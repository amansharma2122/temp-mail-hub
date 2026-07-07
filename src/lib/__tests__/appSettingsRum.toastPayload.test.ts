import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: async () => ({ error: null }) }) },
}));

import {
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

  it("includes key label, version, remote/local status, and receipt-to-toast-visible delay", () => {
    reportAppSettingsToastEvent({
      key: "friendly_sites_widget",
      remote: true,
      version: 42,
      delay_ms: 17,
      toast_visible_delay_ms: 123,
    });

    expect(BUFFER[0]).toEqual({
      event_type: "app_settings_toast",
      key: "friendly_sites_widget",
      key_label: "Friendly sites widget",
      version: 42,
      remote: true,
      delay_ms: 123,
      toast_visible_delay_ms: 123,
      latency_ms: 123,
      observed_at: "2026-07-07T12:00:00.000Z",
    });

    reportAppSettingsToastEvent({
      key: "banner",
      remote: false,
      version: 7,
      delay_ms: 9,
    });

    expect(BUFFER[1]).toMatchObject({
      event_type: "app_settings_toast",
      key: "banner",
      key_label: "Banners",
      version: 7,
      remote: false,
      delay_ms: 9,
      toast_visible_delay_ms: 9,
      latency_ms: 9,
    });
  });
});