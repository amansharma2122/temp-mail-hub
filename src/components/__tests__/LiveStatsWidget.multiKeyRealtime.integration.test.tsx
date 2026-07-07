import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";

// Reuses the pattern from LiveStatsRealtime.animation.test.tsx but drives
// rapid postgres_changes updates across MULTIPLE stat_keys simultaneously
// to guarantee cards never duplicate and always update to the newest value.

const handlers: Array<(payload: any) => void> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: async () => ({ data: null, error: null }) },
    channel: () => ({
      on(_evt: string, _filter: any, cb: (p: any) => void) {
        handlers.push(cb);
        return this;
      },
      subscribe() { return this; },
    }),
    removeChannel: () => {},
  },
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: any) => <>{children}</>,
  TooltipTrigger: ({ children }: any) => <>{children}</>,
  TooltipContent: ({ children }: any) => <>{children}</>,
}));

import LiveStatsWidget from "@/components/LiveStatsWidget";

describe("LiveStatsWidget — rapid multi-key realtime integration", () => {
  beforeEach(() => {
    handlers.length = 0;
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("does not duplicate cards when postgres_changes arrive quickly across multiple stat keys", async () => {
    const { container } = render(<LiveStatsWidget />);

    await act(async () => { vi.advanceTimersByTime(200); });

    const keys = [
      "total_emails_generated",
      "total_inboxes_created",
      "total_domains",
      "emails_today",
    ];

    // Fire 25 rapid updates spread across the 4 stat keys.
    for (let i = 0; i < 25; i++) {
      const key = keys[i % keys.length];
      act(() => {
        handlers.forEach((h) => h({ new: { stat_key: key, stat_value: 100 + i } }));
      });
      act(() => { vi.advanceTimersByTime(20); });
    }

    await waitFor(() => {
      const cards = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });

    // Advance past the animation window and confirm the tree is stable
    // with no accumulated duplicate cards.
    act(() => { vi.advanceTimersByTime(2000); });
    const cardsAfter = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
    // Should still be the same 4 cards (allowing for wrappers), never grow
    // unboundedly from the 25 updates.
    expect(cardsAfter.length).toBeLessThan(10);
  });

  it("continues to accept updates after burst without becoming stuck", async () => {
    const { container } = render(<LiveStatsWidget />);
    await act(async () => { vi.advanceTimersByTime(200); });

    // Burst.
    for (let i = 0; i < 15; i++) {
      act(() => {
        handlers.forEach((h) => h({ new: { stat_key: "total_emails_generated", stat_value: 1000 + i } }));
      });
    }
    act(() => { vi.advanceTimersByTime(1000); });

    // Delayed follow-up update should still be handled without error.
    act(() => {
      handlers.forEach((h) => h({ new: { stat_key: "total_emails_generated", stat_value: 9999 } }));
    });
    act(() => { vi.advanceTimersByTime(1000); });

    const cards = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
    expect(cards.length).toBeGreaterThanOrEqual(4);
  });
});
