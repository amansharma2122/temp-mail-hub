import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import React, { StrictMode } from "react";

// ---------------------------------------------------------------------------
// Mock the api module BEFORE importing the hook so the module-level channel
// registry inside useRealtimeEmails picks up the mock.
// ---------------------------------------------------------------------------
const channelInstances: Array<{
  name: string;
  subscribed: boolean;
  removed: boolean;
}> = [];

vi.mock("@/lib/api", () => {
  const channel = (name: string) => {
    const instance = { name, subscribed: false, removed: false };
    channelInstances.push(instance);
    const api = {
      on: () => api,
      subscribe: (_cb?: (status: string, err?: unknown) => void) => {
        instance.subscribed = true;
        _cb?.("SUBSCRIBED");
        return api;
      },
      unsubscribe: () => {
        instance.removed = true;
      },
    };
    return api;
  };
  return {
    api: {
      realtime: {
        channel,
        removeChannel: (ch: { unsubscribe: () => void }) => ch.unsubscribe(),
      },
    },
  };
});

vi.mock("@/lib/newEmailNotificationStyle", () => ({
  getNewEmailNotificationStyle: async () => "bounce_confetti",
  getNewEmailNotificationStyleSync: () => "bounce_confetti",
  getNewEmailSoundAdminEnabled: async () => true,
  getNewEmailSoundAdminEnabledSync: () => true,
}));

vi.mock("@/lib/realtimeEmailRum", () => ({
  reportRealtimeLatency: vi.fn(),
  reportMissedMessages: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    custom: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

vi.mock("@/components/NewEmailToast", () => ({
  NewEmailToast: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useRealtimeEmails: any;
beforeEach(async () => {
  vi.useFakeTimers();
  channelInstances.length = 0;
  vi.resetModules();
  useRealtimeEmails = (await import("../useRealtimeEmails")).default;
});
afterEach(() => {
  vi.useRealTimers();
});

describe("useRealtimeEmails subscription lifecycle", () => {
  it("opens exactly one channel across a StrictMode double-mount", () => {
    const { unmount } = renderHook(() => useRealtimeEmails({ tempEmailId: "mbx-1" }), {
      wrapper: ({ children }) => <StrictMode>{children}</StrictMode>,
    });
    // StrictMode invokes effect setup twice in dev, but our shared registry
    // must reuse the same channel.
    expect(channelInstances).toHaveLength(1);
    expect(channelInstances[0].subscribed).toBe(true);
    unmount();
    // Teardown is deferred by 250ms to survive remounts.
    vi.advanceTimersByTime(300);
    expect(channelInstances[0].removed).toBe(true);
  });

  it("shares one channel across rapid route switches to the same mailbox", () => {
    const first = renderHook(() => useRealtimeEmails({ tempEmailId: "mbx-2" }));
    const second = renderHook(() => useRealtimeEmails({ tempEmailId: "mbx-2" }));
    expect(channelInstances).toHaveLength(1);
    first.unmount();
    // Deferred teardown must NOT fire while another consumer is still mounted.
    vi.advanceTimersByTime(500);
    expect(channelInstances[0].removed).toBe(false);
    second.unmount();
    vi.advanceTimersByTime(500);
    expect(channelInstances[0].removed).toBe(true);
  });

  it("does not resubscribe when unrelated props change", () => {
    const { rerender } = renderHook(
      ({ onNewEmail }: { onNewEmail: () => void }) =>
        useRealtimeEmails({ tempEmailId: "mbx-3", onNewEmail }),
      { initialProps: { onNewEmail: () => {} } },
    );
    // Rerender many times with a fresh callback — the subscription effect
    // must only depend on tempEmailId, so no new channels should be created.
    for (let i = 0; i < 25; i++) {
      rerender({ onNewEmail: () => i });
    }
    expect(channelInstances).toHaveLength(1);
  });
});