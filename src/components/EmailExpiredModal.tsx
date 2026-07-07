import { AnimatePresence, motion } from "framer-motion";
import { Clock, RefreshCw, X, Sparkles, CreditCard, Wallet, Smartphone, MessageCircle, Copy, Check, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useState } from "react";
import { toast } from "sonner";

interface EmailExpiredModalProps {
  isOpen: boolean;
  address?: string;
  onClose: () => void;
  onGenerateNew: () => void;
}

type Method = "stripe" | "paypal" | "upi" | "telegram";

/**
 * Shown when the current temporary email address expires. Instead of routing
 * away to the pricing page, offers the user inline payment options
 * (Stripe / PayPal / UPI) to *keep this specific email*, plus a Telegram
 * contact fallback and a free "generate a new one" escape hatch.
 */
const EmailExpiredModal = ({ isOpen, address, onClose, onGenerateNew }: EmailExpiredModalProps) => {
  const {
    stripeEnabled,
    paypalEnabled,
    telegramEnabled,
    telegramLink,
    upiEnabled,
    upiId,
    keepEmailPrice,
    currency,
  } = usePaymentSettings();

  const [selected, setSelected] = useState<Method | null>(null);
  const [copied, setCopied] = useState(false);

  const currencyLabel = (currency || "usd").toUpperCase();
  const priceLabel =
    currencyLabel === "USD" ? `$${keepEmailPrice}` :
    currencyLabel === "INR" ? `₹${keepEmailPrice}` :
    `${keepEmailPrice} ${currencyLabel}`;

  const methods: { id: Method; label: string; icon: typeof CreditCard; visible: boolean; hint?: string }[] = [
    { id: "stripe",   label: "Card (Stripe)", icon: CreditCard, visible: stripeEnabled },
    { id: "paypal",   label: "PayPal",        icon: Wallet,     visible: paypalEnabled },
    { id: "upi",      label: "UPI",           icon: Smartphone, visible: upiEnabled, hint: upiId },
    { id: "telegram", label: "Telegram",      icon: MessageCircle, visible: telegramEnabled, hint: "Contact for manual purchase" },
  ].filter(m => m.visible);

  const handleContinue = async () => {
    if (!selected) return;
    if (selected === "telegram") {
      window.open(telegramLink, "_blank", "noopener,noreferrer");
      onClose();
      return;
    }
    if (selected === "upi") {
      const target = upiId;
      try {
        await navigator.clipboard.writeText(target);
        setCopied(true);
        toast.success("UPI ID copied — paste in your UPI app", { description: target });
        setTimeout(() => setCopied(false), 2500);
      } catch {
        toast.info(`UPI ID: ${target}`);
      }
      return;
    }
    // Stripe / PayPal — hand off to Telegram fallback until real checkout is wired.
    // Keeps the UX self-contained without routing away from this modal.
    if (telegramEnabled) {
      window.open(
        `${telegramLink}?text=${encodeURIComponent(`Hi, I'd like to keep my email ${address ?? ""} via ${selected}. Price: ${priceLabel}.`)}`,
        "_blank",
        "noopener,noreferrer",
      );
    } else {
      toast.info(`${selected === "stripe" ? "Card" : "PayPal"} checkout will open shortly.`);
    }
    onClose();
  };

  const hasAnyMethod = methods.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-expired-title"
          aria-describedby="email-expired-desc"
          onClick={onClose}
        >
          <motion.div
            dir="auto"
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/10"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ type: "spring", damping: 22, stiffness: 260 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Decorative gradient header */}
            <div className="relative bg-gradient-to-br from-primary/25 via-accent/15 to-primary/10 px-5 pt-5 pb-4">
              <button
                type="button"
                onClick={onClose}
                aria-label="Dismiss and continue"
                className="absolute top-3 right-3 rounded-full bg-background/60 p-1.5 text-muted-foreground backdrop-blur transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-background/70 text-primary shadow-inner">
                  <Clock className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h2 id="email-expired-title" className="text-lg font-bold text-foreground">
                    Your email just expired
                  </h2>
                  <p id="email-expired-desc" className="mt-0.5 text-xs text-muted-foreground">
                    Keep <span className="font-mono text-foreground break-all">{address ?? "this address"}</span> forever, or spin up a fresh free one.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-xl border border-primary/30 bg-background/70 px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Keep this exact email</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold text-foreground leading-none">{priceLabel}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">one-time</div>
                </div>
              </div>
            </div>

            {/* Payment methods */}
            <div className="px-5 py-4">
              {hasAnyMethod ? (
                <>
                  <div className="mb-2 text-xs font-medium text-muted-foreground">Choose a payment method</div>
                  <div className="grid grid-cols-2 gap-2">
                    {methods.map((m) => {
                      const active = selected === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelected(m.id)}
                          aria-pressed={active}
                          className={[
                            "group flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-all",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                            active
                              ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                              : "border-border bg-background/50 hover:border-primary/40 hover:bg-primary/5",
                          ].join(" ")}
                        >
                          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${active ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                            <m.icon className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-semibold text-foreground">{m.label}</span>
                          {m.hint && (
                            <span className="line-clamp-1 text-[10px] text-muted-foreground">{m.hint}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    className="mt-4 w-full"
                    onClick={handleContinue}
                    disabled={!selected}
                  >
                    {selected === "telegram" ? (
                      <><MessageCircle className="mr-2 h-4 w-4" />Contact on Telegram</>
                    ) : selected === "upi" ? (
                      copied ? <><Check className="mr-2 h-4 w-4" />UPI ID copied</> : <><Copy className="mr-2 h-4 w-4" />Copy UPI ID & pay {priceLabel}</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />Continue — pay {priceLabel}</>
                    )}
                  </Button>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border p-3 text-center text-xs text-muted-foreground">
                  No payment methods are enabled right now.
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
                <Shield className="h-3 w-3" />
                <span>Secure & private — you can dismiss this and continue anytime.</span>
              </div>
            </div>

            {/* Footer: free escape hatch */}
            <div className="flex items-center gap-2 border-t border-border bg-muted/30 px-5 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => {
                  onGenerateNew();
                  onClose();
                }}
              >
                <RefreshCw className="mr-2 h-3.5 w-3.5" />
                Generate a new free email
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                Dismiss
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailExpiredModal;