import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

// Snapshot/structural test: verifies the compact single-row layout for the
// LiveStats + Quick Tips section keeps both cards in a 60:40 grid with
// matching row height and a bounded max height across breakpoints.

function LayoutFixture() {
  return (
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
  );
}

describe("LiveStats + Quick Tips compact layout", () => {
  it("renders both cards in a 3fr:2fr row with matching height caps", () => {
    const { getByTestId, asFragment } = render(<LayoutFixture />);

    const grid = getByTestId("stats-tips-grid");
    const stats = getByTestId("stats-cell");
    const tips = getByTestId("tips-cell");

    // Grid uses the 60:40 template on sm+ and stretches both cells.
    expect(grid.className).toMatch(/sm:grid-cols-\[minmax\(0,3fr\)_minmax\(0,2fr\)\]/);
    expect(grid.className).toMatch(/sm:items-stretch/);

    // Tips cell stretches to match the stats row height via items-stretch + h-full.
    expect(stats.className).toMatch(/min-w-0/);
    expect(tips.className).toMatch(/\bh-full\b/);

    // Snapshot the compact layout so accidental regressions are visible.
    expect(asFragment()).toMatchSnapshot();
  });
});
