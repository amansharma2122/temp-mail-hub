import { describe, it, expect } from "vitest";

// Lightweight WCAG 2.1 relative-luminance contrast check.
// Verifies the stats/quick-tips section text stays at or above WCAG AA
// (4.5:1 for normal text) on both light-mode and dark-mode background
// tokens used by the section.

type RGB = [number, number, number];

function hslToRgb(h: number, s: number, l: number): RGB {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function relLum([r, g, b]: RGB): number {
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrast(a: RGB, b: RGB): number {
  const la = relLum(a);
  const lb = relLum(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

// Values taken from src/index.css design tokens.
const LIGHT = {
  background: hslToRgb(0, 0, 100),
  foreground: hslToRgb(222.2, 47.4, 11.2),
  mutedForeground: hslToRgb(215.4, 16.3, 46.9),
  secondary: hslToRgb(210, 40, 96.1),
  muted: hslToRgb(210, 40, 96.1),
};
const DARK = {
  background: hslToRgb(222.2, 47.4, 4),
  foreground: hslToRgb(210, 40, 98),
  mutedForeground: hslToRgb(215, 20.2, 65.1),
  secondary: hslToRgb(217.2, 32.6, 17.5),
  muted: hslToRgb(217.2, 32.6, 17.5),
};

// The section uses bg-secondary/60 (light) and dark:bg-muted/60 (dark).
// Alpha 60% over the page background approximates as a lerp.
function over(fg: RGB, bg: RGB, alpha: number): RGB {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

describe("stats + quick tips section text contrast", () => {
  it("meets WCAG AA for foreground text in light mode", () => {
    const bg = over(LIGHT.secondary, LIGHT.background, 0.6);
    expect(contrast(LIGHT.foreground, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("meets WCAG AA for muted-foreground labels in light mode", () => {
    const bg = over(LIGHT.secondary, LIGHT.background, 0.6);
    expect(contrast(LIGHT.mutedForeground, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("meets WCAG AA for foreground text in dark mode", () => {
    const bg = over(DARK.muted, DARK.background, 0.6);
    expect(contrast(DARK.foreground, bg)).toBeGreaterThanOrEqual(4.5);
  });
  it("meets WCAG AA for muted-foreground labels in dark mode", () => {
    const bg = over(DARK.muted, DARK.background, 0.6);
    expect(contrast(DARK.mutedForeground, bg)).toBeGreaterThanOrEqual(4.5);
  });

  // Admin-configurable bg colors (via app_settings.stats_section_bg).
  // Verify a handful of common admin choices still meet WCAG AA against
  // the foreground token that renders inside the section.
  const hexToRgb = (hex: string): RGB => {
    const h = hex.replace("#", "");
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  };

  const ADMIN_BG_LIGHT_SAFE = ["#f5f5f7", "#e5efff", "#f7f5ff"];
  const ADMIN_BG_DARK_SAFE = ["#111827", "#1f2937", "#0f172a"];

  ADMIN_BG_LIGHT_SAFE.forEach((hex) => {
    it(`meets WCAG AA on custom admin light bg ${hex}`, () => {
      expect(contrast(LIGHT.foreground, hexToRgb(hex))).toBeGreaterThanOrEqual(4.5);
    });
  });
  ADMIN_BG_DARK_SAFE.forEach((hex) => {
    it(`meets WCAG AA on custom admin dark bg ${hex}`, () => {
      expect(contrast(DARK.foreground, hexToRgb(hex))).toBeGreaterThanOrEqual(4.5);
    });
  });
});