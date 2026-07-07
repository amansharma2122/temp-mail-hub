import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

let currentSettings: any = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true };

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
 * End-to-end guard: when `friendly_sites_widget.enabled === true`, the widget
 * must render exactly ONE root trigger — regardless of remounts or provider
 * churn. Regressions elsewhere have caused duplicate portals or double-mounts;
 * this test locks that down.
 */
describe("FriendlyWebsitesWidget renders once when enabled", () => {
  beforeEach(() => {
    currentSettings = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true };
  });

  it("mounts a single trigger button and no duplicates", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { container } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <FriendlyWebsitesWidget />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll("button").length).toBeGreaterThanOrEqual(1);
    });

    // Only one trigger with the accessible partner-sites name should exist.
    const triggers = Array.from(container.querySelectorAll("button")).filter((b) =>
      /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    expect(triggers.length).toBe(1);
  });

  it("stays unique across a second mount in the same tree", async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
    const { container, rerender } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <FriendlyWebsitesWidget />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector("button")).toBeTruthy());

    rerender(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <FriendlyWebsitesWidget />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const triggers = Array.from(container.querySelectorAll("button")).filter((b) =>
      /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    expect(triggers.length).toBe(1);
  });
});