import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Integration: admin tab changes friendly widget intensity; homepage tab
// must pick it up instantly even while React Router is switching routes
// rapidly (simulated by re-invalidating during the write burst).

let store: Record<string, { value: any; version: number }> = {
  friendly_sites_widget: { value: { enabled: true, animationIntensity: "subtle" }, version: 1 },
};
function deepMerge(a: any, b: any): any {
  if (!a || typeof a !== "object" || Array.isArray(a)) return b ?? a;
  if (!b || typeof b !== "object" || Array.isArray(b)) return b ?? a;
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && v && typeof v === "object" && !Array.isArray(v)
      ? deepMerge(out[k], v) : v;
  }
  return out;
}

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (_n: string, args: any) => {
    const cur = store[args.p_key] ?? { value: {}, version: 0 };
    const value = deepMerge(cur.value, args.p_patch ?? {});
    const version = cur.version + 1;
    store[args.p_key] = { value, version };
    return { data: [{ value, version, merged: true }], error: null };
  });
  const from = () => ({
    select() { return this; }, eq() { return this; },
    order() { return this; }, limit() { return this; },
    maybeSingle: async () => ({ data: { value: store.friendly_sites_widget?.value }, error: null }),
    insert: async () => ({ error: null }),
  });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import {
  saveAppSetting,
  bindAllAppSettingsToQueryClient,
} from "@/lib/appSettingsSync";

describe("friendly widget intensity: admin tab → homepage tab", () => {
  beforeEach(() => {
    store = { friendly_sites_widget: { value: { enabled: true, animationIntensity: "subtle" }, version: 1 } };
  });

  it("homepage tab observes new intensity instantly during rapid navigation", async () => {
    const adminTab = new QueryClient();
    const homepageTab = new QueryClient();

    // Homepage seeds the cached widget config.
    homepageTab.setQueryData(
      ["app_settings", "friendly_sites_widget"],
      { value: { enabled: true, animationIntensity: "subtle" } },
    );
    const offHome = bindAllAppSettingsToQueryClient(homepageTab);
    const offAdmin = bindAllAppSettingsToQueryClient(adminTab);

    // Simulate rapid navigation on the homepage: repeatedly invalidate
    // unrelated caches while admin fires intensity updates.
    const nav = (async () => {
      for (let i = 0; i < 20; i++) {
        await homepageTab.invalidateQueries({ queryKey: ["route-noise", i] });
      }
    })();

    // Admin flips intensity a few times in quick succession.
    await saveAppSetting("friendly_sites_widget", { animationIntensity: "lively" });
    await saveAppSetting("friendly_sites_widget", { animationIntensity: "wild" });
    await nav;

    // Server-side deterministic result.
    expect(store.friendly_sites_widget.value).toMatchObject({
      enabled: true,
      animationIntensity: "wild",
    });

    // Homepage tab query cache is marked stale → next read will refetch.
    const state = homepageTab.getQueryState(["app_settings", "friendly_sites_widget"]);
    expect(state?.isInvalidated).toBe(true);

    offHome(); offAdmin();
  });
});