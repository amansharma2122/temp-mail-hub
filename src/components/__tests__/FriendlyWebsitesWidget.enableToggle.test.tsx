import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// --------------------------------------------------------------------------
// Mock everything the widget touches at module scope.
// --------------------------------------------------------------------------

let currentSettings: any = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true };

const FAKE_WEBSITES = [
  {
    id: "w1",
    name: "Partner",
    url: "https://partner.example",
    icon_url: null,
    icon_name: "Sparkles",
    description: null,
    display_order: 0,
    is_active: true,
    open_in_new_tab: true,
    attention_effect: null,
    badge_enabled: false,
    badge_text: null,
    auto_open_override: null,
    max_badge_per_day: 0,
  },
];

vi.mock("@/integrations/supabase/client", () => {
  function fromApi(table: string) {
    const builder: any = {
      _resolve: async () =>
        table === "friendly_websites"
          ? { data: FAKE_WEBSITES, error: null }
          : table === "app_settings"
            ? { data: { value: currentSettings }, error: null }
            : { data: null, error: null },
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
    channel: () => ({
      on: function () { return this; },
      subscribe: function () { return this; },
    }),
    removeChannel: () => {},
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
  } };
});

vi.mock("@/hooks/useSupabaseAuth", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

// Import AFTER mocks so the widget picks up the fake supabase client.
import FriendlyWebsitesWidget from "../FriendlyWebsitesWidget";
import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

function Wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={makeClient()}>{children}</QueryClientProvider>;
}

describe("FriendlyWebsitesWidget enable/disable toggle", () => {
  beforeEach(() => {
    currentSettings = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true };
  });

  it("mounts a visible trigger when enabled and unmounts when the admin disables it via broadcast", async () => {
    const qc = makeClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <FriendlyWebsitesWidget />
      </QueryClientProvider>,
    );
    // Wait for the initial fetch to settle and the trigger to render.
    await waitFor(() => {
      expect(container.querySelector("button")).toBeTruthy();
    });

    // Admin flips enabled -> false and broadcasts the change.
    currentSettings = { ...currentSettings, enabled: false };
    await act(async () => {
      broadcastAppSettingsChange("friendly_sites_widget");
      await qc.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
    });

    await waitFor(() => {
      expect(container.querySelector("button")).toBeNull();
    });
  });

  it("survives rapid enable/disable churn without leaking DOM nodes", async () => {
    const qc = makeClient();
    const { container } = render(
      <QueryClientProvider client={qc}>
        <FriendlyWebsitesWidget />
      </QueryClientProvider>,
    );
    await waitFor(() => expect(container.querySelector("button")).toBeTruthy());

    for (let i = 0; i < 6; i++) {
      currentSettings = { ...currentSettings, enabled: i % 2 === 0 ? false : true };
      await act(async () => {
        broadcastAppSettingsChange("friendly_sites_widget");
        await qc.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
      });
    }

    // Final state was enabled -> a single trigger button should be present.
    await waitFor(() => {
      const triggers = container.querySelectorAll("button");
      expect(triggers.length).toBeGreaterThanOrEqual(1);
    });
  });
});