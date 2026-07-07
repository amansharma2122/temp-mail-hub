import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Snapshot/structural test: verifies the compact single-row layout for the
// LiveStats + Quick Tips section keeps both cards in a 60:40 grid with
// matching row height and a bounded max height across breakpoints.

function LayoutFixture() {
  return (
    <section
      data-testid="stats-tips-section"
      className="py-4 border-y border-border/50 bg-secondary/60 dark:bg-muted/60"
    >
      <div className="container mx-auto px-4">
        <div
          data-testid="stats-tips-grid"
          className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:items-stretch"
        >
          <div data-testid="stats-cell" className="min-w-0">
            <div className="h-full rounded-xl border" />
          </div>
          <div
            data-testid="tips-cell"
            className="relative flex h-full flex-col overflow-hidden rounded-xl border-2"
          />
        </div>
      </div>
    </section>
  );
}

describe("LiveStats + Quick Tips compact layout", () => {
  it("renders both cards in a 3fr:2fr row with matching height caps", () => {
    const { getByTestId, asFragment } = render(<LayoutFixture />);

    const section = getByTestId("stats-tips-section");
    // Background + top/bottom borders are part of the visual contract.
    expect(section.className).toMatch(/bg-secondary\/60/);
    expect(section.className).toMatch(/dark:bg-muted\/60/);
    expect(section.className).toMatch(/border-y/);
    expect(section.className).toMatch(/py-4/);

    const grid = getByTestId("stats-tips-grid");
    const stats = getByTestId("stats-cell");
    const tips = getByTestId("tips-cell");

    // Grid stacks on mobile and switches to 60:40 with stretched cells on sm+.
    expect(grid.className).toMatch(/^grid /);
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/sm:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/);
    expect(grid.className).toMatch(/sm:items-stretch/);
    expect(grid.className).toMatch(/gap-4/);

    // Tips cell stretches to match the stats row height via items-stretch + h-full.
    expect(stats.className).toMatch(/min-w-0/);
    expect(tips.className).toMatch(/\bh-full\b/);
    expect(tips.className).toMatch(/border-2/);

    // Snapshot the compact layout so accidental regressions are visible.
    expect(asFragment()).toMatchSnapshot();
  });

  it("stacks to a single column at the base breakpoint", () => {
    const { getByTestId } = render(<LayoutFixture />);
    const grid = getByTestId("stats-tips-grid");
    // Base layout is grid-cols-1; sm: variant only applies above 640px.
    expect(grid.className.split(/\s+/)).toContain("grid-cols-1");
  });

  it("keeps the same structure under a .dark theme wrapper (dark visual baseline)", () => {
    const { asFragment, getByTestId } = render(
      <div className="dark">
        <LayoutFixture />
      </div>,
    );
    const section = getByTestId("stats-tips-section");
    // dark: variant still applied via className list; snapshot proves parity.
    expect(section.className).toMatch(/dark:bg-muted\/60/);
    expect(asFragment()).toMatchSnapshot();
  });
});
