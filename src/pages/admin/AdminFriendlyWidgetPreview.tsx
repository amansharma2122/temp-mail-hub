import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import LucideIconPicker from "@/components/admin/LucideIconPicker";
import FriendlyWebsitesWidget from "@/components/FriendlyWebsitesWidget";
import { Moon, Sun, Languages } from "lucide-react";

/**
 * Live preview of the Friendly Websites widget for admins.
 * The widget component accepts `overrideSettings` + `overrideWebsites` props
 * so this page renders exactly what an end user would see, without touching
 * DB state.
 */
export default function AdminFriendlyWidgetPreview() {
  type PreviewSettings = {
    enabled: boolean;
    visibleToPublic: boolean;
    visibleToLoggedIn: boolean;
    colorScheme: 'primary' | 'accent' | 'gradient' | 'glass';
    size: 'small' | 'medium' | 'large';
    position: 'left' | 'right';
    showOnMobile: boolean;
    animationType: 'slide' | 'fade' | 'bounce' | 'flip' | 'zoom';
    attentionEffect: 'none' | 'pulse' | 'glow' | 'wiggle' | 'bounce' | 'ring'
      | 'sparkle' | 'confetti' | 'ripple' | 'rainbow' | 'magnet';
    buttonLabel: string;
    tooltipText: string;
    showBadge: boolean;
    badgeText: string;
    triggerIcon: string;
    autoOpenDelayMs: number;
    showLabelOnTrigger: boolean;
    animationIntensity: 'subtle' | 'normal' | 'lively';
    disableEffectsOnReducedMotion: boolean;
  };
  const [settings, setSettings] = useState<PreviewSettings>({
    enabled: true,
    visibleToPublic: true,
    visibleToLoggedIn: true,
    colorScheme: 'primary',
    size: 'medium',
    position: 'right',
    showOnMobile: true,
    animationType: 'slide',
    attentionEffect: 'sparkle',
    buttonLabel: 'Partner Sites',
    tooltipText: 'Explore our partner sites',
    showBadge: true,
    badgeText: 'NEW',
    triggerIcon: 'Sparkles',
    autoOpenDelayMs: 0,
    showLabelOnTrigger: true,
    animationIntensity: 'normal',
    disableEffectsOnReducedMotion: true,
  });

  const [sites, setSites] = useState([
    {
      id: 'preview-1',
      name: 'Nullsto',
      url: 'https://nullsto.lovable.app',
      icon_url: null,
      icon_name: 'Sparkles',
      description: 'Fast temporary inboxes.',
      display_order: 0,
      is_active: true,
      open_in_new_tab: true,
      attention_effect: null,
      badge_enabled: true,
      badge_text: null,
      auto_open_override: null,
      max_badge_per_day: 0,
    },
    {
      id: 'preview-2',
      name: 'Docs',
      url: 'https://example.com',
      icon_url: null,
      icon_name: 'BookOpen',
      description: 'Reference & guides.',
      display_order: 1,
      is_active: true,
      open_in_new_tab: true,
      attention_effect: null,
      badge_enabled: false,
      badge_text: null,
      auto_open_override: null,
      max_badge_per_day: 0,
    },
  ]);

  const update = <K extends keyof typeof settings>(k: K, v: typeof settings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  // Preview-only toggles: LTR/RTL direction and light/dark theme applied
  // scoped to the preview canvas so admins can validate rendering without
  // affecting the surrounding admin app.
  const [previewDir, setPreviewDir] = useState<"ltr" | "rtl">("ltr");
  const [previewTheme, setPreviewTheme] = useState<"light" | "dark">("light");

  return (
    <div className="container max-w-5xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Friendly Widget Preview</h1>
        <p className="text-muted-foreground text-sm">
          Preview theme, icon, effect and badge rules exactly as end users will see them.
          Nothing is saved — this is a sandbox.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Trigger</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Icon</Label>
              <LucideIconPicker
                value={settings.triggerIcon}
                onChange={(name) => update('triggerIcon', name)}
              />
            </div>
            <div className="space-y-1">
              <Label>Button Label</Label>
              <Input
                value={settings.buttonLabel}
                onChange={(e) => update('buttonLabel', e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Badge Text</Label>
              <Input
                value={settings.badgeText}
                onChange={(e) => update('badgeText', e.target.value)}
                maxLength={6}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Position</Label>
              <Select
                value={settings.position}
                onValueChange={(v: 'left' | 'right') => update('position', v)}
              >
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="right">Right</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Effect & Motion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Attention Effect</Label>
              <Select
                value={settings.attentionEffect}
                onValueChange={(v: typeof settings.attentionEffect) => update('attentionEffect', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['none','pulse','glow','wiggle','bounce','ring','sparkle','confetti','ripple','rainbow','magnet'].map(e => (
                    <SelectItem key={e} value={e}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Color Scheme</Label>
              <Select
                value={settings.colorScheme}
                onValueChange={(v: typeof settings.colorScheme) => update('colorScheme', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['primary','accent','gradient','glass'].map(e => (
                    <SelectItem key={e} value={e as any}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Animation Intensity</Label>
              <Select
                value={settings.animationIntensity}
                onValueChange={(v: typeof settings.animationIntensity) => update('animationIntensity', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['subtle','normal','lively'].map(e => (
                    <SelectItem key={e} value={e as any}>{e}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label>Respect Reduced Motion</Label>
                <p className="text-xs text-muted-foreground">
                  Auto-disable sparkle/wiggle when OS prefers reduce motion.
                </p>
              </div>
              <Switch
                checked={settings.disableEffectsOnReducedMotion}
                onCheckedChange={(v) => update('disableEffectsOnReducedMotion', v)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-2">
            <span>Preview canvas</span>
            <div className="flex items-center gap-2 text-sm font-normal">
              <Button
                type="button"
                variant={previewDir === "rtl" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewDir(previewDir === "ltr" ? "rtl" : "ltr")}
                aria-pressed={previewDir === "rtl"}
                data-testid="preview-dir-toggle"
              >
                <Languages className="w-4 h-4 mr-1" /> {previewDir.toUpperCase()}
              </Button>
              <Button
                type="button"
                variant={previewTheme === "dark" ? "default" : "outline"}
                size="sm"
                onClick={() => setPreviewTheme(previewTheme === "light" ? "dark" : "light")}
                aria-pressed={previewTheme === "dark"}
                data-testid="preview-theme-toggle"
              >
                {previewTheme === "dark" ? (
                  <Moon className="w-4 h-4 mr-1" />
                ) : (
                  <Sun className="w-4 h-4 mr-1" />
                )}
                {previewTheme}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            dir={previewDir}
            data-testid="preview-canvas"
            data-theme={previewTheme}
            className={`relative h-96 border rounded-lg overflow-hidden ${previewTheme === "dark" ? "dark bg-slate-950 text-slate-50" : "bg-gradient-to-br from-muted/40 to-background"}`}
          >
            <p className="absolute top-3 left-3 text-xs text-muted-foreground">
              The widget renders anchored to the viewport — resize your window to see position.
            </p>
            <FriendlyWebsitesWidget
              overrideSettings={settings}
              overrideWebsites={sites as any}
            />
          </div>
          <Button
            variant="outline"
            className="mt-3"
            onClick={() =>
              setSites((s) =>
                s.map((x, i) => (i === 0 ? { ...x, badge_enabled: !x.badge_enabled } : x))
              )
            }
          >
            Toggle badge on first site
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}