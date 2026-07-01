import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import ReportClassic from "../ReportClassic";

const VALID_SCAN_SESSION_ID = "a325c46c-a52d-4349-b260-e227c89d5de8";

const MOCK_ANALYSIS_DATA = {
  analysisId: "test-analysis-id",
  grade: "C",
  flags: [
    { label: "Missing DP rating", detail: "No design pressure listed", severity: "red" },
    { label: "Permit unclear", detail: "Permit handling not specified", severity: "amber" },
  ],
  flagCount: 2,
  flagRedCount: 1,
  flagAmberCount: 1,
  topWarning: "Missing DP rating",
  topMissingItem: "Permit handling",
  analysisStatus: "complete",
};

const MOCK_V2_REPORT_SOURCE = { v2_source_version: "test-fixture" };

const {
  mockUseAnalysisData,
  mockUseReportAccess,
  mockUseScanFunnelSafe,
  mockUsePhonePipeline,
  navigateSpy,
  trackGtmEventMock,
  saveReportDiagnosisHandoffMock,
} = vi.hoisted(() => ({
  mockUseAnalysisData: vi.fn(),
  mockUseReportAccess: vi.fn(),
  mockUseScanFunnelSafe: vi.fn(),
  mockUsePhonePipeline: vi.fn(),
  navigateSpy: vi.fn(),
  trackGtmEventMock: vi.fn(),
  saveReportDiagnosisHandoffMock: vi.fn(),
}));

vi.mock("@/hooks/useAnalysisData", () => ({
  useAnalysisData: mockUseAnalysisData,
}));

vi.mock("@/hooks/useReportAccess", () => ({
  useReportAccess: mockUseReportAccess,
}));

vi.mock("@/state/scanFunnel", () => ({
  useScanFunnelSafe: mockUseScanFunnelSafe,
}));

vi.mock("@/hooks/usePhonePipeline", () => ({
  usePhonePipeline: mockUsePhonePipeline,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateSpy,
  };
});

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: trackGtmEventMock,
}));

vi.mock("@/lib/reportDiagnosisHandoff", () => ({
  saveReportDiagnosisHandoff: saveReportDiagnosisHandoffMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

// Mock the leaf report renderer so we can assert exactly what ReportClassic
// passes into it, and exercise the diagnosis CTA callback in isolation.
vi.mock("@/components/forensic-report/ReportClassicDarkV2Full", () => ({
  default: ({
    onDiagnosisCta,
    scanSessionId,
  }: {
    onDiagnosisCta?: () => void;
    scanSessionId?: string;
  }) => (
    <div>
      <div data-testid="full-report">full</div>
      <div data-testid="scan-session-id">{scanSessionId ?? ""}</div>
      {onDiagnosisCta ? (
        <button type="button" onClick={onDiagnosisCta}>
          diagnosis-cta
        </button>
      ) : (
        <div data-testid="no-diagnosis-cta">missing</div>
      )}
    </div>
  ),
}));

vi.mock("@/components/forensic-report/ReportClassicDarkV2Partial", () => ({
  default: () => <div data-testid="partial-report">partial</div>,
}));

vi.mock("@/components/forensic-report/DarkV2ReportRecoveryPanel", () => ({
  default: ({ message }: { message?: string }) => (
    <div data-testid="recovery-panel">{message ?? "recovering"}</div>
  ),
}));

function baseAnalysisReturn(overrides: Record<string, unknown> = {}) {
  return {
    data: MOCK_ANALYSIS_DATA,
    v2ReportSource: MOCK_V2_REPORT_SOURCE,
    isLoading: false,
    error: null,
    fetchFull: vi.fn(),
    isLoadingFull: false,
    isFullLoaded: true,
    fullFetchError: null,
    tryResume: vi.fn(),
    isResuming: false,
    ...overrides,
  };
}

function basePipeline(overrides: Record<string, unknown> = {}) {
  return {
    phoneStatus: "idle",
    e164: null,
    displayValue: "",
    inputComplete: false,
    rawDigits: "",
    handlePhoneChange: vi.fn(),
    submitPhone: vi.fn(),
    submitOtp: vi.fn(),
    resend: vi.fn(),
    errorMsg: "",
    errorType: null,
    resendCooldown: 0,
    ...overrides,
  };
}

function renderReportClassic() {
  return render(
    <MemoryRouter initialEntries={[`/report/classic/${VALID_SCAN_SESSION_ID}`]}>
      <Routes>
        <Route path="/report/classic/:sessionId" element={<ReportClassic />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  mockUseAnalysisData.mockReturnValue(baseAnalysisReturn());
  mockUseReportAccess.mockReturnValue("full");
  mockUseScanFunnelSafe.mockReturnValue(null);
  mockUsePhonePipeline.mockReturnValue(basePipeline());
});

describe("ReportClassic full reveal diagnosis CTA", () => {
  it("passes onDiagnosisCta into the full report renderer on /report/classic reveal", () => {
    renderReportClassic();

    expect(screen.getByTestId("full-report")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "diagnosis-cta" })).toBeInTheDocument();
    expect(screen.queryByTestId("no-diagnosis-cta")).not.toBeInTheDocument();
  });

  it("forwards the route scanSessionId into the full report renderer", () => {
    renderReportClassic();
    expect(screen.getByTestId("scan-session-id")).toHaveTextContent(VALID_SCAN_SESSION_ID);
  });

  it("clicking the CTA saves the handoff and navigates to /diagnosis with a route returnTo", () => {
    renderReportClassic();

    fireEvent.click(screen.getByRole("button", { name: "diagnosis-cta" }));

    expect(saveReportDiagnosisHandoffMock).toHaveBeenCalledTimes(1);
    const savedHandoff = saveReportDiagnosisHandoffMock.mock.calls[0][0];
    expect(savedHandoff.scan_session_id).toBe(VALID_SCAN_SESSION_ID);
    expect(savedHandoff.returnTo).toBe(`/report/classic/${VALID_SCAN_SESSION_ID}`);

    expect(navigateSpy).toHaveBeenCalledWith(
      "/diagnosis",
      expect.objectContaining({
        state: expect.objectContaining({
          scan_session_id: VALID_SCAN_SESSION_ID,
          returnTo: `/report/classic/${VALID_SCAN_SESSION_ID}`,
        }),
      }),
    );
  });

  it("fires the local diagnosis tracking event on CTA click", () => {
    renderReportClassic();

    fireEvent.click(screen.getByRole("button", { name: "diagnosis-cta" }));

    expect(trackGtmEventMock).toHaveBeenCalledWith(
      "wm_report_to_diagnosis_click",
      expect.objectContaining({ cta_source: "report_reveal_bridge" }),
    );
  });
});
