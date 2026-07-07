import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  subscribeAllAppSettings,
  isLocalAppSettingsWrite,
} from "@/lib/appSettingsSync";
import { reportAppSettingsToastEvent } from "@/lib/appSettingsRum";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAppSettingsKeyLabel, getAppSettingsRoute } from "@/lib/appSettingsKeyRoutes";
import { useNavigate } from "react-router-dom";

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
  const navigate = useNavigate();

  const openSettingRoute = (route: string) => {
    navigate(route);
    const hash = route.split("#")[1];
    if (!hash) return;
    window.setTimeout(() => {
      const el = document.getElementById(hash);
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      if (el instanceof HTMLElement) {
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
        el.focus({ preventScroll: true });
      }
    }, 50);
  };

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
      const keyLabel = getAppSettingsKeyLabel(key);
      const description = t("adminSettingsUpdatedDescription")
        .replace("{key}", key)
        .replace("{keyLabel}", keyLabel)
        .replace("{version}", versionLabel);

      const route = getAppSettingsRoute(key);
      const shownAt = Date.now();
      toast(t("adminSettingsUpdatedTitle"), {
        description,
        duration: 4000,
        // The document-level `dir` attribute (set by LanguageProvider) is
        // what actually flips the toast layout — including here as a data
        // attribute so tests can assert per-toast direction.
        className: `app-settings-update-toast max-w-full break-words ${isRTL ? "rtl" : "ltr"}`,
        ariaProps: {
          role: "status",
          "aria-live": "polite",
        },
        action: route
          ? {
              label: t("adminSettingsUpdatedOpen"),
              onClick: () => openSettingRoute(route),
            }
          : undefined,
      });

      // Measure end-to-end delay from remote patch receipt to the moment
      // the toast is actually painted. Using rAF gives us the first frame
      // after sonner commits the DOM node.
      const measureVisible = () => {
        const visibleAt = Date.now();
        reportAppSettingsToastEvent({
          key,
          remote: true,
          version: change.version ?? null,
          delay_ms: shownAt - change.emittedAt,
          toast_visible_delay_ms: visibleAt - change.emittedAt,
        });
      };
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(measureVisible);
      } else {
        measureVisible();
      }
    });
    return off;
  }, [t, isRTL, navigate]);

  return null;
};

export default AdminAppSettingsUpdateToast;