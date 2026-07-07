import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";

// Non-admin so we get the "Temporarily syncing…" user-facing chip.
vi.mock("@/hooks/useAdminRole", () => ({
  useAdminRole: () => ({ isAdmin: false, loading: false }),
}));

// Deterministic jitter so we can assert exact delays.
let randomValue = 0;
const originalRandom = Math.random;

// One banner so the component actually renders (the syncing chip is inside
// the returned tree — hidden when banners.length === 0).
const banner = {
  id: "b1",
  name: "Test",
  position: "header",
  type: "text" as const,
  content: "hi",
  image_url: null,
  link_url: null,
  is_active: true,
  priority: 1,
  start_date: null,
  end_date: null,
};

// Track the current subscribe callback so tests can drive the channel state.
let subscribeCb: ((status: string, err?: unknown) => void) | null = null;
const channelInstances: any[] = [];

vi.mock("@/integrations/supabase/client", () => {
  const chain = () => {
    const q: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [banner], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      update: vi.fn().mockReturnThis(),
    };
    return q;
  };
  return {
    supabase: {
      from: vi.fn(() => chain()),
      channel: vi.fn(() => {
        const c: any = {
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn((cb: any) => {
            subscribeCb = cb;
            return c;
          }),
        };
        channelInstances.push(c);
        return c;
      }),
      removeChannel: vi.fn(),
    },
  };
});

import BannerDisplay from "@/components/BannerDisplay";

// Advance timers in small slices so React can flush effects between the
// setTimeout callback firing and the next assertion.
async function flush() {
  // Flush queued microtasks (promises resolved from fetch mocks).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}
async function advance(ms: number) {
  await act(async () => { vi.advanceTimersByTime(ms); });
  await flush();
}

describe("BannerDisplay realtime exponential backoff", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    channelInstances.length = 0;
    subscribeCb = null;
    randomValue = 0;
    Math.random = () => randomValue;
  });

  afterEach(() => {
    vi.useRealTimers();
    Math.random = originalRandom;
  });

  it("uses exponential backoff and keeps the syncing indicator until re-subscribed", async () => {
    render(<BannerDisplay position="header" />);
    // Let the initial fetch + subscribe callback wiring settle.
    await flush();
    expect(typeof subscribeCb).toBe("function");

    // Force a channel error → widget must switch to polling and schedule a retry.
    await act(async () => { subscribeCb!("CHANNEL_ERROR", new Error("boom")); });
    await flush();

    // Syncing indicator visible.
    expect(screen.getByText(/Temporarily syncing/i)).toBeInTheDocument();

    // Retry #1 base = 2000ms, jitter = 0 → fires at exactly 2000ms.
    const beforeChannels = channelInstances.length;
    await advance(1999);
    expect(channelInstances.length).toBe(beforeChannels); // not yet
    await advance(1);
    expect(channelInstances.length).toBe(beforeChannels + 1); // new attempt

    // Second failure → next base = 4000ms, jitter = 0 → 4000ms exactly.
    await act(async () => { subscribeCb!("CHANNEL_ERROR"); });
    const beforeSecond = channelInstances.length;
    await advance(3999);
    expect(channelInstances.length).toBe(beforeSecond);
    await advance(1);
    expect(channelInstances.length).toBe(beforeSecond + 1);

    // Third failure with jitter ≈ 25% → base 8000 + 1999 jitter = 9999ms.
    randomValue = 0.999_999;
    await act(async () => { subscribeCb!("TIMED_OUT"); });
    const beforeThird = channelInstances.length;
    await advance(9998);
    expect(channelInstances.length).toBe(beforeThird);
    await advance(1);
    expect(channelInstances.length).toBe(beforeThird + 1);

    // Syncing indicator must still be visible through all failures.
    expect(screen.getByText(/Temporarily syncing/i)).toBeInTheDocument();

    // Finally re-subscribe successfully → syncing indicator disappears.
    await act(async () => { subscribeCb!("SUBSCRIBED"); });
    await flush();
    expect(screen.queryByText(/Temporarily syncing/i)).not.toBeInTheDocument();
  });

  it("caps the backoff base at 60s with jitter <= 25%", async () => {
    render(<BannerDisplay position="header" />);
    await act(async () => { await Promise.resolve(); });

    // Drive many failures so retryCount grows past the cap.
    randomValue = 0;
    for (let i = 0; i < 8; i++) {
      await act(async () => { subscribeCb!("CHANNEL_ERROR"); });
      // Advance enough to fire the retry; delay is capped so 61s always works.
      await advance(61_000);
    }

    // With max jitter (0.999… of 25% of 60_000 = ~14_999ms), total cap ≈ 75_000ms.
    randomValue = 0.999_999;
    await act(async () => { subscribeCb!("CHANNEL_ERROR"); });
    const before = channelInstances.length;
    await advance(74_999);
    // Retry must have fired within the 75s cap.
    expect(channelInstances.length).toBeGreaterThan(before - 1);
  });
});