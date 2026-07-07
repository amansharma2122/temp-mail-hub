import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

let currentSettings: any;

const FAKE_WEBSITES = [
  {
    id: "w1", name: "Partner", url: "https://partner.example",
    icon_url: null, icon_name: "Sparkles", description: null,
    display_order: 0, is_active: true, open_in_new_tab: true,
    attention_effect: null, badge_enabled: false, badge_text: null,
    auto_open_override: null, max_badge_per_day: 0,
  },
];

vi.mock("@/integrations/supabase/client", () => {
  function fromApi(table: string) {
    const builder: any = {
      _resolve: async () =>
        table === "friendly_websites"
          ? { data: FAKE_WEBSITES, error: null }
          : { data: { value: currentSettings }, error: null },
      select() { return builder; },
      eq() { return builder; },
      order() { return builder; },
      limit() { return builder._resolve(); },
      maybeSingle: async () => builder._resolve(),
      then(res: any, rej: any) { return builder._resolve().then(res, rej); },
    };
    return builder;
  }
  return { supabase: {
    from: fromApi,
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
    auth: {
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
  // Emulate OS preference OFF; the admin `reducedMotionMode` policy must
  // still be the source of truth for these tests.
  prefersReducedMotion: () => false,
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";

function mount() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <FriendlyWebsitesWidget />
      </TooltipProvider>
    </QueryClientProvider>,
  );
}

function trigger(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
  );
}

// Matches any animated attention class the widget can emit — pulse, wiggle,
// bounce, sparkle, confetti, ripple, rainbow, magnet. A reduced-motion
// policy of `always_on` must strip all of these.
const ANIMATED_ATTENTION_RE = /animate-(pulse|bounce|\[wiggle|\[fw-sparkle|\[fw-confetti|\[fw-ripple|\[fw-rainbow|\[fw-magnet)/;

describe("FriendlyWebsitesWidget — reducedMotionMode disables attention animations", () => {
  const breakpoints = [
    { name: "mobile",  w: 375,  h: 812 },
    { name: "tablet",  w: 768,  h: 1024 },
    { name: "desktop", w: 1440, h: 900 },
  ];
  // Every animation-producing attention effect the widget supports.
  const animatedEffects = ["pulse", "wiggle", "bounce", "sparkle", "confetti", "ripple", "rainbow", "magnet"] as const;

  beforeEach(() => {
    cleanup();
  });
  afterEach(() => {
    document.documentElement.classList.remove("dark");
  });

  for (const theme of ["light", "dark"] as const) {
    for (const bp of breakpoints) {
      for (const effect of animatedEffects) {
        it(`strips ${effect} animation when reducedMotionMode=always_on (${theme} @ ${bp.name})`, async () => {
          Object.defineProperty(window, "innerWidth", { value: bp.w, configurable: true });
          Object.defineProperty(window, "innerHeight", { value: bp.h, configurable: true });
          document.documentElement.classList.toggle("dark", theme === "dark");
          currentSettings = {
            enabled: true,
            visibleToPublic: true,
            visibleToLoggedIn: true,
            showOnMobile: true,
            attentionEffect: effect,
            animationIntensity: "normal",
            reducedMotionMode: "always_on",
            disableEffectsOnReducedMotion: true,
          };
          const { container } = mount();
          await waitFor(() => expect(trigger(container)).toBeTruthy());
          const t = trigger(container)!;
          expect(t.className).not.toMatch(ANIMATED_ATTENTION_RE);
          // Also no descendant animated attention class inside the trigger.
          const inner = t.querySelectorAll('[class*="animate-"]');
          for (const el of Array.from(inner)) {
            expect(el.className).not.toMatch(ANIMATED_ATTENTION_RE);
          }
        });
      }
    }
  }

  it("respect_user + OS reduce-motion OFF keeps the animated effect (control)", async () => {
    currentSettings = {
      enabled: true,
      visibleToPublic: true,
      visibleToLoggedIn: true,
      showOnMobile: true,
      attentionEffect: "pulse",
      animationIntensity: "normal",
      reducedMotionMode: "respect_user",
      disableEffectsOnReducedMotion: true,
    };
    const { container } = mount();
    await waitFor(() => expect(trigger(container)).toBeTruthy());
    // Since OS reduce-motion is mocked OFF, the animation must be preserved.
    expect(trigger(container)!.className).toMatch(/animate-pulse/);
  });
});
