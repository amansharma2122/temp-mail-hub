import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { NewEmailToast, resolveNewEmailToastVariant, type NewEmailToastStyle } from "../NewEmailToast";

/**
 * Extends the reduced-motion coverage: while reduced motion is on, rapid
 * "intensity" (style) changes AND rapid enable/disable of the toast must
 * always resolve to the "reduced" variant — never leak a bounce/confetti
 * animation between the transitions.
 */
describe("NewEmailToast reduced-motion under rapid changes", () => {
  it("stays on 'reduced' across rapid intensity flips", () => {
    const styles: NewEmailToastStyle[] = [
      "slide_glow", "bounce_confetti", "both", "slide_glow", "bounce_confetti",
    ];
    for (const s of styles) {
      expect(resolveNewEmailToastVariant(s, true)).toBe("reduced");
    }
  });

  it("stays on 'reduced' across rapid enable/disable rerenders", () => {
    const { rerender, container, unmount } = render(
      <NewEmailToast from="a" subject="x" style="bounce_confetti" forceReducedMotion />,
    );
    for (const style of ["slide_glow", "both", "bounce_confetti"] as NewEmailToastStyle[]) {
      rerender(
        <NewEmailToast from="a" subject="x" style={style} forceReducedMotion />,
      );
      const el = container.querySelector("[data-variant]");
      expect(el?.getAttribute("data-variant")).toBe("reduced");
      // Confetti markup must never appear under reduced motion.
      expect(container.querySelectorAll('[aria-hidden="true"] span').length).toBe(0);
    }
    // Simulate rapid disable/re-enable.
    unmount();
    const remount = render(
      <NewEmailToast from="a" subject="y" style="both" forceReducedMotion />,
    );
    expect(
      remount.container.querySelector("[data-variant]")?.getAttribute("data-variant"),
    ).toBe("reduced");
  });
});