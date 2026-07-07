import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Integration: two tabs both begin editing at baseVersion=1. Tab B commits
// first, bumping the server to v2. Tab A then commits with the stale
// baseVersion=1. Both tabs must converge on the deterministic merged
// result at v3, and both tabs' QueryClients must invalidate.

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
  applyAppSettingsPatch,
  bindAllAppSettingsToQueryClient,
} from "@/lib/appSettingsSync";

describe("stale baseVersion — cross-tab convergence", () => {
  beforeEach(() => {
    store = { pricing: { value: { plan: "free" }, version: 1 } };
  });

  it("late writer with stale baseVersion still merges and both tabs converge", async () => {
    const tabA = new QueryClient();
    const tabB = new QueryClient();
    tabA.setQueryData(["app_settings", "pricing"], { value: { plan: "free" } });
    tabB.setQueryData(["app_settings", "pricing"], { value: { plan: "free" } });
    const offA = bindAllAppSettingsToQueryClient(tabA);
    const offB = bindAllAppSettingsToQueryClient(tabB);

    // Both tabs loaded at baseVersion=1.
    const seenBase = 1;

    // Tab B commits first with fresh base.
    const b = await applyAppSettingsPatch("pricing", { currency: "USD" }, seenBase);
    expect(b.version).toBe(2);

    // Tab A now commits with the STALE base — should still succeed & merge.
    const a = await applyAppSettingsPatch("pricing", { plan: "pro" }, seenBase);
    expect(a.merged).toBe(true);
    expect(a.version).toBe(3);

    // Server holds the deterministic union of both patches.
    expect(store.pricing.value).toEqual({ plan: "pro", currency: "USD" });
    expect(store.pricing.version).toBe(3);

    // Both tabs' caches invalidated → next read is guaranteed fresh.
    expect(tabA.getQueryState(["app_settings", "pricing"])?.isInvalidated).toBe(true);
    expect(tabB.getQueryState(["app_settings", "pricing"])?.isInvalidated).toBe(true);

    offA(); offB();
  });
});