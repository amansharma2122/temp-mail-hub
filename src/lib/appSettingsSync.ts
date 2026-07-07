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
import { reportAppSettingsLatency } from "@/lib/appSettingsRum";

const CHANNEL_NAME = "nullsto:app-settings";
const STORAGE_KEY = "nullsto:app-settings:ping";

export interface AppSettingsChange {
  key: string;
  version: number | null;
  emittedAt: number;
}

type Listener = (change: AppSettingsChange) => void;
const listeners = new Set<Listener>();

// Track versions this tab has just persisted so remote-vs-local can be
// distinguished by consumers (e.g. the admin "updated in another tab"
// toast). Entries expire after LOCAL_WRITE_TTL_MS.
const LOCAL_WRITE_TTL_MS = 4_000;
const localWrites = new Map<string, number>(); // `${key}:${version}` -> ts
function markLocalWrite(key: string, version: number | null) {
  if (version == null) return;
  localWrites.set(`${key}:${version}`, Date.now());
  // GC old markers.
  const cutoff = Date.now() - LOCAL_WRITE_TTL_MS;
  for (const [k, t] of localWrites) if (t < cutoff) localWrites.delete(k);
}
export function isLocalAppSettingsWrite(key: string, version: number | null): boolean {
  if (version == null) return false;
  const t = localWrites.get(`${key}:${version}`);
  if (!t) return false;
  return Date.now() - t < LOCAL_WRITE_TTL_MS;
}

// Last-observed change per key — powers the admin debug/audit view.
const lastObserved = new Map<string, AppSettingsChange & { updated_by: string | null; merged: boolean | null }>();
export function getLastObservedAppSettings() {
  return Array.from(lastObserved.values()).sort((a, b) => b.emittedAt - a.emittedAt);
}

let bc: BroadcastChannel | null = null;
let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
let storageBound = false;

function fanout(change: AppSettingsChange, meta?: { updated_by?: string | null; merged?: boolean | null }) {
  lastObserved.set(change.key, {
    ...change,
    updated_by: meta?.updated_by ?? lastObserved.get(change.key)?.updated_by ?? null,
    merged: meta?.merged ?? lastObserved.get(change.key)?.merged ?? null,
  });
  listeners.forEach((fn) => {
    try { fn(change); } catch (e) { console.warn("[appSettingsSync] listener error", e); }
  });
}

function ensureTransport() {
  if (typeof window === "undefined") return;

  if (!bc && "BroadcastChannel" in window) {
    bc = new BroadcastChannel(CHANNEL_NAME);
    bc.onmessage = (e) => {
      const data = typeof e.data === "string" ? { key: e.data } : e.data || {};
      if (data.key) fanout({ key: data.key, version: data.version ?? null, emittedAt: data.emittedAt ?? Date.now() });
    };
  }

  if (!storageBound) {
    window.addEventListener("storage", (e) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const parsed = JSON.parse(e.newValue) as { key?: string; version?: number; t?: number };
        if (parsed?.key) fanout({ key: parsed.key, version: parsed.version ?? null, emittedAt: parsed.t ?? Date.now() });
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
          const row = (payload.new ?? payload.old) as
            | { key?: string; version?: number; updated_by?: string | null }
            | null;
          if (row?.key) {
            fanout(
              { key: row.key, version: row.version ?? null, emittedAt: Date.now() },
              { updated_by: row.updated_by ?? null },
            );
          }
        },
      )
      .subscribe();
  }
}

/** Subscribe to remote app_settings changes for one or more keys. */
export function subscribeAppSettings(
  keys: string[],
  onChange: (key: string, change?: AppSettingsChange) => void,
): () => void {
  ensureTransport();
  const listener: Listener = (change) => {
    if (keys.includes(change.key)) onChange(change.key, change);
  };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe to every app_settings key change. */
export function subscribeAllAppSettings(
  onChange: (key: string, change?: AppSettingsChange) => void,
): () => void {
  ensureTransport();
  const listener: Listener = (change) => onChange(change.key, change);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Broadcast a local settings change to every tab (this one included) and
 * every device. Call after a successful write to `app_settings`.
 */
export function broadcastAppSettingsChange(key: string, version: number | null = null): void {
  ensureTransport();
  const emittedAt = Date.now();
  fanout({ key, version, emittedAt }); // same tab
  try { bc?.postMessage({ key, version, emittedAt }); } catch { /* ignore */ }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, version, t: emittedAt }));
  } catch { /* ignore */ }
}

export function bindAppSettingsToQueryClient(
  qc: QueryClient,
  keys: string[],
): () => void {
  return subscribeAppSettings(keys, (key, change) => {
    void qc.invalidateQueries({ queryKey: ["app_settings", key] }).then(() => {
      if (change) reportAppSettingsLatency(key, change.emittedAt, change.version);
    });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  });
}

export function bindAllAppSettingsToQueryClient(qc: QueryClient): () => void {
  return subscribeAllAppSettings((key, change) => {
    void qc.invalidateQueries({ queryKey: ["app_settings", key] }).then(() => {
      if (change) reportAppSettingsLatency(key, change.emittedAt, change.version);
    });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  });
}

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
  const version = (row?.version ?? 0) as number;
  const merged = Boolean(row?.merged);
  // Track locally for the debug/audit view before broadcasting.
  lastObserved.set(key, {
    key,
    version,
    emittedAt: Date.now(),
    updated_by: lastObserved.get(key)?.updated_by ?? null,
    merged,
  });
  markLocalWrite(key, version);
  broadcastAppSettingsChange(key, version);
  return {
    value: (row?.value ?? {}) as Record<string, unknown>,
    version,
    merged,
  };
}

/**
 * Convenience wrapper used by admin write paths that historically did an
 * `existing? update : insert` on `public.app_settings`. Routes through the
 * deterministic `upsert_app_setting` RPC so that concurrent admin edits
 * deep-merge and every write instantly broadcasts to every tab/device.
 *
 * `value` may be any JSON — for scalar/array values the RPC replaces the
 * row's value (deep-merge only recurses on objects), which matches the
 * previous overwrite semantics of the raw `.upsert`/`.update` calls.
 */
export async function saveAppSetting(
  key: string,
  value: unknown,
  baseVersion?: number | null,
): Promise<{ value: unknown; version: number; merged: boolean }> {
  return applyAppSettingsPatch(
    key,
    value as Record<string, unknown>,
    baseVersion,
  );
}