import { AnimatePresence, motion } from "framer-motion";
import { Clock, RefreshCw, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface EmailExpiredModalProps {
  isOpen: boolean;
  address?: string;
  onClose: () => void;
  onGenerateNew: () => void;
}

/**
 * Shown when the current temporary email address expires. Offers the user a
 * choice between generating a new free address or upgrading to keep the
 * expired one (a "purchase" flow via the pricing page).
 */
const EmailExpiredModal = ({ isOpen, address, onClose, onGenerateNew }: EmailExpiredModalProps) => {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-expired-title"
          onClick={onClose}
        >
          <motion.div
            className="relative w-full max-w-sm rounded-2xl border-2 border-primary/30 bg-card p-5 shadow-xl"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute top-3 right-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-3 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                <Clock className="h-4 w-4" />
              </span>
              <h2 id="email-expired-title" className="text-base font-semibold text-foreground">
                Email expired
              </h2>
            </div>

            <p className="text-sm text-muted-foreground">
              {address ? (
                <>
                  <span className="break-all font-mono text-foreground">{address}</span> has expired.
                  Generate a new free address, or upgrade to keep it active.
                </>
              ) : (
                <>Your temporary address has expired.</>
              )}
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <Button
                className="w-full"
                onClick={() => {
                  onGenerateNew();
                  onClose();
                }}
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Generate new email
              </Button>
              <Button
                variant="outline"
                className="w-full border-primary/40"
                onClick={() => {
                  navigate("/pricing");
                  onClose();
                }}
              >
                <Crown className="mr-2 h-4 w-4 text-primary" />
                Upgrade to keep this email
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default EmailExpiredModal;