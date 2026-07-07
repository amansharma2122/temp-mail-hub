import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";

/**
 * End-to-end style test for the admin dashboard's quota-alert + reconcile flow.
 *
 * Mocks the Supabase client so we don't hit the network, then renders the two
 * dashboard widgets that make up the "mailbox nearing quota → admin acts" path
 * and asserts:
 *   1. The alert renders with the recommended action & rotate-by timestamp
 *   2. Clicking "Reconcile now" fires both reconciler RPCs without throwing
 *   3. Clicking "Promote as active" calls promote_mailbox_as_primary and refreshes
 *   4. No console.error is emitted during any of the above
 */

const rpcMock = vi.fn();
const fromMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import MailboxQuotaAlerts from "../MailboxQuotaAlerts";
import StatsHealthWidget from "../StatsHealthWidget";

const nearingRow = {
  id: "mb-1",
  name: "primary@example.com",
  is_primary: true,
  is_full: false,
  storage_bytes_used: 9.3 * 1024 * 1024 * 1024,
  storage_bytes_limit: 10 * 1024 * 1024 * 1024,
  percent_used: 93,
  recommended_action: "Rotate now or promote another active mailbox",
  suggested_rotate_at: new Date(Date.now() + 6 * 3600_000).toISOString(),
};
const secondaryRow = {
  ...nearingRow,
  id: "mb-2",
  name: "spare@example.com",
  is_primary: false,
  percent_used: 91,
  recommended_action: "Plan rotation within the next 24 hours",
};

function setupSupabaseMocks() {
  rpcMock.mockReset();
  fromMock.mockReset();

  rpcMock.mockImplementation((name: string) => {
    if (name === "get_mailboxes_nearing_quota") {
      return Promise.resolve({ data: [nearingRow, secondaryRow], error: null });
    }
    if (name === "reconcile_email_stats") return Promise.resolve({ data: {}, error: null });
    if (name === "reconcile_mailbox_storage") return Promise.resolve({ data: {}, error: null });
    if (name === "promote_mailbox_as_primary") return Promise.resolve({ data: {}, error: null });
    return Promise.resolve({ data: null, error: null });
  });

  // Chainable stub covering the queries StatsHealthWidget makes.
  const chain: any = {};
  const table = (name: string) => {
    chain.select = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.in = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn(() =>
      Promise.resolve(
        name === "stats_health_log"
          ? { data: [{ id: "h1", status: "ok", source: "reconcile_email_stats", duration_ms: 12, error_message: null, details: {}, created_at: new Date().toISOString() }], error: null }
          : { data: [], error: null },
      ),
    );
    // For .order().order() (mailboxes) that doesn't call .limit()
    chain.then = (resolve: (v: unknown) => unknown) => {
      const rows =
        name === "mailboxes"
          ? [
              { id: "mb-1", name: "primary@example.com", is_active: true, is_full: false,
                storage_bytes_used: nearingRow.storage_bytes_used, storage_bytes_limit: nearingRow.storage_bytes_limit,
                is_primary: true, last_quota_check_at: null },
              { id: "mb-2", name: "spare@example.com", is_active: true, is_full: false,
                storage_bytes_used: 8e9, storage_bytes_limit: 10 * 1024 * 1024 * 1024,
                is_primary: false, last_quota_check_at: null },
            ]
          : name === "email_stats"
          ? [{ stat_key: "emails_today_ist", stat_value: 42, stat_date: new Date().toISOString().slice(0, 10), updated_at: new Date().toISOString() }]
          : [];
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    };
    return chain;
  };
  fromMock.mockImplementation((name: string) => table(name));
}

function renderDashboardWidgets() {
  return render(
    <BrowserRouter>
      <>
        <MailboxQuotaAlerts />
        <StatsHealthWidget />
      </>
    </BrowserRouter>,
  );
}

describe("Admin dashboard: quota alerts + reconcile/promote flow", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setupSupabaseMocks();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders quota alert with recommended action + rotate-by time", async () => {
    renderDashboardWidgets();
    await waitFor(() => {
      expect(screen.getByText(/approaching 10\s*GB quota/i)).toBeInTheDocument();
    });
    expect(screen.getByText("primary@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(/Rotate now or promote another active mailbox/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/rotate by/i)).toBeInTheDocument();
  });

  it("Reconcile now triggers both reconciler RPCs without errors", async () => {
    renderDashboardWidgets();
    const btn = await screen.findByRole("button", { name: /reconcile now/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("reconcile_email_stats");
      expect(rpcMock).toHaveBeenCalledWith("reconcile_mailbox_storage");
    });
    expect(errorSpy).not.toHaveBeenCalled();
    cleanup();
  });

  it("Promote as active calls the locked RPC for the correct mailbox", async () => {
    renderDashboardWidgets();
    const promoteBtn = await screen.findByRole("button", { name: /promote as active/i });
    fireEvent.click(promoteBtn);
    await waitFor(() => {
      expect(rpcMock).toHaveBeenCalledWith("promote_mailbox_as_primary", { p_mailbox_id: "mb-2" });
    });
    expect(errorSpy).not.toHaveBeenCalled();
  });
});