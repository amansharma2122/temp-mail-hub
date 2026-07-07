import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

const recordSpy = vi.fn();

const FAKE_WEBSITES = [{
  id: "w1", name: "Partner", url: "https://partner.example",
  icon_url: null, icon_name: "Sparkles", description: null,
  display_order: 0, is_active: true, open_in_new_tab: true,
  attention_effect: null, badge_enabled: false, badge_text: null,
  auto_open_override: null, max_badge_per_day: 0,
}];

const settingsValue = {
  enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
  showOnMobile: true, colorScheme: "primary", size: "medium",
  position: "right", animationType: "slide", attentionEffect: "glow",
  buttonLabel: "Partner", tooltipText: "Explore",
  showBadge: false, triggerIcon: "Sparkles",
  autoOpenDelayMs: 0, showLabelOnTrigger: false,
  animationIntensity: "subtle", disableEffectsOnReducedMotion: true,
  reducedMotionMode: "respect_user",
  celebrationEnabled: true, celebrationLabel: "Go", celebrationEffect: "confetti",
  celebrationIntensity: "normal", celebrationDurationMs: 4200,
  celebrationParticleCount: 0, celebrationSoundEnabled: false,
};

vi.mock("@/integrations/supabase/client", () => {
  function fromApi(table: string) {
    const b: any = {
      _r: async () => table === "friendly_websites"
        ? { data: FAKE_WEBSITES, error: null }
        : { data: { value: settingsValue }, error: null },
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
  recordFriendlyWidgetEvent: (...args: unknown[]) => recordSpy(...args),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => true, // force reduced-motion
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

describe("Celebration button — reduced-motion behavior", () => {
  beforeEach(() => { cleanup(); recordSpy.mockClear(); });
  afterEach(() => cleanup());

  it("still fires celebrate_click and renders minimal overlay in reduced-motion", async () => {
    const { container } = mount();
    const trigger = await waitFor(() => {
      const t = container.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
      if (!t) throw new Error("trigger missing");
      return t;
    });
    fireEvent.click(trigger);
    const btn = await waitFor(() => {
      const c = container.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
      if (!c) throw new Error("celebrate button missing");
      return c;
    });
    recordSpy.mockClear();
    fireEvent.click(btn);

    // Analytics fires regardless of motion prefs.
    await waitFor(() => {
      const calls = recordSpy.mock.calls.map(c => c[0]);
      expect(calls).toContain("celebrate_click");
    });

    // Overlay renders but flagged as reduced-motion (minimal shower).
    const overlay = await waitFor(() => {
      const el = document.querySelector('[data-testid="friendly-widget-click-burst"]');
      if (!el) throw new Error("overlay missing");
      return el;
    });
    expect(overlay.getAttribute("data-reduced-motion")).toBe("true");
    // Minimal particle count (<= 6) — bounded by RM cap in ClickBurst.
    expect(overlay.querySelectorAll("span").length).toBeLessThanOrEqual(6);
  });
});
