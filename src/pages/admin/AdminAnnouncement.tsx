import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useAnnouncementSettings } from "@/hooks/useAnnouncementSettings";
import { Megaphone, Save, Eye, MessageCircle, Crown, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const AdminAnnouncement = () => {
  const { settings, isLoading, updateSettings } = useAnnouncementSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = async () => {
    setIsSaving(true);
    const result = await updateSettings(localSettings);
    if (result.success) {
      toast.success("Announcement settings saved!");
    } else {
      toast.error("Failed to save settings");
    }
    setIsSaving(false);
  };

  const updateSetting = <K extends keyof typeof localSettings>(key: K, value: typeof localSettings[K]) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Megaphone className="w-8 h-8 text-primary" />
            Announcement Bar
          </h1>
          <p className="text-muted-foreground">Configure the announcement bar shown at the top of the site</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Live Preview */}
      <Card className="border-border overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            Live Preview
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {localSettings.isEnabled ? (
            <div className="relative overflow-hidden bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] animate-gradient-x">
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative container mx-auto px-4">
                <div className="flex items-center justify-center gap-2 py-2.5 text-primary-foreground">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <div className="flex items-center gap-3 text-sm font-medium">
                    <span className="flex items-center gap-1.5">
                      {localSettings.badgeText && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold uppercase tracking-wider">
                          {localSettings.badgeText}
                        </span>
                      )}
                      <span>{localSettings.mainMessage}</span>
                    </span>
                    {localSettings.ctaText && (
                      <>
                        <span className="w-px h-4 bg-white/30" />
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-4 h-4 text-yellow-300" />
                          <span>{localSettings.ctaText}</span>
                          {localSettings.showTelegramButton && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/20 rounded-full">
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span className="font-semibold">{localSettings.telegramText}</span>
                            </span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 text-center text-muted-foreground bg-secondary/30">
              Announcement bar is disabled
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6">
        {/* Enable/Disable */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Display Settings</CardTitle>
            <CardDescription>Control when the announcement bar is shown</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Enable Announcement Bar</Label>
                <p className="text-sm text-muted-foreground">
                  Show the announcement bar at the top of all pages
                </p>
              </div>
              <Switch
                checked={localSettings.isEnabled}
                onCheckedChange={(checked) => updateSetting('isEnabled', checked)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Content Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle>Content Settings</CardTitle>
            <CardDescription>Customize the announcement message</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="badgeText">Badge Text</Label>
                <Input
                  id="badgeText"
                  value={localSettings.badgeText}
                  onChange={(e) => updateSetting('badgeText', e.target.value)}
                  placeholder="New"
                  className="bg-secondary/50"
                />
                <p className="text-xs text-muted-foreground">Leave empty to hide badge</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mainMessage">Main Message</Label>
                <Input
                  id="mainMessage"
                  value={localSettings.mainMessage}
                  onChange={(e) => updateSetting('mainMessage', e.target.value)}
                  placeholder="Guest can create 5 free Emails in a day"
                  className="bg-secondary/50"
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="ctaText">CTA Text</Label>
                <Input
                  id="ctaText"
                  value={localSettings.ctaText}
                  onChange={(e) => updateSetting('ctaText', e.target.value)}
                  placeholder="Premium Plan is live!"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ctaLink">CTA Link (optional)</Label>
                <Input
                  id="ctaLink"
                  value={localSettings.ctaLink}
                  onChange={(e) => updateSetting('ctaLink', e.target.value)}
                  placeholder="/pricing"
                  className="bg-secondary/50"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Telegram Settings */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-[#0088cc]" />
              Telegram Button
            </CardTitle>
            <CardDescription>Configure the Telegram contact button</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border">
              <div>
                <Label className="text-base font-medium">Show Telegram Button</Label>
                <p className="text-sm text-muted-foreground">
                  Display a button to contact via Telegram
                </p>
              </div>
              <Switch
                checked={localSettings.showTelegramButton}
                onCheckedChange={(checked) => updateSetting('showTelegramButton', checked)}
              />
            </div>
            {localSettings.showTelegramButton && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="telegramText">Button Text</Label>
                  <Input
                    id="telegramText"
                    value={localSettings.telegramText}
                    onChange={(e) => updateSetting('telegramText', e.target.value)}
                    placeholder="Contact on Telegram"
                    className="bg-secondary/50"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="telegramLink">Telegram Link</Label>
                  <Input
                    id="telegramLink"
                    value={localSettings.telegramLink}
                    onChange={(e) => updateSetting('telegramLink', e.target.value)}
                    placeholder="https://t.me/yourhandle"
                    className="bg-secondary/50"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminAnnouncement;
