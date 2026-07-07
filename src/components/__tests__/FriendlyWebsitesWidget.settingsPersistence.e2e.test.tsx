import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// Simulated persisted app_settings row. The mocked supabase client always
// returns whatever is currently stored here — mimicking a saved-and-reloaded
// admin round trip.
let persistedSettings: any;

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
          : { data: { value: persistedSettings }, error: null },
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

function trigger(container: HTMLElement) {
  return Array.from(container.querySelectorAll("button")).find((b) =>
    /partner sites|custom-brand/i.test(b.getAttribute("aria-label") || b.textContent || ""),
  );
}

/**
 * End-to-end guard: after the admin "saves" a full set of widget settings
 * (including advanced controls) the values must survive a fresh mount —
 * the equivalent of reloading the admin page — and must NOT change when
 * the document theme flips between light and dark.
 */
describe("FriendlyWebsitesWidget — settings persistence across reload & theme", () => {
  beforeEach(() => {
    cleanup();
    persistedSettings = {
      enabled: true,
      visibleToPublic: true,
      visibleToLoggedIn: true,
      showOnMobile: true,
      colorScheme: "gradient",
      size: "large",
      position: "left",
      animationType: "fade",
      attentionEffect: "glow",
      animationIntensity: "subtle",
      buttonLabel: "Custom-Brand Sites",
      tooltipText: "Custom tooltip",
      showBadge: false,
      badgeText: "NEW",
      triggerIcon: "Sparkles",
      autoOpenDelayMs: 0,
      showLabelOnTrigger: true,
      disableEffectsOnReducedMotion: true,
      reducedMotionMode: "respect_user",
    };
  });
  afterEach(() => cleanup());

  it("renders the exact persisted values after a fresh mount (simulated reload)", async () => {
    const { container, unmount } = mount();
    await waitFor(() => expect(trigger(container)).toBeTruthy());

    const t1 = trigger(container)!;
    expect(/custom-brand sites/i.test(t1.getAttribute("aria-label") || t1.textContent || "")).toBe(true);
    // position left → left-0 class in the module-scoped position helper.
    expect(t1.className).toMatch(/left-0/);
    // gradient color scheme.
    expect(t1.className).toMatch(/from-primary/);
    unmount();

    // Simulated admin-page reload: brand-new QueryClient / tree, same DB row.
    const { container: container2 } = mount();
    await waitFor(() => expect(trigger(container2)).toBeTruthy());
    const t2 = trigger(container2)!;
    expect(t2.getAttribute("aria-label") || t2.textContent).toEqual(
      t1.getAttribute("aria-label") || t1.textContent,
    );
    expect(t2.className).toMatch(/left-0/);
    expect(t2.className).toMatch(/from-primary/);
  });

  it("persisted settings do not change when switching between light and dark themes", async () => {
    // Light mode mount.
    document.documentElement.classList.remove("dark");
    const { container: lightC, unmount } = mount();
    await waitFor(() => expect(trigger(lightC)).toBeTruthy());
    const lightLabel = trigger(lightC)!.textContent || "";
    const lightClasses = trigger(lightC)!.className;
    unmount();

    // Dark mode mount — same persisted row.
    document.documentElement.classList.add("dark");
    const { container: darkC } = mount();
    await waitFor(() => expect(trigger(darkC)).toBeTruthy());
    const darkLabel = trigger(darkC)!.textContent || "";
    const darkClasses = trigger(darkC)!.className;

    expect(darkLabel).toBe(lightLabel);
    // Structural classes derived from persisted settings must match exactly.
    // (Theme-dependent tokens like text-foreground are the same class name in
    // both modes — Tailwind resolves them at paint time.)
    expect(darkClasses).toBe(lightClasses);

    document.documentElement.classList.remove("dark");
  });
});
