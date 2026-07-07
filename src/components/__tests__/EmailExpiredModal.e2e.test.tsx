import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import EmailExpiredModal from "@/components/EmailExpiredModal";

function Harness({ onGenerateNew }: { onGenerateNew: () => void }) {
  return (
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route
          path="/"
          element={
            <EmailExpiredModal
              isOpen
              address="user@nullsto.com"
              onClose={vi.fn()}
              onGenerateNew={onGenerateNew}
            />
          }
        />
        <Route path="/pricing" element={<div>Pricing Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("EmailExpiredModal end-to-end flow", () => {
  it("renders with the expired address and both actions", () => {
    render(<Harness onGenerateNew={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("user@nullsto.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate new email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /upgrade to keep this email/i })).toBeInTheDocument();
  });

  it("invokes onGenerateNew when the primary action is clicked", () => {
    const onGenerateNew = vi.fn();
    render(<Harness onGenerateNew={onGenerateNew} />);
    fireEvent.click(screen.getByRole("button", { name: /generate new email/i }));
    expect(onGenerateNew).toHaveBeenCalledTimes(1);
  });

  it("navigates to /pricing when Upgrade is clicked", () => {
    render(<Harness onGenerateNew={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /upgrade to keep this email/i }));
    expect(screen.getByText("Pricing Page")).toBeInTheDocument();
  });

  it("calls onClose when the close (X) button is clicked", () => {
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <EmailExpiredModal
          isOpen
          address="a@b.co"
          onClose={onClose}
          onGenerateNew={vi.fn()}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
