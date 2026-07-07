// Lightweight, dependency-free telemetry for BannerDisplay resilience events.
//
// Emits three signals so ops/admin dashboards can alert when the banner
// fallback path is being used repeatedly:
//   - realtime_failure       — realtime channel errored / timed out
//   - polling_started        — fell back to 30s polling
//   - manual_refresh         — user/admin clicked "Refresh now"
//
// The module is intentionally storage-only + CustomEvent so it works in tests
// (jsdom) and never adds network dependencies. Consumers (admin widgets, an
// external alerting worker) can read the rolling counter or subscribe to
// `window` events.

export type BannerTelemetryEvent =
  | "realtime_failure"
  | "polling_started"
  | "manual_refresh";

export interface BannerTelemetryPayload {
  event: BannerTelemetryEvent;
  position: string;
  at: number;
  detail?: Record<string, unknown>;
}

const STORAGE_KEY = "nullsto:banner-telemetry:v1";
const MAX_ENTRIES = 200;
// Rolling window used by consumers to decide when to alert.
export const ALERT_WINDOW_MS = 10 * 60_000;
export const ALERT_THRESHOLD = 5;

function safeRead(): BannerTelemetryPayload[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as BannerTelemetryPayload[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(entries: BannerTelemetryPayload[]) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function recordBannerTelemetry(
  event: BannerTelemetryEvent,
  position: string,
  detail?: Record<string, unknown>,
): BannerTelemetryPayload {
  const payload: BannerTelemetryPayload = {
    event,
    position,
    at: Date.now(),
    detail,
  };
  const next = [...safeRead(), payload].slice(-MAX_ENTRIES);
  safeWrite(next);
  try {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("nullsto:banner-telemetry", { detail: payload }),
      );
    }
  } catch {
    /* ignore */
  }
  // Structured console breadcrumb so remote log collectors can pick it up.
  // Kept at info level to avoid noisy error reporting for expected fallbacks.
  // eslint-disable-next-line no-console
  console.info("[banner-telemetry]", payload);
  return payload;
}

export function getBannerTelemetry(): BannerTelemetryPayload[] {
  return safeRead();
}

export function clearBannerTelemetry() {
  safeWrite([]);
}

export function countRecentEvents(
  event: BannerTelemetryEvent,
  windowMs: number = ALERT_WINDOW_MS,
): number {
  const cutoff = Date.now() - windowMs;
  return safeRead().filter((e) => e.event === event && e.at >= cutoff).length;
}

export function shouldAlertFallback(): boolean {
  return (
    countRecentEvents("realtime_failure") >= ALERT_THRESHOLD ||
    countRecentEvents("polling_started") >= ALERT_THRESHOLD
  );
}