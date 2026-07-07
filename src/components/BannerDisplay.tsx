import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { ExternalLink, RadioTower, RefreshCw } from "lucide-react";
import DOMPurify from "dompurify";
import { supabase } from "@/integrations/supabase/client";
import { reportRealtimeStatus, clearRealtimeStatus } from "@/lib/realtimeHealth";
import { useAdminRole } from "@/hooks/useAdminRole";

interface Banner {
  id: string;
  name: string;
  position: string;
  type: "image" | "html" | "script" | "text";
  content: string | null;
  image_url: string | null;
  link_url: string | null;
  is_active: boolean;
  priority: number;
  start_date: string | null;
  end_date: string | null;
}

interface BannerDisplayProps {
  position: "header" | "sidebar" | "content" | "footer";
  className?: string;
}

const BannerDisplay = ({ position, className = "" }: BannerDisplayProps) => {
  const cacheKey = `nullsto:banner-cache:${position}`;
  const ttlKey = "nullsto:banner-cache-ttl-min";
  const getTtlMs = () => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(ttlKey) : null;
      const min = raw ? Number(raw) : NaN;
      return (Number.isFinite(min) && min > 0 ? min : 24 * 60) * 60_000;
    } catch { return 24 * 60 * 60_000; }
  };
  const readCache = (): Banner[] => {
    try {
      const raw = typeof window !== "undefined" ? localStorage.getItem(cacheKey) : null;
      if (!raw) return [];
      const parsed = JSON.parse(raw) as { at: number; data: Banner[] };
      // Discard cache older than the admin-configured TTL.
      if (!parsed?.data || Date.now() - (parsed.at || 0) > getTtlMs()) return [];
      return parsed.data;
    } catch { return []; }
  };
  const [banners, setBanners] = useState<Banner[]>(() => readCache());
  const [isLoading, setIsLoading] = useState(true);
  const [realtimeMode, setRealtimeMode] = useState<"live" | "polling" | "connecting">("connecting");
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const { isAdmin } = useAdminRole();

  // Fetch admin-configured TTL once and cache in localStorage.
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase
          .from("app_settings")
          .select("value")
          .eq("key", "banner_cache_ttl_minutes")
          .maybeSingle();
        const m = (data?.value as { minutes?: number } | null)?.minutes;
        if (typeof m === "number" && m > 0) localStorage.setItem(ttlKey, String(m));
      } catch { /* ignore — falls back to default */ }
    })();
  }, []);

  const fetchBanners = useCallback(async (attempt = 0) => {
    const maxRetries = 3;
    const backoffMs = Math.min(1000 * Math.pow(2, attempt), 5000);
    
    try {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("banners")
        .select("id, name, position, type, content, image_url, link_url, is_active, priority, start_date, end_date")
        .eq("position", position)
        .eq("is_active", true)
        .order("priority", { ascending: false });

      if (error) {
        const isRetryable = error.message?.includes('Failed to fetch') || 
                            error.message?.includes('fetch') ||
                            error.message?.includes('timeout');
        
        if (isRetryable && attempt < maxRetries) {
          console.log(`[BannerDisplay] Retrying in ${backoffMs}ms (attempt ${attempt + 1})...`);
          setTimeout(() => fetchBanners(attempt + 1), backoffMs);
          return;
        }
        console.error("Error fetching banners:", error);
        setIsLoading(false);
        return;
      }

      // Filter by date range on client side
      const activeBanners = (data || []).filter((banner) => {
        const startOk = !banner.start_date || new Date(banner.start_date) <= new Date(now);
        const endOk = !banner.end_date || new Date(banner.end_date) >= new Date(now);
        return startOk && endOk;
      }) as Banner[];

      setBanners(activeBanners);
      try {
        localStorage.setItem(cacheKey, JSON.stringify({ at: Date.now(), data: activeBanners }));
      } catch { /* quota / private mode */ }
      setIsLoading(false);
    } catch (err: any) {
      console.error("Failed to fetch banners:", err);
      if (attempt < maxRetries) {
        setTimeout(() => fetchBanners(attempt + 1), backoffMs);
        return;
      }
      setIsLoading(false);
    }
  }, [position]);

  useEffect(() => {
    let cancelled = false;
    let pollingId: ReturnType<typeof setInterval> | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const doFetch = async () => {
      if (!cancelled) await fetchBanners();
    };

    doFetch();

    const healthKey = `BannerDisplay:${position}`;

    const startPolling = () => {
      if (pollingId) return;
      setRealtimeMode("polling");
      pollingId = setInterval(() => {
        if (!cancelled) fetchBanners();
      }, 30_000);
    };

    const attemptSubscribe = () => {
      if (cancelled) return;
      const channelName = `banners_realtime_${position}_${Math.random().toString(36).slice(2)}`;
      setRealtimeMode("connecting");
      try {
        reportRealtimeStatus(healthKey, channelName, "subscribing");
        channel = supabase.channel(channelName);
        channel
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "banners" },
            (payload) => {
              if (!cancelled) {
                console.log("[BannerDisplay] Realtime update received:", payload.eventType);
                fetchBanners();
              }
            },
          )
          .subscribe((status, err) => {
            if (status === "SUBSCRIBED") {
              reportRealtimeStatus(healthKey, channelName, "subscribed");
              retryCount = 0;
              if (pollingId) { clearInterval(pollingId); pollingId = null; }
              setRealtimeMode("live");
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              reportRealtimeStatus(healthKey, channelName, status === "TIMED_OUT" ? "timed_out" : "error", err);
              startPolling();
              scheduleRetry();
            } else if (status === "CLOSED") {
              reportRealtimeStatus(healthKey, channelName, "closed");
            }
          });
      } catch (err) {
        console.warn("[BannerDisplay] Realtime subscription failed, using polling fallback:", err);
        reportRealtimeStatus(healthKey, channelName, "error", err);
        startPolling();
        scheduleRetry();
      }
    };

    const scheduleRetry = () => {
      if (cancelled || retryCount >= MAX_RETRIES) return;
      retryCount += 1;
      const delay = 60_000; // 60s between retries
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        if (cancelled) return;
        if (channel) {
          try { supabase.removeChannel(channel); } catch { /* ignore */ }
          channel = null;
        }
        attemptSubscribe();
      }, delay);
    };

    attemptSubscribe();

    return () => {
      cancelled = true;
      if (pollingId) clearInterval(pollingId);
      if (retryTimer) clearTimeout(retryTimer);
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // ignore
        }
      }
      clearRealtimeStatus(healthKey);
    };
  }, [position, fetchBanners]);

  const handleBannerClick = async (banner: Banner) => {
    // Track click in database - increment via SQL
    try {
      const { data } = await supabase
        .from("banners")
        .select("click_count")
        .eq("id", banner.id)
        .single();
      
      if (data) {
        await supabase
          .from("banners")
          .update({ click_count: (data.click_count || 0) + 1 })
          .eq("id", banner.id);
      }
    } catch (err) {
      // Silently fail click tracking
    }

    if (banner.link_url) {
      window.open(banner.link_url, "_blank", "noopener,noreferrer");
    }
  };

  const trackView = async (bannerId: string) => {
    try {
      const { data } = await supabase
        .from("banners")
        .select("view_count")
        .eq("id", bannerId)
        .single();
      
      if (data) {
        await supabase
          .from("banners")
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq("id", bannerId);
      }
    } catch (err) {
      // Silently fail view tracking
    }
  };

  useEffect(() => {
    banners.forEach((banner) => trackView(banner.id));
  }, [banners]);

  // Don't render anything if no banners — avoids layout shift.
  if (banners.length === 0) return null;

  const manualRefresh = async () => {
    setManualRefreshing(true);
    try { await fetchBanners(); } finally { setManualRefreshing(false); }
  };

  const positionStyles: Record<string, string> = {
    header: "w-full py-2",
    sidebar: "w-full",
    content: "w-full my-4",
    footer: "w-full py-2",
  };

  return (
    <div className={`${positionStyles[position]} ${className} relative`}>
      {realtimeMode === "polling" && (
        <div
          className={`absolute top-1 right-1 z-10 text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
            isAdmin
              ? "bg-amber-500/15 text-amber-600 border border-amber-500/30"
              : "bg-muted text-muted-foreground border border-border/50 opacity-70"
          }`}
          title={
            isAdmin
              ? "Realtime channel unavailable — refreshing every 30s"
              : "Temporarily syncing — content refreshes every 30 seconds"
          }
          aria-live="polite"
        >
          <RadioTower className={`w-3 h-3 ${!isAdmin ? "animate-pulse" : ""}`} />
          {isAdmin ? "Live updates paused — polling" : "Temporarily syncing…"}
          <button
            type="button"
            onClick={manualRefresh}
            disabled={manualRefreshing}
            aria-label="Refresh banners now"
            className="ml-1 -mr-1 rounded-full p-0.5 hover:bg-foreground/10 focus:outline-none focus:ring-1 focus:ring-current pointer-events-auto disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${manualRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      )}
      {banners.map((banner, index) => (
        <motion.div
          key={banner.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: index * 0.1 }}
          className={`relative ${banner.link_url ? "cursor-pointer" : ""}`}
          onClick={() => banner.link_url && handleBannerClick(banner)}
        >
          {banner.type === "image" && banner.image_url && (
            <div className="relative group overflow-hidden rounded-lg">
              <img
                src={banner.image_url}
                alt={banner.name}
                className="w-full h-auto object-cover transition-transform group-hover:scale-105"
              />
              {banner.link_url && (
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <ExternalLink className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
            </div>
          )}

          {banner.type === "html" && (
            <div
              className="banner-html-content"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content || '') }}
            />
          )}

          {banner.type === "text" && (
            <div className="p-4 bg-primary/10 rounded-lg border border-primary/20 text-center">
              <p className="text-foreground">{banner.content || ''}</p>
              {banner.link_url && (
                <span className="text-primary text-sm hover:underline">
                  Learn more →
                </span>
              )}
            </div>
          )}

          {banner.type === "script" && (
            <div
              className="banner-script-container"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(banner.content, { ADD_TAGS: ['script'], ADD_ATTR: ['src'] }) }}
            />
          )}
        </motion.div>
      ))}
    </div>
  );
};

export default BannerDisplay;