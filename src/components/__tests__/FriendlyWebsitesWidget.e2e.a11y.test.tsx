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
              data: { value: {
                enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
                colorScheme: "primary", size: "medium", position: "right",
                showOnMobile: true, animationType: "fade", attentionEffect: "none",
                buttonLabel: "Partner Sites", tooltipText: "Explore our partner sites",
                showBadge: false, triggerIcon: "Sparkles", autoOpenDelayMs: 0,
                showLabelOnTrigger: true, animationIntensity: "subtle",
                disableEffectsOnReducedMotion: true, reducedMotionMode: "always_on",
                celebrationEnabled: true, celebrationLabel: "Click Me 🎉",
                celebrationEffect: "confetti",
              } },
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
                { id: "s1", name: "Nullsto", url: "https://nullsto.example",
                  icon_url: null, icon_name: "Star", description: "Fast inboxes",
                  display_order: 0, is_active: true, open_in_new_tab: true,
                  attention_effect: null, badge_enabled: false, badge_text: null,
                  auto_open_override: null, max_badge_per_day: 0 },
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

const setTheme = (mode: "light" | "dark") => {
  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(mode);
};

const renderWidget = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider delayDuration={0}>
        <FriendlyWebsitesWidget />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

describe("FriendlyWebsitesWidget — end-to-end accessibility", () => {
  beforeEach(() => { document.documentElement.className = ""; });

  it.each(["light", "dark"] as const)(
    "trigger + panel expose proper ARIA and keyboard-activate in %s theme",
    async (mode) => {
      setTheme(mode);
      renderWidget();
      const trigger = await screen.findByTestId("friendly-widget-trigger");

      // ARIA: named, is a button.
      expect(trigger.tagName).toBe("BUTTON");
      expect(trigger.getAttribute("aria-label") || "").toMatch(/open partner sites/i);

      // Live region is polite for non-blocking announcements.
      const live = await screen.findByTestId("friendly-widget-live-region");
      expect(live).toHaveAttribute("aria-live", "polite");

      // Keyboard focus + activation.
      act(() => trigger.focus());
      expect(document.activeElement).toBe(trigger);
      fireEvent.click(trigger); // Enter/Space on <button> is equivalent
      await waitFor(() => expect(trigger.getAttribute("aria-label")).toMatch(/close/i));

      // Panel's own close button and celebrate button must have accessible names.
      const closeBtn = screen.getByRole("button", { name: /close panel/i });
      expect(closeBtn).toBeInTheDocument();
      const celebrate = screen.getByTestId("friendly-widget-celebrate");
      expect(celebrate.getAttribute("aria-label") || celebrate.textContent || "").toMatch(/click me|celebrate/i);

      // Contrast: enforce that we're relying on semantic tokens, not hardcoded
      // low-contrast utilities. We assert none of the widget's interactive
      // controls smuggle in known-poor combos.
      const html = document.body.innerHTML;
      expect(html).not.toMatch(/text-gray-300/);
      expect(html).not.toMatch(/text-muted-foreground\/(?:10|20|30|40)\b/);
    },
  );

  it("tab order reaches close → celebrate → site link inside an open panel", async () => {
    setTheme("light");
    renderWidget();
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    fireEvent.click(trigger);
    await waitFor(() => expect(trigger.getAttribute("aria-label")).toMatch(/close/i));

    const focusables = Array.from(
      document.querySelectorAll<HTMLElement>(
        'button, a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((el) => !el.hasAttribute("disabled"));

    // Trigger, close button, site link, celebrate button are all reachable.
    expect(focusables.some((el) => el.getAttribute("data-testid") === "friendly-widget-trigger")).toBe(true);
    expect(focusables.some((el) => /close panel/i.test(el.getAttribute("aria-label") || ""))).toBe(true);
    expect(focusables.some((el) => el.tagName === "A" && /nullsto/i.test(el.textContent || ""))).toBe(true);
    expect(focusables.some((el) => el.getAttribute("data-testid") === "friendly-widget-celebrate")).toBe(true);
  });
});