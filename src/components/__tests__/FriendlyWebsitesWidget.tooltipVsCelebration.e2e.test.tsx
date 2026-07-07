import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));
vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "app_settings") return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { value: {
          enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
          showOnMobile: true, position: "right", colorScheme: "primary",
          size: "medium", animationType: "slide", attentionEffect: "none",
          buttonLabel: "Partner Sites", tooltipText: "Explore",
          triggerIcon: "Sparkles", autoOpenDelayMs: 0,
          showLabelOnTrigger: true, animationIntensity: "subtle",
          disableEffectsOnReducedMotion: true, reducedMotionMode: "never",
          celebrationEnabled: true, celebrationLabel: "Click Me 🎉",
          celebrationEffect: "confetti",
        } }, error: null,
      }) }) }),
    };
    return { select: () => ({ eq: () => ({ order: async () => ({
      data: [{ id: "s1", name: "S1", url: "https://s1.example",
        icon_url: null, icon_name: "Star", description: "",
        display_order: 0, is_active: true, open_in_new_tab: true,
        attention_effect: null, badge_enabled: false, badge_text: null,
        auto_open_override: null, max_badge_per_day: 0 }], error: null,
    }) }) }) };
  };
  return { supabase: { from,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  } };
});

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";

const renderAt = (width: number) => {
  Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: width });
  window.dispatchEvent(new Event("resize"));
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <FriendlyWebsitesWidget />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

describe("Tooltip open + outside click does not interfere with celebration overlay", () => {
  beforeEach(() => cleanup());

  it.each([
    ["mobile", 375],
    ["desktop", 1280],
  ])("celebration burst remains after opening tooltip & clicking outside (%s)", async (_n, width) => {
    const { container } = renderAt(width);
    const trigger = await waitFor(() => {
      const t = container.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
      if (!t) throw new Error("no trigger");
      return t;
    });

    // Hover trigger — invokes the wrapped TooltipTrigger without opening panel.
    fireEvent.pointerEnter(trigger);
    fireEvent.focus(trigger);

    // Now open panel and fire celebration.
    fireEvent.click(trigger);
    const celebrate = await waitFor(() => {
      const c = container.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
      if (!c) throw new Error("no celebrate");
      return c;
    });
    fireEvent.click(celebrate);

    const burst = await waitFor(() => {
      // A trigger-click burst may still be exiting; the last one mounted is
      // the celebration overlay.
      const els = document.querySelectorAll('[data-testid="friendly-widget-click-burst"]');
      const el = els[els.length - 1] as HTMLElement | undefined;
      if (!el || el.getAttribute("data-variant") !== "confetti") {
        throw new Error("celebration burst not mounted yet");
      }
      return el;
    });
    expect(burst.getAttribute("data-variant")).toBe("confetti");

    // Simulate an "outside" click on the document body and closing the panel.
    // The celebration overlay is pointer-events:none and must NOT be removed
    // by these interactions — it lives independent of the panel/tooltip.
    fireEvent.pointerDown(document.body);
    fireEvent.mouseDown(document.body);
    const closeBtn = container.querySelector('button[aria-label="Close panel"]') as HTMLButtonElement | null;
    if (closeBtn) fireEvent.click(closeBtn);

    // Burst overlay must still be present in the DOM immediately after.
    expect(document.querySelector('[data-testid="friendly-widget-click-burst"]')).not.toBeNull();
    // Overlay is decorative and must not swallow pointer events.
    expect(burst.className).toMatch(/pointer-events-none/);
  });
});