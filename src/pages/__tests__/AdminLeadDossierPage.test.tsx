import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminLeadDossierPage from "../AdminLeadDossierPage";

const leadId = "11111111-1111-4111-8111-111111111111";
const scanId = "22222222-2222-4222-8222-222222222222";

vi.mock("@/services/adminDataService", () => ({
  fetchLeadDetail: vi.fn(async () => ({
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
  })),
  fetchLeadAnalysis: vi.fn(async () => ({ confidence_score: 85, flags: [] })),
  getErrorMessage: (error: unknown) => String(error),
}));

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({
    title,
    variant,
    nav,
    children,
  }: {
    title: string;
    variant?: string;
    nav?: ReactNode;
    children?: ReactNode;
  }) => (
    <div data-testid="admin-shell" data-variant={variant}>
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
  LeadStatusPanel: () => <section><h2>Stage</h2></section>,
}));
vi.mock("@/components/admin/lead-workspace/LeadHumanContextPanel", () => ({
  LeadHumanContextPanel: () => <section><h2>Human Context</h2></section>,
}));
vi.mock("@/components/admin/lead-workspace/LeadTasksPanel", () => ({
  LeadTasksPanel: () => <section><h2>Tasks</h2></section>,
}));
vi.mock("@/components/admin/lead-workspace/LeadNotesPanel", () => ({
  LeadNotesPanel: () => <section><h2>Notes</h2></section>,
}));
vi.mock("@/components/admin/lead-workspace/LeadTimelinePanel", () => ({
  LeadTimelinePanel: () => <section><h2>Timeline</h2></section>,
}));

describe("AdminLeadDossierPage", () => {
  it("renders one ordered dossier with preserved report links", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/admin/leads/${leadId}`]}>
          <Routes>
            <Route path="/admin/leads/:id" element={<AdminLeadDossierPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await screen.findByRole("heading", { level: 1, name: "Jane Doe" });
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

    expect(screen.getByRole("link", { name: "Open Truth Report" }))
      .toHaveAttribute("href", `/admin/leads/${leadId}/report`);
    expect(screen.getByRole("link", { name: "Homeowner view" }))
      .toHaveAttribute("href", `/report/classic/${scanId}`);
    expect(screen.getByTestId("admin-shell")).toHaveAttribute("data-variant", "lead-dossier");
    expect(screen.getByRole("navigation")).toHaveAttribute("data-variant", "lead-dossier");
    await waitFor(() => expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1));
  });
});
