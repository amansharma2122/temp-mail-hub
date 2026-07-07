import { useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  subscribeAllAppSettings,
  isLocalAppSettingsWrite,
} from "@/lib/appSettingsSync";

/**
 * Renders nothing. Listens for `app_settings` changes that did NOT
 * originate in the current tab and surfaces a small confirmation toast
 * with the merged version that was applied — helpful when multiple admins
 * are editing simultaneously.
 */
const AdminAppSettingsUpdateToast = () => {
  // Coalesce rapid bursts on the same key so we don't spam the admin.
  const lastShown = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const off = subscribeAllAppSettings((key, change) => {
      if (!change) return;
      // Skip local writes so admins only see cross-tab / cross-device edits.
      if (isLocalAppSettingsWrite(key, change.version)) return;

      const now = Date.now();
      const last = lastShown.current.get(key) ?? 0;
      if (now - last < 1500) return;
      lastShown.current.set(key, now);

      const versionLabel =
        change.version != null ? `v${change.version}` : "latest version";
      toast(`Settings updated in another tab`, {
        description: `"${key}" merged and applied (${versionLabel}).`,
        duration: 4000,
      });
    });
    return off;
  }, []);

  return null;
};

export default AdminAppSettingsUpdateToast;