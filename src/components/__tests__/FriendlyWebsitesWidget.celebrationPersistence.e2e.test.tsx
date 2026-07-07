import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

let persistedSettings: any;

const FAKE_WEBSITES = [{
  id: "w1", name: "Partner", url: "https://partner.example",
  icon_url: null, icon_name: "Sparkles", description: null,
  display_order: 0, is_active: true, open_in_new_tab: true,
  attention_effect: null, badge_enabled: false, badge_text: null,
  auto_open_override: null, max_badge_per_day: 0,
}];

vi.mock("@/integrations/supabase/client", () => {
  function fromApi(table: string) {
    const b: any = {
      _r: async () => table === "friendly_websites"
        ? { data: FAKE_WEBSITES, error: null }
        : { data: { value: persistedSettings }, error: null },
      select() { return b; }, eq() { return b; }, order() { return b; },
      limit() { return b._r(); }, maybeSingle: async () => b._r(),
      then(res: any, rej: any) { return b._r().then(res, rej); },
    };
    return b;
  }
  return { supabase: {
    from: fromApi,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
    auth: {
      getUser: async () => ({ data: { user: null } }),
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  } };
});
vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <FriendlyWebsitesWidget />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

describe("Celebration button — persistence across reload & theme", () => {
  beforeEach(() => {
    cleanup();
    persistedSettings = {
      enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
      showOnMobile: true, colorScheme: "primary", size: "medium",
      position: "right", animationType: "slide", attentionEffect: "glow",
      buttonLabel: "Partner Sites", tooltipText: "Explore",
      showBadge: false, triggerIcon: "Sparkles",
      autoOpenDelayMs: 0, showLabelOnTrigger: true,
      animationIntensity: "subtle", disableEffectsOnReducedMotion: true,
      reducedMotionMode: "respect_user",
      celebrationEnabled: true,
      celebrationLabel: "Party Time 🎊",
      celebrationEffect: "fireworks",
    };
  });
  afterEach(() => cleanup());

  const openAndAssertCelebration = async (root: HTMLElement) => {
    const trigger = await waitFor(() => {
      const t = root.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
      if (!t) throw new Error("trigger missing");
      return t;
    });
    fireEvent.click(trigger);
    const btn = await waitFor(() => {
      const c = root.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
      if (!c) throw new Error("celebrate missing");
      return c;
    });
    // Persisted label round-trips exactly.
    expect(btn.textContent).toMatch(/party time/i);
    expect(btn.getAttribute("aria-label")).toMatch(/party time/i);
  };

  it("persists label + effect + enabled across a simulated reload (light theme)", async () => {
    document.documentElement.classList.remove("dark");
    const { container, unmount } = mount();
    await openAndAssertCelebration(container);
    unmount();

    const { container: c2 } = mount();
    await openAndAssertCelebration(c2);
  });

  it("persists identically after theme flips to dark", async () => {
    document.documentElement.classList.add("dark");
    const { container } = mount();
    await openAndAssertCelebration(container);
    document.documentElement.classList.remove("dark");
  });

  it("celebration disabled flag persists — button not rendered", async () => {
    persistedSettings.celebrationEnabled = false;
    const { container } = mount();
    const trigger = await waitFor(() => {
      const t = container.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
      if (!t) throw new Error("trigger missing");
      return t;
    });
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(container.querySelector('[data-testid="friendly-widget-celebrate"]')).toBeNull();
    });
  });
});