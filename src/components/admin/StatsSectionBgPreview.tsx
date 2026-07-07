import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

// --- Small WCAG contrast helper (sRGB → relative luminance → ratio) ---
function hexToRgb(hex: string): [number, number, number] | null {
  const m = /^#?([a-f\d]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return [(int >> 16) & 255, (int >> 8) & 255, int & 255];
}
function relLuminance([r, g, b]: [number, number, number]): number {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}
export function contrastRatio(hexA: string, hexB: string): number {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  if (!a || !b) return 0;
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
// Body text used against the stats-section bg in each theme.
const LIGHT_TEXT = "#0f172a";
const DARK_TEXT = "#f8fafc";
const AA_MIN = 4.5;

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

  const lightRatio = useMemo(() => contrastRatio(LIGHT_TEXT, light), [light]);
  const darkRatio = useMemo(() => contrastRatio(DARK_TEXT, dark), [dark]);
  const lightFails = lightRatio < AA_MIN;
  const darkFails = darkRatio < AA_MIN;
  const anyFail = lightFails || darkFails;

  const save = async () => {
    if (anyFail) {
      toast.error("Contrast too low — pick a background that passes WCAG AA (≥ 4.5:1).");
      return;
    }
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
          <ContrastPill ratio={lightRatio} label="Light text on this bg" />
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
          <ContrastPill ratio={darkRatio} label="Dark text on this bg" />
        </div>
      </div>

      {anyFail && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-semibold">Fails WCAG AA contrast (≥ 4.5:1)</div>
            <div className="text-destructive/90">
              {lightFails && <>Light: {lightRatio.toFixed(2)}:1. </>}
              {darkFails && <>Dark: {darkRatio.toFixed(2)}:1. </>}
              Saving is disabled until both themes pass.
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={save} disabled={loading || saving || anyFail}>
          {saving ? "Saving…" : "Save background"}
        </Button>
      </div>
    </div>
  );
}

function ContrastPill({ ratio, label }: { ratio: number; label: string }) {
  const pass = ratio >= AA_MIN;
  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px]",
        pass
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-destructive/40 bg-destructive/10 text-destructive",
      ].join(" ")}
      aria-label={`${label}: ${ratio.toFixed(2)} to 1, ${pass ? "passes" : "fails"} WCAG AA`}
    >
      {pass ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
      <span>{ratio.toFixed(2)}:1 · {pass ? "AA ✓" : "AA ✗"}</span>
    </div>
  );
}