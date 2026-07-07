import { supabase } from "@/integrations/supabase/client";
import type { NewEmailToastStyle } from "@/components/NewEmailToast";

const STORAGE_KEY = "new_email_notification_style";
const DEFAULT_STYLE: NewEmailToastStyle = "bounce_confetti";
let cached: NewEmailToastStyle | null = null;
let inflight: Promise<NewEmailToastStyle> | null = null;

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