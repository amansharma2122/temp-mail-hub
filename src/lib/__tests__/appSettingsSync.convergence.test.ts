import { describe, it, expect, beforeEach, vi } from "vitest";

// Simulate two tabs racing writes on two different keys and assert both
// tabs converge to the same final in-memory snapshot.

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async () => ({ data: { value: {}, version: 1, merged: true }, error: null }));
  const from = () => ({ insert: async () => ({ error: null }) });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import {
  broadcastAppSettingsChange,
  subscribeAllAppSettings,
  getLastObservedAppSettings,
} from "@/lib/appSettingsSync";

describe("appSettingsSync convergence", () => {
  beforeEach(() => {
    // best-effort reset — new listeners only
  });

  it("two tabs writing different keys converge to the same snapshot", async () => {
    const seenTabA: Record<string, number | null> = {};
    const seenTabB: Record<string, number | null> = {};

    const offA = subscribeAllAppSettings((key, change) => {
      seenTabA[key] = change?.version ?? null;
    });
    const offB = subscribeAllAppSettings((key, change) => {
      seenTabB[key] = change?.version ?? null;
    });

    // Tab A edits friendly_sites_widget, Tab B edits banner at roughly the
    // same time — broadcast synchronously to simulate co-arrival.
    broadcastAppSettingsChange("friendly_sites_widget", 7);
    broadcastAppSettingsChange("banner", 3);

    // Both tabs must observe both keys with the same versions.
    expect(seenTabA).toEqual({ friendly_sites_widget: 7, banner: 3 });
    expect(seenTabB).toEqual({ friendly_sites_widget: 7, banner: 3 });

    // The shared observation store agrees too.
    const snap = new Map(getLastObservedAppSettings().map((c) => [c.key, c.version]));
    expect(snap.get("friendly_sites_widget")).toBe(7);
    expect(snap.get("banner")).toBe(3);

    offA();
    offB();
  });
});