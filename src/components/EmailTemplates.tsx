import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Plus, Edit2, Trash2, Copy, Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  createdAt: string;
  updatedAt: string;
}

interface EmailTemplatesProps {
  onUseTemplate?: (template: EmailTemplate) => void;
}

export const EmailTemplates = ({ onUseTemplate }: EmailTemplatesProps) => {
  const { user } = useAuth();
  const { tier } = usePremiumFeatures();
  const { fireSuccessConfetti } = useConfetti();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    subject: "",
    body: "",
  });

  const isPremium = tier !== "free";

  useEffect(() => {
    if (user) {
      const saved = storage.get<EmailTemplate[]>(`email_templates_${user.id}`, []);
      setTemplates(saved);
    }
  }, [user]);

  const saveTemplates = (updated: EmailTemplate[]) => {
    setTemplates(updated);
    if (user) {
      storage.set(`email_templates_${user.id}`, updated);
    }
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.body.trim()) {
      toast.error("Please fill in name and body");
      return;
    }

    const now = new Date().toISOString();

    if (editingId) {
      saveTemplates(
        templates.map((t) =>
          t.id === editingId
            ? { ...t, ...form, updatedAt: now }
            : t
        )
      );
      toast.success("Template updated!");
    } else {
      const template: EmailTemplate = {
        id: crypto.randomUUID(),
        ...form,
        createdAt: now,
        updatedAt: now,
      };
      saveTemplates([...templates, template]);
      fireSuccessConfetti();
      toast.success("Template created!");
    }

    setForm({ name: "", subject: "", body: "" });
    setEditingId(null);
    setIsOpen(false);
  };

  const handleEdit = (template: EmailTemplate) => {
    setForm({
      name: template.name,
      subject: template.subject,
      body: template.body,
    });
    setEditingId(template.id);
    setIsOpen(true);
  };

  const handleDelete = (id: string) => {
    saveTemplates(templates.filter((t) => t.id !== id));
    toast.success("Template deleted");
  };

  const handleCopy = async (template: EmailTemplate) => {
    await navigator.clipboard.writeText(template.body);
    setCopiedId(template.id);
    toast.success("Template copied to clipboard!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleUse = (template: EmailTemplate) => {
    if (onUseTemplate) {
      onUseTemplate(template);
      toast.success("Template applied!");
    } else {
      handleCopy(template);
    }
  };

  const openNewDialog = () => {
    setForm({ name: "", subject: "", body: "" });
    setEditingId(null);
    setIsOpen(true);
  };

  if (!isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="p-6 rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20"
      >
        <div className="flex items-center gap-3 mb-3">
          <FileText className="w-6 h-6 text-purple-500" />
          <h3 className="font-semibold text-lg">Email Templates</h3>
          <Crown className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-muted-foreground mb-4">
          Create reusable email templates for quick replies. Upgrade to Pro to unlock this feature.
        </p>
        <Button className="bg-gradient-to-r from-purple-500 to-pink-500">
          Upgrade to Pro
        </Button>
      </motion.div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">Email Templates</h3>
          <span className="text-xs text-muted-foreground">
            ({templates.length})
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={openNewDialog}
          className="gap-2 hover-lift"
        >
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      <AnimatePresence mode="popLayout">
        {templates.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8 text-muted-foreground"
          >
            <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No templates yet</p>
            <p className="text-xs">Create templates for quick email replies</p>
          </motion.div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="group p-4 rounded-lg bg-secondary/30 border border-border hover:border-primary/30 transition-all hover-lift"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium truncate flex-1">{template.name}</h4>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEdit(template)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => handleDelete(template.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
                {template.subject && (
                  <p className="text-xs text-muted-foreground mb-1 truncate">
                    Subject: {template.subject}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                  {template.body}
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2"
                  onClick={() => handleUse(template)}
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="w-3 h-3" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      Use Template
                    </>
                  )}
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="glass-card max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Template" : "New Template"}
            </DialogTitle>
            <DialogDescription>
              Create a reusable email template
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                placeholder="Quick Thank You"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Subject (optional)</Label>
              <Input
                placeholder="Re: Your inquiry"
                value={form.subject}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, subject: e.target.value }))
                }
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea
                placeholder="Write your template content here..."
                value={form.body}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, body: e.target.value }))
                }
                className="bg-secondary/50 min-h-[150px]"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-gradient-to-r from-primary to-accent"
            >
              {editingId ? "Update" : "Create"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailTemplates;
