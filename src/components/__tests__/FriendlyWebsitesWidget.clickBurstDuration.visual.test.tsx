import { describe, it, expect } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { ClickBurst } from "../FriendlyWebsitesWidget";

/**
 * Visual-regression style assertion: the ClickBurst overlay duration
 * must match the documented formula per celebration speed so admins
 * get the visible pacing they configure.
 *
 *   OVERLAY_MS = round(durationMs * iMul * sMul), clamped to [800, 12000]
 *   iMul(normal) = 1
 *   sMul: slower = 1.5, normal = 1, faster = 0.6
 */
describe("ClickBurst overlay duration matches configured speed", () => {
  const base = 4200;
  const expected: Record<"slower" | "normal" | "faster", number> = {
    slower: Math.round(base * 1.5), // 6300
    normal: Math.round(base * 1.0), // 4200
    faster: Math.round(base * 0.6), // 2520
  };

  for (const speed of ["slower", "normal", "faster"] as const) {
    it(`speed='${speed}' → data-overlay-ms=${expected[speed]}`, () => {
      cleanup();
      const { container } = render(
        <ClickBurst
          variant="confetti"
          intensity="normal"
          durationMs={base}
          countScale={0}
          speed={speed}
          reducedMotion={false}
          onDone={() => {}}
        />,
      );
      const el = container.querySelector('[data-testid="friendly-widget-click-burst"]') as HTMLElement;
      expect(el).toBeTruthy();
      expect(el.getAttribute("data-speed")).toBe(speed);
      expect(Number(el.getAttribute("data-overlay-ms"))).toBe(expected[speed]);
    });
  }

  it("ordering holds: slower > normal > faster", () => {
    expect(expected.slower).toBeGreaterThan(expected.normal);
    expect(expected.normal).toBeGreaterThan(expected.faster);
  });
});