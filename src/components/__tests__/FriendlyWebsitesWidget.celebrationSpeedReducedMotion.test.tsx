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
  prefersReducedMotion: () => true, // FORCE reduced-motion for every case
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";

function base(speed: "slower" | "normal" | "faster") {
  return {
    enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
    showOnMobile: true, colorScheme: "primary", size: "medium",
    position: "right", animationType: "slide", attentionEffect: "glow",
    buttonLabel: "Partner", tooltipText: "Explore",
    showBadge: false, triggerIcon: "Sparkles",
    autoOpenDelayMs: 0, showLabelOnTrigger: false,
    animationIntensity: "normal", disableEffectsOnReducedMotion: true,
    reducedMotionMode: "respect_user",
    celebrationEnabled: true, celebrationLabel: "Go", celebrationEffect: "confetti",
    celebrationIntensity: "normal", celebrationDurationMs: 4200,
    celebrationParticleCount: 0, celebrationSoundEnabled: false,
    celebrationSpeed: speed,
  };
}

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

async function openAndBurst(root: HTMLElement) {
  const t = await waitFor(() => {
    const el = root.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
    if (!el) throw new Error("no trigger"); return el;
  });
  fireEvent.click(t);
  const c = await waitFor(() => {
    const el = root.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
    if (!el) throw new Error("no celebrate"); return el;
  });
  fireEvent.click(c);
  return await waitFor(() => {
    const el = root.querySelector('[data-testid="friendly-widget-click-burst"]') as HTMLElement | null;
    if (!el) throw new Error("no burst"); return el;
  });
}

describe("Reduced-motion always downgrades ClickBurst — regardless of celebration speed", () => {
  beforeEach(() => cleanup());
  afterEach(() => cleanup());

  for (const speed of ["slower", "normal", "faster"] as const) {
    it(`speed='${speed}' — still renders minimal RM overlay (≤6 particles, ~900ms)`, async () => {
      persistedSettings = base(speed);
      const { container } = mount();
      const burst = await openAndBurst(container);
      expect(burst.getAttribute("data-reduced-motion")).toBe("true");
      expect(burst.querySelectorAll("span").length).toBeLessThanOrEqual(6);
      // Reduced-motion overrides speed multiplier — overlay fixed at 900ms.
      expect(Number(burst.getAttribute("data-overlay-ms"))).toBe(900);
    });
  }
});