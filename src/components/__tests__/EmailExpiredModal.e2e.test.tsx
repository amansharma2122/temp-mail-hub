import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EmailExpiredModal from "@/components/EmailExpiredModal";

function Harness({
  onGenerateNew,
  onClose = vi.fn(),
}: {
  onGenerateNew: () => void;
  onClose?: () => void;
}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmailExpiredModal
          isOpen
          address="user@nullsto.com"
          onClose={onClose}
          onGenerateNew={onGenerateNew}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("EmailExpiredModal end-to-end flow", () => {
  it("renders with the expired address and the free-generate escape hatch", () => {
    render(<Harness onGenerateNew={vi.fn()} />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("user@nullsto.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /generate a new free email/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^dismiss$/i })).toBeInTheDocument();
  });

  it("invokes onGenerateNew when the free-generate button is clicked", () => {
    const onGenerateNew = vi.fn();
    render(<Harness onGenerateNew={onGenerateNew} />);
    fireEvent.click(screen.getByRole("button", { name: /generate a new free email/i }));
    expect(onGenerateNew).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when Dismiss is clicked", () => {
    const onClose = vi.fn();
    render(<Harness onGenerateNew={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^dismiss$/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when the top-right dismiss (X) button is clicked", () => {
    const onClose = vi.fn();
    render(<Harness onGenerateNew={vi.fn()} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /dismiss and continue/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
