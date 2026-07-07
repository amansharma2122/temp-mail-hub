import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidRecaptchaDomainWarning } from "@/pages/admin/AdminCaptcha";

vi.mock("@/hooks/useCaptchaSettings", () => ({
  useCaptchaSettings: () => ({
    settings: {
      enabled: true,
      provider: "recaptcha",
      siteKey: "site-key",
      secretKey: "secret-key",
      enableOnLogin: true,
      enableOnRegister: true,
      enableOnContact: true,
      enableOnEmailGen: false,
      threshold: 0.5,
    },
    isLoading: false,
    updateSettings: vi.fn(),
    isSaving: false,
  }),
}));

vi.mock("@/hooks/useRecaptcha", () => ({
  useRecaptcha: () => ({
    loadError: "reCAPTCHA misconfigured: Invalid domain for site key",
    executeRecaptcha: vi.fn(),
    isReady: false,
    isEnabled: true,
    isLoading: false,
    settings: {},
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange, ...props }: any) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

describe("AdminCaptcha invalid-domain warning", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the current hostname and expands/collapses the checklist", async () => {
    render(
      <InvalidRecaptchaDomainWarning
        hostname={window.location.hostname}
        loadError="reCAPTCHA misconfigured: Invalid domain for site key"
      />,
    );

    const expectedHostname = window.location.hostname;
    expect(screen.getByTestId("recaptcha-invalid-domain-alert")).toBeInTheDocument();
    expect(screen.getByText(expectedHostname)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /copy current hostname/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expectedHostname);
    });

    const toggle = screen.getByTestId("recaptcha-domain-checklist-toggle");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/Select the site key currently configured above/i)).not.toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("recaptcha-domain-checklist")).toBeInTheDocument();
    expect(screen.getByText(/Select the site key currently configured above/i)).toBeInTheDocument();

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await waitFor(() => {
      expect(screen.queryByText(/Select the site key currently configured above/i)).not.toBeInTheDocument();
    });
  });
});