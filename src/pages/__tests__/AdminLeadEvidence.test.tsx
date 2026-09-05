import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { LeadEvidenceResponse } from "@/services/adminDataService";
import AdminLeadEvidence from "../AdminLeadEvidence";

const {
  invokeAdminDataMock,
  fetchLeadEvidenceMock,
} = vi.hoisted(() => ({
  invokeAdminDataMock: vi.fn(),
  fetchLeadEvidenceMock: vi.fn(),
}));

vi.mock("@/services/adminDataService", () => ({
  invokeAdminData: invokeAdminDataMock,
  fetchLeadEvidence: fetchLeadEvidenceMock,
  getErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
  isAdminDataError: () => false,
}));

vi.mock("@/components/admin/shell/AdminShell", () => ({
  AdminShell: ({
    children,
    belowHeader,
  }: {
    children?: ReactNode;
    belowHeader?: ReactNode;
  }) => (
    <div data-testid="admin-shell">
      {belowHeader}
      <main>{children}</main>
    </div>
  ),
}));

vi.mock("@/components/admin/shell/AdminGlobalNav", () => ({
  AdminGlobalNav: () => <nav aria-label="Admin navigation" />,
}));

const leadA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const leadB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const scanA = "11111111-1111-4111-8111-111111111111";
const analysisA = "22222222-2222-4222-8222-222222222222";

function listRow(
  id: string,
  first: string,
  last: string,
  extras: Partial<{ latest_scan_session_id: string; latest_analysis_id: string }> = {},
) {
  return {
    id,
    created_at: "2026-01-01T12:00:00Z",
    updated_at: "2026-01-01T12:00:00Z",
    first_name: first,
    last_name: last,
    email: `${first.toLowerCase()}@example.com`,
    phone_e164: null,
    city: null,
    county: null,
    state: null,
    zip: null,
    latest_scan_session_id: extras.latest_scan_session_id ?? null,
    latest_analysis_id: extras.latest_analysis_id ?? null,
    grade: "B",
    status: "new",
  };
}

function evidenceFor(
  id: string,
  first: string,
  last: string,
  scanId: string | null,
  analysisId: string | null,
): LeadEvidenceResponse {
  return {
    lead: {
      id,
      created_at: "2026-01-01T12:00:00Z",
      updated_at: "2026-01-01T12:00:00Z",
      first_name: first,
      last_name: last,
      email: `${first.toLowerCase()}@example.com`,
      phone_e164: null,
      city: null,
      county: null,
      state: null,
      zip: null,
      latest_scan_session_id: scanId,
      latest_analysis_id: analysisId,
      grade: "B",
      status: "new",
    },
    quote_files: [],
    scan_sessions: scanId
      ? [{
          id: scanId,
          lead_id: id,
          quote_file_id: null,
          status: "complete",
          created_at: "2026-01-01T12:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
        }]
      : [],
    analyses: analysisId
      ? [{
          id: analysisId,
          lead_id: id,
          scan_session_id: scanId,
          grade: "B",
          analysis_status: "complete",
          confidence_score: 80,
          rubric_version: "2",
          document_type: "quote_pdf",
          document_is_window_door_related: true,
          dollar_delta: 100,
          created_at: "2026-01-01T12:00:00Z",
          updated_at: "2026-01-01T12:00:00Z",
          flags_summary: { count: 0, severities: {} },
          preview_summary: { present: true, top_level_keys: ["summary"] },
          proof_summary: { present: false, top_level_keys: [] },
        }]
      : [],
  };
}

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <div data-testid="location-search">{location.search}</div>
      <button type="button" onClick={() => navigate(-1)}>
        History back
      </button>
    </>
  );
}

function renderEvidence(entry: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LocationProbe />
        <Routes>
          <Route path="/admin/lead-evidence" element={<AdminLeadEvidence />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function readSearch() {
  return new URLSearchParams(screen.getByTestId("location-search").textContent ?? "");
}

describe("AdminLeadEvidence", () => {
  beforeEach(() => {
    invokeAdminDataMock.mockReset();
    fetchLeadEvidenceMock.mockReset();
    invokeAdminDataMock.mockResolvedValue([
      listRow(leadA, "Alice", "Smith", {
        latest_scan_session_id: scanA,
        latest_analysis_id: analysisA,
      }),
      listRow(leadB, "Bob", "Jones"),
    ]);
    fetchLeadEvidenceMock.mockImplementation(async (id: string) => {
      if (id === leadA) return evidenceFor(leadA, "Alice", "Smith", scanA, analysisA);
      return evidenceFor(leadB, "Bob", "Jones", null, null);
    });
  });

  it("clears the selected lead when Back removes lead_id", async () => {
    renderEvidence("/admin/lead-evidence");
    fireEvent.click(await screen.findByRole("button", { name: /Alice Smith/ }));
    await screen.findByRole("link", { name: "View analysis evidence" });
    expect(readSearch().get("lead_id")).toBe(leadA);

    fireEvent.click(screen.getByRole("button", { name: "History back" }));
    await screen.findByRole("heading", { name: "No lead selected" });
    expect(readSearch().get("lead_id")).toBeNull();
  });

  it("does not treat a plain lead_id deep link as Command Center context", async () => {
    renderEvidence(`/admin/lead-evidence?lead_id=${leadA}`);
    await screen.findByRole("link", { name: "View analysis evidence" });
    expect(screen.queryByTestId("command-center-context")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search ID/)).toHaveValue("");
  });

  it("shows Command Center context and highlights when scan and analysis match", async () => {
    renderEvidence(
      `/admin/lead-evidence?lead_id=${leadA}&scan_session_id=${scanA}&analysis_id=${analysisA}`,
    );
    await screen.findByTestId("command-center-context");
    const highlighted = document.querySelectorAll('[data-highlighted="true"]');
    expect(highlighted.length).toBe(2);
    expect(
      screen.getByRole("link", { name: "View analysis evidence" }),
    ).toHaveAttribute("href", `/admin/leads/${leadA}/report`);
  });

  it("preserves unknown params when selecting another lead and drops stale context chrome", async () => {
    renderEvidence(
      `/admin/lead-evidence?lead_id=${leadA}&scan_session_id=${scanA}&analysis_id=${analysisA}&utm_source=google`,
    );
    await screen.findByTestId("command-center-context");

    fireEvent.click(screen.getByRole("button", { name: /Bob Jones/ }));
    await waitFor(() => expect(readSearch().get("lead_id")).toBe(leadB));
    const bobHeading = await screen.findByRole("heading", { name: "Bob Jones" });
    const params = readSearch();
    expect(params.get("scan_session_id")).toBe(scanA);
    expect(params.get("analysis_id")).toBe(analysisA);
    expect(params.get("utm_source")).toBe("google");
    expect(screen.queryByTestId("command-center-context")).not.toBeInTheDocument();
    expect(document.querySelectorAll('[data-highlighted="true"]')).toHaveLength(0);
    const bobPanel = bobHeading.closest("section");
    expect(bobPanel).not.toBeNull();
    expect(within(bobPanel!).queryByRole("link", { name: "View analysis evidence" })).not.toBeInTheDocument();
  });
});
