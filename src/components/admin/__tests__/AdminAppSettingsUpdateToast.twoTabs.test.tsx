import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { Toaster } from "sonner";
import { MemoryRouter } from "react-router-dom";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AdminAppSettingsUpdateToast from "@/components/admin/AdminAppSettingsUpdateToast";

// Simulate two admin tabs. "Tab A" mounts the toast + Sonner viewport.
// "Tab B" is simulated by calling saveAppSetting directly WITHOUT going
// through Tab A's markLocalWrite (we simulate it by broadcasting a
// change from a foreign tab id via broadcastAppSettingsChange with a
// version that Tab A never wrote).
//
// Assertions:
//   1. When Tab B saves, Tab A's toast appears with the merged version.
//   2. When Tab A saves locally (via saveAppSetting), no toast fires.

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
  broadcastAppSettingsChange,
} from "@/lib/appSettingsSync";

function renderTabA() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <AdminAppSettingsUpdateToast />
        <Toaster />
      </LanguageProvider>
    </MemoryRouter>,
  );
}

describe("AdminAppSettingsUpdateToast — two-tab behaviour", () => {
  beforeEach(() => {
    store = {};
    cleanup();
  });

  it("shows the remote-update toast with merged version from another tab", async () => {
    const { container } = renderTabA();

    // Tab B (a foreign tab) writes and broadcasts the resulting version.
    // Because Tab A never called saveAppSetting locally, no local-write
    // marker exists → the toast should fire.
    act(() => {
      broadcastAppSettingsChange("friendly_sites_widget", 7);
    });

    await waitFor(() => {
      expect(document.body.textContent).toMatch(/updated in another tab/i);
    });
    // Version label present in description.
    expect(document.body.textContent).toMatch(/v7/);
    expect(document.body.textContent).toMatch(/friendly_sites_widget/);

    void container;
  });

  it("does NOT show the toast for local writes originating in the same tab", async () => {
    renderTabA();

    // Tab A itself commits — saveAppSetting marks the version as local.
    await act(async () => {
      await saveAppSetting("banner", { visible: true });
    });

    // Give sonner a tick.
    await new Promise((r) => setTimeout(r, 50));

    expect(document.body.textContent || "").not.toMatch(/updated in another tab/i);
  });
});