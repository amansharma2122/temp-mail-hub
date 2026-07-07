import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  subscribeAllAppSettings,
  isLocalAppSettingsWrite,
} from "@/lib/appSettingsSync";
import { reportAppSettingsToastEvent } from "@/lib/appSettingsRum";
import { useLanguage } from "@/contexts/LanguageContext";

/**
 * Renders nothing. Listens for `app_settings` changes that did NOT
 * originate in the current tab and surfaces a small confirmation toast
 * with the merged version that was applied — helpful when multiple admins
 * are editing simultaneously.
 */
const AdminAppSettingsUpdateToast = () => {
  // Coalesce rapid bursts on the same key so we don't spam the admin.
  const lastShown = useRef<Map<string, number>>(new Map());
  const { t, isRTL } = useLanguage();

  useEffect(() => {
    const off = subscribeAllAppSettings((key, change) => {
      if (!change) return;
      const isLocal = isLocalAppSettingsWrite(key, change.version);
      if (isLocal) {
        // Emit a local-skip RUM sample so we can measure signal-to-noise
        // ratio across sessions, then drop the toast itself.
        reportAppSettingsToastEvent({
          key,
          remote: false,
          version: change.version ?? null,
          delay_ms: Date.now() - change.emittedAt,
        });
        return;
      }

      const now = Date.now();
      const last = lastShown.current.get(key) ?? 0;
      if (now - last < 1500) return;
      lastShown.current.set(key, now);

      const versionLabel =
        change.version != null
          ? `v${change.version}`
          : t("adminSettingsUpdatedVersionFallback");
      const description = t("adminSettingsUpdatedDescription")
        .replace("{key}", key)
        .replace("{version}", versionLabel);

      toast(t("adminSettingsUpdatedTitle"), {
        description,
        duration: 4000,
        // sonner respects the document-level `dir` attribute, but we set
        // it explicitly here so screen readers announce direction even if
        // the toast root is portalled outside the localized subtree.
        dir: isRTL ? "rtl" : "ltr",
      });

      reportAppSettingsToastEvent({
        key,
        remote: true,
        version: change.version ?? null,
        delay_ms: now - change.emittedAt,
      });
    });
    return off;
  }, [t, isRTL]);

  return null;
};

export default AdminAppSettingsUpdateToast;