import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoutingDesk } from "@/components/admin/RoutingDesk";
import type { CRMLead } from "@/components/admin/types";

const leadId = "0621be04-8984-4087-8cec-324e0efd25d4";

vi.mock("@/components/admin/LeadDossierSheet", () => ({
  LeadDossierSheet: ({
    lead,
    open,
    onOpenChange,
  }: {
    lead: CRMLead | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="routing-dossier">
        {lead?.id ?? "unavailable"}
        <button type="button" onClick={() => onOpenChange(false)}>
          Close lead detail
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/admin/DispatchHealthCard", () => ({
  DispatchHealthCard: () => <div>Dispatch health</div>,
}));

vi.mock("@/services/adminDataService", () => ({
  fetchOpportunities: vi.fn(async () => [
    {
      id: "opp-1",
      lead_id: leadId,
      scan_session_id: "scan-1",
      analysis_id: "analysis-1",
      status: "intro_requested",
      intro_requested_at: "2026-09-03T10:00:00.000Z",
      routed_at: null,
      sent_at: null,
      county: "Miami-Dade",
      project_type: null,
      window_count: 8,
      quote_range: null,
      grade: "B",
      flag_count: 0,
      red_flag_count: 0,
      amber_flag_count: 0,
      priority_score: 1,
      brief_text: null,
      brief_json: null,
      brief_version: null,
      brief_generated_at: null,
      homeowner_contact_released_at: null,
      suggested_contractor_id: null,
      client_slug: "direct",
      internal_notes: null,
      last_call_intent: null,
      last_call_requested_at: null,
      created_at: "2026-09-03T10:00:00.000Z",
      updated_at: "2026-09-03T10:00:00.000Z",
    },
  ]),
  fetchRoutes: vi.fn(async () => []),
  fetchContractors: vi.fn(async () => []),
  routeLeadToContractor: vi.fn(),
  markOpportunityDead: vi.fn(),
  invokeAdminData: vi.fn(),
}));

vi.mock("@/services/dispatchHealth", () => ({
  fetchClientResolutions: vi.fn(async () => []),
  describeNoRouteReason: () => "No route",
}));

function lead(): CRMLead {
  return {
    id: leadId,
    session_id: "session-1",
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone_e164: "+13055551234",
    county: "Miami-Dade",
    city: "Miami",
    state: "FL",
    zip: "33101",
    grade: "B",
    grade_score: 80,
    window_count: 8,
    quote_amount: 18000,
    phone_verified: true,
    phone_verified_at: null,
    latest_analysis_id: "analysis-1",
    latest_scan_session_id: "scan-1",
    latest_opportunity_id: "opp-1",
    status: "qualified",
    funnel_stage: "qualified",
    flag_count: 0,
    red_flag_count: 0,
    amber_flag_count: 0,
    critical_flag_count: 0,
    confidence_score: 0.9,
    lead_score: 80,
    scan_count: 1,
    created_at: "2026-09-03T10:00:00.000Z",
    updated_at: "2026-09-03T10:00:00.000Z",
    deal_status: null,
    last_call_intent: null,
    assigned_partner: "Primary Client",
    project_type: null,
    quote_range: null,
    utm_source: null,
    utm_medium: null,
    utm_campaign: null,
    gclid: null,
    fbclid: null,
    landing_page_url: null,
    initial_referrer: null,
    report_unlocked_at: null,
    intro_requested_at: null,
    routed_to_contractor_at: null,
    appointment_booked_at: null,
    replacement_quote_submitted_at: null,
    closed_at: null,
    reactivation_email_sent_at: null,
    last_call_completed_at: null,
    last_call_status: null,
    last_call_outcome: null,
    last_call_summary: null,
    deal_value: null,
    revenue_amount: null,
    last_activity_at: null,
    latest_activity_type: null,
  };
}

function renderDesk(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const router = createMemoryRouter(
    [
      {
        path: "/admin/routing",
        element: (
          <QueryClientProvider client={queryClient}>
            <RoutingDesk leads={[lead()]} />
          </QueryClientProvider>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  return { router, ...render(<RouterProvider router={router} />) };
}

describe("RoutingDesk lead selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("opens a dossier from the current routing URL and closes with Back", async () => {
    const { router } = renderDesk("/admin/routing?utm_source=google");
    fireEvent.click(await screen.findByRole("button", { name: /Dossier/i }));
    expect(await screen.findByTestId("routing-dossier")).toHaveTextContent(leadId);
    expect(router.state.location.search).toContain(`lead_id=${leadId}`);
    expect(router.state.location.search).toContain("utm_source=google");
    expect(router.state.historyAction).toBe("PUSH");
    fireEvent.click(screen.getByRole("button", { name: "Close lead detail" }));
    await waitFor(() => {
      expect(screen.queryByTestId("routing-dossier")).not.toBeInTheDocument();
    });
    expect(router.state.location.search).not.toContain("lead_id=");
    expect(router.state.location.search).toContain("utm_source=google");
  });

  it("opens from a direct lead_id query and replace-closes", async () => {
    const { router } = renderDesk(`/admin/routing?utm_source=google&lead_id=${leadId}`);
    expect(await screen.findByTestId("routing-dossier")).toHaveTextContent(leadId);
    fireEvent.click(screen.getByRole("button", { name: "Close lead detail" }));
    await waitFor(() => {
      expect(screen.queryByTestId("routing-dossier")).not.toBeInTheDocument();
    });
    expect(router.state.location.pathname).toBe("/admin/routing");
    expect(router.state.location.search).toContain("utm_source=google");
    expect(router.state.location.search).not.toContain("lead_id=");
  });
});
