import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Integration: two tabs (two separate QueryClient instances, both wired to
// bindAllAppSettingsToQueryClient) update TWO DIFFERENT keys at roughly
// the same time. Both tabs must observe both invalidations, and the last
// cached snapshot for each key must reflect the deterministic RPC result.

let store: Record<string, { value: any; version: number }> = {};
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
  const from = () => ({ insert: async () => ({ error: null }) });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import {
  saveAppSetting,
  bindAllAppSettingsToQueryClient,
} from "@/lib/appSettingsSync";

describe("multi-tab convergence on different keys", () => {
  beforeEach(() => { store = {}; });

  it("both tabs invalidate & converge to identical UI state", async () => {
    const tabA = new QueryClient();
    const tabB = new QueryClient();

    // Seed initial caches so we can detect invalidation.
    tabA.setQueryData(["app_settings", "friendly_sites_widget"], { value: { enabled: false } });
    tabA.setQueryData(["app_settings", "banner"], { value: { visible: false } });
    tabB.setQueryData(["app_settings", "friendly_sites_widget"], { value: { enabled: false } });
    tabB.setQueryData(["app_settings", "banner"], { value: { visible: false } });

    const offA = bindAllAppSettingsToQueryClient(tabA);
    const offB = bindAllAppSettingsToQueryClient(tabB);

    // Concurrent writes on different keys, one per "tab".
    await Promise.all([
      saveAppSetting("friendly_sites_widget", { enabled: true, animationIntensity: 1.4 }),
      saveAppSetting("banner", { visible: true, message: "hi" }),
    ]);

    // Deterministic server-side state.
    expect(store.friendly_sites_widget.value).toEqual({ enabled: true, animationIntensity: 1.4 });
    expect(store.banner.value).toEqual({ visible: true, message: "hi" });

    // Both tabs saw invalidations for both keys (query state becomes stale).
    for (const qc of [tabA, tabB]) {
      const s1 = qc.getQueryState(["app_settings", "friendly_sites_widget"]);
      const s2 = qc.getQueryState(["app_settings", "banner"]);
      expect(s1?.isInvalidated).toBe(true);
      expect(s2?.isInvalidated).toBe(true);
    }

    offA(); offB();
  });
});