import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import AdminAppSettingsUpdateToast from "@/components/admin/AdminAppSettingsUpdateToast";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: async () => ({ error: null }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  },
}));

import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function SwitchToArabic() {
  const { setLanguage } = useLanguage();
  return <button onClick={() => setLanguage("ar")}>ar</button>;
}

describe("AdminAppSettingsUpdateToast RTL a11y (e2e)", () => {
  beforeEach(() => cleanup());

  it("renders unclipped with role=status and keyboard-focusable action in RTL", async () => {
    const { getByRole } = render(
      <MemoryRouter>
        <LanguageProvider>
          <SwitchToArabic />
          <AdminAppSettingsUpdateToast />
          <Toaster />
        </LanguageProvider>
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "ar" }).click());
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));

    act(() => broadcastAppSettingsChange("friendly_sites_widget", 101));

    const status = await waitFor(() => getByRole("status"));
    expect(status).toHaveTextContent("friendly_sites_widget");

    const toastEl = document.querySelector(".app-settings-update-toast") as HTMLElement;
    expect(toastEl).toBeTruthy();
    expect(toastEl.classList.contains("rtl")).toBe(true);
    // No ancestor clips the toast content.
    for (let node: HTMLElement | null = toastEl; node && node !== document.body; node = node.parentElement) {
      expect(getComputedStyle(node).overflow).not.toBe("hidden");
    }

    // Action link is reachable by keyboard focus.
    const action = document.querySelector(".app-settings-update-toast a, .app-settings-update-toast button") as HTMLElement;
    expect(action).toBeTruthy();
    action.focus();
    expect(document.activeElement).toBe(action);

    // Enter/Space keyboard activation does not throw on the focused action.
    fireEvent.keyDown(action, { key: "Enter" });
  });
});
