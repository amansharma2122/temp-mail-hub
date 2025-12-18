import { useEffect } from "react";

const CACHE_REFRESH_KEY = "nullsto_cache_refresh_version";
const CACHE_REFRESH_VERSION = "2025-12-18-01";

export default function CacheRefresh() {
  useEffect(() => {
    const run = async () => {
      try {
        const last = localStorage.getItem(CACHE_REFRESH_KEY);
        if (last === CACHE_REFRESH_VERSION) return;

        // Clear Cache Storage (does NOT touch localStorage sessions/tokens)
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }

        // Ask any registered service worker to update (push notifications remain intact)
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.update()));
        }

        localStorage.setItem(CACHE_REFRESH_KEY, CACHE_REFRESH_VERSION);
      } catch {
        // ignore
      }
    };

    void run();
  }, []);

  return null;
}
