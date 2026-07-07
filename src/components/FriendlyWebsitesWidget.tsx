import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X, Sparkles, AlertCircle, RefreshCw } from "lucide-react";
import * as LucideIcons from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  recordFriendlyWidgetEvent,
  canShowBadge,
  noteBadgeShown,
  prefersReducedMotion,
} from "@/lib/friendlyWidgetAnalytics";

interface FriendlyWebsite {
  id: string;
  name: string;
  url: string;
  icon_url: string | null;
  icon_name?: string | null;
  description: string | null;
  display_order: number;
  is_active: boolean;
  open_in_new_tab: boolean;
  // Per-site notification rules (all optional; nulls inherit widget settings).
  attention_effect?: string | null;
  badge_enabled?: boolean | null;
  badge_text?: string | null;
  auto_open_override?: boolean | null;
  max_badge_per_day?: number | null;
}

interface WidgetSettings {
  enabled: boolean;
  visibleToPublic: boolean;
  visibleToLoggedIn: boolean;
  colorScheme: 'primary' | 'accent' | 'gradient' | 'glass';
  size: 'small' | 'medium' | 'large';
  position: 'left' | 'right';
  showOnMobile: boolean;
  animationType: 'slide' | 'fade' | 'bounce' | 'flip' | 'zoom';
  attentionEffect?:
    | 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring'
    | 'sparkle' | 'confetti' | 'ripple' | 'rainbow' | 'magnet';
  buttonLabel?: string;
  tooltipText?: string;
  showBadge?: boolean;
  badgeText?: string;
  triggerIcon?: string;
  autoOpenDelayMs?: number;
  showLabelOnTrigger?: boolean;
  animationIntensity?: 'subtle' | 'normal' | 'lively';
  disableEffectsOnReducedMotion?: boolean;
  // Admin-forced motion policy — persisted site-wide default.
  //  'respect_user': honor prefers-reduced-motion (default).
  //  'always_on':    force reduced motion for every visitor.
  //  'never':        ignore OS preference (use with caution).
  reducedMotionMode?: 'respect_user' | 'always_on' | 'never';
}

const defaultSettings: WidgetSettings = {
  enabled: true,
  visibleToPublic: true,
  visibleToLoggedIn: true,
  colorScheme: 'primary',
  size: 'medium',
  position: 'right',
  showOnMobile: true,
  animationType: 'slide',
  attentionEffect: 'pulse',
  buttonLabel: 'Partner Sites',
  tooltipText: 'Explore our partner sites',
  showBadge: true,
  badgeText: '',
  triggerIcon: 'Sparkles',
  autoOpenDelayMs: 0,
  showLabelOnTrigger: true,
  animationIntensity: 'normal',
  disableEffectsOnReducedMotion: true,
  reducedMotionMode: 'respect_user',
};

const renderLucide = (name: string | null | undefined, className = "w-5 h-5") => {
  if (!name) return null;
  const Icon = (LucideIcons as any)[name];
  if (!Icon || typeof Icon !== 'function') return null;
  return <Icon className={className} />;
};

interface FriendlyWebsitesWidgetProps {
  /** When set, bypass DB and render with these settings (used by admin preview). */
  overrideSettings?: Partial<WidgetSettings>;
  /** When set, bypass DB and render with these websites (used by admin preview). */
  overrideWebsites?: FriendlyWebsite[];
}

const FriendlyWebsitesWidget = ({
  overrideSettings,
  overrideWebsites,
}: FriendlyWebsitesWidgetProps = {}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  // Burst effect triggered when the user clicks the trigger — a lightweight
  // site-wide sparkle overlay that respects reduced-motion.
  const [burstAt, setBurstAt] = useState<number | null>(null);
  // Track OS-level reduce-motion. Updates live if the user toggles it.
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => prefersReducedMotion());
  // Consistent live-region message. We derive it from state transitions in a
  // dedicated effect so screen readers get one clear announcement per event
  // (open / close / highlight / sync error) instead of overlapping strings.
  const [liveMessage, setLiveMessage] = useState<string>("");
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mq.matches);
    try { mq.addEventListener("change", onChange); } catch { mq.addListener(onChange); }
    return () => {
      try { mq.removeEventListener("change", onChange); } catch { mq.removeListener(onChange); }
    };
  }, []);

  // Fetch settings with React Query for caching and real-time updates
  const { data: fetchedSettings = defaultSettings, isError: settingsError, refetch: refetchSettings } = useQuery({
    queryKey: ['app_settings', 'friendly_sites_widget'],
    queryFn: async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'friendly_sites_widget')
        .maybeSingle();

      if (data?.value) {
        return { ...defaultSettings, ...(data.value as Partial<WidgetSettings>) };
      }
      return defaultSettings;
    },
    staleTime: 1000 * 30, // 30 seconds - will refetch when invalidated
    refetchOnWindowFocus: true,
  });
  const settings: WidgetSettings = overrideSettings
    ? { ...fetchedSettings, ...overrideSettings }
    : fetchedSettings;

  // Fetch websites with React Query
  const { data: fetchedWebsites = [], isLoading, isError: sitesError, refetch: refetchSites } = useQuery({
    queryKey: ['friendly_websites', 'active'],
    queryFn: async () => {
      const { data } = await supabase
        .from('friendly_websites')
        .select('id,name,url,icon_url,icon_name,description,display_order,is_active,open_in_new_tab,attention_effect,badge_enabled,badge_text,auto_open_override,max_badge_per_day')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

      return (data || []) as unknown as FriendlyWebsite[];
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const websites: FriendlyWebsite[] = overrideWebsites ?? fetchedWebsites;

  const hasSyncError = !overrideSettings && !overrideWebsites && (settingsError || sitesError);
  useEffect(() => {
    if (!hasSyncError) return;
    // eslint-disable-next-line no-console
    console.warn("[friendly-widget] realtime/polling failed — surfacing sync indicator");
  }, [hasSyncError]);

  // Sync-error exponential backoff. Retries the two failing queries with
  // jittered exponential delay (2s, 4s, 8s, 16s, 32s, 60s max). A manual
  // "Retry now" click resets the attempt counter.
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [nextRetryIn, setNextRetryIn] = useState<number>(0);
  const runRetry = () => {
    refetchSettings();
    refetchSites();
  };
  useEffect(() => {
    if (!hasSyncError) {
      if (syncAttempt !== 0) setSyncAttempt(0);
      if (nextRetryIn !== 0) setNextRetryIn(0);
      return;
    }
    const base = Math.min(60_000, 2_000 * Math.pow(2, syncAttempt));
    const jitter = Math.floor(base * 0.25 * Math.random());
    const delay = base + jitter;
    setNextRetryIn(delay);
    const tick = setInterval(() => {
      setNextRetryIn((ms) => Math.max(0, ms - 1000));
    }, 1000);
    const timer = setTimeout(() => {
      setSyncAttempt((n) => n + 1);
      runRetry();
    }, delay);
    return () => { clearTimeout(timer); clearInterval(tick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSyncError, syncAttempt]);

  const manualRetry = () => {
    setSyncAttempt(0);
    setNextRetryIn(0);
    runRetry();
  };
  const nextRetrySec = Math.max(0, Math.ceil(nextRetryIn / 1000));

  // Derive a single consistent live-region announcement. Priority: sync error
  // beats interactive state (a screen reader user needs to know the widget is
  // broken). Open/close use symmetric wording so listeners can build a mental
  // model, and the sparkle burst is announced as "highlighted" only when the
  // panel is closed (avoiding a duplicate announcement alongside "opened").
  const _label = (overrideSettings?.buttonLabel ?? fetchedSettings.buttonLabel) || 'Partner Sites';
  useEffect(() => {
    if (hasSyncError) {
      setLiveMessage(`${_label}: sync unavailable — retry available.`);
      return;
    }
    if (isOpen) {
      setLiveMessage(`${_label} panel opened.`);
      return;
    }
    // Panel just closed (burstAt is only set when opening, so no overlap).
    if (hasAutoOpened || liveMessage.includes('opened')) {
      setLiveMessage(`${_label} panel closed.`);
      return;
    }
    if (burstAt) {
      setLiveMessage(`${_label} highlighted.`);
      return;
    }
    setLiveMessage("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSyncError, isOpen, burstAt, _label]);

  // ---- Telemetry: render latency (measure until first paint of the trigger) ----
  const mountRef = useState(() => (typeof performance !== 'undefined' ? performance.now() : Date.now()))[0];
  useEffect(() => {
    if (overrideSettings || overrideWebsites) return; // skip telemetry in preview
    if (isLoading) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const latency = Math.max(0, Math.round(now - mountRef));
    recordFriendlyWidgetEvent('render_latency', {
      sample_ms: latency,
      attention_effect: settings.attentionEffect ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading]);

  // Check visibility permissions
  const isVisible = () => {
    if (!settings.enabled) return false;
    if (websites.length === 0) return false;
    
    if (user && !settings.visibleToLoggedIn) return false;
    if (!user && !settings.visibleToPublic) return false;
    
    return true;
  };

  // Auto-open once per session. A site with `auto_open_override = false` blocks
  // the auto-open even if the widget default enables it; `true` forces it on.
  useEffect(() => {
    const delay = settings.autoOpenDelayMs ?? 0;
    const anyBlocks = websites.some(w => w.auto_open_override === false);
    const anyForces = websites.some(w => w.auto_open_override === true);
    const shouldAuto = anyForces || (delay > 0 && !anyBlocks);
    if (!shouldAuto || hasAutoOpened || isOpen) return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nullsto:friendly-auto-opened')) return;
    const effectiveDelay = anyForces && !delay ? 3000 : Math.max(500, delay);
    const t = setTimeout(() => {
      setIsOpen(true);
      setHasAutoOpened(true);
      recordFriendlyWidgetEvent('auto_open', { attention_effect: settings.attentionEffect ?? null });
      try { sessionStorage.setItem('nullsto:friendly-auto-opened', '1'); } catch { /* ignore */ }
    }, effectiveDelay);
    return () => clearTimeout(t);
  }, [settings.autoOpenDelayMs, settings.attentionEffect, websites, hasAutoOpened, isOpen]);

  // Per-site badge: only show if at least one active site allows a badge today.
  // Computed here (before any early return) so all hooks below are called every
  // render — required by React's rules of hooks.
  const showBadgeSetting = settings.showBadge !== false;
  const _badgeSite = websites.find(w =>
    w.badge_enabled !== false && canShowBadge(w.id, w.max_badge_per_day ?? 0)
  );
  const _badgeAllowed = showBadgeSetting && !!_badgeSite;
  useEffect(() => {
    if (_badgeAllowed && _badgeSite) {
      noteBadgeShown(_badgeSite.id);
      recordFriendlyWidgetEvent('badge_shown', {
        website_id: _badgeSite.id,
        attention_effect: _badgeSite.attention_effect || settings.attentionEffect || null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_badgeAllowed, _badgeSite?.id]);

  // Sync-error fallback: even when we have no data to render, surface the
  // retry pill so users know something is wrong instead of seeing nothing.
  if (!overrideWebsites && (isLoading || !isVisible())) {
    if (hasSyncError && !isLoading && settings.enabled) {
      return (
        <SyncErrorPill
          position={settings.position}
          attempt={syncAttempt}
          nextRetrySec={nextRetrySec}
          onRetry={manualRetry}
        />
      );
    }
    return null;
  }
  if (overrideWebsites && !settings.enabled) return null;

  const sizeClasses = {
    small: 'w-48',
    medium: 'w-64',
    large: 'w-80',
  };

  const colorClasses = {
    primary: 'bg-primary/10 border-primary/30 hover:bg-primary/20',
    accent: 'bg-accent/10 border-accent/30 hover:bg-accent/20',
    gradient: 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30',
    glass: 'bg-card/80 backdrop-blur-xl border-border/50',
  };

  const buttonColorClasses = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
    gradient: 'bg-gradient-to-r from-primary to-accent text-primary-foreground',
    glass: 'bg-card/90 backdrop-blur-xl text-foreground border border-border/50 hover:bg-card',
  };

  const animationVariants = {
    slide: {
      hidden: { x: settings.position === 'right' ? 300 : -300, opacity: 0 },
      visible: { x: 0, opacity: 1 },
    },
    fade: {
      hidden: { opacity: 0, scale: 0.8 },
      visible: { opacity: 1, scale: 1 },
    },
    bounce: {
      hidden: { x: settings.position === 'right' ? 300 : -300, opacity: 0 },
      visible: { x: 0, opacity: 1 },
    },
    flip: {
      hidden: { rotateY: 90, opacity: 0 },
      visible: { rotateY: 0, opacity: 1 },
    },
    zoom: {
      hidden: { scale: 0, opacity: 0 },
      visible: { scale: 1, opacity: 1 },
    },
  } as const;

  const positionClasses = settings.position === 'right' 
    ? 'right-0 rounded-l-xl' 
    : 'left-0 rounded-r-xl';

  const toggleButtonPosition = settings.position === 'right'
    ? 'right-0 rounded-l-xl'
    : 'left-0 rounded-r-xl';

  // Attention effect for the toggle button. Reduced-motion callers collapse
  // wiggle/bounce/pulse into the static `ring` treatment so the widget stays
  // discoverable without any looping animation.
  const rawAttention = settings.attentionEffect ?? 'pulse';
  const disableOnRM = settings.disableEffectsOnReducedMotion !== false;
  // Effective reduced-motion combines admin policy and OS preference.
  const rmMode = settings.reducedMotionMode ?? 'respect_user';
  const effectiveReducedMotion =
    rmMode === 'always_on' ? true
    : rmMode === 'never' ? false
    : (reducedMotion && disableOnRM);
  const attention = effectiveReducedMotion
    && ['pulse','wiggle','bounce','sparkle','confetti','ripple','rainbow','magnet'].includes(rawAttention)
    ? 'ring'
    : rawAttention;
  const attentionClass =
    attention === 'pulse' ? 'animate-pulse'
    : attention === 'glow' ? 'shadow-[0_0_20px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.8)]'
    : attention === 'wiggle' ? 'animate-[wiggle_2.4s_ease-in-out_infinite]'
    : attention === 'bounce' ? 'animate-bounce'
    : attention === 'ring' ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background'
    : attention === 'sparkle' ? 'animate-[fw-sparkle_2.2s_ease-in-out_infinite] shadow-[0_0_18px_hsl(var(--primary)/0.55)]'
    : attention === 'confetti' ? 'animate-[fw-confetti-pop_2.8s_ease-in-out_infinite]'
    : attention === 'ripple' ? 'relative after:absolute after:inset-0 after:rounded-l-xl after:ring-2 after:ring-primary/40 after:animate-[fw-ripple_1.8s_ease-out_infinite]'
    : attention === 'rainbow' ? 'animate-[fw-rainbow_4s_linear_infinite] bg-[length:200%_200%] bg-gradient-to-r from-primary via-accent to-primary text-primary-foreground'
    : attention === 'magnet' ? 'animate-[fw-magnet_3.2s_ease-in-out_infinite]'
    : '';

  const label = settings.buttonLabel || 'Partner Sites';
  const tooltip = settings.tooltipText || label;
  const showBadge = showBadgeSetting;
  const TriggerIcon = settings.triggerIcon
    ? (LucideIcons as any)[settings.triggerIcon]
    : null;
  const showLabelOnTrigger = settings.showLabelOnTrigger !== false;

  const badgeSite = _badgeSite;
  const badgeAllowed = _badgeAllowed;
  const badgeText = badgeSite?.badge_text || settings.badgeText || String(websites.length);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    if (next) {
      const rmBlocks = effectiveReducedMotion;
      if (!rmBlocks) setBurstAt(Date.now());
      recordFriendlyWidgetEvent('manual_open', {
        attention_effect: settings.attentionEffect ?? null,
      });
    }
  };

  const handleSiteClick = (site: FriendlyWebsite) => {
    recordFriendlyWidgetEvent('click', {
      website_id: site.id,
      attention_effect: site.attention_effect || settings.attentionEffect || null,
    });
  };

  // Animation variants — collapse fancy motion when the user prefers reduced motion
  // AND the admin hasn't disabled that safeguard.
  const effectiveAnim = effectiveReducedMotion ? 'fade' : settings.animationType;

  // Intensity multiplier tunes duration/spring stiffness for panel animations.
  const intensity = settings.animationIntensity ?? 'normal';
  const intensityMul = intensity === 'subtle' ? 0.6 : intensity === 'lively' ? 1.35 : 1;

  return (
    <>
      {/* Local keyframes for the wiggle effect — kept scoped so we don't touch tailwind config. */}
      <style>{`
        @keyframes wiggle{0%,100%{transform:translateY(-50%) rotate(-3deg)}50%{transform:translateY(-50%) rotate(3deg)}}
        @keyframes fw-sparkle{0%,100%{filter:brightness(1) drop-shadow(0 0 0 hsl(var(--primary)/0))}50%{filter:brightness(1.25) drop-shadow(0 0 12px hsl(var(--primary)/0.75))}}
        @keyframes fw-confetti-pop{0%,90%,100%{transform:translateY(-50%) scale(1)}45%{transform:translateY(-50%) scale(1.08)}}
        @keyframes fw-ripple{0%{box-shadow:0 0 0 0 hsl(var(--primary)/0.55)}100%{box-shadow:0 0 0 18px hsl(var(--primary)/0)}}
        @keyframes fw-rainbow{0%{background-position:0% 50%}50%{background-position:100% 50%}100%{background-position:0% 50%}}
        @keyframes fw-magnet{0%,100%{transform:translateY(-50%) translateX(0)}50%{transform:translateY(-50%) translateX(-4px)}}
        @keyframes fw-burst{0%{transform:translate(-50%,-50%) scale(0);opacity:.9}100%{transform:translate(-50%,-50%) scale(3.2);opacity:0}}
      `}</style>

      {/* Site-wide sparkle burst on open. Purely decorative, pointer-events:none. */}
      <AnimatePresence>
        {burstAt && !effectiveReducedMotion && (
          <motion.div
            key={burstAt}
            className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 1.4, ease: 'easeOut' }}
            onAnimationComplete={() => setBurstAt(null)}
            aria-hidden
          >
            {Array.from({ length: 14 }).map((_, i) => (
              <span
                key={i}
                className="absolute w-2 h-2 rounded-full bg-primary/70"
                style={{
                  top: `${50 + (Math.sin(i) * 30)}%`,
                  left: `${50 + (Math.cos(i) * 30)}%`,
                  animation: `fw-burst 1.2s ease-out forwards`,
                  animationDelay: `${(i % 5) * 60}ms`,
                }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Screen-reader-only live region: announces widget state changes
          (open/close, burst, sync issues) without visual noise. */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
        data-testid="friendly-widget-live-region"
      >
        {liveMessage}
      </div>

      {/* Toggle Button */}
      <motion.button
        onClick={handleToggle}
        data-testid="friendly-widget-trigger"
        data-attention={attention}
        className={`group fixed top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 py-3 pl-3 pr-2 shadow-xl transition-all duration-300 ${toggleButtonPosition} ${buttonColorClasses[settings.colorScheme]} ${settings.showOnMobile ? '' : 'hidden md:block'} ${isOpen ? '' : attentionClass}`}
        whileHover={effectiveReducedMotion ? undefined : { scale: 1.05 }}
        whileTap={effectiveReducedMotion ? undefined : { scale: 0.95 }}
        aria-label={isOpen ? `Close ${label}` : `Open ${label}`}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="flex items-center gap-2">
              {TriggerIcon ? (
                <TriggerIcon className="w-5 h-5" />
              ) : (
                <Sparkles className="w-5 h-5" />
              )}
              {showLabelOnTrigger && !isOpen && (
                <span className="hidden md:inline text-xs font-semibold uppercase tracking-wide [writing-mode:vertical-rl] rotate-180 max-h-24">
                  {label}
                </span>
              )}
              {badgeAllowed && !isOpen && websites.length > 0 && (
                <span className="absolute -top-1 -left-1 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center border-2 border-background">
                  {badgeText}
                </span>
              )}
              <span className="ml-1">
                {settings.position === 'right' ? (
                  isOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />
                ) : (
                  isOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />
                )}
              </span>
            </span>
          </TooltipTrigger>
          <TooltipContent side={settings.position === 'right' ? 'left' : 'right'}>
            <p>{isOpen ? 'Close' : tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </motion.button>

      {/* User-visible sync indicator when both realtime + fetches fail. */}
      {hasSyncError && !isOpen && (
        <SyncErrorPill
          position={settings.position}
          attempt={syncAttempt}
          nextRetrySec={nextRetrySec}
          onRetry={manualRetry}
          offsetTop
        />
      )}

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
             variants={animationVariants[effectiveAnim]}
             transition={effectiveAnim === 'bounce'
               ? { type: 'spring', stiffness: 260 * intensityMul, damping: 18 }
               : { duration: (effectiveReducedMotion ? 0.15 : 0.35) / intensityMul, ease: 'easeOut' }
             }
             onAnimationStart={() => {
               (window as any).__fw_anim_start = performance.now();
               recordFriendlyWidgetEvent('anim_start', {
                 attention_effect: settings.attentionEffect ?? null,
               });
             }}
             onAnimationComplete={() => {
               const started = (window as any).__fw_anim_start as number | undefined;
               const dur = started ? Math.max(0, Math.round(performance.now() - started)) : null;
               recordFriendlyWidgetEvent('anim_complete', {
                 attention_effect: settings.attentionEffect ?? null,
                 sample_ms: dur,
               });
             }}
            className={`fixed top-1/2 -translate-y-1/2 z-50 ${positionClasses} ${sizeClasses[settings.size]} ${colorClasses[settings.colorScheme]} border p-4 shadow-xl ${settings.showOnMobile ? '' : 'hidden md:block'}`}
          >
            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 p-1 rounded-full hover:bg-background/50 transition-colors"
              aria-label="Close panel"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Header */}
            <h3 className="font-semibold text-foreground mb-4 pr-6 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              {label}
            </h3>

            {/* Website list */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {websites.map((website, index) => (
                <motion.a
                  key={website.id}
                  href={website.url}
                  target={website.open_in_new_tab ? '_blank' : '_self'}
                  rel={website.open_in_new_tab ? 'noopener noreferrer' : undefined}
                  className="flex items-center gap-3 p-3 rounded-lg bg-background/50 border border-border/50 hover:border-primary/30 hover:bg-background/80 transition-all duration-200 group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: effectiveReducedMotion ? 0 : index * 0.05 }}
                  whileHover={effectiveReducedMotion ? undefined : { x: 4 }}
                  onClick={() => handleSiteClick(website)}
                >
                  {website.icon_name && renderLucide(website.icon_name, 'w-8 h-8 p-1.5 rounded-lg bg-primary/15 text-primary') ? (
                    renderLucide(website.icon_name, 'w-8 h-8 p-1.5 rounded-lg bg-primary/15 text-primary')
                  ) : website.icon_url ? (
                    <img 
                      src={website.icon_url} 
                      alt={website.name}
                      className="w-8 h-8 rounded-lg object-cover"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-semibold text-sm">
                        {website.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {website.name}
                    </p>
                    {website.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {website.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
              ))}
            </div>

            {/* Decorative elements */}
            <div className="absolute -bottom-2 -right-2 w-16 h-16 bg-primary/10 rounded-full blur-xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FriendlyWebsitesWidget;
