import { describe, it, expect, vi, beforeEach } from "vitest";

// Two tabs write to the SAME app_settings key concurrently. Each call
// funnels through the deterministic `upsert_app_setting` RPC, which
// deep-merges on top of the current row. Both tabs then observe the same
// final broadcasted version and both listener snapshots must converge.

let currentValue: Record<string, unknown> = {};
let currentVersion = 0;

function deepMerge(a: any, b: any): any {
  if (!a || typeof a !== "object" || Array.isArray(a)) return b ?? a;
  if (!b || typeof b !== "object" || Array.isArray(b)) return b ?? a;
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] =
      out[k] && typeof out[k] === "object" && !Array.isArray(out[k])
        ? deepMerge(out[k], v)
        : v;
  }
  return out;
}

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (_name: string, args: any) => {
    // simulate RPC: merge patch on top of current value, bump version.
    currentValue = deepMerge(currentValue, args.p_patch ?? {});
    currentVersion += 1;
    return {
      data: [{ value: currentValue, version: currentVersion, merged: true }],
      error: null,
    };
  });
  const from = () => ({ insert: async () => ({ error: null }) });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import {
  saveAppSetting,
  subscribeAllAppSettings,
  getLastObservedAppSettings,
} from "@/lib/appSettingsSync";

describe("appSettingsSync same-key convergence", () => {
  beforeEach(() => {
    currentValue = {};
    currentVersion = 0;
  });

  it("two concurrent writers on one key converge to the same UI state", async () => {
    const tabA: Array<{ key: string; version: number | null }> = [];
    const tabB: Array<{ key: string; version: number | null }> = [];
    const offA = subscribeAllAppSettings((key, ch) => tabA.push({ key, version: ch?.version ?? null }));
    const offB = subscribeAllAppSettings((key, ch) => tabB.push({ key, version: ch?.version ?? null }));

    // Two tabs racing on the same key with disjoint patches — deep merge
    // yields the union deterministically.
    await Promise.all([
      saveAppSetting("friendly_sites_widget", { enabled: true }),
      saveAppSetting("friendly_sites_widget", { animationIntensity: 1.5 }),
    ]);

    // Both tabs saw two invalidations, and the last observed value for the
    // key contains BOTH patches (deterministic deep merge).
    expect(tabA.filter((e) => e.key === "friendly_sites_widget").length).toBeGreaterThanOrEqual(2);
    expect(tabB.filter((e) => e.key === "friendly_sites_widget").length).toBeGreaterThanOrEqual(2);
    expect(currentValue).toEqual({ enabled: true, animationIntensity: 1.5 });

    const observed = getLastObservedAppSettings().find((c) => c.key === "friendly_sites_widget");
    expect(observed?.version).toBe(currentVersion);
    expect(observed?.version).toBeGreaterThanOrEqual(2);

    offA();
    offB();
  });
});