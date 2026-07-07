import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import AdminAppSettingsUpdateToast from "@/components/admin/AdminAppSettingsUpdateToast";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(),
    from: () => ({ insert: async () => ({ error: null }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  },
}));

import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function SwitchToArabic() {
  const { setLanguage } = useLanguage();
  return (
    <button data-testid="to-ar" onClick={() => setLanguage("ar")}>
      ar
    </button>
  );
}

describe("AdminAppSettingsUpdateToast — RTL rendering", () => {
  beforeEach(() => cleanup());

  it("renders the toast in Arabic with rtl direction and no clipped text", async () => {
    const { getByTestId } = render(
      <MemoryRouter>
        <LanguageProvider>
          <SwitchToArabic />
          <AdminAppSettingsUpdateToast />
          <Toaster />
        </LanguageProvider>
      </MemoryRouter>,
    );

    act(() => {
      getByTestId("to-ar").click();
    });

    // The LanguageProvider flips the document dir on language change.
    await waitFor(() => {
      expect(document.documentElement.dir).toBe("rtl");
    });

    act(() => {
      broadcastAppSettingsChange("friendly_sites_widget", 12);
    });

    // Arabic title appears.
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/تم تحديث الإعدادات في علامة تبويب أخرى/);
    });
    // Key + version rendered.
    expect(document.body.textContent).toMatch(/friendly_sites_widget/);
    expect(document.body.textContent).toMatch(/v12/);

    // Locate the toast element and verify direction + safe overflow class.
    const toastEl = document.querySelector(".app-settings-update-toast") as HTMLElement | null;
    expect(toastEl).toBeTruthy();
    expect(toastEl!.classList.contains("rtl")).toBe(true);
    // Guardrails against clipped text — the toast must allow wrapping.
    expect(toastEl!.className).toMatch(/break-words/);
    // The nearest positioned ancestor (sonner viewport) should not be
    // `overflow: hidden` in a way that would clip the RTL text — sonner
    // uses `overflow: visible` on the list container, verify no ancestor
    // has clip.
    let node: HTMLElement | null = toastEl;
    while (node && node !== document.body) {
      const style = getComputedStyle(node);
      expect(style.overflow).not.toBe("hidden");
      node = node.parentElement;
    }
  });
});