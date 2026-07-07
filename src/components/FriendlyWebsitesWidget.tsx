import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, ExternalLink, X, Sparkles } from "lucide-react";
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
  attentionEffect?: 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring';
  buttonLabel?: string;
  tooltipText?: string;
  showBadge?: boolean;
  badgeText?: string;
  triggerIcon?: string;
  autoOpenDelayMs?: number;
  showLabelOnTrigger?: boolean;
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
};

const renderLucide = (name: string | null | undefined, className = "w-5 h-5") => {
  if (!name) return null;
  const Icon = (LucideIcons as any)[name];
  if (!Icon || typeof Icon !== 'function') return null;
  return <Icon className={className} />;
};

const FriendlyWebsitesWidget = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);

  // Fetch settings with React Query for caching and real-time updates
  const { data: settings = defaultSettings } = useQuery({
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

  // Fetch websites with React Query
  const { data: websites = [], isLoading } = useQuery({
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

  // Check visibility permissions
  const isVisible = () => {
    if (!settings.enabled) return false;
    if (websites.length === 0) return false;
    
    if (user && !settings.visibleToLoggedIn) return false;
    if (!user && !settings.visibleToPublic) return false;
    
    return true;
  };

  // Auto-open once per session if admin configured a delay > 0.
  useEffect(() => {
    const delay = settings.autoOpenDelayMs ?? 0;
    if (!delay || hasAutoOpened || isOpen) return;
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('nullsto:friendly-auto-opened')) return;
    const t = setTimeout(() => {
      setIsOpen(true);
      setHasAutoOpened(true);
      try { sessionStorage.setItem('nullsto:friendly-auto-opened', '1'); } catch { /* ignore */ }
    }, Math.max(500, delay));
    return () => clearTimeout(t);
  }, [settings.autoOpenDelayMs, hasAutoOpened, isOpen]);

  if (isLoading || !isVisible()) return null;

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

  // Attention effect classes for the toggle button.
  const attention = settings.attentionEffect ?? 'pulse';
  const attentionClass =
    attention === 'pulse' ? 'animate-pulse'
    : attention === 'glow' ? 'shadow-[0_0_20px_hsl(var(--primary)/0.6)] hover:shadow-[0_0_30px_hsl(var(--primary)/0.8)]'
    : attention === 'wiggle' ? 'animate-[wiggle_2.4s_ease-in-out_infinite]'
    : attention === 'bounce' ? 'animate-bounce'
    : attention === 'ring' ? 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background animate-[pulse_2s_ease-in-out_infinite]'
    : '';

  const label = settings.buttonLabel || 'Partner Sites';
  const tooltip = settings.tooltipText || label;
  const showBadge = settings.showBadge !== false;
  const badgeText = settings.badgeText || String(websites.length);
  const TriggerIcon = settings.triggerIcon
    ? (LucideIcons as any)[settings.triggerIcon]
    : null;
  const showLabelOnTrigger = settings.showLabelOnTrigger !== false;

  return (
    <>
      {/* Local keyframes for the wiggle effect — kept scoped so we don't touch tailwind config. */}
      <style>{`@keyframes wiggle{0%,100%{transform:translateY(-50%) rotate(-3deg)}50%{transform:translateY(-50%) rotate(3deg)}}`}</style>

      {/* Toggle Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`group fixed top-1/2 -translate-y-1/2 z-40 flex items-center gap-2 py-3 pl-3 pr-2 shadow-xl transition-all duration-300 ${toggleButtonPosition} ${buttonColorClasses[settings.colorScheme]} ${settings.showOnMobile ? '' : 'hidden md:block'} ${isOpen ? '' : attentionClass}`}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
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
              {showBadge && !isOpen && websites.length > 0 && (
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

      {/* Sidebar Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="hidden"
            variants={animationVariants[settings.animationType]}
            transition={settings.animationType === 'bounce'
              ? { type: 'spring', stiffness: 260, damping: 18 }
              : { duration: 0.35, ease: 'easeOut' }
            }
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
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ x: 4 }}
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
