import { describe, it, expect, vi, beforeEach } from "vitest";

// Validates deterministic deep-merge semantics of applyAppSettingsPatch:
// - Nested objects merge key-by-key (last-writer-wins on scalars).
// - Arrays are REPLACED wholesale (never merged element-wise) so ordering
//   stays deterministic under conflicting concurrent updates.
// - Successive patches converge to the same final snapshot regardless of
//   arrival order for disjoint keys.

let currentValue: Record<string, unknown> = {};
let currentVersion = 0;
const rpcCalls: Array<{ key: string; patch: any }> = [];

function deepMerge(a: any, b: any): any {
  if (!a || typeof a !== "object" || Array.isArray(a)) return b ?? a;
  if (!b || typeof b !== "object" || Array.isArray(b)) return b ?? a;
  const out: any = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] =
      out[k] && typeof out[k] === "object" && !Array.isArray(out[k]) && v && typeof v === "object" && !Array.isArray(v)
        ? deepMerge(out[k], v)
        : v;
  }
  return out;
}

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn(async (_name: string, args: any) => {
    rpcCalls.push({ key: args.p_key, patch: args.p_patch });
    currentValue = deepMerge(currentValue, args.p_patch ?? {});
    currentVersion += 1;
    return { data: [{ value: currentValue, version: currentVersion, merged: true }], error: null };
  });
  const from = () => ({ insert: async () => ({ error: null }) });
  const channel = () => ({ on() { return this; }, subscribe() { return this; } });
  return { supabase: { rpc, from, channel, removeChannel: () => {} } };
});

import { applyAppSettingsPatch } from "@/lib/appSettingsSync";

describe("applyAppSettingsPatch deep-merge semantics", () => {
  beforeEach(() => {
    currentValue = {};
    currentVersion = 0;
    rpcCalls.length = 0;
  });

  it("recurses into nested objects and preserves untouched keys", async () => {
    await applyAppSettingsPatch("k", { ui: { theme: "dark", spacing: 8 }, misc: 1 });
    const r = await applyAppSettingsPatch("k", { ui: { theme: "light" } });
    expect(r.value).toEqual({ ui: { theme: "light", spacing: 8 }, misc: 1 });
    expect(r.version).toBe(2);
    expect(r.merged).toBe(true);
  });

  it("replaces arrays wholesale so ordering is deterministic", async () => {
    await applyAppSettingsPatch("k", { rules: [{ id: "a" }, { id: "b" }] });
    const r = await applyAppSettingsPatch("k", { rules: [{ id: "c" }] });
    expect(r.value).toEqual({ rules: [{ id: "c" }] });
  });

  it("converges to the same result regardless of arrival order for disjoint patches", async () => {
    // Run once in order A→B
    currentValue = {}; currentVersion = 0;
    await applyAppSettingsPatch("k", { a: { x: 1 } });
    await applyAppSettingsPatch("k", { b: { y: 2 } });
    const first = JSON.stringify(currentValue);

    // Reset and run in reverse order B→A
    currentValue = {}; currentVersion = 0;
    await applyAppSettingsPatch("k", { b: { y: 2 } });
    await applyAppSettingsPatch("k", { a: { x: 1 } });
    const second = JSON.stringify(currentValue);

    expect(first).toBe(second);
    expect(currentValue).toEqual({ a: { x: 1 }, b: { y: 2 } });
  });

  it("last write wins on conflicting scalar under nested key", async () => {
    await applyAppSettingsPatch("k", { nested: { flag: true, count: 1 } });
    const r = await applyAppSettingsPatch("k", { nested: { flag: false } });
    expect(r.value).toEqual({ nested: { flag: false, count: 1 } });
  });
});