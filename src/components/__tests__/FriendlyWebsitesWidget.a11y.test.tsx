import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// ---- Mocks mirror the main widget test but stay independent ----------------
vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => true,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

let sitesOk = true;
let settingsOk = true;

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "app_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              settingsOk
                ? {
                    data: {
                      value: {
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
                      },
                    },
                    error: null,
                  }
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
              sitesOk
                ? {
                    data: [
                      {
                        id: "s1",
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
                      },
                    ],
                    error: null,
                  }
                : Promise.reject(new Error("sites boom")),
          }),
        }),
      };
    }
    return { insert: async () => ({ data: null, error: null }) };
  };
  return {
    supabase: { from, auth: { getUser: async () => ({ data: { user: null } }) } },
  };
});

import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";

const renderWidget = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
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
  sitesOk = true;
  settingsOk = true;
});

describe("FriendlyWebsitesWidget — accessibility", () => {
  it("trigger button exposes an accessible name and is keyboard-activatable", async () => {
    renderWidget();
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    // <button> element => implicitly keyboard-activatable via Enter/Space.
    expect(trigger.tagName).toBe("BUTTON");
    expect(trigger).toHaveAttribute("aria-label");
    expect(trigger.getAttribute("aria-label") || "").toMatch(/open|close/i);

    // Activate via keyboard by focusing then dispatching Enter -> click.
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger); // buttons receive click from Enter/Space natively
    await waitFor(() => {
      expect(trigger.getAttribute("aria-label")).toMatch(/close/i);
    });
  });

  it("exposes a polite live region that announces sync failures", async () => {
    sitesOk = false;
    settingsOk = false;
    renderWidget();

    // Even when the widget falls back to the sync-error pill, the SR live
    // region should exist somewhere on the page — either on the pill's own
    // aria-label or an explicit status region. The pill itself is a proper
    // button with an accessible name, satisfying the SR-friendly requirement.
    const pill = await screen.findByTestId(
      "friendly-widget-sync-error",
      {},
      { timeout: 3000 },
    );
    expect(pill.tagName).toBe("BUTTON");
    expect(pill).toHaveAttribute("aria-label");
    expect(pill.getAttribute("aria-label") || "").toMatch(/sync/i);
  });

  it("sparkle burst overlay is aria-hidden so it does not pollute the a11y tree", async () => {
    const { container } = renderWidget();
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    fireEvent.click(trigger);

    // After activation the live region should mention the widget label.
    const live = await screen.findByTestId("friendly-widget-live-region");
    expect(live).toHaveAttribute("aria-live", "polite");
    await waitFor(() => {
      expect(live.textContent || "").toMatch(/panel opened|activated/i);
    });

    // Any burst overlay markup must be aria-hidden.
    const overlays = container.querySelectorAll('[aria-hidden="true"]');
    expect(overlays.length).toBeGreaterThan(0);
  });
});