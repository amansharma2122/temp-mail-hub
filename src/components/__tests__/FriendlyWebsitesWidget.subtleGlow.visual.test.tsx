import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

let currentSettings: any = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  attentionEffect: "glow",
  animationIntensity: "subtle",
  showOnMobile: true,
};

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
  prefersReducedMotion: () => false,
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";

/**
 * Visual-regression guard: the default gentle "glow" effect at "subtle"
 * intensity must NOT apply Tailwind's `animate-pulse` or any pulsing
 * looping animation class, in either light or dark mode, across common
 * breakpoints. Prevents the widget from becoming visually painful again.
 */
describe("FriendlyWebsitesWidget — subtle glow visual guard", () => {
  const breakpoints = [
    { name: "mobile",  w: 375,  h: 812 },
    { name: "tablet",  w: 768,  h: 1024 },
    { name: "desktop", w: 1440, h: 900 },
  ];

  beforeEach(() => {
    currentSettings = {
      enabled: true,
      visibleToPublic: true,
      visibleToLoggedIn: true,
      attentionEffect: "glow",
      animationIntensity: "subtle",
      showOnMobile: true,
    };
  });

  for (const theme of ["light", "dark"] as const) {
    for (const bp of breakpoints) {
      it(`does not apply animate-pulse in ${theme} @ ${bp.name}`, async () => {
        Object.defineProperty(window, "innerWidth", { value: bp.w, configurable: true });
        Object.defineProperty(window, "innerHeight", { value: bp.h, configurable: true });
        document.documentElement.classList.toggle("dark", theme === "dark");

        const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
        const { container } = render(
          <QueryClientProvider client={qc}>
            <TooltipProvider>
              <FriendlyWebsitesWidget />
            </TooltipProvider>
          </QueryClientProvider>,
        );

        await waitFor(() => {
          expect(container.querySelector("button")).toBeTruthy();
        });

        // The rendered trigger and any descendant must be free of the
        // pulsing class regardless of theme / breakpoint.
        const pulsing = container.querySelectorAll(".animate-pulse");
        expect(pulsing.length).toBe(0);

        // Sanity: still exactly one trigger.
        const triggers = Array.from(container.querySelectorAll("button")).filter((b) =>
          /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
        );
        expect(triggers.length).toBe(1);
      });
    }
  }
});
