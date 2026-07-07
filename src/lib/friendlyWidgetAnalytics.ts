import { supabase } from "@/integrations/supabase/client";

// Lightweight, best-effort analytics for the Friendly Websites widget.
// Never throws — we don't want telemetry to break UX.

export type FriendlyWidgetEvent =
  | "manual_open"
  | "auto_open"
  | "click"
  | "badge_shown"
  | "anim_start"
  | "anim_complete"
  | "render_latency";

const SESSION_KEY = "nullsto:friendly-session-id";

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? String(Date.now()) + Math.random().toString(36).slice(2);
      sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

export async function recordFriendlyWidgetEvent(
  event_type: FriendlyWidgetEvent,
  opts: {
    website_id?: string | null;
    attention_effect?: string | null;
    sample_ms?: number | null;
  } = {},
): Promise<void> {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const user_id = authData?.user?.id ?? null;
    await supabase.from("friendly_widget_events").insert({
      event_type,
      website_id: opts.website_id ?? null,
      attention_effect: opts.attention_effect ?? null,
      sample_ms: opts.sample_ms ?? null,
      session_id: getSessionId(),
      user_id,
    } as any);
  } catch {
    // swallow — telemetry must not break the widget
  }
}

// Client-side per-day badge cap: returns true if a badge for `siteId` may be
// shown right now, and records the display if so.
const BADGE_KEY = "nullsto:friendly-badge-counts";

type BadgeCountMap = Record<string, { date: string; count: number }>;

function readBadgeMap(): BadgeCountMap {
  try {
    const raw = localStorage.getItem(BADGE_KEY);
    return raw ? (JSON.parse(raw) as BadgeCountMap) : {};
  } catch { return {}; }
}

export function canShowBadge(siteId: string, maxPerDay: number): boolean {
  if (!maxPerDay || maxPerDay <= 0) return true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const map = readBadgeMap();
    const entry = map[siteId];
    if (!entry || entry.date !== today) return true;
    return entry.count < maxPerDay;
  } catch { return true; }
}

export function noteBadgeShown(siteId: string): void {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const map = readBadgeMap();
    const entry = map[siteId];
    map[siteId] = {
      date: today,
      count: entry && entry.date === today ? entry.count + 1 : 1,
    };
    localStorage.setItem(BADGE_KEY, JSON.stringify(map));
  } catch { /* ignore */ }
}

// Respect the OS-level "reduce motion" preference. Falls back to false if
// matchMedia isn't available (SSR / tests).
export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined"
      && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}