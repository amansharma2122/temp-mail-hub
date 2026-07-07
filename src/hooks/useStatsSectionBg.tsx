import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Admin-configurable background style for the stats + quick tips section.
 * Reads `app_settings.stats_section_bg` which may hold:
 *   { lightColor?: string; darkColor?: string; className?: string }
 * `lightColor`/`darkColor` are CSS color values (hex/hsl/rgb/named); when
 * present they win over the fallback className. Falls back to a semantic
 * token combo that stays visible in both themes.
 */
export interface StatsSectionBgConfig {
  lightColor?: string;
  darkColor?: string;
  className?: string;
}

const FALLBACK_CLASS = "bg-secondary/60 dark:bg-muted/60";

export function useStatsSectionBg() {
  const [config, setConfig] = useState<StatsSectionBgConfig | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "stats_section_bg")
        .maybeSingle();
      if (!cancelled && data?.value && typeof data.value === "object") {
        setConfig(data.value as StatsSectionBgConfig);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const className = config?.className || FALLBACK_CLASS;
  const style: React.CSSProperties | undefined =
    config?.lightColor || config?.darkColor
      ? {
          // CSS custom properties consumed via inline style below.
          ["--stats-section-bg" as unknown as string]: config?.lightColor,
          ["--stats-section-bg-dark" as unknown as string]: config?.darkColor,
          backgroundColor: `var(--stats-section-bg, transparent)`,
        }
      : undefined;

  return { className, style };
}