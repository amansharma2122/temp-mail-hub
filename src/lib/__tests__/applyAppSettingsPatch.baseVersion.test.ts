import { describe, it, expect, vi, beforeEach } from "vitest";

// Simulates the server-side `upsert_app_setting` RPC behaviour with
// respect to `p_base_version`. The contract is:
//   - `baseVersion` is advisory: even if it lags the current row version,
//     the RPC still performs a deterministic deep-merge (last-writer-wins
//     on scalars) and bumps `version` monotonically.
//   - The response always reflects the freshly bumped version.
// This exercises both a "fresh" caller (baseVersion === current) and a
// "stale" caller (baseVersion behind current) and asserts that both
// produce a merged snapshot and the correct new version.

let currentValue: Record<string, unknown> = {};
let currentVersion = 0;
const rpcArgsLog: Array<any> = [];

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
  const rpc = vi.fn(async (_name: string, args: any) => {
    rpcArgsLog.push(args);
    // Deterministic merge regardless of stale baseVersion.
    currentValue = deepMerge(currentValue, args.p_patch ?? {});
    currentVersion += 1;
    return { data: [{ value: currentValue, version: currentVersion, merged: true }], error: null };
  });
  const from = () => ({ insert: async () => ({ error: null }) });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import { applyAppSettingsPatch } from "@/lib/appSettingsSync";

describe("applyAppSettingsPatch — baseVersion behaviour", () => {
  beforeEach(() => {
    currentValue = {};
    currentVersion = 0;
    rpcArgsLog.length = 0;
  });

  it("forwards baseVersion to the RPC unchanged", async () => {
    await applyAppSettingsPatch("k", { a: 1 }, 5);
    expect(rpcArgsLog[0]).toMatchObject({ p_key: "k", p_base_version: 5 });
  });

  it("with a fresh baseVersion returns merged=true and bumps to next version", async () => {
    // Bring server to v3.
    await applyAppSettingsPatch("k", { one: 1 });
    await applyAppSettingsPatch("k", { two: 2 });
    await applyAppSettingsPatch("k", { three: 3 });
    expect(currentVersion).toBe(3);

    const r = await applyAppSettingsPatch("k", { four: 4 }, /* baseVersion */ 3);
    expect(r.merged).toBe(true);
    expect(r.version).toBe(4);
    expect(r.value).toEqual({ one: 1, two: 2, three: 3, four: 4 });
  });

  it("with a STALE baseVersion still deterministically merges and bumps version", async () => {
    // Server advances from v0 → v2 while our caller was thinking.
    await applyAppSettingsPatch("k", { server: { alpha: true } });
    await applyAppSettingsPatch("k", { server: { beta: true } });
    expect(currentVersion).toBe(2);

    // Caller submits with the version they FIRST saw (0) — deliberately stale.
    const r = await applyAppSettingsPatch(
      "k",
      { caller: { patch: "here" } },
      /* baseVersion */ 0,
    );

    // Merge is deterministic — no data was lost.
    expect(r.value).toEqual({
      server: { alpha: true, beta: true },
      caller: { patch: "here" },
    });
    // Version bumped to next monotonic slot.
    expect(r.version).toBe(3);
    expect(r.merged).toBe(true);
  });

  it("two stale callers converge deterministically", async () => {
    // Server at v1 with {a:1}
    await applyAppSettingsPatch("k", { a: 1 });
    const baseline = currentVersion;

    // Two callers both saw baseline=1 and race with disjoint patches.
    const [r1, r2] = await Promise.all([
      applyAppSettingsPatch("k", { b: 2 }, baseline),
      applyAppSettingsPatch("k", { c: 3 }, baseline),
    ]);

    // Versions strictly increase; both callers observe a merged=true result.
    expect(r1.merged).toBe(true);
    expect(r2.merged).toBe(true);
    expect(new Set([r1.version, r2.version]).size).toBe(2);
    expect(Math.max(r1.version, r2.version)).toBe(currentVersion);

    // Final value contains BOTH stale-caller patches → no lost writes.
    expect(currentValue).toEqual({ a: 1, b: 2, c: 3 });
  });
});