import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { NewEmailToast, resolveNewEmailToastVariant } from "../NewEmailToast";

describe("NewEmailToast reduced-motion variant", () => {
  it("resolveNewEmailToastVariant returns 'reduced' when RM is on", () => {
    expect(resolveNewEmailToastVariant("bounce_confetti", true)).toBe("reduced");
    expect(resolveNewEmailToastVariant("both", true)).toBe("reduced");
    expect(resolveNewEmailToastVariant("slide_glow", true)).toBe("reduced");
  });

  it("keeps the requested variant when RM is off", () => {
    expect(resolveNewEmailToastVariant("bounce_confetti", false)).toBe("bounce_confetti");
    expect(resolveNewEmailToastVariant("slide_glow", false)).toBe("slide_glow");
    expect(resolveNewEmailToastVariant("both", false)).toBe("both");
  });

  it("renders the 'reduced' variant and hides confetti when reduced motion is forced", () => {
    const { container } = render(
      <NewEmailToast
        from="alice@example.com"
        subject="Hello"
        style="bounce_confetti"
        forceReducedMotion
      />,
    );
    const root = container.querySelector('[data-variant]');
    expect(root?.getAttribute("data-variant")).toBe("reduced");
    // No confetti particles or sparkle burst under reduced motion.
    expect(container.querySelectorAll('[aria-hidden="true"] span').length).toBe(0);
  });

  it("renders the requested bounce_confetti variant when reduced motion is off", () => {
    const { container } = render(
      <NewEmailToast
        from="alice@example.com"
        subject="Hello"
        style="bounce_confetti"
        forceReducedMotion={false}
      />,
    );
    const root = container.querySelector('[data-variant]');
    expect(root?.getAttribute("data-variant")).toBe("bounce_confetti");
  });
});