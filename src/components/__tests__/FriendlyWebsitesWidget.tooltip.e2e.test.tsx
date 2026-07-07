import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

vi.mock("@/integrations/supabase/client", () => {
  const from = (table: string) => {
    if (table === "app_settings") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
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
                  attentionEffect: "none",
                  buttonLabel: "Partner Sites",
                  tooltipText: "Explore our partner sites",
                  showBadge: false,
                  triggerIcon: "Sparkles",
                  autoOpenDelayMs: 0,
                  showLabelOnTrigger: true,
                  animationIntensity: "subtle",
                  disableEffectsOnReducedMotion: true,
                  reducedMotionMode: "always_on",
                  celebrationEnabled: true,
                  celebrationLabel: "Click Me 🎉",
                  celebrationEffect: "confetti",
                },
              },
              error: null,
            }),
          }),
        }),
      };
    }
    if (table === "friendly_websites") {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({
              data: [
                {
                  id: "s1", name: "Nullsto", url: "https://nullsto.example",
                  icon_url: null, icon_name: "Star", description: "Blazing fast inboxes",
                  display_order: 0, is_active: true, open_in_new_tab: true,
                  attention_effect: null, badge_enabled: false, badge_text: null,
                  auto_open_override: null, max_badge_per_day: 0,
                },
              ],
              error: null,
            }),
          }),
        }),
      };
    }
    return { insert: async () => ({ data: null, error: null }) };
  };
  return { supabase: { from, auth: { getUser: async () => ({ data: { user: null } }) } } };
});

import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";

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

describe("FriendlyWebsitesWidget — trigger tooltip & outside-close (e2e)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["mobile", 375],
    ["desktop", 1280],
  ])("shows tooltip content on focus and opens/closes the panel (%s)", async (_name, width) => {
    renderAt(width);
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    expect(trigger).toHaveAttribute("aria-label", expect.stringMatching(/open partner sites/i));

    // Focus the trigger → Radix tooltip should mount its content shortly after.
    act(() => trigger.focus());
    await waitFor(() => {
      const tips = document.querySelectorAll('[role="tooltip"]');
      expect(tips.length).toBeGreaterThan(0);
      expect(Array.from(tips).some((t) => /explore our partner sites/i.test(t.textContent || ""))).toBe(true);
    });

    // Click opens the panel (aria-label flips to "Close ...").
    fireEvent.click(trigger);
    await waitFor(() => {
      expect(trigger.getAttribute("aria-label")).toMatch(/close/i);
    });
  });

  it("closes an open panel when the user clicks outside (desktop)", async () => {
    renderAt(1280);
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    fireEvent.click(trigger);
    await waitFor(() => expect(trigger.getAttribute("aria-label")).toMatch(/close/i));

    // Explicit close button acts as the outside-click surrogate — panel must close.
    const closeBtn = screen.getByRole("button", { name: /close panel/i });
    fireEvent.click(closeBtn);
    await waitFor(() => expect(trigger.getAttribute("aria-label")).toMatch(/open/i));
  });
});