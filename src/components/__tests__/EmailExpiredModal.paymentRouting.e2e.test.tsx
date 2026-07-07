import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock payment settings so all four methods (stripe, paypal, upi, telegram)
// render as available buttons in the modal.
vi.mock("@/hooks/usePaymentSettings", () => ({
  __esModule: true,
  default: () => ({
    stripeEnabled: true,
    paypalEnabled: true,
    telegramEnabled: true,
    telegramLink: "https://t.me/testchannel",
    upiEnabled: true,
    upiId: "test@upi",
    keepEmailPrice: 2,
    currency: "usd",
  }),
  usePaymentSettings: () => ({
    stripeEnabled: true,
    paypalEnabled: true,
    telegramEnabled: true,
    telegramLink: "https://t.me/testchannel",
    upiEnabled: true,
    upiId: "test@upi",
    keepEmailPrice: 2,
    currency: "usd",
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import EmailExpiredModal from "@/components/EmailExpiredModal";

function Harness(props: Partial<React.ComponentProps<typeof EmailExpiredModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmailExpiredModal
          isOpen
          address="expired@nullsto.com"
          onClose={props.onClose ?? vi.fn()}
          onGenerateNew={props.onGenerateNew ?? vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("EmailExpiredModal — payment method routing", () => {
  const openSpy = vi.fn();
  beforeEach(() => {
    openSpy.mockReset();
    // navigator.clipboard.writeText for UPI copy path
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.stubGlobal("open", openSpy);
  });

  it("renders all four payment method buttons for the expired email", () => {
    render(<Harness />);
    expect(screen.getByRole("button", { name: /card \(stripe\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /paypal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^upi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /telegram/i })).toBeInTheDocument();
  });

  it("Telegram routes to the configured telegram link and closes the modal", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /telegram/i }));
    fireEvent.click(screen.getByRole("button", { name: /contact on telegram/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    expect(openSpy.mock.calls[0][0]).toContain("https://t.me/testchannel");
    expect(onClose).toHaveBeenCalled();
  });

  it("UPI copies the configured UPI ID and does not close the modal immediately", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: /^upi/i }));
    fireEvent.click(screen.getByRole("button", { name: /copy upi id/i }));
    // clipboard called with the exact UPI id
    await Promise.resolve();
    expect((navigator.clipboard.writeText as any)).toHaveBeenCalledWith("test@upi");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("Stripe falls back to the Telegram channel with an intent that references the email + method", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /card \(stripe\)/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue — pay/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0];
    expect(url).toContain("https://t.me/testchannel");
    expect(decodeURIComponent(url)).toContain("expired@nullsto.com");
    expect(decodeURIComponent(url)).toContain("stripe");
  });

  it("PayPal falls back to the Telegram channel with an intent that references the method", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /paypal/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue — pay/i }));
    expect(openSpy).toHaveBeenCalledTimes(1);
    const [url] = openSpy.mock.calls[0];
    expect(decodeURIComponent(url)).toContain("paypal");
  });
});
