import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { BellRing, Loader2, Save, Sparkles, Volume2, VolumeX } from "lucide-react";
import { NewEmailToast, type NewEmailToastStyle } from "@/components/NewEmailToast";
import {
  setNewEmailNotificationStyleCache,
  setNewEmailSoundAdminEnabledCache,
} from "@/lib/newEmailNotificationStyle";

export default function NewEmailNotificationSettings() {
  const [style, setStyle] = useState<NewEmailToastStyle>("bounce_confetti");
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);

  useEffect(() => {
    (async () => {
      const [{ data: styleRow }, { data: soundRow }] = await Promise.all([
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "new_email_notification_style")
          .maybeSingle(),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "new_email_sound_admin_enabled")
          .maybeSingle(),
      ]);
      const _ = await Promise.resolve({ data: null } as any); void _; // no-op to keep TS calm
      const data = styleRow as any;
      const raw = (data as any)?.value;
      const val: NewEmailToastStyle =
        raw === "slide_glow" || raw === "bounce_confetti" || raw === "both"
          ? raw : (raw?.style ?? "bounce_confetti");
      setStyle(val);
      const rawSound = (soundRow as any)?.value;
      setSoundEnabled(!(rawSound === false || rawSound === "false" || rawSound?.enabled === false));
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("app_settings").upsert(
        { key: "new_email_notification_style", value: style } as any,
        { onConflict: "key" },
      ),
      supabase.from("app_settings").upsert(
        { key: "new_email_sound_admin_enabled", value: soundEnabled } as any,
        { onConflict: "key" },
      ),
    ]);
    const error = e1 || e2;
    setSaving(false);
    if (error) {
      toast.error("Save failed", { description: error.message });
      return;
    }
    setNewEmailNotificationStyleCache(style);
    setNewEmailSoundAdminEnabledCache(soundEnabled);
    toast.success("Notification style saved");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellRing className="w-5 h-5 text-primary" />
          New Email Notification Style
        </CardTitle>
        <CardDescription>
          Controls the animated toast shown when a new email arrives in realtime.
          Users with "prefers reduced motion" automatically get the calm variant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid md:grid-cols-[1fr_auto] gap-3 items-end">
          <div className="space-y-1">
            <Label>Style</Label>
            <Select value={style} onValueChange={(v: NewEmailToastStyle) => setStyle(v)} disabled={loading}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="slide_glow">Slide + soft glow (calm)</SelectItem>
                <SelectItem value="bounce_confetti">Bounce + confetti burst (default)</SelectItem>
                <SelectItem value="both">Both — glow + confetti (attention max)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={saving || loading} size="sm">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>

        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
          <div className="flex items-start gap-3">
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-primary mt-0.5" />
            ) : (
              <VolumeX className="w-5 h-5 text-muted-foreground mt-0.5" />
            )}
            <div>
              <Label className="text-sm">Site-wide new-email sound</Label>
              <p className="text-xs text-muted-foreground">
                Master switch for the sound played on realtime new-email arrivals.
                Users can still silence sounds individually via their preferences.
              </p>
            </div>
          </div>
          <Switch checked={soundEnabled} onCheckedChange={setSoundEnabled} disabled={loading} />
        </div>

        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Live preview</Label>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setPreviewKey((k) => k + 1)}
            >
              <Sparkles className="w-4 h-4 mr-1" /> Replay animation
            </Button>
          </div>
          <div className="p-4 rounded-lg bg-muted/40 flex justify-start">
            <NewEmailToast
              key={previewKey}
              from="hello@example.com"
              subject="Your verification code is 482910"
              style={style}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}