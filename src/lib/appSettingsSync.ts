// Cross-tab / cross-device sync for admin app_settings.
//
// - `BroadcastChannel` fans out invalidations to sibling tabs in the same
//   browser instantly.
// - `localStorage` "storage" events cover browsers without BroadcastChannel.
// - A single supabase realtime channel subscribed to `public.app_settings`
//   fans out changes across devices (admin on laptop -> homepage on phone).
//
// Callers receive settings-key-scoped invalidations that they wire into
// their React Query cache.

import { supabase } from "@/integrations/supabase/client";
import type { QueryClient } from "@tanstack/react-query";

const CHANNEL_NAME = "nullsto:app-settings";
const STORAGE_KEY = "nullsto:app-settings:ping";

type Listener = (key: string) => void;
const WILDCARD = "*";
const listeners = new Set<Listener>();

let bc: BroadcastChannel | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let storageBound = false;

function fanout(key: string) {
  listeners.forEach((fn) => {
    try { fn(key); } catch (e) { console.warn("[appSettingsSync] listener error", e); }
  });
}

function ensureTransport() {
  if (typeof window === "undefined") return;

  if (!bc && "BroadcastChannel" in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (e) => {
      const key = typeof e.data === "string" ? e.data : e.data?.key;
      if (key) fanout(key);
    };
  }

  if (!storageBound) {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { key?: string };
        if (parsed?.key) fanout(parsed.key);
      } catch { /* ignore */ }
    });
    storageBound = true;
  }

  if (!realtimeChannel) {
    realtimeChannel = supabase
      .channel("app-settings-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings" },
        (payload) => {
          const row = (payload.new ?? payload.old) as { key?: string } | null;
          if (row?.key) fanout(row.key);
        },
      )
      .subscribe();
  }
}

/** Subscribe to remote app_settings changes for one or more keys. */
export function subscribeAppSettings(
  keys: string[],
  onChange: (key: string) => void,
): () => void {
  ensureTransport();
  const listener: Listener = (key) => {
    if (keys.includes(key)) onChange(key);
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Subscribe to every app_settings key change. Used by the global
 * QueryClient binder so any admin edit (not just friendly_sites_widget)
 * propagates instantly to every subscriber in every tab / device.
 */
export function subscribeAllAppSettings(
  onChange: (key: string) => void,
): () => void {
  ensureTransport();
  const listener: Listener = (key) => onChange(key);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Broadcast a local settings change to every tab (this one included) and
 * every device. Call after a successful write to `app_settings`.
 */
export function broadcastAppSettingsChange(key: string): void {
  ensureTransport();
  fanout(key); // same tab
  try { bc?.postMessage({ key }); } catch { /* ignore */ }
  try {
    // Writing then removing triggers the "storage" event on other tabs.
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, t: Date.now() }));
  } catch { /* ignore */ }
}

/**
 * Convenience helper: wires a QueryClient so any change to `key` invalidates
 * `['app_settings', key]` and the umbrella `['app_settings']` list.
 */
export function bindAppSettingsToQueryClient(
  qc: QueryClient,
  keys: string[],
): () => void {
  return subscribeAppSettings(keys, (key) => {
    qc.invalidateQueries({ queryKey: ["app_settings", key] });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  });
}

/**
 * Global binder — invalidates any React Query cache entry that starts with
 * `['app_settings', <changed-key>]` when *any* app setting is edited. Wire
 * once at app boot so every admin panel reacts to every change.
 */
export function bindAllAppSettingsToQueryClient(qc: QueryClient): () => void {
  return subscribeAllAppSettings((key) => {
    qc.invalidateQueries({ queryKey: ["app_settings", key] });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  });
}

/**
 * Atomic patch-upsert via the deterministic-merge RPC. Simultaneous admin
 * edits deep-merge server-side (patch wins on collision, other admin's
 * untouched fields survive) so every tab converges to the same value.
 * Broadcasts on success so subscribers refresh immediately.
 */
export async function applyAppSettingsPatch(
  key: string,
  patch: Record<string, unknown>,
  baseVersion?: number | null,
): Promise<{ value: Record<string, unknown>; version: number; merged: boolean }> {
  const { data, error } = await supabase.rpc("upsert_app_setting", {
    p_key: key,
    p_patch: patch as unknown as never,
    p_base_version: baseVersion ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  broadcastAppSettingsChange(key);
  return {
    value: (row?.value ?? {}) as Record<string, unknown>,
    version: (row?.version ?? 0) as number,
    merged: Boolean(row?.merged),
  };
}