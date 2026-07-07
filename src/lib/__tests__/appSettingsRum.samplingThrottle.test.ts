import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Confirms the RUM pipeline honours its sample-rate + per-key throttle
// configuration and that each recorded sample carries the correct version
// + convergence timing (latency = observedAt - emittedAt).

vi.mock("@/integrations/supabase/client", () => {
  const from = () => ({ insert: async () => ({ error: null }) });
  return { supabase: { from } };
});

import {
  configureAppSettingsRum,
  reportAppSettingsLatency,
  __appSettingsRumInternals,
} from "@/lib/appSettingsRum";

describe("appSettingsRum sampling + throttle", () => {
  const { BUFFER, lastSampledAt } = __appSettingsRumInternals();

  beforeEach(() => {
    BUFFER.length = 0;
    lastSampledAt.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    configureAppSettingsRum({ sampleRate: 0.25, throttleMs: 2000 });
  });

  it("captures every sample when sampleRate=1 and throttle=0", () => {
    configureAppSettingsRum({ sampleRate: 1, throttleMs: 0 });
    // Force Math.random into the "keep" zone regardless of sampleRate.
    vi.spyOn(Math, "random").mockReturnValue(0);
    const t0 = Date.now() - 42;
    reportAppSettingsLatency("friendly_sites_widget", t0, 7);
    reportAppSettingsLatency("friendly_sites_widget", t0, 8);
    expect(BUFFER.length).toBe(2);
    expect(BUFFER[0].key).toBe("friendly_sites_widget");
    expect(BUFFER[0].version).toBe(7);
    expect(BUFFER[0].latency_ms).toBeGreaterThanOrEqual(42);
  });

  it("drops samples above the per-key throttle window", () => {
    configureAppSettingsRum({ sampleRate: 1, throttleMs: 60_000 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    reportAppSettingsLatency("banner", Date.now(), 1);
    reportAppSettingsLatency("banner", Date.now(), 2); // throttled
    reportAppSettingsLatency("banner", Date.now(), 3); // throttled
    expect(BUFFER.length).toBe(1);
    expect(BUFFER[0].version).toBe(1);
  });

  it("keeps different keys independent under throttling", () => {
    configureAppSettingsRum({ sampleRate: 1, throttleMs: 60_000 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    reportAppSettingsLatency("banner", Date.now(), 1);
    reportAppSettingsLatency("friendly_sites_widget", Date.now(), 2);
    expect(BUFFER.map((b) => b.key).sort()).toEqual([
      "banner",
      "friendly_sites_widget",
    ]);
  });

  it("drops samples when sampleRate=0 (nothing is recorded)", () => {
    configureAppSettingsRum({ sampleRate: 0, throttleMs: 0 });
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    reportAppSettingsLatency("banner", Date.now(), 1);
    reportAppSettingsLatency("banner", Date.now() - 1000, 2);
    expect(BUFFER.length).toBe(0);
  });

  it("records monotonic convergence timing per emit", () => {
    configureAppSettingsRum({ sampleRate: 1, throttleMs: 0 });
    vi.spyOn(Math, "random").mockReturnValue(0);
    const now = Date.now();
    reportAppSettingsLatency("k", now - 10, 1);
    reportAppSettingsLatency("k", now - 100, 2);
    expect(BUFFER[0].latency_ms).toBeLessThanOrEqual(BUFFER[1].latency_ms);
    expect(BUFFER[1].version).toBe(2);
  });
});