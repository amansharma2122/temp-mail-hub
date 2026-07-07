import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";
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
  return <button onClick={() => setLanguage("ar")}>العربية</button>;
}

describe("AdminAppSettingsUpdateToast RTL accessibility", () => {
  beforeEach(() => cleanup());

  it("keeps RTL toast text unclipped and action keyboard-focusable with live-region semantics", async () => {
    const { getByRole } = render(
      <MemoryRouter>
        <LanguageProvider>
          <SwitchToArabic />
          <AdminAppSettingsUpdateToast />
          <Toaster />
        </LanguageProvider>
      </MemoryRouter>,
    );

    act(() => getByRole("button", { name: "العربية" }).click());
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));

    act(() => broadcastAppSettingsChange("friendly_sites_widget", 88));

    await waitFor(() => {
      expect(getByRole("status")).toHaveTextContent("friendly_sites_widget");
    });

    const toastEl = document.querySelector(".app-settings-update-toast") as HTMLElement;
    expect(toastEl).toBeTruthy();
    expect(toastEl.classList.contains("rtl")).toBe(true);
    expect(toastEl.className).toMatch(/break-words/);
    expect(getComputedStyle(toastEl).textAlign).not.toBe("left");

    const action = getByRole("button", { name: /فتح الإعداد/ });
    action.focus();
    expect(document.activeElement).toBe(action);

    let node: HTMLElement | null = toastEl;
    while (node && node !== document.body) {
      expect(getComputedStyle(node).overflow).not.toBe("hidden");
      node = node.parentElement;
    }
  });
});