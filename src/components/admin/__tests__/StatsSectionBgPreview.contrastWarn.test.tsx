import { describe, it, expect } from "vitest";
import { contrastRatio } from "@/components/admin/StatsSectionBgPreview";

describe("StatsSectionBgPreview — WCAG contrast guard", () => {
  it("passes AA for the default light+dark tokens", () => {
    expect(contrastRatio("#0f172a", "#f1f5f9")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio("#f8fafc", "#111827")).toBeGreaterThanOrEqual(4.5);
  });

  it("flags a low-contrast light background (gray text on white)", () => {
    // Bad: dark text on a similarly dark background.
    expect(contrastRatio("#0f172a", "#334155")).toBeLessThan(4.5);
  });

  it("flags a low-contrast dark background (near-black text on dark grey)", () => {
    expect(contrastRatio("#f8fafc", "#e2e8f0")).toBeLessThan(4.5);
  });
});