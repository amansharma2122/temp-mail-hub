// Lightweight RUM pipeline for realtime email updates.
//
// Tracks two signals per mailbox subscription:
//   * update latency  — ms between the DB row's `received_at` (or `created_at`)
//                       and the moment the client observed the INSERT payload.
//   * missed messages — realtime rows whose IDs we hadn't seen in the last
//                       polled snapshot for a given mailbox. Callers report
//                       this via `reportMissedMessages`.
//
// Events are buffered in memory and flushed in small batches to
// `friendly_widget_events` (existing generic client-event sink) so we don't
// need a new table. `surface` distinguishes `inbox` vs `admin` callers.

import { supabase } from "@/integrations/supabase/client";

export type RumSurface = "inbox" | "admin";

interface RumEvent {
  event_type: "realtime_email_latency" | "realtime_email_missed";
  surface: RumSurface;
  temp_email_id?: string | null;
  latency_ms?: number;
  missed_count?: number;
  observed_at: string;
}

const BUFFER: RumEvent[] = [];
const FLUSH_INTERVAL_MS = 15_000;
const MAX_BUFFER = 40;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  if (BUFFER.length === 0) return;
  const batch = BUFFER.splice(0, BUFFER.length);
  try {
    // Best-effort — swallow failures so RUM never breaks UX.
    await supabase.from("friendly_widget_events").insert(
      batch.map((e) => ({
        event_name: e.event_type,
        payload: {
          surface: e.surface,
          temp_email_id: e.temp_email_id ?? null,
          latency_ms: e.latency_ms ?? null,
          missed_count: e.missed_count ?? null,
          observed_at: e.observed_at,
        },
      })),
    );
  } catch (err) {
    // eslint-disable-next-line no-console
    console.debug("[realtimeEmailRum] flush failed", err);
  }
}

function push(event: RumEvent) {
  BUFFER.push(event);
  if (BUFFER.length >= MAX_BUFFER) {
    void flush();
  } else {
    scheduleFlush();
  }
}

export function reportRealtimeLatency(
  surface: RumSurface,
  tempEmailId: string | null | undefined,
  serverTimestampIso: string | null | undefined,
): void {
  if (!serverTimestampIso) return;
  const serverMs = Date.parse(serverTimestampIso);
  if (Number.isNaN(serverMs)) return;
  const latency = Math.max(0, Date.now() - serverMs);
  push({
    event_type: "realtime_email_latency",
    surface,
    temp_email_id: tempEmailId ?? null,
    latency_ms: latency,
    observed_at: new Date().toISOString(),
  });
}

export function reportMissedMessages(
  surface: RumSurface,
  tempEmailId: string | null | undefined,
  missed: number,
): void {
  if (!missed || missed <= 0) return;
  push({
    event_type: "realtime_email_missed",
    surface,
    temp_email_id: tempEmailId ?? null,
    missed_count: missed,
    observed_at: new Date().toISOString(),
  });
}

// Test hook — do not use in app code.
export function __rumInternals() {
  return { BUFFER, flush };
}