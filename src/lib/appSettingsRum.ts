// Lightweight RUM for admin app_settings update-to-UI latency.
//
// Every time a settings change is observed (broadcast, storage event, or
// realtime), we record the time between the emit and the moment the
// QueryClient finishes invalidating the corresponding cache entry. Buffers
// in memory and flushes small batches to `friendly_widget_events` so we
// don't need an extra table.

import { supabase } from "@/integrations/supabase/client";

interface Sample {
  key: string;
  version: number | null;
  latency_ms: number;
  observed_at: string;
}

const BUFFER: Sample[] = [];
const FLUSH_MS = 15_000;
const MAX_BUFFER = 40;
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
        event_type: "app_settings_latency",
        sample_ms: s.latency_ms,
        attention_effect: `${s.key}:v${s.version ?? "?"}`,
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
    key,
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