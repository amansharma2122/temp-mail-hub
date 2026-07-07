import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import EmailExpiredModal from "@/components/EmailExpiredModal";

function renderIn(dir: "ltr" | "rtl", viewport: { w: number; h: number }) {
  Object.defineProperty(window, "innerWidth", { value: viewport.w, configurable: true });
  Object.defineProperty(window, "innerHeight", { value: viewport.h, configurable: true });
  document.documentElement.setAttribute("dir", dir);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <EmailExpiredModal
          isOpen
          address="مستخدم@nullsto.com"
          onClose={vi.fn()}
          onGenerateNew={vi.fn()}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("EmailExpiredModal — RTL & i18n across viewports", () => {
  const viewports = [
    { name: "mobile",  w: 360,  h: 780 },
    { name: "tablet",  w: 768,  h: 1024 },
    { name: "desktop", w: 1280, h: 900 },
  ];

  for (const dir of ["ltr", "rtl"] as const) {
    for (const vp of viewports) {
      it(`renders correctly in ${dir.toUpperCase()} @ ${vp.name}`, () => {
        renderIn(dir, vp);
        const dialog = screen.getByRole("dialog");
        expect(dialog).toBeInTheDocument();

        // The dialog uses `dir="auto"` so it inherits from documentElement
        // and the address (which contains RTL characters) renders inline.
        expect(screen.getByText(/nullsto\.com/)).toBeInTheDocument();

        // Both escape hatches (dismiss + generate new) stay accessible.
        expect(screen.getByRole("button", { name: /dismiss and continue/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /generate a new free email/i })).toBeInTheDocument();
      });
    }
  }
});