import { useState } from "react";
import { motion } from "framer-motion";
import { Clock, Calendar, Trash2, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { useConfetti } from "@/hooks/useConfetti";

interface EmailSchedulerProps {
  emailId: string;
  currentExpiry?: Date;
  onSchedule: (expiryTime: Date) => void;
}

export const EmailScheduler = ({
  emailId,
  currentExpiry,
  onSchedule,
}: EmailSchedulerProps) => {
  const { tier, limits } = usePremiumFeatures();
  const { fireSuccessConfetti } = useConfetti();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTime, setSelectedTime] = useState("1h");

  const isPremium = tier !== "free";
  const maxHours = limits.emailExpiryHours;

  const timeOptions = [
    { value: "15m", label: "15 minutes", hours: 0.25 },
    { value: "30m", label: "30 minutes", hours: 0.5 },
    { value: "1h", label: "1 hour", hours: 1 },
    { value: "3h", label: "3 hours", hours: 3 },
    { value: "6h", label: "6 hours", hours: 6 },
    { value: "12h", label: "12 hours", hours: 12 },
    { value: "24h", label: "24 hours", hours: 24, premium: true },
    { value: "48h", label: "2 days", hours: 48, premium: true },
    { value: "168h", label: "7 days", hours: 168, premium: true },
  ];

  const availableOptions = timeOptions.filter((opt) => {
    if (opt.premium && !isPremium) return false;
    if (opt.hours > maxHours && maxHours !== -1) return false;
    return true;
  });

  const handleSchedule = () => {
    const option = timeOptions.find((o) => o.value === selectedTime);
    if (!option) return;

    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + option.hours * 60 * 60 * 1000);

    onSchedule(expiryDate);
    setIsOpen(false);
    fireSuccessConfetti();
    toast.success(`Email will auto-delete in ${option.label}`);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2 hover-lift"
      >
        <Clock className="w-4 h-4" />
        Schedule Delete
        {!isPremium && <Crown className="w-3 h-3 text-amber-500" />}
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Schedule Auto-Delete
            </DialogTitle>
            <DialogDescription>
              Set when this email should be automatically deleted
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-4">
            {currentExpiry && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 text-sm">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">Currently expires:</span>
                <span className="font-medium">
                  {currentExpiry.toLocaleString()}
                </span>
              </div>
            )}

            <div className="space-y-2">
              <Label>Delete after</Label>
              <Select value={selectedTime} onValueChange={setSelectedTime}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <span className="flex items-center gap-2">
                        {option.label}
                        {option.premium && (
                          <Crown className="w-3 h-3 text-amber-500" />
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isPremium && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
              >
                <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
                  <Crown className="w-4 h-4" />
                  <span>Upgrade for longer retention (up to 7 days)</span>
                </div>
              </motion.div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSchedule}
              className="gap-2 bg-gradient-to-r from-primary to-accent"
            >
              <Trash2 className="w-4 h-4" />
              Set Auto-Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default EmailScheduler;
