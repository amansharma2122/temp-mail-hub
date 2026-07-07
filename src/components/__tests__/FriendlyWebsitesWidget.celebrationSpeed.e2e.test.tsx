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

function base() {
  return {
    enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
    showOnMobile: true, colorScheme: "primary", size: "medium",
    position: "right", animationType: "slide", attentionEffect: "glow",
    buttonLabel: "Partner Sites", tooltipText: "Explore",
    showBadge: false, triggerIcon: "Sparkles",
    autoOpenDelayMs: 0, showLabelOnTrigger: true,
    animationIntensity: "normal", disableEffectsOnReducedMotion: true,
    reducedMotionMode: "respect_user",
    celebrationEnabled: true,
    celebrationLabel: "Party",
    celebrationEffect: "confetti",
    celebrationIntensity: "normal",
    celebrationDurationMs: 4200,
    celebrationParticleCount: 0,
    celebrationSpeed: "normal" as "slower" | "normal" | "faster",
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

async function openAndFire(root: HTMLElement) {
  const trigger = await waitFor(() => {
    const t = root.querySelector('[data-testid="friendly-widget-trigger"]') as HTMLButtonElement | null;
    if (!t) throw new Error("no trigger");
    return t;
  });
  fireEvent.click(trigger);
  const celebrate = await waitFor(() => {
    const c = root.querySelector('[data-testid="friendly-widget-celebrate"]') as HTMLButtonElement | null;
    if (!c) throw new Error("no celebrate btn");
    return c;
  });
  fireEvent.click(celebrate);
  return await waitFor(() => {
    const b = root.querySelector('[data-testid="friendly-widget-click-burst"]') as HTMLElement | null;
    if (!b) throw new Error("no burst");
    return b;
  });
}

describe("Celebration speed — persistence + effect on animation", () => {
  beforeEach(() => { cleanup(); persistedSettings = base(); });
  afterEach(() => cleanup());

  it("persists the speed value across a simulated reload", async () => {
    persistedSettings.celebrationSpeed = "slower";
    const { container, unmount } = mount();
    const burst = await openAndFire(container);
    expect(burst.getAttribute("data-speed")).toBe("slower");
    unmount();
    const { container: c2 } = mount();
    const burst2 = await openAndFire(c2);
    expect(burst2.getAttribute("data-speed")).toBe("slower");
  });

  it("slower yields a longer overlay than faster (verifies it affects the animation)", async () => {
    persistedSettings = { ...base(), celebrationSpeed: "slower" };
    const { container: cSlow, unmount: u1 } = mount();
    const slow = await openAndFire(cSlow);
    const slowMs = Number(slow.getAttribute("data-overlay-ms"));
    u1();

    persistedSettings = { ...base(), celebrationSpeed: "faster" };
    const { container: cFast, unmount: u2 } = mount();
    const fast = await openAndFire(cFast);
    const fastMs = Number(fast.getAttribute("data-overlay-ms"));
    u2();

    expect(slowMs).toBeGreaterThan(fastMs);
    expect(slowMs).toBeGreaterThanOrEqual(5000);
    expect(fastMs).toBeLessThanOrEqual(3200);
  });

  it("defaults to 'normal' when the setting is absent from persisted row", async () => {
    persistedSettings = base();
    delete (persistedSettings as any).celebrationSpeed;
    const { container } = mount();
    const burst = await openAndFire(container);
    expect(burst.getAttribute("data-speed")).toBe("normal");
  });
});
