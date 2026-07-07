import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import React from "react";

// -------- Shared fake supabase (mirrors enableToggle test) ------------
let currentSettings: any = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  animationIntensity: "normal",
};

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
      _resolve: async () =>
        table === "friendly_websites"
          ? { data: FAKE_WEBSITES, error: null }
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
  prefersReducedMotion: () => false,
}));

import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";
import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
}

describe("FriendlyWebsitesWidget — animationIntensity applies without remount", () => {
  beforeEach(() => {
    currentSettings = {
      enabled: true, visibleToPublic: true, visibleToLoggedIn: true,
      animationIntensity: "subtle",
    };
  });

  it("keeps the same trigger DOM node identity across intensity changes", async () => {
    const qc = makeClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <FriendlyWebsitesWidget />
        </TooltipProvider>
      </QueryClientProvider>,
    );

    await waitFor(() => expect(container.querySelector("button")).toBeTruthy());
    const originalTrigger = container.querySelector("button")!;
    // Force a stable marker on the mounted node — if it gets unmounted,
    // the marker disappears with it.
    (originalTrigger as HTMLElement).setAttribute("data-mount-marker", "keep");

    // Flip intensity several times and broadcast each change.
    for (const intensity of ["normal", "lively", "subtle", "lively"]) {
      currentSettings = { ...currentSettings, animationIntensity: intensity };
      await act(async () => {
        broadcastAppSettingsChange("friendly_sites_widget");
        await qc.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
      });
    }

    // Wait for React to flush any re-render caused by the invalidations.
    await waitFor(() => {
      const marker = container.querySelector('[data-mount-marker="keep"]');
      expect(marker).not.toBeNull();
    });

    // Node identity preserved -> no full remount, intensity applied via
    // a prop/state update on the existing instance.
    const stillSame = container.querySelector('[data-mount-marker="keep"]');
    expect(stillSame).toBe(originalTrigger);
  });
});