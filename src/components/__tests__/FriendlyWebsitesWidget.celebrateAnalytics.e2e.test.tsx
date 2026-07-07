import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const recordSpy = vi.fn();

vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: (...args: any[]) => recordSpy(...args),
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
          disableEffectsOnReducedMotion: true, reducedMotionMode: "always_on",
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

describe("Celebration button fires celebrate_click analytics (mobile & desktop)", () => {
  beforeEach(() => { recordSpy.mockClear(); cleanup(); });

  it.each([
    ["mobile", 375],
    ["desktop", 1280],
  ])("emits celebrate_click on %s", async (_n, width) => {
    const { container } = renderAt(width);
    const trigger = await waitFor(() => {
      const t = container.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
      if (!t) throw new Error("no trigger");
      return t;
    });
    fireEvent.click(trigger);

    const celebrate = await waitFor(() => {
      const c = container.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
      if (!c) throw new Error("no celebrate");
      return c;
    });
    recordSpy.mockClear();
    fireEvent.click(celebrate);

    await waitFor(() => {
      const events = recordSpy.mock.calls.map((c) => c[0]);
      expect(events).toContain("celebrate_click");
    });
    const call = recordSpy.mock.calls.find((c) => c[0] === "celebrate_click")!;
    expect(call[1]?.attention_effect).toBe("confetti");
  });
});