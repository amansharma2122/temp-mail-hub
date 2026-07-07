import { useState, useEffect, memo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { subscribeAppSettings } from "@/lib/appSettingsSync";
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
  /** Fired once when the user clicks/opens the trigger. Purely decorative. */
  clickEffect?:
    | 'none' | 'sparkle' | 'confetti' | 'bomb' | 'fireworks'
    | 'hearts' | 'stars' | 'rainbow-burst';
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
  /** Celebration button rendered inside the open panel. */
  celebrationEnabled?: boolean;
  celebrationLabel?: string;
  celebrationEffect?:
    | 'sparkle' | 'confetti' | 'bomb' | 'fireworks'
    | 'hearts' | 'stars' | 'rainbow-burst';
  /** Celebration animation tuning — persisted, editable in admin. */
  celebrationIntensity?: 'subtle' | 'normal' | 'lively';
  celebrationDurationMs?: number;   // 800..8000, overrides OVERLAY_MS
  celebrationParticleCount?: number; // 0 = use preset default
  /** Celebration playback speed — scales duration + per-particle fall time. */
  celebrationSpeed?: 'slower' | 'normal' | 'faster';
  /** Play a short chime when the celebrate button is clicked. */
  celebrationSoundEnabled?: boolean;
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
  // Gentle, non-looping default so the trigger doesn't fatigue the eye.
  // Admins can pick a livelier effect in the widget settings.
  attentionEffect: 'glow',
  buttonLabel: 'Partner Sites',
  tooltipText: 'Explore our partner sites',
  showBadge: true,
  badgeText: '',
  triggerIcon: 'Sparkles',
  autoOpenDelayMs: 0,
  showLabelOnTrigger: true,
  animationIntensity: 'subtle',
  disableEffectsOnReducedMotion: true,
  reducedMotionMode: 'respect_user',
  clickEffect: 'sparkle',
  celebrationEnabled: true,
  celebrationLabel: 'Click Me 🎉',
  celebrationEffect: 'confetti',
  celebrationIntensity: 'normal',
  celebrationDurationMs: 4200,
  celebrationParticleCount: 0,
  celebrationSpeed: 'normal',
  celebrationSoundEnabled: false,
};

// -------- Module-scoped constants (do NOT depend on component state) -------
// Hoisted out of the render body so React doesn't rebuild these object
// literals on every state change (countdown ticks, isOpen toggles, etc).
const SIZE_CLASSES = {
  small: 'w-48',
  medium: 'w-64',
  large: 'w-80',
} as const;

const COLOR_CLASSES = {
  primary: 'bg-primary/10 border-primary/30 hover:bg-primary/20',
  accent: 'bg-accent/10 border-accent/30 hover:bg-accent/20',
  gradient: 'bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30',
  glass: 'bg-card/80 backdrop-blur-xl border-border/50',
} as const;

const BUTTON_COLOR_CLASSES = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  accent: 'bg-accent text-accent-foreground hover:bg-accent/90',
  gradient: 'bg-gradient-to-r from-primary to-accent text-primary-foreground',
  glass: 'bg-card/90 backdrop-blur-xl text-foreground border border-border/50 hover:bg-card',
} as const;

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
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  // Burst effect triggered when the user clicks the trigger — a lightweight
  // site-wide sparkle overlay that respects reduced-motion.
  const [burstAt, setBurstAt] = useState<number | null>(null);
  const [burstVariant, setBurstVariant] = useState<NonNullable<WidgetSettings['clickEffect']> | NonNullable<WidgetSettings['celebrationEffect']>>('sparkle');
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

  // Cross-tab / cross-device sync: when the admin toggles the widget on/off
  // or changes any setting, invalidate our cached query so the change is
  // reflected immediately — no page reload, no focus event required.
  useEffect(() => {
    return subscribeAppSettings(
      ["friendly_sites_widget", "friendly_widget_per_effect_quotas"],
      () => {
        queryClient.invalidateQueries({ queryKey: ["app_settings", "friendly_sites_widget"] });
        queryClient.invalidateQueries({ queryKey: ["friendly_websites"] });
      },
    );
  }, [queryClient]);

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

  const sizeClasses = SIZE_CLASSES;
  const colorClasses = COLOR_CLASSES;
  const buttonColorClasses = BUTTON_COLOR_CLASSES;

  // NOTE: this literal lives after an early-return branch, so it can't be a
  // hook. It's still cheaper than before because the class-name maps above
  // are now module-scoped and no longer rebuilt every render.
  const _offset = settings.position === 'right' ? 300 : -300;
  const animationVariants = {
    slide:  { hidden: { x: _offset, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    fade:   { hidden: { opacity: 0, scale: 0.8 }, visible: { opacity: 1, scale: 1 } },
    bounce: { hidden: { x: _offset, opacity: 0 }, visible: { x: 0, opacity: 1 } },
    flip:   { hidden: { rotateY: 90, opacity: 0 }, visible: { rotateY: 0, opacity: 1 } },
    zoom:   { hidden: { scale: 0, opacity: 0 }, visible: { scale: 1, opacity: 1 } },
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
      if (!rmBlocks) {
        setBurstVariant(settings.clickEffect ?? 'sparkle');
        setBurstAt(Date.now());
      }
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

  const handleCelebrate = () => {
    const rmBlocks = effectiveReducedMotion;
    // Even in reduced-motion we still render ClickBurst — the component
    // itself downgrades to a minimal "gentle" shower (few particles, short
    // duration, no rotation) so users get feedback without vestibular risk.
    setBurstVariant(settings.celebrationEffect ?? 'confetti');
    setBurstAt(Date.now());
    // Optional short chime — always gated by admin toggle AND reduced-motion.
    if (!rmBlocks && settings.celebrationSoundEnabled) {
      try {
        const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'sine'; o.frequency.value = 660;
          g.gain.value = 0.001;
          o.connect(g); g.connect(ctx.destination);
          const now = ctx.currentTime;
          g.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
          o.start(now); o.stop(now + 0.4);
        }
      } catch { /* audio is best-effort */ }
    }
    recordFriendlyWidgetEvent('celebrate_click', {
      attention_effect: settings.celebrationEffect ?? null,
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
        @keyframes fw-particle{0%{transform:translate(-50%,-50%) translate(0,0) scale(1);opacity:1}100%{transform:translate(-50%,-50%) translate(var(--dx),var(--dy)) scale(.3);opacity:0}}
        @keyframes fw-shockwave{0%{transform:translate(-50%,-50%) scale(0);opacity:.55}100%{transform:translate(-50%,-50%) scale(6);opacity:0}}
        @keyframes fw-float-up{0%{transform:translate(-50%,-50%) translateY(0);opacity:1}100%{transform:translate(-50%,-50%) translateY(-160px);opacity:0}}
        @keyframes fw-panel-glow{0%,100%{opacity:.35}50%{opacity:.7}}
        @keyframes fw-rain{0%{transform:translateY(-12vh) rotate(0deg);opacity:0}8%{opacity:1}92%{opacity:1}100%{transform:translateY(112vh) rotate(var(--rot,360deg));opacity:0}}
      `}</style>

      {/* Site-wide sparkle burst on open. Purely decorative, pointer-events:none. */}
      <AnimatePresence>
        {burstAt && (
          <ClickBurst
            key={burstAt}
            variant={burstVariant as NonNullable<WidgetSettings['clickEffect']>}
            reducedMotion={effectiveReducedMotion}
            intensity={settings.celebrationIntensity ?? 'normal'}
            durationMs={settings.celebrationDurationMs ?? 4200}
            countScale={settings.celebrationParticleCount ?? 0}
            speed={settings.celebrationSpeed ?? 'normal'}
            onDone={() => setBurstAt(null)}
          />
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
            className={`fixed top-1/2 -translate-y-1/2 z-50 ${positionClasses} ${sizeClasses[settings.size]} ${settings.showOnMobile ? '' : 'hidden md:block'} overflow-hidden border border-primary/25 bg-card/80 backdrop-blur-2xl p-4 shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.55)]`}
          >
            {/* Animated gradient sheen behind the panel */}
            <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-accent/15" />
              <div
                className="absolute -inset-8 bg-[conic-gradient(from_0deg,hsl(var(--primary)/0.35),transparent_35%,hsl(var(--accent)/0.35),transparent_70%,hsl(var(--primary)/0.35))] blur-2xl"
                style={{ animation: 'fw-panel-glow 4.5s ease-in-out infinite' }}
              />
            </div>

            {/* Close button */}
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-background/40 backdrop-blur hover:bg-background/80 hover:rotate-90 transition-all duration-300"
              aria-label="Close panel"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Header */}
            <div className="mb-4 pr-6">
              <h3 className="flex items-center gap-2 text-base font-bold tracking-tight">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gradient-to-br from-primary to-accent" />
                </span>
                <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                  {label}
                </span>
              </h3>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {websites.length} handpicked {websites.length === 1 ? 'site' : 'sites'} you'll love
              </p>
            </div>

            {/* Website list */}
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1 [scrollbar-width:thin]">
              {websites.map((website, index) => (
                <motion.a
                  key={website.id}
                  href={website.url}
                  target={website.open_in_new_tab ? '_blank' : '_self'}
                  rel={website.open_in_new_tab ? 'noopener noreferrer' : undefined}
                  className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-border/40 bg-background/60 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 hover:bg-background/90 hover:shadow-lg hover:shadow-primary/10 group"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: effectiveReducedMotion ? 0 : index * 0.05 }}
                  onClick={() => handleSiteClick(website)}
                >
                  <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-primary/0 via-primary/10 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  {website.icon_name && renderLucide(website.icon_name, 'w-8 h-8 p-1.5 rounded-lg bg-primary/15 text-primary') ? (
                    <span className="shrink-0 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 p-0.5 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                      {renderLucide(website.icon_name, 'w-8 h-8 p-1.5 rounded-lg text-primary')}
                    </span>
                  ) : website.icon_url ? (
                    <img 
                      src={website.icon_url} 
                      alt={website.name}
                      className="w-9 h-9 rounded-lg object-cover ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110"
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/30 to-accent/30 ring-1 ring-primary/20 transition-transform duration-300 group-hover:scale-110">
                      <span className="text-sm font-bold text-primary">
                        {website.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {website.name}
                    </p>
                    {website.description && (
                      <p className="truncate text-[11px] leading-tight text-muted-foreground">
                        {website.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="w-4 h-4 shrink-0 text-primary opacity-0 -translate-x-1 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                </motion.a>
              ))}
            </div>

            {/* Decorative orbs */}
            <div aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            <div aria-hidden className="pointer-events-none absolute -top-6 -left-6 h-20 w-20 rounded-full bg-accent/20 blur-2xl" />

            {(settings.celebrationEnabled ?? true) && (
              <button
                type="button"
                onClick={handleCelebrate}
                data-testid="friendly-widget-celebrate"
                aria-label={settings.celebrationLabel || 'Celebrate'}
                className="mt-3 relative w-full inline-flex items-center justify-center gap-2 rounded-xl border border-primary/40 bg-gradient-to-r from-primary/90 via-accent/90 to-primary/90 px-3 py-2 text-sm font-semibold text-primary-foreground shadow-md transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
              >
                <Sparkles className="w-4 h-4" aria-hidden />
                <span>{settings.celebrationLabel || 'Click Me 🎉'}</span>
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

// Memoize to skip re-renders when parents (e.g. Index) re-render but props
// (overrideSettings/overrideWebsites) are unchanged. React Query caches keep
// internal state stable, so parent renders shouldn't propagate down here.
export default memo(FriendlyWebsitesWidget);

// -------------------- Click Burst (full-screen decorative effect) ----------
type BurstVariant = NonNullable<WidgetSettings['clickEffect']>;

export function ClickBurst({
  variant,
  onDone,
  reducedMotion = false,
  intensity = 'normal',
  durationMs,
  countScale = 0,
}: {
  variant: BurstVariant;
  onDone: () => void;
  reducedMotion?: boolean;
  intensity?: 'subtle' | 'normal' | 'lively';
  /** Overrides overlay lifetime (ms). */
  durationMs?: number;
  /** Overrides preset particle count; 0 = use preset default. */
  countScale?: number;
}) {
  if (variant === 'none') { setTimeout(onDone, 0); return null; }
  // Rain-style presets: particles start above the viewport and fall the
  // full screen height. Slower & softer than the old burst so it doesn't
  // feel jarring — feels like a celebratory shower over the whole page.
  const presets: Record<Exclude<BurstVariant, 'none'>, { count: number; glyph: (i: number) => string; colors: string[] }> = {
    sparkle:        { count: 34, glyph: () => '✨', colors: ['#fde68a', '#fbbf24'] },
    confetti:       { count: 60, glyph: (i) => ['🎉','🎊','⭐','💫','🎈'][i % 5], colors: [] },
    bomb:           { count: 70, glyph: (i) => (i % 5 === 0 ? '💥' : ''), colors: ['hsl(var(--destructive))','hsl(var(--primary))','#f97316','#facc15'] },
    fireworks:      { count: 60, glyph: (i) => (i % 6 === 0 ? '🎆' : ''), colors: ['#f43f5e','#3b82f6','#a855f7','#22d3ee','#facc15'] },
    hearts:         { count: 40, glyph: () => '❤️', colors: [] },
    stars:          { count: 44, glyph: () => '⭐', colors: [] },
    'rainbow-burst':{ count: 60, glyph: (i) => (i % 8 === 0 ? '🌈' : ''), colors: ['#ef4444','#f97316','#facc15','#22c55e','#3b82f6','#a855f7'] },
  };
  const p = presets[variant];
  // Intensity multiplier tunes count + duration together.
  const iMul = intensity === 'subtle' ? 0.6 : intensity === 'lively' ? 1.4 : 1;
  // Reduced-motion: hard cap to a gentle few-particle shower and short overlay.
  const rmCount = 6;
  const rmMs = 900;
  const baseCount = countScale > 0 ? countScale : Math.round(p.count * iMul);
  const effectiveCount = reducedMotion ? rmCount : Math.max(4, Math.min(220, baseCount));
  const OVERLAY_MS = reducedMotion
    ? rmMs
    : Math.max(800, Math.min(8000, Math.round((durationMs ?? 4200) * iMul)));
  const speedMul = reducedMotion ? 0.5 : 1 / iMul; // lively = faster fall
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      data-testid="friendly-widget-click-burst"
      data-variant={variant}
      data-reduced-motion={reducedMotion ? 'true' : 'false'}
      initial={{ opacity: 1 }}
      animate={{ opacity: reducedMotion ? 0.55 : 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reducedMotion ? 0.2 : 0.4, ease: 'easeOut' }}
      onAnimationComplete={() => { setTimeout(onDone, OVERLAY_MS); }}
      aria-hidden
    >
      {Array.from({ length: effectiveCount }).map((_, i) => {
        // Even horizontal spread with a small jitter so it doesn't line up.
        const leftPct = ((i + 0.5) / effectiveCount) * 100 + (Math.random() * 6 - 3);
        const glyph = p.glyph(i);
        const color = p.colors.length ? p.colors[i % p.colors.length] : undefined;
        const size = glyph ? 18 + Math.random() * 14 : 8 + Math.random() * 8;
        // Slower fall: 2.4s – 3.4s per particle, staggered start so it
        // feels like a shower, not a burst.
        const dur = (2400 + Math.random() * 1000) * speedMul;
        const delay = (reducedMotion ? Math.random() * 150 : Math.random() * 900);
        const rot = reducedMotion ? 0 : Math.round((Math.random() * 720) - 360);
        return (
          <span
            key={i}
            className="absolute top-0 select-none font-bold"
            style={{
              left: `${leftPct}%`,
              fontSize: `${size}px`,
              width: glyph ? undefined : `${size}px`,
              height: glyph ? undefined : `${size}px`,
              borderRadius: glyph ? undefined : '9999px',
              background: glyph ? undefined : color,
              color,
              ['--rot' as any]: `${rot}deg`,
              animation: `fw-rain ${dur}ms cubic-bezier(.25,.6,.35,1) forwards`,
              animationDelay: `${delay}ms`,
              willChange: 'transform, opacity',
            } as React.CSSProperties}
          >
            {glyph}
          </span>
        );
      })}
    </motion.div>
  );
}

// -------------------- Sync-error pill w/ backoff + Retry now ---------------

function SyncErrorPill({
  position,
  attempt,
  nextRetrySec,
  onRetry,
  offsetTop = false,
}: {
  position: 'left' | 'right';
  attempt: number;
  nextRetrySec: number;
  onRetry: () => void;
  offsetTop?: boolean;
}) {
  const label = nextRetrySec > 0
    ? `Widget offline — retrying in ${nextRetrySec}s`
    : `Widget offline — reconnecting…`;
  return (
    <div
      role="alert"
      className={`fixed top-1/2 ${offsetTop ? 'mt-14 ' : ''}-translate-y-1/2 z-40 flex items-center gap-2 pl-2.5 pr-1 py-1 rounded-full text-[11px] bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 shadow-sm ${position === 'right' ? 'right-2' : 'left-2'}`}
      data-testid="friendly-widget-sync-error-pill"
    >
      <AlertCircle className="w-3 h-3 shrink-0" aria-hidden />
      <span className="whitespace-nowrap">{label}</span>
      <button
        type="button"
        onClick={onRetry}
        data-testid="friendly-widget-sync-error"
        aria-label={`Retry widget sync now (attempt ${attempt + 1})`}
        className="ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/25 hover:bg-amber-500/40 text-amber-900 dark:text-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500/70"
      >
        <RefreshCw className="w-3 h-3" aria-hidden />
        <span>Retry now</span>
      </button>
    </div>
  );
}
