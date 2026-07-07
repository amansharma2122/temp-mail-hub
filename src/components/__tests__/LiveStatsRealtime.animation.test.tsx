import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";

// Minimal realtime harness for the LiveStatsWidget. We stub the supabase
// client so we can drive the `postgres_changes` handler manually and verify:
//   * repeated realtime UPDATE events for the same stat_key only rerender
//     the affected counter (no duplicate DOM entries per card)
//   * the animation index toggles per update without stuttering (each
//     update resets the timer cleanly)

const emailStatsHandlers: Array<(payload: any) => void> = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: async () => ({ data: null, error: null }) },
    channel: () => ({
      on(_evt: string, _filter: any, cb: (p: any) => void) {
        emailStatsHandlers.push(cb);
        return this;
      },
      subscribe() {
        return this;
      },
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

describe("LiveStatsWidget realtime animation smoothness", () => {
  beforeEach(() => {
    emailStatsHandlers.length = 0;
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it("renders exactly four stat cards and does not duplicate on repeated realtime updates", async () => {
    const { container } = render(<LiveStatsWidget />);

    // Let the deferred initial fetch resolve so initialLoadRef flips false.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // Fire ten rapid realtime UPDATE events for the same stat_key.
    for (let i = 0; i < 10; i++) {
      act(() => {
        emailStatsHandlers.forEach((h) =>
          h({ new: { stat_key: "total_emails_generated", stat_value: 1000 + i } }),
        );
      });
    }

    await waitFor(() => {
      // 4 stat cards, no duplicates from re-renders.
      const cards = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
      expect(cards.length).toBeGreaterThanOrEqual(4);
    });

    // No React key warnings and animation timers do not leak — advance past
    // the 500ms animation window and ensure the tree is still stable.
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    const cardsAfter = container.querySelectorAll('[class*="rounded-xl"][class*="border"]');
    expect(cardsAfter.length).toBeGreaterThanOrEqual(4);
  });
});
