import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Copy, Trash2, Users, Check, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useEmailService } from "@/contexts/EmailServiceContext";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { useConfetti } from "@/hooks/useConfetti";

interface EmailAlias {
  id: string;
  address: string;
  createdAt: Date;
}

export const EmailAliases = () => {
  const { currentEmail, domains, generateCustomEmail } = useEmailService();
  const { tier, limits } = usePremiumFeatures();
  const { fireSuccessConfetti } = useConfetti();
  const [aliases, setAliases] = useState<EmailAlias[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const maxAliases = tier === "free" ? 3 : tier === "pro" ? 10 : -1;
  const canCreateMore = maxAliases === -1 || aliases.length < maxAliases;

  const handleCreateAlias = async () => {
    if (!newAlias.trim()) {
      toast.error("Please enter an alias name");
      return;
    }

    if (!canCreateMore) {
      toast.error(`You've reached the maximum of ${maxAliases} aliases. Upgrade for more!`);
      return;
    }

    setIsCreating(true);
    try {
      const domainId = domains[0]?.id;
      if (!domainId) {
        toast.error("No domain available");
        return;
      }

      const success = await generateCustomEmail(newAlias, domainId);
      if (success) {
        const newAliasObj: EmailAlias = {
          id: crypto.randomUUID(),
          address: `${newAlias}${domains[0]?.name || "@nullsto.email"}`,
          createdAt: new Date(),
        };
        setAliases((prev) => [...prev, newAliasObj]);
        setNewAlias("");
        setIsOpen(false);
        fireSuccessConfetti();
        toast.success("Alias created successfully!");
      }
    } catch (error) {
      toast.error("Failed to create alias");
    } finally {
      setIsCreating(false);
    }
  };

  const copyAlias = async (alias: EmailAlias) => {
    await navigator.clipboard.writeText(alias.address);
    setCopiedId(alias.id);
    toast.success("Alias copied!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const deleteAlias = (id: string) => {
    setAliases((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alias removed");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Email Aliases</h3>
          <span className="text-xs text-muted-foreground">
            ({aliases.length}{maxAliases !== -1 ? `/${maxAliases}` : ""})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          disabled={!canCreateMore}
          className="gap-2 hover-lift"
        >
          <Plus className="w-4 h-4" />
          Add Alias
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {aliases.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-muted-foreground"
          >
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No aliases yet</p>
            <p className="text-xs">Create aliases to organize your temporary emails</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {aliases.map((alias, index) => (
              <motion.div
                key={alias.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05 }}
                className="group flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-all hover-lift"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm truncate text-foreground">
                    {alias.address}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Created {alias.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyAlias(alias)}
                  >
                    {copiedId === alias.id ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteAlias(alias.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {!canCreateMore && tier === "free" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2 p-3 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
        >
          <Crown className="w-4 h-4 text-amber-500" />
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Upgrade to Pro for up to 10 aliases
          </p>
        </motion.div>
      )}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Create Email Alias</DialogTitle>
            <DialogDescription>
              Create an alias linked to your current temporary email
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Alias Username</label>
            <Input
              placeholder="myalias"
              value={newAlias}
              onChange={(e) => setNewAlias(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ""))}
              className="bg-secondary/50"
            />
            {newAlias && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-primary mt-2 font-mono"
              >
                Preview: {newAlias}{domains[0]?.name || "@nullsto.email"}
              </motion.p>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateAlias}
              disabled={isCreating || !newAlias.trim()}
              className="bg-gradient-to-r from-primary to-accent"
            >
              {isCreating ? "Creating..." : "Create Alias"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailAliases;
