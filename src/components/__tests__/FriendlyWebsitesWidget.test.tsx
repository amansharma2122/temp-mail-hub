import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// ---- Mocks ---------------------------------------------------------------
vi.mock("@/hooks/useSupabaseAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => true,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

let mockState: { settingsOk: boolean; sitesOk: boolean } = {
  settingsOk: true,
  sitesOk: true,
};

const settingsPayload = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  colorScheme: "primary",
  size: "medium",
  position: "right",
  showOnMobile: true,
  animationType: "slide",
  attentionEffect: "sparkle",
  buttonLabel: "Partner Sites",
  tooltipText: "Explore our partner sites",
  showBadge: true,
  badgeText: "NEW",
  triggerIcon: "Sparkles",
  autoOpenDelayMs: 0,
  showLabelOnTrigger: true,
  animationIntensity: "normal",
  disableEffectsOnReducedMotion: true,
};

const siteRow = {
  id: "site-1",
  name: "Nullsto",
  url: "https://nullsto.lovable.app",
  icon_url: null,
  icon_name: "Star",
  description: "Fast temp inboxes",
  display_order: 0,
  is_active: true,
  open_in_new_tab: true,
  attention_effect: null,
  badge_enabled: true,
  badge_text: null,
  auto_open_override: null,
  max_badge_per_day: 0,
};

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "app_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              mockState.settingsOk
                ? { data: { value: settingsPayload }, error: null }
                : Promise.reject(new Error("settings boom")),
          }),
        }),
      };
    }
    if (table === "friendly_websites") {
      return {
        select: () => ({
          eq: () => ({
            order: async () =>
              mockState.sitesOk
                ? { data: [siteRow], error: null }
                : Promise.reject(new Error("sites boom")),
          }),
        }),
      };
    }
    return {
      insert: async () => ({ data: null, error: null }),
    };
  };
  return {
    supabase: {
      from,
      auth: { getUser: async () => ({ data: { user: null } }) },
    },
  };
});

import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";

const renderWidget = () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
    },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <FriendlyWebsitesWidget />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

beforeEach(() => {
  mockState = { settingsOk: true, sitesOk: true };
});

describe("FriendlyWebsitesWidget (e2e)", () => {
  it("renders the selected trigger icon and sparkle effect class", async () => {
    renderWidget();
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    expect(trigger).toBeInTheDocument();
    // The `sparkle` attention effect is exposed via data-attribute for tests.
    expect(trigger.getAttribute("data-attention")).toBe("sparkle");
    // Sparkle attention effect keyframe class is applied
    expect(trigger.className).toMatch(/fw-sparkle/);
  });

  it("triggers the site-wide sparkle burst overlay when clicked", async () => {
    const { container } = renderWidget();
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    fireEvent.click(trigger);
    // Burst overlay spans use the fw-burst keyframe.
    await waitFor(() => {
      const burstEls = container.querySelectorAll('[style*="fw-burst"]');
      expect(burstEls.length).toBeGreaterThan(0);
    });
  });

  it("shows the sync-error pill when both settings and sites queries fail", async () => {
    mockState = { settingsOk: false, sitesOk: false };
    renderWidget();
    const pill = await screen.findByTestId(
      "friendly-widget-sync-error",
      {},
      { timeout: 3000 },
    );
    expect(pill).toBeInTheDocument();
    // The button is now labelled "Retry now" and lives inside a pill that
    // shows "Widget offline …" — either message satisfies the sync-error UI.
    expect(pill.textContent).toMatch(/retry now/i);
    const container = pill.closest('[data-testid="friendly-widget-sync-error-pill"]');
    expect(container?.textContent || "").toMatch(/widget offline/i);
  });
});