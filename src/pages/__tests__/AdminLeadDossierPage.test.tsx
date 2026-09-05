import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminLeadDossierPage from "../AdminLeadDossierPage";
import { fetchLeadDetail } from "@/services/adminDataService";

const leadId = "11111111-1111-4111-8111-111111111111";
const scanId = "22222222-2222-4222-8222-222222222222";

const leadDetail = {
  id: leadId,
  first_name: "Jane",
  last_name: "Doe",
  email: "jane@example.com",
  phone_e164: "+13055551234",
  phone_verified: true,
  county: "Miami-Dade",
  state: "FL",
  zip: "33101",
  window_count: 8,
  project_type: "Replacement",
  quote_range: "$15k-$20k",
  quote_amount: 18500,
  utm_source: "google",
  source: "web",
  funnel_stage: "qualified",
  grade: "B",
  confidence_score: 85,
  flag_count: 2,
  critical_flag_count: 1,
  latest_analysis_id: "analysis-1",
  latest_scan_session_id: scanId,
  created_at: "2026-01-01T12:00:00Z",
};

vi.mock("@/services/adminDataService", () => ({
  fetchLeadDetail: vi.fn(),
  fetchLeadAnalysis: vi.fn(async () => ({ confidence_score: 85, flags: [] })),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

const fetchLeadDetailMock = vi.mocked(fetchLeadDetail);

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({
    title,
    eyebrow,
    backTo,
    backLabel,
    variant,
    nav,
    children,
  }: {
    title: string;
    eyebrow?: string;
    backTo?: string;
    backLabel?: string;
    variant?: string;
    nav?: ReactNode;
    children?: ReactNode;
  }) => (
    <div
      data-testid="admin-shell"
      data-variant={variant}
      data-eyebrow={eyebrow}
      data-back-to={backTo}
      data-back-label={backLabel}
    >
      {backTo ? (
        <a href={backTo} data-testid="shell-back">
          {backLabel}
        </a>
      ) : null}
      {eyebrow ? <p data-testid="shell-eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {nav}
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: ({ variant }: { variant?: string }) => (
    <nav data-variant={variant}>Admin navigation</nav>
  ),
}));

vi.mock("@/components/admin/QuoteViewerButton", () => ({
  QuoteViewerButton: () => <button type="button">View quote</button>,
}));

vi.mock("@/components/admin/lead-workspace/LeadStatusPanel", () => ({
  LeadStatusPanel: () => (
    <section>
      <h2>Stage</h2>
    </section>
  ),
}));
vi.mock("@/components/admin/lead-workspace/LeadHumanContextPanel", () => ({
  LeadHumanContextPanel: () => (
    <section>
      <h2>Human Context</h2>
    </section>
  ),
}));
vi.mock("@/components/admin/lead-workspace/LeadTasksPanel", () => ({
  LeadTasksPanel: () => (
    <section>
      <h2>Tasks</h2>
    </section>
  ),
}));
vi.mock("@/components/admin/lead-workspace/LeadNotesPanel", () => ({
  LeadNotesPanel: () => (
    <section>
      <h2>Notes</h2>
    </section>
  ),
}));
vi.mock("@/components/admin/lead-workspace/LeadTimelinePanel", () => ({
  LeadTimelinePanel: () => (
    <section>
      <h2>Timeline</h2>
    </section>
  ),
}));

function renderDossier(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/leads/:id" element={<AdminLeadDossierPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function expectDossierShell() {
  const shell = screen.getByTestId("admin-shell");
  expect(shell).toHaveAttribute("data-eyebrow", "Operator · Lead Workspace");
  expect(shell).toHaveAttribute("data-back-to", "/admin/leads");
  expect(shell).toHaveAttribute("data-back-label", "Back to Lead Inbox");
  expect(screen.getByTestId("shell-back")).toHaveAttribute("href", "/admin/leads");
  expect(screen.getByTestId("shell-back")).toHaveTextContent("Back to Lead Inbox");
}

describe("AdminLeadDossierPage", () => {
  beforeEach(() => {
    fetchLeadDetailMock.mockReset();
    fetchLeadDetailMock.mockResolvedValue(leadDetail);
  });

  it("uses the workspace eyebrow and Inbox breadcrumb for an invalid lead ID", async () => {
    renderDossier("/admin/leads/not-a-uuid");
    await screen.findByRole("heading", { level: 1, name: "Invalid lead ID" });
    expectDossierShell();
  });

  it("uses the workspace eyebrow and Inbox breadcrumb while loading", async () => {
    fetchLeadDetailMock.mockReturnValue(new Promise(() => undefined));
    renderDossier(`/admin/leads/${leadId}`);
    await screen.findByRole("heading", { level: 1, name: "Loading lead…" });
    expectDossierShell();
  });

  it("uses the workspace eyebrow and Inbox breadcrumb when the lead fails to load", async () => {
    fetchLeadDetailMock.mockRejectedValue(new Error("Lead not found."));
    renderDossier(`/admin/leads/${leadId}`);
    await screen.findByRole("heading", { level: 1, name: "Couldn't load lead" });
    expectDossierShell();
  });

  it("renders one ordered dossier with analysis-evidence scent and no toolbar escapes", async () => {
    renderDossier(`/admin/leads/${leadId}`);

    await screen.findByRole("heading", { level: 1, name: "Jane Doe" });
    expectDossierShell();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      "Contact & project",
      "Stage",
      "Truth Engine",
      "Human Context",
      "Tasks",
      "Notes",
      "Timeline",
    ]);
    for (const heading of headings) {
      expect(screen.getAllByRole("heading", { level: 2, name: heading! })).toHaveLength(1);
    }

    expect(screen.getByRole("link", { name: "View analysis evidence" })).toHaveAttribute(
      "href",
      `/admin/leads/${leadId}/report`,
    );
    expect(screen.getByRole("link", { name: "Open Evidence Inspector" })).toHaveAttribute(
      "href",
      `/admin/lead-evidence?lead_id=${leadId}`,
    );
    expect(screen.getByRole("link", { name: "Homeowner view" })).toHaveAttribute(
      "href",
      `/report/classic/${scanId}`,
    );
    expect(screen.queryByRole("link", { name: "Lead Inbox" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open in Pipeline" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open Truth Report" })).not.toBeInTheDocument();
    expect(screen.getByTestId("admin-lead-dossier-page")).toBeInTheDocument();
    expect(screen.getByTestId("admin-shell")).toHaveAttribute("data-variant", "lead-dossier");
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "lead-dossier");
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1));
  });

  it("still offers Evidence Inspector when no analysis exists", async () => {
    fetchLeadDetailMock.mockResolvedValue({
      ...leadDetail,
      latest_analysis_id: null,
      latest_scan_session_id: null,
    });
    renderDossier(`/admin/leads/${leadId}`);
    await screen.findByText("No analysis yet for this lead.");
    expect(screen.getByRole("link", { name: "Open Evidence Inspector" })).toHaveAttribute(
      "href",
      `/admin/lead-evidence?lead_id=${leadId}`,
    );
    expect(screen.queryByRole("link", { name: "View analysis evidence" })).not.toBeInTheDocument();
  });
});
