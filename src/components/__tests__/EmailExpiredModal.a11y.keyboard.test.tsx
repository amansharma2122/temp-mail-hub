import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/hooks/usePaymentSettings", () => {
  const settings = {
    stripeEnabled: true,
    paypalEnabled: true,
    telegramEnabled: true,
    telegramLink: "https://t.me/testchannel",
    upiEnabled: true,
    upiId: "test@upi",
    keepEmailPrice: 2,
    currency: "usd",
  };
  return { __esModule: true, default: () => settings, usePaymentSettings: () => settings };
});

import EmailExpiredModal from "@/components/EmailExpiredModal";

function renderModal(onClose = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmailExpiredModal
          isOpen
          address="expired@nullsto.com"
          onClose={onClose}
          onGenerateNew={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmailExpiredModal — keyboard & screen-reader a11y", () => {
  const viewports = [
    { name: "mobile-small", w: 320 },
    { name: "mobile",       w: 375 },
    { name: "mobile-large", w: 414 },
  ];

  beforeEach(() => {
    document.documentElement.setAttribute("dir", "ltr");
  });

  for (const vp of viewports) {
    it(`exposes dialog semantics with labelled + described refs @ ${vp.name}`, () => {
      Object.defineProperty(window, "innerWidth", { value: vp.w, configurable: true });
      renderModal();
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "email-expired-title");
      expect(dialog).toHaveAttribute("aria-describedby", "email-expired-desc");
      // Ensure the referenced nodes exist so screen readers can resolve them.
      expect(document.getElementById("email-expired-title")).not.toBeNull();
      expect(document.getElementById("email-expired-desc")).not.toBeNull();
    });
  }

  it("dismiss (X) button has an accessible name", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /dismiss and continue/i })).toBeInTheDocument();
  });

  it("tab order surfaces dismiss, payment methods, and the free-generate escape hatch as reachable buttons", () => {
    renderModal();
    const buttons = screen.getAllByRole("button");
    const names = buttons.map((b) => (b.getAttribute("aria-label") || b.textContent || "").trim());
    // The critical interactive elements must all be present in the tab order.
    expect(names.some((n) => /dismiss and continue/i.test(n))).toBe(true);
    expect(names.some((n) => /card \(stripe\)/i.test(n))).toBe(true);
    expect(names.some((n) => /paypal/i.test(n))).toBe(true);
    expect(names.some((n) => /upi/i.test(n))).toBe(true);
    expect(names.some((n) => /telegram/i.test(n))).toBe(true);
    expect(names.some((n) => /generate a new free email/i.test(n))).toBe(true);
    expect(names.some((n) => /^dismiss$/i.test(n))).toBe(true);
    // None of these must be tab-trapped away via tabindex="-1".
    for (const b of buttons) {
      expect(b.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("clicking the backdrop dismisses the modal (Esc-equivalent escape hatch)", () => {
    const onClose = vi.fn();
    renderModal(onClose);
    // The outermost overlay handles onClick={onClose}.
    const dialog = screen.getByRole("dialog");
    fireEvent.click(dialog);
    expect(onClose).toHaveBeenCalled();
  });

  it("payment method buttons are toggle buttons with aria-pressed state", () => {
    renderModal();
    const stripeBtn = screen.getByRole("button", { name: /card \(stripe\)/i });
    expect(stripeBtn).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(stripeBtn);
    expect(stripeBtn).toHaveAttribute("aria-pressed", "true");
  });
});
