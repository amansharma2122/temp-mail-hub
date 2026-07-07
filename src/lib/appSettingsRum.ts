// Lightweight RUM for admin app_settings update-to-UI latency.
//
// Every time a settings change is observed (broadcast, storage event, or
// realtime), we record the time between the emit and the moment the
// QueryClient finishes invalidating the corresponding cache entry. Buffers
// in memory and flushes small batches to `friendly_widget_events` so we
// don't need an extra table.

import { supabase } from "@/integrations/supabase/client";
import { getAppSettingsKeyLabel } from "@/lib/appSettingsKeyRoutes";

interface Sample {
  event_type: "app_settings_latency" | "app_settings_toast";
  key: string;
  key_label?: string;
  version: number | null;
  latency_ms: number;
  remote?: boolean;
  delay_ms?: number;
  toast_visible_delay_ms?: number;
  delay_threshold_ms?: number;
  delay_exceeded_threshold?: boolean;
  observed_at: string;
}

const BUFFER: Sample[] = [];
const FLUSH_MS = 15_000;
const MAX_BUFFER = 40;
export const APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS = 5_000;
let timer: ReturnType<typeof setTimeout> | null = null;

// Sampling + per-key throttling keeps this pipeline light: we never emit
// more than one sample per key per THROTTLE_MS window, and only SAMPLE_RATE
// of qualifying samples make it into the buffer at all. Both can be tuned
// via `configureAppSettingsRum` (used by tests).
let SAMPLE_RATE = 0.25; // 25% of events
let THROTTLE_MS = 2_000; // one sample per key per 2s
const lastSampledAt = new Map<string, number>();

export function configureAppSettingsRum(opts: { sampleRate?: number; throttleMs?: number }) {
  if (typeof opts.sampleRate === "number") SAMPLE_RATE = Math.min(1, Math.max(0, opts.sampleRate));
  if (typeof opts.throttleMs === "number") THROTTLE_MS = Math.max(0, opts.throttleMs);
}

function scheduleFlush() {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flush();
  }, FLUSH_MS);
}

async function flush() {
  if (!BUFFER.length) return;
  const batch = BUFFER.splice(0, BUFFER.length);
  try {
    await supabase.from("friendly_widget_events").insert(
      batch.map((s) => ({
        event_type: s.event_type,
        sample_ms: s.latency_ms,
        attention_effect:
          s.event_type === "app_settings_toast"
            ? `${s.key}:${s.remote ? "remote" : "local"}:v${s.version ?? "?"}`
            : `${s.key}:v${s.version ?? "?"}`,
      })),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug("[appSettingsRum] flush failed", err);
  }
}

export function reportAppSettingsLatency(
  key: string,
  emittedAt: number,
  version: number | null,
): void {
  const latency = Math.max(0, Date.now() - emittedAt);

  // Per-key throttle window — drop repeat noise.
  const now = Date.now();
  const last = lastSampledAt.get(key) ?? 0;
  if (now - last < THROTTLE_MS) return;

  // Random sampling — keep pipeline cheap on high-volume tabs.
  if (Math.random() >= SAMPLE_RATE) return;
  lastSampledAt.set(key, now);

  BUFFER.push({
    event_type: "app_settings_latency",
    key,
    key_label: getAppSettingsKeyLabel(key),
    version,
    latency_ms: latency,
    observed_at: new Date().toISOString(),
  });
  if (BUFFER.length >= MAX_BUFFER) void flush();
  else scheduleFlush();
}

export function __appSettingsRumInternals() {
  return { BUFFER, flush, lastSampledAt };
}

// -----------------------------------------------------------------------
// Admin cross-tab UPDATE-TOAST telemetry
// -----------------------------------------------------------------------
//
// Emits a separate RUM event whenever the admin sees the cross-tab
// "settings updated in another tab" toast. Payload includes:
//   - whether the update was remote (vs skipped/local)
//   - the applied merged version
//   - end-to-end delay from emit to toast display

export interface AppSettingsToastRum {
  key: string;
  remote: boolean;
  version: number | null;
  /** Pre-paint fallback delay from receipt to toast request. */
  delay_ms: number;
  /**
   * End-to-end delay measured from remote patch receipt (broadcast/realtime
   * event) to the moment sonner actually rendered the toast in the DOM.
   * Included in the RUM payload as `toast_visible_delay_ms`.
   */
  toast_visible_delay_ms?: number;
}

export function reportAppSettingsToastEvent(sample: AppSettingsToastRum): void {
  const visibleDelay = Math.max(
    0,
    typeof sample.toast_visible_delay_ms === "number"
      ? sample.toast_visible_delay_ms
      : sample.delay_ms,
  );
  BUFFER.push({
    event_type: "app_settings_toast",
    key: sample.key,
    key_label: getAppSettingsKeyLabel(sample.key),
    version: sample.version,
    remote: sample.remote,
    delay_ms: visibleDelay,
    toast_visible_delay_ms: visibleDelay,
    delay_threshold_ms: APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS,
    delay_exceeded_threshold: visibleDelay > APP_SETTINGS_TOAST_DELAY_THRESHOLD_MS,
    latency_ms: visibleDelay,
    observed_at: new Date().toISOString(),
  });
  if (BUFFER.length >= MAX_BUFFER) void flush();
  else scheduleFlush();
}