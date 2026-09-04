import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ActivePipeline } from "@/components/admin/ActivePipeline";
import type { CRMLead } from "@/components/admin/types";

vi.mock("@/components/admin/LeadDossierSheet", () => ({
  LeadDossierSheet: ({ lead, open }: { lead: CRMLead | null; open: boolean }) =>
    open && lead ? <div data-testid="pipeline-dossier">{lead.id}</div> : null,
}));

function lead(overrides: Partial<CRMLead>): CRMLead {
  return {
    id: "0621be04-8984-4087-8cec-324e0efd25d4",
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
    latest_opportunity_id: null,
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
    ...overrides,
  };
}

const leads = [
  lead({}),
  lead({
    id: "1721be04-8984-4087-8cec-324e0efd25d4",
    session_id: "session-2",
    first_name: "Alex",
    last_name: "Rivera",
    email: "alex@example.com",
    phone_e164: "+14075559876",
  }),
];

function renderPipeline(initialEntry = "/admin/pipeline") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ActivePipeline leads={leads} />
    </MemoryRouter>,
  );
}

describe("ActivePipeline lead search and links", () => {
  it.each(["Jane Doe", "jane@example.com", "(305) 555-1234", "0621be04"])(
    "searches live leads by %s",
    (query) => {
      renderPipeline();
      fireEvent.change(screen.getByRole("textbox", { name: "Search pipeline leads" }), {
        target: { value: query },
      });
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();
      expect(screen.queryByText("Alex Rivera")).not.toBeInTheDocument();
    },
  );

  it("provides a permanent workspace link and copyable full ID", () => {
    renderPipeline();
    expect(screen.getByRole("link", { name: "Open lead workspace for Jane Doe" }))
      .toHaveAttribute("href", "/admin/leads/0621be04-8984-4087-8cec-324e0efd25d4");
    expect(screen.getByRole("button", {
      name: "Copy lead ID 0621be04-8984-4087-8cec-324e0efd25d4",
    })).toBeInTheDocument();
  });

  it("opens the matching drawer from a shareable lead_id link", () => {
    renderPipeline("/admin/pipeline?lead_id=0621be04-8984-4087-8cec-324e0efd25d4");
    expect(screen.getByTestId("pipeline-dossier"))
      .toHaveTextContent("0621be04-8984-4087-8cec-324e0efd25d4");
  });
});
