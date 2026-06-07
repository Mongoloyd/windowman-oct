import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { FunctionsResponse } from "@supabase/supabase-js";
import { PostScanReportSwitcher } from "./PostScanReportSwitcher";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const VALID_SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_VALID_SCAN_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const FUNNEL_MISMATCH_SCAN_SESSION_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LOST_SCAN_SESSION_MESSAGE = "We lost the scan session. Please restart the scan.";

const {
  mockUseReportAccess,
  mockUseScanFunnelSafe,
  mockUsePhonePipeline,
  navigateSpy,
  trackEventMock,
  trackGtmEventMock,
} = vi.hoisted(() => ({
  mockUseReportAccess: vi.fn(),
  mockUseScanFunnelSafe: vi.fn(),
  mockUsePhonePipeline: vi.fn(),
  navigateSpy: vi.fn(),
  trackEventMock: vi.fn(),
  trackGtmEventMock: vi.fn(),
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

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("@/lib/trackConversion", () => ({
  trackGtmEvent: trackGtmEventMock,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    // Runtime now uses direct await supabase.rpc(...), so tests return
    // plain Promise<{ data, error }> instead of chained rpc(...).maybeSingle().
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

// Render the gate as a real form so onOtpSubmit can be exercised in tests
// for the post-OTP transition.
vi.mock("../TruthReportClassic", () => ({
  default: ({
    gateProps,
    accessLevel,
    onContractorMatchClick,
    onReportHelpCall,
  }: {
    gateProps?: any;
    accessLevel: string;
    onContractorMatchClick?: () => void;
    onReportHelpCall?: () => void;
  }) => (
    <div>
      <div data-testid="access-level">{accessLevel}</div>
      <div data-testid="gate-mode">{gateProps?.gateMode ?? "none"}</div>
      <div data-testid="is-loading">{String(!!gateProps?.isLoading)}</div>
      <div data-testid="error-msg">{gateProps?.errorMsg ?? ""}</div>
      <div data-testid="fetch-stalled">{String(!!gateProps?.fetchStalled)}</div>
      <input
        data-testid="otp-input"
        value={gateProps?.otpValue ?? ""}
        onChange={(e) => gateProps?.onOtpChange?.(e.target.value)}
      />
      <button onClick={gateProps?.onResend}>resend</button>
      <button onClick={gateProps?.onPhoneSubmit}>phone-submit</button>
      <button onClick={gateProps?.onChangePhone}>change-phone</button>
      <button onClick={gateProps?.onOtpSubmit}>otp-submit</button>
      <button onClick={gateProps?.onRetryFetchFull}>retry-fetch-full</button>
      <div data-testid="masked-phone">{gateProps?.maskedPhone ?? ""}</div>
      {onContractorMatchClick ? (
        <button type="button" onClick={onContractorMatchClick}>
          diagnosis-cta
        </button>
      ) : null}
      {onReportHelpCall ? (
        <button type="button" onClick={onReportHelpCall}>
          report-help-call
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
});

// Helper: every render must be wrapped in a Router because the component
// uses useNavigate() for the diagnosis handoff CTA. Without this, tests
// crash before any assertion can run.
function renderSwitcher(extraProps: Record<string, unknown> = {}) {
  return render(
    <MemoryRouter>
      <PostScanReportSwitcher {...baseProps()} {...extraProps} />
    </MemoryRouter>
  );
}

function baseProps() {
  return {
    grade: "C",
    flags: [],
    pillarScores: [],
    contractorName: null,
    county: "Miami-Dade",
    confidenceScore: 0.8,
    documentType: "quote",
    onSecondScan: vi.fn(),
    scanSessionId: null,
    onVerified: vi.fn(),
    isFullLoaded: false,
  };
}

describe("PostScanReportSwitcher shared OTP status wiring", () => {
  let funnelState: any;
  let resendMock: ReturnType<typeof vi.fn>;
  let submitPhoneMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: null,
      phoneStatus: "none",
      scanSessionId: VALID_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-1",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    resendMock = vi.fn().mockResolvedValue({ status: "otp_sent", e164: "+13055551234" });
    submitPhoneMock = vi.fn().mockResolvedValue({ status: "otp_sent", e164: "+13055551234" });
    mockUsePhonePipeline.mockReturnValue({
      displayValue: "",
      rawDigits: "",
      e164: null,
      inputComplete: false,
      phoneStatus: "idle",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: submitPhoneMock,
      submitOtp: vi.fn(),
      resend: resendMock,
      reset: vi.fn(),
    });
  });

  it("shows code entry mode when shared status is otp_sent", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_sent";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
  });

  it("shows send_code mode and loading while shared status is sending_otp", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "sending_otp";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("send_code");
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
  });

  it("shows fallback copy when shared status is send_failed", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "send_failed";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    expect(screen.getByTestId("error-msg")).toHaveTextContent("Send or confirm your number to receive a code.");
  });

  it("auto-sends OTP when phone is pre-hydrated and status is screened_valid", async () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "screened_valid";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    // The auto-send effect must fire because phone is pre-hydrated and the
    // gate landed in send_code — this is the unlock path for returning leads.
    // After the send completes, localGateOverride flips to enter_code so the
    // user can immediately type the SMS code without an extra click.
    await waitFor(() => expect(submitPhoneMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code")
    );
  });

  it("send-code path captures server e164 (not stale gated phone) and stays preview-locked", async () => {
    const staleGatePhone = "+13055550000";
    const serverValidatedPhone = "+13055551234";
    const onVerifiedMock = vi.fn();
    funnelState.phoneE164 = staleGatePhone;
    funnelState.phoneStatus = "screened_valid";
    submitPhoneMock.mockResolvedValueOnce({
      status: "otp_sent",
      e164: serverValidatedPhone,
    });

    renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: onVerifiedMock,
      isFullLoaded: false,
    });

    await waitFor(() => expect(submitPhoneMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(funnelState.setPhone).toHaveBeenCalledWith(serverValidatedPhone, "otp_sent"),
    );
    expect(funnelState.setPhone).not.toHaveBeenCalledWith(staleGatePhone, "otp_sent");
    await waitFor(() =>
      expect(screen.getByTestId("masked-phone")).toHaveTextContent("1234"),
    );
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
    expect(screen.getByTestId("access-level")).toHaveTextContent("preview");
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("shows enter_phone mode when no phone exists", () => {
    renderSwitcher();
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_phone");
  });

  it("manual resend still calls pipeline.resend", async () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_sent";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    fireEvent.click(screen.getAllByText("resend")[0]);
    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
  });

  it("blocked resend does not downgrade shared status to send_failed", async () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_sent";
    resendMock.mockResolvedValueOnce({ status: "blocked", error: "Please wait before requesting another code." });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });

    fireEvent.click(screen.getAllByText("resend")[0]);
    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(funnelState.setPhoneStatus).toHaveBeenCalledWith("sending_otp");
    expect(funnelState.setPhoneStatus).toHaveBeenCalledWith("otp_sent");
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("send_failed");
  });

  it("does not auto-send when preemptive OTP already set status to otp_sent", async () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_sent";
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await Promise.resolve();
    expect(submitPhoneMock).not.toHaveBeenCalled();
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
  });

  it("auto-send fires exactly once for a pre-hydrated phone (no double-fire on re-render)", async () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "screened_valid";
    const { rerender } = renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await waitFor(() => expect(submitPhoneMock).toHaveBeenCalledTimes(1));
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher {...baseProps()} scanSessionId={VALID_SCAN_SESSION_ID} />
      </MemoryRouter>
    );
    // The autoSendFiredRef guard must prevent a second send.
    await Promise.resolve();
    expect(submitPhoneMock).toHaveBeenCalledTimes(1);
  });
});

describe("PostScanReportSwitcher — OTP handoff hydration (lead read unknown)", () => {
  let funnelState: any;

  type MockLeadSource =
    | { mode: "unknown"; withError?: boolean }
    | { mode: "loaded"; phoneE164: string | null };

  function mockLeadHydration(source: MockLeadSource) {
    // Hydration uses direct await rpc("get_lead_context_for_session", ...).
    vi.mocked(supabase.rpc).mockImplementation((fnName: string) => {
      if (fnName === "get_lead_context_for_session") {
        return Promise.resolve(
          source.mode === "unknown"
            ? { data: null, error: source.withError ? { message: "RLS blocked" } : null }
            : {
                data: {
                  lead_id: "lead-1",
                  first_name: null,
                  county: null,
                  phone_e164: source.phoneE164,
                },
                error: null,
              },
        ) as any;
      }
      // Other RPCs (get_comparable_sessions, etc.) keep default behavior.
      return Promise.resolve({ data: [], error: null }) as any;
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");
    funnelState = {
      phoneE164: "+13055551234",
      phoneStatus: "otp_sent",
      scanSessionId: VALID_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-1",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);
    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      inputComplete: true,
      phoneStatus: "idle",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: vi.fn(),
      submitOtp: vi.fn(),
      resend: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("preserves otp_sent and shows enter_code when lead hydration is unknown (null row)", async () => {
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await waitFor(() => {
      expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
    });
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("", "none");
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("", expect.anything());
  });

  it("preserves funnel phone when lead hydration is unknown and status is none", async () => {
    funnelState.phoneStatus = "none";
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await waitFor(() => expect(funnelState.setPhone).not.toHaveBeenCalled());
  });

  it("preserves funnel phone when lead read returns an error (unknown)", async () => {
    funnelState.phoneStatus = "none";
    mockLeadHydration({ mode: "unknown", withError: true });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await waitFor(() => expect(funnelState.setPhone).not.toHaveBeenCalled());
  });

  it("does not clear otp_sent when trusted loaded lead has no phone", async () => {
    mockLeadHydration({ mode: "loaded", phoneE164: null });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    await waitFor(() => {
      expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
    });
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("", "none");
  });

  it("does not call onVerified when only otp_sent (no verify)", async () => {
    const onVerifiedMock = vi.fn();
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID, onVerified: onVerifiedMock });
    await waitFor(() => {
      expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
    });
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("shows enter_phone when status is screened_valid but active session is missing", () => {
    funnelState.phoneStatus = "screened_valid";
    mockLeadHydration({ mode: "unknown" });
    // With strict session gating, missing active session must fail closed.
    renderSwitcher({ scanSessionId: null });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_phone");
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("enter_code");
  });

  it("shows send_code when status is send_failed (not OTP grid as if sent)", () => {
    funnelState.phoneStatus = "send_failed";
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("send_code");
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("enter_code");
  });

  it("change-phone resets to enter_phone and clears funnel phone", () => {
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    fireEvent.click(screen.getByText("change-phone"));
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_phone");
    expect(funnelState.setPhone).toHaveBeenCalledWith("", "none");
  });

  it("ignores funnel phone when scanSessionId mismatches active session", () => {
    funnelState.scanSessionId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    mockLeadHydration({ mode: "unknown" });
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_phone");
  });
});

describe("PostScanReportSwitcher — Identity Ladder full access (Level 2)", () => {
  let funnelState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("full");

    funnelState = {
      phoneE164: "+13055551234",
      phoneStatus: "verified",
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-verified",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      inputComplete: true,
      phoneStatus: "verified",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: vi.fn(),
      submitOtp: vi.fn(),
      resend: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("passes gateProps=undefined to TruthReportClassic when access is full", () => {
    renderSwitcher({ isFullLoaded: true });
    // When accessLevel is "full", gateProps is not passed — gate-mode reads "none"
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("none");
    expect(screen.getByTestId("access-level")).toHaveTextContent("full");
  });

  it("does not render a phone input gate when user is fully verified", () => {
    renderSwitcher({ isFullLoaded: true });
    expect(screen.queryByTestId("gate-mode")).not.toHaveTextContent("enter_phone");
    expect(screen.queryByTestId("gate-mode")).not.toHaveTextContent("send_code");
    expect(screen.queryByTestId("gate-mode")).not.toHaveTextContent("enter_code");
  });
});

describe("PostScanReportSwitcher — Identity Ladder partial access (Level 0/1)", () => {
  let funnelState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: null,
      phoneStatus: "none",
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-anon",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    mockUsePhonePipeline.mockReturnValue({
      displayValue: "",
      rawDigits: "",
      e164: null,
      inputComplete: false,
      phoneStatus: "idle",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: vi.fn(),
      submitOtp: vi.fn(),
      resend: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("shows enter_phone gate for anonymous user (no phone, no verification)", () => {
    renderSwitcher({ isFullLoaded: false });
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_phone");
  });

  it("never shows gateMode=none when user is unverified (bypass prevention)", () => {
    renderSwitcher({ isFullLoaded: false });
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("none");
  });

  it("keeps the gate locked when phoneStatus is otp_failed", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_failed";
    renderSwitcher({ isFullLoaded: false });
    // otp_failed should not unlock access; the user must remain gated.
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("none");
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("send_code");
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("enter_code");
  });

  it("blocks full report access even if phone is present but isFullLoaded is false", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "otp_sent";
    renderSwitcher({ isFullLoaded: false });
    // User is in OTP flow but full data has not been fetched from backend
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
    expect(screen.getByTestId("gate-mode")).not.toHaveTextContent("none");
    expect(screen.getByTestId("access-level")).toHaveTextContent("preview");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// New tests: post-OTP transition (preview → full) and stall recovery.
// These tests guard the seal between successful OTP and full report reveal,
// which is the explicit objective of this sprint.
// ─────────────────────────────────────────────────────────────────────────
describe("PostScanReportSwitcher — post-OTP unlock transition", () => {
  let funnelState: any;
  let submitOtpMock: any;
  let submitPhoneMock: any;
  let resendMock: any;
  let onVerifiedMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: "+13055551234",
      phoneStatus: "otp_sent",
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-unlock",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    submitOtpMock = vi.fn().mockResolvedValue({
      status: "verified",
      e164: "+13055551234",
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });
    submitPhoneMock = vi.fn().mockResolvedValue({ status: "otp_sent", e164: "+13055551234" });
    resendMock = vi.fn().mockResolvedValue({ status: "otp_sent", e164: "+13055551234" });
    onVerifiedMock = vi.fn();

    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      inputComplete: true,
      phoneStatus: "otp_sent",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: submitPhoneMock,
      submitOtp: submitOtpMock,
      resend: resendMock,
      reset: vi.fn(),
    });
  });

  it("missing scanSessionId blocks OTP verify before pipeline or funnel mutation", async () => {
    renderSwitcher({ scanSessionId: null, onVerified: onVerifiedMock });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOST_SCAN_SESSION_MESSAGE));
    expect(submitOtpMock).not.toHaveBeenCalled();
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("+13055551234", "verified");
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("verified");
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("invalid scanSessionId blocks OTP verify before pipeline or funnel mutation", async () => {
    renderSwitcher({ scanSessionId: "not-a-valid-uuid", onVerified: onVerifiedMock });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOST_SCAN_SESSION_MESSAGE));
    expect(submitOtpMock).not.toHaveBeenCalled();
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("+13055551234", "verified");
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("verified");
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("blocks OTP verify when scanSessionId becomes null between code entry and submit", async () => {
    const { rerender } = render(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={null}
          onVerified={onVerifiedMock}
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("otp-submit"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOST_SCAN_SESSION_MESSAGE));
    expect(submitOtpMock).not.toHaveBeenCalled();
    expect(funnelState.setPhone).not.toHaveBeenCalledWith("+13055551234", "verified");
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("verified");
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("missing scanSessionId blocks phone submit before pipeline or sending_otp mutation", async () => {
    funnelState.phoneE164 = null;
    funnelState.phoneStatus = "none";
    renderSwitcher({ scanSessionId: null });

    fireEvent.click(screen.getByText("phone-submit"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOST_SCAN_SESSION_MESSAGE));
    expect(submitPhoneMock).not.toHaveBeenCalled();
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("sending_otp");
  });

  it("missing scanSessionId blocks resend before pipeline or sending_otp mutation", async () => {
    renderSwitcher({ scanSessionId: null });

    fireEvent.click(screen.getByText("resend"));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(LOST_SCAN_SESSION_MESSAGE));
    expect(resendMock).not.toHaveBeenCalled();
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("sending_otp");
  });

  it("valid scanSessionId permits OTP verify and hands off unlock with server-canonical phone", async () => {
    render(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));

    await waitFor(() => expect(submitOtpMock).toHaveBeenCalledTimes(1));
    expect(submitOtpMock).toHaveBeenCalledWith("123456");
    expect(funnelState.setPhone).toHaveBeenCalledWith("+13055551234", "verified");
    expect(onVerifiedMock).toHaveBeenCalledWith("+13055551234");
  });

  it("transitions from preview to full when isFullLoaded flips to true after onVerified", () => {
    const { rerender } = render(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId="11111111-1111-4111-8111-111111111111"
          isFullLoaded={false}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("access-level")).toHaveTextContent("preview");

    // Parent (Index.tsx / ReportClassic.tsx) is responsible for flipping
    // isFullLoaded after fetchFull resolves. The switcher must immediately
    // promote accessLevel to "full" without any forced preview override.
    mockUseReportAccess.mockReturnValue("full");
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId="11111111-1111-4111-8111-111111111111"
          isFullLoaded={true}
        />
      </MemoryRouter>
    );
    expect(screen.getByTestId("access-level")).toHaveTextContent("full");
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("none");
  });

  it("surfaces fetchStalled=true when fullFetchError is present", () => {
    renderSwitcher({
      scanSessionId: "11111111-1111-4111-8111-111111111111",
      isFullLoaded: false,
      fullFetchError: "Failed to unlock report.",
    });
    expect(screen.getByTestId("fetch-stalled")).toHaveTextContent("true");
  });
});

describe("PostScanReportSwitcher — gated phone in OTP/full-fetch callbacks", () => {
  let funnelState: any;
  let resendMock: ReturnType<typeof vi.fn>;
  let submitOtpMock: ReturnType<typeof vi.fn>;
  let onVerifiedMock: ReturnType<typeof vi.fn<(phone: string) => void>>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: "+13055551234",
      phoneStatus: "otp_sent",
      scanSessionId: VALID_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-gated",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    resendMock = vi.fn().mockResolvedValue({ status: "otp_sent", e164: "+13055551234" });
    submitOtpMock = vi.fn().mockResolvedValue({
      status: "verified",
      e164: "+13055551234",
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });
    onVerifiedMock = vi.fn();

    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      inputComplete: true,
      phoneStatus: "otp_sent",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: vi.fn(),
      submitOtp: submitOtpMock,
      resend: resendMock,
      reset: vi.fn(),
    });
  });

  it("blocks resend when funnel scanSessionId mismatches active scan session", async () => {
    funnelState.scanSessionId = FUNNEL_MISMATCH_SCAN_SESSION_ID;
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    fireEvent.click(screen.getByText("resend"));
    await Promise.resolve();
    expect(resendMock).not.toHaveBeenCalled();
    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("sending_otp");
  });

  it("allows resend when funnel scanSessionId matches active scan session", async () => {
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });
    fireEvent.click(screen.getByText("resend"));
    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(1));
    expect(funnelState.setPhoneStatus).toHaveBeenCalledWith("sending_otp");
  });

  it("blocks retry full fetch on session mismatch even after verify captured phone for another session", async () => {
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    funnelState.phoneStatus = "otp_sent";
    const { rerender } = render(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
          fullFetchError="Failed to unlock report."
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));
    await waitFor(() => expect(onVerifiedMock).toHaveBeenCalledWith("+13055551234"));

    onVerifiedMock.mockClear();
    funnelState.scanSessionId = FUNNEL_MISMATCH_SCAN_SESSION_ID;
    funnelState.phoneStatus = "verified";
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
          fullFetchError="Failed to unlock report."
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText("retry-fetch-full"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Unable to retry. Please resend your verification code."),
    );
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("allows retry full fetch with session-matched captured phone after verify stall", async () => {
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    funnelState.phoneStatus = "verified";
    renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: onVerifiedMock,
      fullFetchError: "Failed to unlock report.",
    });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));
    await waitFor(() => expect(onVerifiedMock).toHaveBeenCalledWith("+13055551234"));

    onVerifiedMock.mockClear();
    fireEvent.click(screen.getByText("retry-fetch-full"));
    await waitFor(() => expect(onVerifiedMock).toHaveBeenCalledWith("+13055551234"));
  });

  it("does not call onVerified from retry when only otp_sent (no verify)", async () => {
    funnelState.phoneStatus = "otp_sent";
    renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: onVerifiedMock,
      fullFetchError: "Failed to unlock report.",
    });
    fireEvent.click(screen.getByText("retry-fetch-full"));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Unable to retry. Please resend your verification code."),
    );
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("invalidates session-captured phone when scanSessionId changes", async () => {
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    const { rerender } = renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));
    await waitFor(() => expect(screen.getByTestId("masked-phone")).toHaveTextContent("1234"));

    funnelState.scanSessionId = FUNNEL_MISMATCH_SCAN_SESSION_ID;
    funnelState.phoneStatus = "otp_sent";
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
        />
      </MemoryRouter>
    );

    expect(screen.getByTestId("masked-phone")).toHaveTextContent("");
  });
});

const STALE_PIPELINE_E164 = "+19998887777";
const SESSION_SAFE_E164 = "+13055551234";

function mockPipeline(overrides: Record<string, unknown> = {}) {
  mockUsePhonePipeline.mockReturnValue({
    displayValue: "(305) 555-1234",
    rawDigits: "3055551234",
    e164: STALE_PIPELINE_E164,
    inputComplete: true,
    phoneStatus: "verified",
    errorMsg: "",
    errorType: null,
    resendCooldown: 0,
    handlePhoneChange: vi.fn(),
    submitPhone: vi.fn(),
    submitOtp: vi.fn(),
    resend: vi.fn(),
    reset: vi.fn(),
    ...overrides,
  });
}

function renderFullUnlocked(extraProps: Record<string, unknown> = {}) {
  mockUseReportAccess.mockReturnValue("full");
  return renderSwitcher({
    scanSessionId: VALID_SCAN_SESSION_ID,
    isFullLoaded: true,
    ...extraProps,
  });
}

describe("PostScanReportSwitcher — post-full helper phone (session-safe)", () => {
  let funnelState: Record<string, unknown>;
  let invokeMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    navigateSpy.mockClear();
    invokeMock = vi.mocked(supabase.functions.invoke);
    invokeMock.mockResolvedValue({ data: { success: true }, error: null });
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_comparable_sessions") {
        return Promise.resolve({
          data: [
            { scan_session_id: VALID_SCAN_SESSION_ID },
            { scan_session_id: OTHER_VALID_SCAN_SESSION_ID },
          ],
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>;
      }
      return Promise.resolve({ data: [], error: null }) as unknown as ReturnType<typeof supabase.rpc>;
    });

    funnelState = {
      phoneE164: null,
      phoneStatus: "verified",
      scanSessionId: FUNNEL_MISMATCH_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-post-full",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);
    mockPipeline();
  });

  it("does not pass stale pipeline.e164 to compare, diagnosis, or voice when session phone is gated off", async () => {
    renderFullUnlocked();

    await waitFor(() =>
      expect(screen.getByText("Compare My 2 Quotes Side-by-Side →")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Compare My 2 Quotes Side-by-Side →"));
    fireEvent.click(screen.getByText("diagnosis-cta"));
    fireEvent.click(screen.getByText("report-help-call"));

    await Promise.resolve();

    const compareInvoke = invokeMock.mock.calls.find(([name]) => name === "compare-quotes");
    expect(compareInvoke).toBeUndefined();

    expect(navigateSpy).toHaveBeenCalledWith(
      "/diagnosis",
      expect.objectContaining({
        state: expect.objectContaining({ phone: null }),
      }),
    );
    const callbackInvoke = invokeMock.mock.calls.find(([name]) => name === "request-callback");
    expect(callbackInvoke).toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith(
      "Unable to process request. Please verify your phone number first.",
    );
  });

  it("passes session-safe phone to diagnosis and request-callback when funnel session matches", async () => {
    funnelState.phoneE164 = SESSION_SAFE_E164;
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    renderFullUnlocked();

    fireEvent.click(screen.getByText("diagnosis-cta"));
    fireEvent.click(screen.getByText("report-help-call"));

    await waitFor(() => expect(navigateSpy).toHaveBeenCalled());
    expect(navigateSpy).toHaveBeenCalledWith(
      "/diagnosis",
      expect.objectContaining({
        state: expect.objectContaining({ phone: SESSION_SAFE_E164 }),
      }),
    );

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "request-callback",
        expect.objectContaining({
          body: expect.objectContaining({
            scan_session_id: VALID_SCAN_SESSION_ID,
            call_intent: "report_explainer",
            cta_source: "report_help",
          }),
        }),
      ),
    );
    const compareBody = invokeMock.mock.calls.find(([name]) => name === "compare-quotes")?.[1];
    expect(compareBody?.body?.phone_e164).not.toBe(STALE_PIPELINE_E164);
  });

  it("uses session-captured phone for compare when funnel phone is mismatched", async () => {
    const submitOtpMock = vi.fn().mockResolvedValue({
      status: "verified",
      e164: SESSION_SAFE_E164,
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });
    mockPipeline({ submitOtp: submitOtpMock, e164: STALE_PIPELINE_E164, phoneStatus: "otp_sent" });
    funnelState.phoneE164 = SESSION_SAFE_E164;
    funnelState.phoneStatus = "otp_sent";
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;

    mockUseReportAccess.mockReturnValue("preview");
    const { rerender } = renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: vi.fn(),
    });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));
    await waitFor(() => expect(submitOtpMock).toHaveBeenCalled());

    funnelState.scanSessionId = FUNNEL_MISMATCH_SCAN_SESSION_ID;
    funnelState.phoneE164 = null;
    mockUseReportAccess.mockReturnValue("full");
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={VALID_SCAN_SESSION_ID}
          isFullLoaded={true}
        />
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Compare My 2 Quotes Side-by-Side →")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Compare My 2 Quotes Side-by-Side →"));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith(
        "compare-quotes",
        expect.objectContaining({
          body: expect.objectContaining({ phone_e164: SESSION_SAFE_E164 }),
        }),
      ),
    );
    expect(
      invokeMock.mock.calls.find(
        ([name, args]) =>
          name === "compare-quotes" && args?.body?.phone_e164 === STALE_PIPELINE_E164,
      ),
    ).toBeUndefined();
  });
});

describe("PostScanReportSwitcher — async session guard", () => {
  let funnelState: Record<string, unknown>;
  let submitOtpMock: ReturnType<typeof vi.fn>;
  let onVerifiedMock: ReturnType<typeof vi.fn<(phone: string) => void>>;
  let resolveOtp: (value: {
    status: string;
    e164: string;
    phoneVerifiedEventId: string;
    reportRevealedEventId: string;
  }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: SESSION_SAFE_E164,
      phoneStatus: "otp_sent",
      scanSessionId: VALID_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-async",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    submitOtpMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveOtp = resolve;
        }),
    );
    onVerifiedMock = vi.fn();
    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: SESSION_SAFE_E164,
      inputComplete: true,
      phoneStatus: "otp_sent",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: vi.fn(),
      submitOtp: submitOtpMock,
      resend: vi.fn(),
      reset: vi.fn(),
    });
  });

  it("does not call onVerified when OTP verify resolves after scanSessionId changes", async () => {
    const { rerender } = renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: onVerifiedMock,
    });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));
    expect(submitOtpMock).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
        />
      </MemoryRouter>,
    );

    resolveOtp!({
      status: "verified",
      e164: SESSION_SAFE_E164,
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(onVerifiedMock).not.toHaveBeenCalled();
    expect(funnelState.setPhone).not.toHaveBeenCalled();
    expect(trackGtmEventMock).not.toHaveBeenCalledWith(
      "phone_verified",
      expect.anything(),
    );

    await waitFor(() => expect(screen.getByTestId("is-loading")).toHaveTextContent("false"));

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "654321" } });
    fireEvent.click(screen.getByText("otp-submit"));
    await waitFor(() => expect(submitOtpMock).toHaveBeenCalledTimes(2));
  });
});

describe("PostScanReportSwitcher — async cleanup (FIX-3.2)", () => {
  let funnelState: Record<string, unknown>;
  let submitPhoneMock: ReturnType<typeof vi.fn>;
  let resendMock: ReturnType<typeof vi.fn>;
  let submitOtpMock: ReturnType<typeof vi.fn>;
  let onVerifiedMock: ReturnType<typeof vi.fn<(phone: string) => void>>;
  let resolvePhoneSubmit: (value: { status: string; e164: string }) => void;
  let resolveResend: (value: { status: string }) => void;
  let rejectPhoneSubmit: (reason?: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReportAccess.mockReturnValue("preview");

    funnelState = {
      phoneE164: SESSION_SAFE_E164,
      phoneStatus: "otp_sent",
      scanSessionId: VALID_SCAN_SESSION_ID,
      setPhone: vi.fn(),
      setPhoneStatus: vi.fn(),
      sessionId: "sess-cleanup",
    };
    mockUseScanFunnelSafe.mockImplementation(() => funnelState);

    onVerifiedMock = vi.fn();
    submitOtpMock = vi.fn().mockResolvedValue({
      status: "verified",
      e164: SESSION_SAFE_E164,
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });
    submitPhoneMock = vi.fn(
      () =>
        new Promise((resolve, reject) => {
          resolvePhoneSubmit = resolve;
          rejectPhoneSubmit = reject;
        }),
    );
    resendMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveResend = resolve;
        }),
    );

    mockUsePhonePipeline.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: SESSION_SAFE_E164,
      inputComplete: true,
      phoneStatus: "otp_sent",
      errorMsg: "",
      errorType: null,
      resendCooldown: 0,
      handlePhoneChange: vi.fn(),
      submitPhone: submitPhoneMock,
      submitOtp: submitOtpMock,
      resend: resendMock,
      reset: vi.fn(),
    });
  });

  it("releases send in-flight lock after scanSessionId changes mid-flight", async () => {
    funnelState.phoneStatus = "screened_valid";
    const { rerender } = renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });

    fireEvent.click(screen.getByText("phone-submit"));
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
        />
      </MemoryRouter>,
    );

    resolvePhoneSubmit!({ status: "otp_sent", e164: SESSION_SAFE_E164 });
    await waitFor(() => expect(screen.getByTestId("is-loading")).toHaveTextContent("false"));

    funnelState.phoneStatus = "screened_valid";
    fireEvent.click(screen.getByText("phone-submit"));
    await waitFor(() => expect(submitPhoneMock).toHaveBeenCalledTimes(2));
  });

  it("releases resend in-flight lock after scanSessionId changes mid-flight", async () => {
    const { rerender } = renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });

    fireEvent.click(screen.getByText("resend"));
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
        />
      </MemoryRouter>,
    );

    resolveResend!({ status: "otp_sent" });
    await waitFor(() => expect(screen.getByTestId("is-loading")).toHaveTextContent("false"));

    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    funnelState.phoneE164 = SESSION_SAFE_E164;
    funnelState.phoneStatus = "otp_sent";
    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={VALID_SCAN_SESSION_ID}
        />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByText("resend"));
    await waitFor(() => expect(resendMock).toHaveBeenCalledTimes(2));
  });

  it("does not apply send_failed funnel status to a new session after rejected send", async () => {
    funnelState.phoneStatus = "screened_valid";
    const { rerender } = renderSwitcher({ scanSessionId: VALID_SCAN_SESSION_ID });

    fireEvent.click(screen.getByText("phone-submit"));
    vi.mocked(funnelState.setPhoneStatus as ReturnType<typeof vi.fn>).mockClear();

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
        />
      </MemoryRouter>,
    );

    rejectPhoneSubmit!(new Error("network fail"));
    await Promise.resolve();
    await Promise.resolve();

    expect(funnelState.setPhoneStatus).not.toHaveBeenCalledWith("send_failed");
    expect(toast.error).not.toHaveBeenCalledWith("Connection error. Please try again.");
  });

  it("does not fire phone_verified GTM event for inactive session after OTP resolves", async () => {
    let resolveOtp: (value: {
      status: string;
      e164: string;
      phoneVerifiedEventId: string;
      reportRevealedEventId: string;
    }) => void;
    submitOtpMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveOtp = resolve;
        }),
    );

    const { rerender } = renderSwitcher({
      scanSessionId: VALID_SCAN_SESSION_ID,
      onVerified: onVerifiedMock,
    });

    fireEvent.change(screen.getByTestId("otp-input"), { target: { value: "123456" } });
    fireEvent.click(screen.getByText("otp-submit"));

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
          onVerified={onVerifiedMock}
        />
      </MemoryRouter>,
    );

    resolveOtp!({
      status: "verified",
      e164: SESSION_SAFE_E164,
      phoneVerifiedEventId: "evt-pv",
      reportRevealedEventId: "evt-rr",
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(trackGtmEventMock).not.toHaveBeenCalledWith("phone_verified", expect.anything());
    expect(onVerifiedMock).not.toHaveBeenCalled();
  });

  it("does not show compare toast on new session after compare fails on prior session", async () => {
    funnelState.phoneE164 = SESSION_SAFE_E164;
    funnelState.scanSessionId = VALID_SCAN_SESSION_ID;
    mockUseReportAccess.mockReturnValue("full");
    const invokeMock = vi.mocked(supabase.functions.invoke);
    let resolveCompare: ((value: FunctionsResponse<unknown> | PromiseLike<FunctionsResponse<unknown>>) => void) | undefined;
    invokeMock.mockImplementation((name: string) => {
      if (name === "compare-quotes") {
        return new Promise((resolve) => {
          resolveCompare = resolve;
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });
    vi.mocked(supabase.rpc).mockImplementation((fn: string) => {
      if (fn === "get_comparable_sessions") {
        return Promise.resolve({
          data: [
            { scan_session_id: VALID_SCAN_SESSION_ID },
            { scan_session_id: OTHER_VALID_SCAN_SESSION_ID },
          ],
          error: null,
        }) as unknown as ReturnType<typeof supabase.rpc>;
      }
      return Promise.resolve({ data: [], error: null }) as unknown as ReturnType<typeof supabase.rpc>;
    });

    const { rerender } = renderFullUnlocked();

    await waitFor(() =>
      expect(screen.getByText("Compare My 2 Quotes Side-by-Side →")).toBeInTheDocument(),
    );
    (toast.error as unknown as ReturnType<typeof vi.fn>).mockClear();
    fireEvent.click(screen.getByText("Compare My 2 Quotes Side-by-Side →"));

    rerender(
      <MemoryRouter>
        <PostScanReportSwitcher
          {...baseProps()}
          scanSessionId={OTHER_VALID_SCAN_SESSION_ID}
          isFullLoaded={true}
        />
      </MemoryRouter>,
    );

    resolveCompare!({ data: null, error: new Error("stale") });
    await Promise.resolve();
    await Promise.resolve();

    expect(toast.error).not.toHaveBeenCalledWith("Comparison failed. Please try again.");
    expect(toast.error).not.toHaveBeenCalledWith("Connection error. Please try again.");
  });
});
