import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import React from "react";
import { MemoryRouter } from "react-router-dom";
import { PostScanReportSwitcher } from "./PostScanReportSwitcher";
import { toast } from "sonner";

const VALID_SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const LOST_SCAN_SESSION_MESSAGE = "We lost the scan session. Please restart the scan.";

const { mockUseReportAccess, mockUseScanFunnelSafe, mockUsePhonePipeline } = vi.hoisted(() => ({
  mockUseReportAccess: vi.fn(),
  mockUseScanFunnelSafe: vi.fn(),
  mockUsePhonePipeline: vi.fn(),
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

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
    },
  },
}));

// Render the gate as a real form so onOtpSubmit can be exercised in tests
// for the post-OTP transition.
vi.mock("../TruthReportClassic", () => ({
  default: ({ gateProps, accessLevel }: { gateProps?: any; accessLevel: string }) => (
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
    </div>
  ),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

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
    renderSwitcher();
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("enter_code");
  });

  it("shows send_code mode and loading while shared status is sending_otp", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "sending_otp";
    renderSwitcher();
    expect(screen.getByTestId("gate-mode")).toHaveTextContent("send_code");
    expect(screen.getByTestId("is-loading")).toHaveTextContent("true");
  });

  it("shows fallback copy when shared status is send_failed", () => {
    funnelState.phoneE164 = "+13055551234";
    funnelState.phoneStatus = "send_failed";
    renderSwitcher();
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
