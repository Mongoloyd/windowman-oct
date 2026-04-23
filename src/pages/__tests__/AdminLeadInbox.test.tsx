/**
 * AdminLeadInbox — accessibility + event-propagation tests
 *
 * Verifies Phase 20 contract:
 *  - The "View" link on every row carries aria-label="View details for {name}"
 *    (specific, screen-reader friendly).
 *  - Clicking the View link navigates exactly once (e.stopPropagation prevents
 *    the row's own onClick from firing a second navigate call).
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// ── Mocks must be hoisted ────────────────────────────────────────────────
const navigateSpy = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom",
  );
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("@/services/adminDataService", () => ({
  invokeAdminData: vi.fn(async () => [
    {
      id: "lead-uuid-001",
      session_id: "sess-001",
      first_name: "Jane",
      last_name: "Doe",
      email: "jane@example.com",
      phone_e164: "+13055551234",
      county: "Miami-Dade",
      city: "Miami",
      state: "FL",
      zip: "33101",
      grade: "B",
      grade_score: 78,
      window_count: 8,
      quote_amount: 18500,
      phone_verified: true,
      phone_verified_at: new Date().toISOString(),
      latest_analysis_id: "analysis-001",
      latest_scan_session_id: "sess-001",
      status: "qualified",
      funnel_stage: "qualified",
      flag_count: 2,
      red_flag_count: 1,
      amber_flag_count: 1,
      critical_flag_count: 0,
      confidence_score: 0.85,
      lead_score: 72,
      scan_count: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      utm_source: "google",
      utm_campaign: "impact-windows-fl",
    },
  ]),
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

// AdminShell pulls AdminIdentityBar → supabase. Stub it out for unit isolation.
vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({ children, belowHeader }: any) => (
    <div data-testid="admin-shell">
      {belowHeader}
      {children}
    </div>
  ),
}));

import AdminLeadInbox from "@/pages/AdminLeadInbox";

function renderInbox() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/admin/leads"]}>
        <AdminLeadInbox />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AdminLeadInbox — View link accessibility & propagation", () => {
  beforeEach(() => {
    navigateSpy.mockReset();
  });

  it('exposes aria-label="View details for {name}" on the row link', async () => {
    renderInbox();
    const link = await screen.findByRole("link", {
      name: "View details for Jane Doe",
    });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/admin/leads/lead-uuid-001");
  });

  it("clicking View navigates exactly once (row onClick does not double-fire)", async () => {
    renderInbox();
    const link = await screen.findByRole("link", {
      name: "View details for Jane Doe",
    });

    // Simulate the click — react-router <Link> handles navigation internally
    // when wrapped in MemoryRouter, so navigateSpy from the row's useNavigate
    // hook is the only path that would call our spy.
    fireEvent.click(link);

    // The row's onClick calls navigate(`/admin/leads/${id}`). The link's own
    // e.stopPropagation must prevent the row click from firing — so the spy
    // must be called 0 times (link handled navigation via MemoryRouter, not
    // via the row's useNavigate hook).
    expect(navigateSpy).toHaveBeenCalledTimes(0);
  });

  it("clicking the row body navigates via useNavigate exactly once", async () => {
    renderInbox();
    const link = await screen.findByRole("link", {
      name: "View details for Jane Doe",
    });
    // The row is the closest <tr> ancestor of the link
    const row = link.closest("tr");
    expect(row).not.toBeNull();

    fireEvent.click(row!);

    expect(navigateSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith("/admin/leads/lead-uuid-001");
  });
});
