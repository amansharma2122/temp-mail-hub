import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
}));

import {
  APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS,
  reportAppSettingsToastEvent,
  __appSettingsRumInternals,
} from "@/lib/appSettingsRum";

describe("reportAppSettingsToastEvent payload", () => {
  const { BUFFER } = __appSettingsRumInternals();

  beforeEach(() => {
    BUFFER.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches the exact remote payload shape including key label, version, status, and delay", () => {
    reportAppSettingsToastEvent({
      key: "friendly_sites_widget",
      remote: true,
      version: 42,
      delay_ms: 17,
      toast_visible_delay_ms: 123,
    });

    expect(BUFFER[0]).toMatchInlineSnapshot(`
      {
        "delay_exceeded_threshold": false,
        "delay_ms": 123,
        "delay_threshold_ms": 5000,
        "event_type": "app_settings_toast",
        "key": "friendly_sites_widget",
        "key_label": "Friendly sites widget",
        "latency_ms": 123,
        "observed_at": "2026-07-07T12:00:00.000Z",
        "remote": true,
        "toast_visible_delay_ms": 123,
        "version": 42,
      }
    `);
  });

  it("matches the exact local payload shape and flags delays above the threshold", () => {
    const slowDelay = APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS + 1;

    reportAppSettingsToastEvent({
      key: "banner",
      remote: false,
      version: 7,
      delay_ms: slowDelay,
    });

    expect(BUFFER[0]).toMatchInlineSnapshot(`
      {
        "delay_exceeded_threshold": true,
        "delay_ms": 5001,
        "delay_threshold_ms": 5000,
        "event_type": "app_settings_toast",
        "key": "banner",
        "key_label": "Banners",
        "latency_ms": 5001,
        "observed_at": "2026-07-07T12:00:00.000Z",
        "remote": false,
        "toast_visible_delay_ms": 5001,
        "version": 7,
      }
    `);
  });
});