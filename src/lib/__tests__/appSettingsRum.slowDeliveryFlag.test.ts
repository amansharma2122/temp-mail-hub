import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
}));

import {
  APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS,
  reportAppSettingsToastEvent,
  __appSettingsRumInternals,
} from "@/lib/appSettingsRum";

describe("reportAppSettingsToastEvent slow-delivery flag", () => {
  const { BUFFER } = __appSettingsRumInternals();

  beforeEach(() => {
    BUFFER.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-07T12:00:00.000Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("does NOT flag deliveries at or below the 5000ms threshold", () => {
    reportAppSettingsToastEvent({
      key: "banner",
      remote: true,
      version: 1,
      delay_ms: APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS,
    });
    expect(BUFFER[0].delay_threshold_ms).toBe(5000);
    expect(BUFFER[0].delay_exceeded_threshold).toBe(false);
  });

  it("flags deliveries above 5000ms so slow updates are easy to investigate", () => {
    reportAppSettingsToastEvent({
      key: "banner",
      remote: true,
      version: 2,
      delay_ms: 12_345,
    });
    expect(BUFFER[0]).toMatchObject({
      event_type: "app_settings_toast",
      delay_ms: 12_345,
      toast_visible_delay_ms: 12_345,
      delay_threshold_ms: 5000,
      delay_exceeded_threshold: true,
    });
  });
});
