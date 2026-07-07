import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

let currentSettings: any;
let currentUser: any = null;

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
vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: currentUser }) }));
vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => false,
  noteBadgeShown: vi.fn(),
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

function triggerCount(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).filter((b) =>
    /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
  ).length;
}

async function settle() {
  // Yield microtasks so React Query fetches resolve.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}

describe("FriendlyWebsitesWidget — Enabled master switch across audiences & breakpoints", () => {
  const breakpoints = [
    { name: "mobile",  w: 375 },
    { name: "desktop", w: 1440 },
  ];

  beforeEach(() => {
    cleanup();
    currentUser = null;
    currentSettings = {
      enabled: true, visibleToPublic: true, visibleToLoggedIn: true, showOnMobile: true,
    };
  });

  for (const audience of ["public", "logged-in"] as const) {
    for (const bp of breakpoints) {
      it(`hides the widget when enabled=false (${audience} @ ${bp.name})`, async () => {
        Object.defineProperty(window, "innerWidth", { value: bp.w, configurable: true });
        currentUser = audience === "logged-in" ? { id: "u1" } : null;
        currentSettings = { enabled: false, visibleToPublic: true, visibleToLoggedIn: true, showOnMobile: true };
        const { container } = mount();
        await settle();
        expect(triggerCount(container)).toBe(0);
      });

      it(`shows the widget when enabled=true (${audience} @ ${bp.name})`, async () => {
        Object.defineProperty(window, "innerWidth", { value: bp.w, configurable: true });
        currentUser = audience === "logged-in" ? { id: "u1" } : null;
        currentSettings = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true, showOnMobile: true };
        const { container } = mount();
        await waitFor(() => expect(triggerCount(container)).toBe(1));
      });
    }
  }

  it("respects visibleToPublic=false — hides the trigger for public visitors only", async () => {
    currentUser = null;
    currentSettings = { enabled: true, visibleToPublic: false, visibleToLoggedIn: true, showOnMobile: true };
    const { container } = mount();
    await settle();
    expect(triggerCount(container)).toBe(0);
  });

  it("respects visibleToLoggedIn=false — hides the trigger for logged-in visitors only", async () => {
    currentUser = { id: "u1" };
    currentSettings = { enabled: true, visibleToPublic: true, visibleToLoggedIn: false, showOnMobile: true };
    const { container } = mount();
    await settle();
    expect(triggerCount(container)).toBe(0);
  });

  it("with showOnMobile=false the trigger is class-hidden on mobile breakpoints (hidden md:block)", async () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    currentSettings = { enabled: true, visibleToPublic: true, visibleToLoggedIn: true, showOnMobile: false };
    const { container } = mount();
    await waitFor(() => expect(triggerCount(container)).toBe(1));
    const trigger = Array.from(container.querySelectorAll("button")).find((b) =>
      /partner sites/i.test(b.getAttribute("aria-label") || b.textContent || ""),
    )!;
    expect(trigger.className).toMatch(/\bhidden\b/);
    expect(trigger.className).toMatch(/md:block/);
  });
});
