import { render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { LeadDossierSheet } from "@/components/admin/LeadDossierSheet";
import type { CRMLead } from "@/components/admin/types";

const leadId = "0621be04-8984-4087-8cec-324e0efd25d4";

vi.mock("@/services/adminDataService", () => ({
  fetchLeadAnalysis: vi.fn(async () => ({
    grade: "D",
    dollar_delta: 4200,
    confidence_score: 48,
    flags: [
      { severity: "High", flag: "missing_dp_rating", detail: "No permit responsibility stated" },
      { severity: "Medium", flag: "permit_scope", detail: "Scope is unclear" },
    ],
    evidence_projection: { pillar_detail_available: false },
  })),
  fetchLeadVoiceFollowups: vi.fn(async () => []),
  invokeAdminData: vi.fn(),
  routeLeadToContractor: vi.fn(),
  fetchContractors: vi.fn(async () => []),
}));

vi.mock("@/components/admin/OpportunityRouteTimeline", () => ({
  OpportunityRouteTimeline: () => <div>Contractor routing evidence</div>,
}));

vi.mock("@/components/admin/LeadLifecycleTimeline", () => ({
  LeadLifecycleTimeline: () => <ol><li>Lead Created</li></ol>,
}));

vi.mock("@/components/dossier/ForensicFindingsPanel", () => ({
  default: () => <section><h2>Forensic Findings</h2></section>,
}));

const lead: CRMLead = {
  id: leadId,
  session_id: "session-1",
  first_name: "Peter",
  last_name: null,
  email: "peter@example.com",
  phone_e164: "+12345678938",
  county: null,
  city: null,
  state: null,
  zip: null,
  grade: "D",
  grade_score: 40,
  window_count: null,
  quote_amount: null,
  phone_verified: true,
  phone_verified_at: "2026-09-03T13:45:00.000Z",
  latest_analysis_id: "analysis-1",
  latest_scan_session_id: "scan-1",
  latest_opportunity_id: null,
  status: "new",
  funnel_stage: "new",
  flag_count: 2,
  red_flag_count: 1,
  amber_flag_count: 1,
  critical_flag_count: 0,
  confidence_score: 48,
  lead_score: 40,
  scan_count: 1,
  created_at: "2026-09-03T13:34:00.000Z",
  updated_at: "2026-09-03T13:45:00.000Z",
  deal_status: null,
  last_call_intent: null,
  assigned_partner: null,
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

function renderDossier() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <LeadDossierSheet lead={lead} open onOpenChange={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("LeadDossierSheet verdict-file presentation", () => {
  it("renders the dossier cover, live verdict metrics, and evidence notice", async () => {
    renderDossier();

    expect(screen.getByText("Confidential · Lead verdict file")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Peter" })).toBeInTheDocument();

    const verdict = screen.getByLabelText("Verdict summary");
    await waitFor(() => expect(within(verdict).getByText("+$4,200")).toBeInTheDocument());
    expect(within(verdict).getByText("48%")).toBeInTheDocument();
    expect(within(verdict).getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Analysis confidence" }))
      .toHaveAttribute("aria-valuenow", "48");
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Limited evidence — detailed review unavailable",
    );
  });

  it("preserves permanent workspace and lead identity actions", () => {
    renderDossier();

    expect(screen.getByRole("link", { name: "Open Lead Workspace" }))
      .toHaveAttribute("href", `/admin/leads/${leadId}`);
    expect(screen.getByRole("button", { name: `Copy lead ID ${leadId}` }))
      .toHaveClass("bg-[#18212E]");
    expect(screen.getByRole("button", { name: "Send to Contractor" })).toBeEnabled();
  });
});
