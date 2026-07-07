import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";

// Preview page renders the widget via overrideSettings/overrideWebsites, so
// no Supabase calls happen. Mock auth to keep the hook satisfied.
vi.mock("@/hooks/useSupabaseAuth", () => ({ useAuth: () => ({ user: null }) }));

vi.mock("@/lib/friendlyWidgetAnalytics", () => ({
  recordFriendlyWidgetEvent: vi.fn(),
  canShowBadge: () => true,
  noteBadgeShown: vi.fn(),
  prefersReducedMotion: () => false,
}));

// The widget doesn't hit the DB in preview mode (overrides), but the module
// still imports supabase — stub it defensively.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null, error: null }),
          order: async () => ({ data: [], error: null }),
        }),
      }),
    }),
    auth: { getUser: async () => ({ data: { user: null } }) },
  },
}));

import AdminFriendlyWidgetPreview from "@/pages/admin/AdminFriendlyWidgetPreview";

const renderPage = () => {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0, staleTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <TooltipProvider>
        <AdminFriendlyWidgetPreview />
      </TooltipProvider>
    </QueryClientProvider>,
  );
};

describe("AdminFriendlyWidgetPreview — RTL & theme toggles", () => {
  it("renders the preview canvas with the selected icon and sparkle effect", async () => {
    renderPage();
    // Widget trigger is rendered inside the canvas with the sparkle effect.
    const trigger = await screen.findByTestId("friendly-widget-trigger");
    expect(trigger.getAttribute("data-attention")).toBe("sparkle");
    // Canvas is present.
    expect(screen.getByTestId("preview-canvas")).toBeInTheDocument();
  });

  it("toggles preview direction between LTR and RTL", async () => {
    renderPage();
    const canvas = await screen.findByTestId("preview-canvas");
    const dirBtn = screen.getByTestId("preview-dir-toggle");

    expect(canvas.getAttribute("dir")).toBe("ltr");
    fireEvent.click(dirBtn);
    await waitFor(() =>
      expect(canvas.getAttribute("dir")).toBe("rtl"),
    );
    expect(dirBtn.getAttribute("aria-pressed")).toBe("true");
  });

  it("toggles preview theme between light and dark and keeps layout intact", async () => {
    renderPage();
    const canvas = await screen.findByTestId("preview-canvas");
    const themeBtn = screen.getByTestId("preview-theme-toggle");

    expect(canvas.getAttribute("data-theme")).toBe("light");
    fireEvent.click(themeBtn);
    await waitFor(() =>
      expect(canvas.getAttribute("data-theme")).toBe("dark"),
    );
    // Dark class applied for scoped styling.
    expect(canvas.className).toMatch(/dark/);
    // Widget trigger continues to render after theme swap.
    expect(await screen.findByTestId("friendly-widget-trigger")).toBeInTheDocument();
  });
});