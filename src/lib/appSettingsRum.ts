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
  return { BUFFER, flush };
}