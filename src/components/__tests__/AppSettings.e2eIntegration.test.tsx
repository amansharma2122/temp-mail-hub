import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";

// -------------------------------------------------------------------------
// End-to-end integration: toggle enabled, adjust intensity, and trigger a
// new-email toast — all while `prefers-reduced-motion: reduce` is active.
// Asserts the widget mounts/unmounts correctly, the intensity change is
// picked up without a full remount, and the toast falls back to the
// dedicated "reduced" variant.
// -------------------------------------------------------------------------

let currentSettings: any = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  animationIntensity: "subtle",
};

vi.mock("@/integrations/supabase/client", () => {
  function fromApi(table: string) {
    const b: any = {
      _resolve: async () =>
        table === "friendly_websites"
          ? { data: [{
              id: "w1", name: "Partner", url: "https://partner.example",
              icon_url: null, icon_name: "Sparkles", description: null,
              display_order: 0, is_active: true, open_in_new_tab: true,
              attention_effect: null, badge_enabled: false, badge_text: null,
              auto_open_override: null, max_badge_per_day: 0,
            }], error: null }
          : table === "app_settings"
            ? { data: { value: currentSettings }, error: null }
            : { data: null, error: null },
      select() { return b; }, eq() { return b; }, order() { return b; },
      limit() { return b._resolve(); },
      maybeSingle: async () => b._resolve(),
      then(res: any, rej: any) { return b._resolve().then(res, rej); },
    };
    return b;
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
  prefersReducedMotion: () => true, // OS reduced-motion is ON
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";
import { NewEmailToast, resolveNewEmailToastVariant } from "../NewEmailToast";
import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe("E2E: enable + intensity + toast under reduced-motion", () => {
  beforeEach(() => {
    currentSettings = {
      enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
      animationIntensity: "subtle",
    };
  });

  it("orchestrates toggle + intensity + reduced-motion toast correctly", async () => {
    const qc = makeClient();
    const { container, rerender } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <FriendlyWebsitesWidget />
          <NewEmailToast
            from="test@example.com"
            subject="Hello"
            style="bounce_confetti"
            forceReducedMotion
          />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    // 1. Widget mounted while enabled (its trigger is a <button>).
    await waitFor(() => {
      expect(container.querySelector("button")).toBeTruthy();
    });
    // Toast is present too (reduced variant).
    expect(container.querySelector('[data-variant="reduced"]')).toBeTruthy();
    const triggerBefore = container.querySelector("button");
    (triggerBefore as HTMLElement)?.setAttribute("data-mount-marker", "keep");

    // 2. Adjust intensity — assert no remount.
    currentSettings = { ...currentSettings, animationIntensity: "lively" };
    await act(async () => {
      broadcastAppSettingsChange("friendly_sites_widget");
      await qc.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
    });
    await waitFor(() => {
      expect(container.querySelector('[data-mount-marker="keep"]')).not.toBeNull();
    });

    // 3. Toast uses the dedicated reduced variant (no springs / confetti).
    const toast = container.querySelector('[data-variant]');
    expect(toast?.getAttribute("data-variant")).toBe("reduced");
    expect(resolveNewEmailToastVariant("bounce_confetti", true)).toBe("reduced");

    // 4. Admin disables the widget — it fully unmounts.
    currentSettings = { ...currentSettings, enabled: false };
    await act(async () => {
      broadcastAppSettingsChange("friendly_sites_widget");
      await qc.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
    });
    await waitFor(() => {
      expect(container.querySelector('[data-mount-marker="keep"]')).toBeNull();
    });

    // 5. Toast still present after widget unmount — separate lifecycle.
    expect(container.querySelector('[data-variant="reduced"]')).toBeTruthy();

    rerender(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          {/* widget stays unmounted */}
          <NewEmailToast from="a" subject="b" style="both" forceReducedMotion={false} />
        </TooltipProvider>
      </QueryClientProvider>,
    );
    // When reduced-motion is off, we fall back to the requested style.
    expect(resolveNewEmailToastVariant("both", false)).toBe("both");
  });
});