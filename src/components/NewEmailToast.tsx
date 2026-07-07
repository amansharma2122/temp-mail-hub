import { motion, useReducedMotion } from "framer-motion";
import { Mail, Sparkles } from "lucide-react";

export type NewEmailToastStyle = "slide_glow" | "bounce_confetti" | "both";
// Extra internal variant used when the user has requested reduced motion.
// Callers still pass one of the public styles above — we swap in "reduced"
// automatically. Exposed for tests.
export type ResolvedNewEmailToastVariant = NewEmailToastStyle | "reduced";

interface NewEmailToastProps {
  from: string;
  subject: string;
  style: NewEmailToastStyle;
  onClose?: () => void;
  /**
   * Test hook: force a specific reduced-motion state. When omitted, the
   * component reads `useReducedMotion()` and OS media query as usual.
   */
  forceReducedMotion?: boolean;
}

/** Resolve the visual variant, downgrading to "reduced" if requested. */
export function resolveNewEmailToastVariant(
  style: NewEmailToastStyle,
  reducedMotion: boolean,
): ResolvedNewEmailToastVariant {
  return reducedMotion ? "reduced" : style;
}

/**
 * NewEmailToast — animated toast for realtime new-email arrivals.
 * The style is admin-configurable via `app_settings.new_email_notification_style`.
 * When the visitor has `prefers-reduced-motion: reduce` we render a dedicated
 * static "reduced" variant — no springs, no confetti, no repeated glow.
 */
export function NewEmailToast({ from, subject, style, onClose, forceReducedMotion }: NewEmailToastProps) {
  const rm = useReducedMotion();
  const reduced = forceReducedMotion ?? Boolean(rm);
  const variant = resolveNewEmailToastVariant(style, reduced);
  const isReduced = variant === "reduced";
  const showConfetti = variant === "bounce_confetti" || variant === "both";
  const useBounce = variant === "bounce_confetti" || variant === "both";

  return (
    <motion.div
      data-variant={variant}
      initial={isReduced
        ? { opacity: 0 }
        : useBounce
          ? { y: -40, opacity: 0, scale: 0.85 }
          : { x: 40, opacity: 0 }}
      animate={isReduced
        ? { opacity: 1 }
        : useBounce
          ? { y: 0, opacity: 1, scale: 1 }
          : { x: 0, opacity: 1 }}
      exit={isReduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
      transition={isReduced
        ? { duration: 0.15, ease: "linear" }
        : useBounce
          ? { type: "spring", stiffness: 380, damping: 18 }
          : { duration: 0.35, ease: "easeOut" }}
      className="relative flex items-start gap-3 min-w-[280px] max-w-sm bg-card border border-primary/30 rounded-xl shadow-lg pl-3 pr-4 py-3 overflow-visible"
      role="status"
      aria-live="polite"
    >
      <div className="relative shrink-0">
        <motion.div
          animate={!isReduced && (variant === "slide_glow" || variant === "both")
            ? { boxShadow: [
                "0 0 0px hsl(var(--primary) / 0.0)",
                "0 0 18px hsl(var(--primary) / 0.55)",
                "0 0 0px hsl(var(--primary) / 0.0)",
              ]}
            : {}}
          transition={{ duration: 1.8, repeat: 2, ease: "easeInOut" }}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/15 text-primary"
        >
          <Mail className="w-5 h-5" aria-hidden />
        </motion.div>
        {showConfetti && !isReduced && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {Array.from({ length: 8 }).map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              const dx = Math.cos(angle) * 26;
              const dy = Math.sin(angle) * 26;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                  animate={{ x: dx, y: dy, opacity: 0, scale: 1 }}
                  transition={{ duration: 0.9, delay: 0.05 + i * 0.02, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full bg-primary"
                  style={{
                    background: `hsl(${(i * 42) % 360} 80% 60%)`,
                    marginLeft: -3, marginTop: -3,
                  }}
                />
              );
            })}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1.4, 1.6] }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              className="absolute -top-1 -right-1 text-primary"
            >
              <Sparkles className="w-3 h-3" />
            </motion.div>
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-foreground">New email received</div>
        <div className="text-xs text-muted-foreground truncate" title={from}>From: {from}</div>
        <div className="text-xs text-foreground/80 truncate" title={subject}>
          {subject || "(No subject)"}
        </div>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground text-xs"
          aria-label="Dismiss notification"
        >
          ✕
        </button>
      )}
    </motion.div>
  );
}

export default NewEmailToast;