import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidRecaptchaDomainWarning } from "@/pages/admin/AdminCaptcha";

vi.mock("@/hooks/useCaptchaSettings", () => ({
  useCaptchaSettings: () => ({
    settings: { enabled: true, provider: "recaptcha", siteKey: "sk", secretKey: "s", enableOnLogin: true, enableOnRegister: true, enableOnContact: true, enableOnEmailGen: false, threshold: 0.5 },
    isLoading: false, updateSettings: vi.fn(), isSaving: false,
  }),
}));
vi.mock("@/hooks/useRecaptcha", () => ({
  useRecaptcha: () => ({ loadError: null, executeRecaptcha: vi.fn(), isReady: true, isEnabled: true, isLoading: false, settings: {} }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe("InvalidRecaptchaDomainWarning hostname copy button", () => {
  const writeText = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  it("copies the exact hostname value to the clipboard on click", async () => {
    const HOSTNAME = "admin.example.test";

    render(
      <InvalidRecaptchaDomainWarning
        hostname={HOSTNAME}
        loadError="reCAPTCHA misconfigured: Invalid domain for site key"
      />,
    );

    // The exact hostname string is rendered in the warning body.
    expect(screen.getByText(HOSTNAME)).toBeInTheDocument();

    const button = screen.getByRole("button", { name: /copy current hostname/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
      // Argument must be the exact hostname, with no whitespace, protocol, or extras.
      expect(writeText).toHaveBeenCalledWith(HOSTNAME);
      const [arg] = writeText.mock.calls[0];
      expect(arg).toBe(HOSTNAME);
      expect(arg).not.toMatch(/^\s|\s$|https?:|\//);
    });
  });
});
