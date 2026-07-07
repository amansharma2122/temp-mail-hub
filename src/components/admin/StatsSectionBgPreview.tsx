import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface StatsSectionBgConfig {
  lightColor?: string;
  darkColor?: string;
  className?: string;
}

const FALLBACK_LIGHT = "#f1f5f9"; // ≈ secondary/60 on white
const FALLBACK_DARK = "#111827"; // ≈ muted/60 on dark background

/**
 * Admin preview + editor for the stats + quick tips section background
 * (`app_settings.stats_section_bg`). Shows a side-by-side light + dark
 * preview so admins can immediately see the effect before saving.
 */
export default function StatsSectionBgPreview() {
  const [light, setLight] = useState(FALLBACK_LIGHT);
  const [dark, setDark] = useState(FALLBACK_DARK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "stats_section_bg")
        .maybeSingle();
      const v = (data?.value ?? {}) as StatsSectionBgConfig;
      if (v.lightColor) setLight(v.lightColor);
      if (v.darkColor) setDark(v.darkColor);
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "stats_section_bg", value: { lightColor: light, darkColor: dark } });
    setSaving(false);
    if (error) toast.error("Failed to save background color");
    else toast.success("Section background updated");
  };

  const previewCard = useMemo(
    () => (bg: string, theme: "light" | "dark") => (
      <div
        className={`rounded-xl border ${theme === "dark" ? "border-white/10" : "border-black/10"}`}
        style={{ backgroundColor: bg }}
        data-testid={`stats-bg-preview-${theme}`}
      >
        <div className="p-4">
          <p
            className="text-sm font-semibold"
            style={{ color: theme === "dark" ? "#f8fafc" : "#0f172a" }}
          >
            Today (IST) · 11.1K
          </p>
          <p
            className="text-xs"
            style={{ color: theme === "dark" ? "#94a3b8" : "#64748b" }}
          >
            Quick tips preview text on {theme} theme
          </p>
        </div>
      </div>
    ),
    [],
  );

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div>
        <h3 className="text-base font-semibold">Stats section background</h3>
        <p className="text-xs text-muted-foreground">
          Pick a color for the stats + quick tips section. Applies live in both themes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stats-bg-light">Light theme</Label>
          <div className="flex items-center gap-2">
            <Input
              id="stats-bg-light"
              type="color"
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="h-9 w-14 p-1"
              disabled={loading}
            />
            <Input
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="font-mono text-xs"
              disabled={loading}
            />
          </div>
          {previewCard(light, "light")}
        </div>

        <div className="space-y-2">
          <Label htmlFor="stats-bg-dark">Dark theme</Label>
          <div className="flex items-center gap-2">
            <Input
              id="stats-bg-dark"
              type="color"
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="h-9 w-14 p-1"
              disabled={loading}
            />
            <Input
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="font-mono text-xs"
              disabled={loading}
            />
          </div>
          {previewCard(dark, "dark")}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading || saving}>
          {saving ? "Saving…" : "Save background"}
        </Button>
      </div>
    </div>
  );
}