import { supabase } from "@/integrations/supabase/client";
import type { NewEmailToastStyle } from "@/components/NewEmailToast";

const STORAGE_KEY = "new_email_notification_style";
const SOUND_KEY = "new_email_sound_admin_enabled";
const DEFAULT_STYLE: NewEmailToastStyle = "bounce_confetti";
let cached: NewEmailToastStyle | null = null;
let inflight: Promise<NewEmailToastStyle> | null = null;
let cachedSound: boolean | null = null;
let inflightSound: Promise<boolean> | null = null;

function readCache(): NewEmailToastStyle {
  if (cached) return cached;
  try {
    const v = localStorage.getItem(STORAGE_KEY) as NewEmailToastStyle | null;
    if (v === "slide_glow" || v === "bounce_confetti" || v === "both") return v;
  } catch { /* localStorage may be unavailable */ }
  return DEFAULT_STYLE;
}

export function getNewEmailNotificationStyleSync(): NewEmailToastStyle {
  return cached ?? readCache();
}

/** Fetch (once) the admin-configured notification style and cache it. */
export async function getNewEmailNotificationStyle(): Promise<NewEmailToastStyle> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", STORAGE_KEY)
        .maybeSingle();
      const raw = (data as any)?.value;
      const val: NewEmailToastStyle =
        raw === "slide_glow" || raw === "bounce_confetti" || raw === "both"
          ? raw
          : (raw?.style === "slide_glow" || raw?.style === "bounce_confetti" || raw?.style === "both")
            ? raw.style
            : DEFAULT_STYLE;
      cached = val;
      try { localStorage.setItem(STORAGE_KEY, val); } catch { /* noop */ }
      return val;
    } catch {
      const fallback = readCache();
      cached = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function setNewEmailNotificationStyleCache(style: NewEmailToastStyle) {
  cached = style;
  try { localStorage.setItem(STORAGE_KEY, style); } catch { /* noop */ }
}

// --- Admin-controlled sound gate ---------------------------------------------
// Distinct from the per-user "enable notification sounds" toggle: this is a
// site-wide switch admins can flip to silence realtime new-email sound
// notifications for everyone (e.g. if a bug causes flooding).

function readSoundCache(): boolean {
  if (cachedSound !== null) return cachedSound;
  try {
    const v = localStorage.getItem(SOUND_KEY);
    if (v === "true") return true;
    if (v === "false") return false;
  } catch { /* noop */ }
  return true; // default on
}

export function getNewEmailSoundAdminEnabledSync(): boolean {
  return cachedSound ?? readSoundCache();
}

export async function getNewEmailSoundAdminEnabled(): Promise<boolean> {
  if (cachedSound !== null) return cachedSound;
  if (inflightSound) return inflightSound;
  inflightSound = (async () => {
    try {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", SOUND_KEY)
        .maybeSingle();
      const raw = (data as any)?.value;
      const val = raw === false || raw === "false" || raw?.enabled === false ? false : true;
      cachedSound = val;
      try { localStorage.setItem(SOUND_KEY, val ? "true" : "false"); } catch { /* noop */ }
      return val;
    } catch {
      const fallback = readSoundCache();
      cachedSound = fallback;
      return fallback;
    } finally {
      inflightSound = null;
    }
  })();
  return inflightSound;
}

export function setNewEmailSoundAdminEnabledCache(enabled: boolean) {
  cachedSound = enabled;
  try { localStorage.setItem(SOUND_KEY, enabled ? "true" : "false"); } catch { /* noop */ }
}