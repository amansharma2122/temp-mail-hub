import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { LanguageProvider } from "@/contexts/LanguageContext";
import AdminAppSettingsUpdateToast from "@/components/admin/AdminAppSettingsUpdateToast";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: async () => ({ error: null }) }),
    channel: () => ({ on() { return this; }, subscribe() { return this; } }),
    removeChannel: () => {},
  },
}));

import { broadcastAppSettingsChange } from "@/lib/appSettingsSync";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}{location.hash}</div>;
}

function Harness() {
  return (
    <LanguageProvider>
      <AdminAppSettingsUpdateToast />
      <Toaster />
      <Routes>
        <Route
          path="/admin/friendly-websites"
          element={
            <>
              <LocationProbe />
              <div id="app-setting-friendly_sites_widget" data-testid="settings-row" tabIndex={-1} />
            </>
          }
        />
      </Routes>
    </LanguageProvider>
  );
}

describe("AdminAppSettingsUpdateToast action link", () => {
  beforeEach(() => {
    cleanup();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("navigates to and scrolls/focuses the row for the changed app_settings key", async () => {
    const { getByRole, getByTestId } = render(
      <MemoryRouter initialEntries={["/admin/friendly-websites"]}>
        <Harness />
      </MemoryRouter>,
    );

    act(() => {
      broadcastAppSettingsChange("friendly_sites_widget", 31);
    });

    const action = await waitFor(() => getByRole("button", { name: /open setting/i }));
    fireEvent.click(action);

    await waitFor(() => {
      expect(getByTestId("location")).toHaveTextContent(
        "/admin/friendly-websites#app-setting-friendly_sites_widget",
      );
    });

    await waitFor(() => {
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
      expect(document.activeElement).toBe(getByTestId("settings-row"));
    });
  });
});