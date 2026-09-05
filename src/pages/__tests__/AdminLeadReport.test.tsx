import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import AdminLeadReport from "../AdminLeadReport";
import { fetchLeadAnalysis, fetchLeadDetail } from "@/services/adminDataService";

const leadId = "11111111-1111-4111-8111-111111111111";
const analysisId = "analysis-1";
const scanId = "22222222-2222-4222-8222-222222222222";

const useAnalysisData = vi.fn();
const reportServiceFetch = vi.fn();

vi.mock("@/hooks/useAnalysisData", () => ({
  useAnalysisData,
}));

vi.mock("@/services/reportService", () => ({
  fetchReport: reportServiceFetch,
  getFullReport: reportServiceFetch,
}));

vi.mock("@/services/adminDataService", () => ({
  fetchLeadDetail: vi.fn(),
  fetchLeadAnalysis: vi.fn(),
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}));

const fetchLeadDetailMock = vi.mocked(fetchLeadDetail);
const fetchLeadAnalysisMock = vi.mocked(fetchLeadAnalysis);

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({
    title,
    eyebrow,
    backTo,
    backLabel,
    children,
  }: {
    title: string;
    eyebrow?: string;
    backTo?: string;
    backLabel?: string;
    children?: ReactNode;
  }) => (
    <div
      data-testid="admin-shell"
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
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: () => <nav>Admin navigation</nav>,
}));

const leadDetail = {
  id: leadId,
  first_name: "Jane",
  last_name: "Doe",
  latest_analysis_id: analysisId,
  latest_scan_session_id: scanId,
};

const analysisPayload = {
  grade: "B",
  dollar_delta: 500,
  confidence_score: 0.91,
  flags: [{ flag: "High markup", severity: "High" }],
  evidence_projection: {
    analysis_id: analysisId,
    scan_session_id: scanId,
    status: "complete",
    grade: "B",
    confidence_score: 0.91,
    dollar_delta: 500,
    missing_detail_count: 1,
    pillar_scores: [{ key: "price", score: 62 }],
    pillar_detail_available: true,
    document_type: "quote_pdf",
    rubric_version: "2",
    proof_of_read: { document_read: true },
    operator_summary: {
      contractor_name: "Acme Windows",
      total_quoted_price: 12000,
      opening_count: 8,
      document_type: "quote_pdf",
    },
  },
};

function renderReport(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/admin/leads/:id/report" element={<AdminLeadReport />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function expectReportShell(backTo: string, backLabel: string) {
  const shell = screen.getByTestId("admin-shell");
  expect(shell).toHaveAttribute("data-eyebrow", "Operator · Analysis evidence");
  expect(shell).toHaveAttribute("data-back-to", backTo);
  expect(shell).toHaveAttribute("data-back-label", backLabel);
  expect(screen.getByTestId("shell-back")).toHaveAttribute("href", backTo);
  expect(screen.getByTestId("shell-back")).toHaveTextContent(backLabel);
}

describe("AdminLeadReport", () => {
  beforeEach(() => {
    fetchLeadDetailMock.mockReset();
    fetchLeadAnalysisMock.mockReset();
    useAnalysisData.mockReset();
    reportServiceFetch.mockReset();
    fetchLeadDetailMock.mockResolvedValue(leadDetail);
    fetchLeadAnalysisMock.mockResolvedValue(analysisPayload);
  });

  it("uses Inbox breadcrumb for an invalid lead ID", async () => {
    renderReport("/admin/leads/not-a-uuid/report");
    await screen.findByRole("heading", { level: 1, name: "Invalid lead ID" });
    expectReportShell("/admin/leads", "Back to Lead Inbox");
  });

  it("uses workspace breadcrumb while loading", async () => {
    fetchLeadDetailMock.mockReturnValue(new Promise(() => undefined));
    renderReport(`/admin/leads/${leadId}/report`);
    await screen.findByRole("heading", { level: 1, name: "Loading analysis evidence…" });
    expectReportShell(`/admin/leads/${leadId}`, "Back to lead workspace");
  });

  it("uses workspace breadcrumb when the lead fails to load", async () => {
    fetchLeadDetailMock.mockRejectedValue(new Error("Lead not found."));
    renderReport(`/admin/leads/${leadId}/report`);
    await screen.findByRole("heading", { level: 1, name: "Couldn't load report" });
    expectReportShell(`/admin/leads/${leadId}`, "Back to lead workspace");
  });

  it("uses workspace breadcrumb when no analysis exists", async () => {
    fetchLeadDetailMock.mockResolvedValue({
      ...leadDetail,
      latest_analysis_id: null,
    });
    renderReport(`/admin/leads/${leadId}/report`);
    await screen.findByText("No analysis on file yet");
    expectReportShell(`/admin/leads/${leadId}`, "Back to lead workspace");
    expect(fetchLeadAnalysisMock).not.toHaveBeenCalled();
  });

  it("uses workspace breadcrumb when analysis fails to load", async () => {
    fetchLeadAnalysisMock.mockRejectedValue(new Error("Unable to load analysis."));
    renderReport(`/admin/leads/${leadId}/report`);
    await screen.findByText("Analysis failed to load");
    expectReportShell(`/admin/leads/${leadId}`, "Back to lead workspace");
  });

  it("renders the bounded evidence projection through fetchLeadAnalysis only", async () => {
    renderReport(`/admin/leads/${leadId}/report`);
    await screen.findByRole("heading", {
      level: 1,
      name: "Analysis evidence · Jane Doe",
    });
    expectReportShell(`/admin/leads/${leadId}`, "Back to lead workspace");
    expect(fetchLeadAnalysisMock).toHaveBeenCalledWith(analysisId);
    expect(screen.getByText(/Admin safe projection/)).toBeInTheDocument();
    expect(
      screen.getByText(/This page does not render the homeowner Truth Report skin/),
    ).toBeInTheDocument();
    expect(screen.getByText("High markup")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Homeowner route/ })).toHaveAttribute(
      "href",
      `/report/classic/${scanId}`,
    );
    expect(useAnalysisData).not.toHaveBeenCalled();
    expect(reportServiceFetch).not.toHaveBeenCalled();
  });
});
