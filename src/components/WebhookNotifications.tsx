import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Webhook, Plus, Trash2, Check, AlertCircle, Crown, TestTube, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { storage } from "@/lib/storage";
import { usePremiumFeatures } from "@/hooks/usePremiumFeatures";
import { useAuth } from "@/hooks/useSupabaseAuth";
import { useConfetti } from "@/hooks/useConfetti";

interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  type: "discord" | "slack" | "custom";
  enabled: boolean;
  createdAt: string;
}

export const WebhookNotifications = () => {
  const { user } = useAuth();
  const { tier } = usePremiumFeatures();
  const { fireSuccessConfetti } = useConfetti();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isTesting, setIsTesting] = useState<string | null>(null);
  const [newWebhook, setNewWebhook] = useState<{
    name: string;
    url: string;
    type: "discord" | "slack" | "custom";
  }>({
    name: "",
    url: "",
    type: "discord",
  });

  const isPremium = tier !== "free";

  useEffect(() => {
    if (user) {
      const saved = storage.get<WebhookConfig[]>(`webhooks_${user.id}`, []);
      setWebhooks(saved);
    }
  }, [user]);

  const saveWebhooks = (updated: WebhookConfig[]) => {
    setWebhooks(updated);
    if (user) {
      storage.set(`webhooks_${user.id}`, updated);
    }
  };

  const handleAdd = () => {
    if (!newWebhook.name.trim() || !newWebhook.url.trim()) {
      toast.error("Please fill in all fields");
      return;
    }

    try {
      new URL(newWebhook.url);
    } catch {
      toast.error("Please enter a valid URL");
      return;
    }

    const webhook: WebhookConfig = {
      id: crypto.randomUUID(),
      ...newWebhook,
      enabled: true,
      createdAt: new Date().toISOString(),
    };

    saveWebhooks([...webhooks, webhook]);
    setNewWebhook({ name: "", url: "", type: "discord" });
    setIsOpen(false);
    fireSuccessConfetti();
    toast.success("Webhook added successfully!");
  };

  const handleRemove = (id: string) => {
    saveWebhooks(webhooks.filter((w) => w.id !== id));
    toast.success("Webhook removed");
  };

  const handleToggle = (id: string) => {
    saveWebhooks(
      webhooks.map((w) => (w.id === id ? { ...w, enabled: !w.enabled } : w))
    );
  };

  const handleTest = async (webhook: WebhookConfig) => {
    setIsTesting(webhook.id);
    try {
      let body: string;
      let headers: Record<string, string> = {};

      if (webhook.type === "discord") {
        body = JSON.stringify({
          content: "🧪 Test notification from Nullsto Email!",
          embeds: [
            {
              title: "Test Email Received",
              description: "This is a test webhook notification.",
              color: 0x00d4aa,
              timestamp: new Date().toISOString(),
            },
          ],
        });
        headers["Content-Type"] = "application/json";
      } else if (webhook.type === "slack") {
        body = JSON.stringify({
          text: "🧪 Test notification from Nullsto Email!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "*Test Email Received*\nThis is a test webhook notification.",
              },
            },
          ],
        });
        headers["Content-Type"] = "application/json";
      } else {
        body = JSON.stringify({
          event: "test",
          message: "Test notification from Nullsto Email",
          timestamp: new Date().toISOString(),
        });
        headers["Content-Type"] = "application/json";
      }

      await fetch(webhook.url, {
        method: "POST",
        headers,
        body,
        mode: "no-cors",
      });

      toast.success("Test notification sent! Check your webhook destination.");
    } catch (error) {
      toast.error("Failed to send test notification");
      console.error(error);
    } finally {
      setIsTesting(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "discord":
        return "🎮";
      case "slack":
        return "💼";
      default:
        return "🔗";
    }
  };

  if (!isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20"
      >
        <div className="flex items-center gap-3 mb-3">
          <Webhook className="w-6 h-6 text-amber-500" />
          <h3 className="font-semibold text-lg">Webhook Notifications</h3>
          <Crown className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-muted-foreground mb-4">
          Send email notifications to Discord, Slack, or any custom webhook.
          Upgrade to Pro to unlock this feature.
        </p>
        <Button className="bg-gradient-to-r from-amber-500 to-orange-500">
          Upgrade to Pro
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Webhook Notifications</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsOpen(true)}
          className="gap-2 hover-lift"
        >
          <Plus className="w-4 h-4" />
          Add Webhook
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {webhooks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-muted-foreground"
          >
            <Webhook className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No webhooks configured</p>
            <p className="text-xs">Add a webhook to receive email notifications</p>
          </motion.div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((webhook) => (
              <motion.div
                key={webhook.id}
                layout
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{getTypeIcon(webhook.type)}</span>
                  <div>
                    <p className="font-medium">{webhook.name}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                      {webhook.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleTest(webhook)}
                    disabled={isTesting === webhook.id || !webhook.enabled}
                    className="gap-1"
                  >
                    {isTesting === webhook.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <TestTube className="w-4 h-4" />
                    )}
                    Test
                  </Button>
                  <Switch
                    checked={webhook.enabled}
                    onCheckedChange={() => handleToggle(webhook.id)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleRemove(webhook.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure a webhook to receive email notifications
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="My Discord Channel"
                value={newWebhook.name}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, name: e.target.value }))
                }
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={newWebhook.type}
                onValueChange={(value: "discord" | "slack" | "custom") =>
                  setNewWebhook((prev) => ({ ...prev, type: value }))
                }
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discord">🎮 Discord</SelectItem>
                  <SelectItem value="slack">💼 Slack</SelectItem>
                  <SelectItem value="custom">🔗 Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Webhook URL</Label>
              <Input
                placeholder={
                  newWebhook.type === "discord"
                    ? "https://discord.com/api/webhooks/..."
                    : newWebhook.type === "slack"
                    ? "https://hooks.slack.com/services/..."
                    : "https://your-webhook-url.com/..."
                }
                value={newWebhook.url}
                onChange={(e) =>
                  setNewWebhook((prev) => ({ ...prev, url: e.target.value }))
                }
                className="bg-secondary/50"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAdd}
              className="bg-gradient-to-r from-primary to-accent"
            >
              Add Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebhookNotifications;
