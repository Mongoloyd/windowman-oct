import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePhonePipeline } from "./usePhonePipeline";

const { mockInvoke, mockUsePhoneInput } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  mockUsePhoneInput: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
  },
}));

vi.mock("@/hooks/usePhoneInput", () => ({
  usePhoneInput: mockUsePhoneInput,
}));

vi.mock("@/lib/trackEvent", () => ({
  trackEvent: vi.fn(),
}));

describe("usePhonePipeline resend cooldown", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("sets a user-facing message when resend is blocked by cooldown", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", { externalPhoneE164: "+13055551234" })
    );

    await act(async () => {
      await result.current.resend();
    });

    let blockedResult: Awaited<ReturnType<typeof result.current.resend>> | null = null;
    await act(async () => {
      blockedResult = await result.current.resend();
    });

    expect(blockedResult?.status).toBe("blocked");
    expect(result.current.errorMsg).toBe("Please wait before requesting another code.");
  });
});

describe("usePhonePipeline submitOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("returns a verified result and calls onVerified on success", async () => {
    const onVerified = vi.fn();
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055550000" },
      error: null,
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
        onVerified,
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("123456");
    });

    expect(mockInvoke).toHaveBeenCalledWith("verify-otp", {
      body: {
        phone_e164: "+13055551234",
        code: "123456",
        scan_session_id: "session_abc",
      },
    });
    expect(verifyResult).toEqual({
      status: "verified",
      e164: "+13055550000",
      phoneVerifiedEventId: null,
      reportRevealedEventId: null,
    });
    expect(result.current.phoneStatus).toBe("verified");
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("returns a controlled invalid_code result on invalid OTP", async () => {
    const errorContextJson = vi.fn().mockResolvedValue({
      error: "Invalid verification code",
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: errorContextJson,
        },
      },
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("000000");
    });

    expect(verifyResult).toEqual({
      status: "invalid_code",
      error: "Invalid verification code",
    });
    expect(result.current.phoneStatus).toBe("otp_sent");
    expect(result.current.errorMsg).toBe("Invalid verification code");
    expect(result.current.errorType).toBe("invalid_code");
    expect(errorContextJson).toHaveBeenCalledTimes(1);
  });

  it("always includes phone and scan session context in the verify payload", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055551234" },
      error: null,
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_xyz",
      })
    );

    await act(async () => {
      await result.current.submitOtp("123456");
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      "verify-otp",
      expect.objectContaining({
        body: expect.objectContaining({
          phone_e164: "+13055551234",
          code: "123456",
          scan_session_id: "session_xyz",
        }),
      })
    );
  });

  it("returns a controlled error without calling verify-otp when the code is incomplete", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("12345");
    });

    expect(verifyResult).toEqual({
      status: "error",
      error: "Enter the full 6-digit code.",
    });
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("usePhonePipeline submitPhone — validate_only mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 234-1234",
      rawDigits: "3052341234",
      e164: "+13052341234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("returns valid status without calling send-otp in validate_only mode", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_only", {})
    );

    let startResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      startResult = await result.current.submitPhone();
    });

    expect(startResult?.status).toBe("valid");
    expect(startResult?.e164).toBe("+13052341234");
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("sets phoneStatus to 'valid' in validate_only mode", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_only", {})
    );

    await act(async () => {
      await result.current.submitPhone();
    });

    expect(result.current.phoneStatus).toBe("valid");
  });
});

describe("usePhonePipeline submitPhone — invalid local phone screening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate user typed too few digits (incomplete)
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 234-12",
      rawDigits: "305234",
      e164: null,
      isValid: false,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("returns blocked when local phone is incomplete (no external phone)", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {})
    );

    let startResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      startResult = await result.current.submitPhone();
    });

    expect(startResult?.status).toBe("blocked");
    expect(mockInvoke).not.toHaveBeenCalled();
    expect(result.current.phoneStatus).toBe("invalid");
  });
});

describe("usePhonePipeline submitPhone — send-otp error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 234-1234",
      rawDigits: "3052341234",
      e164: "+13052341234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("classifies a 429 rate-limit response as 'rate_limit' error type", async () => {
    const errorContextJson = vi.fn().mockResolvedValue({
      error: "Too many code requests. Please wait 25 seconds before trying again.",
      retry_after: 25,
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 429,
          json: errorContextJson,
        },
      },
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
      })
    );

    let startResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      startResult = await result.current.submitPhone();
    });

    expect(startResult?.status).toBe("error");
    expect(result.current.errorType).toBe("rate_limit");
    expect(result.current.phoneStatus).toBe("otp_failed");
  });

  it("classifies a generic send failure as 'generic' error type", async () => {
    const errorContextJson = vi.fn().mockResolvedValue({
      error: "Failed to send verification code.",
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: errorContextJson,
        },
      },
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
      })
    );

    await act(async () => {
      await result.current.submitPhone();
    });

    expect(result.current.errorType).toBe("generic");
    expect(result.current.errorMsg).toBe("Failed to send verification code.");
  });

  it("sets otp_failed when send-otp returns success=false in the response body", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Phone number not reachable." },
      error: null,
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
      })
    );

    let startResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      startResult = await result.current.submitPhone();
    });

    expect(startResult?.status).toBe("error");
    expect(result.current.phoneStatus).toBe("otp_failed");
    expect(result.current.errorMsg).toBe("Phone number not reachable.");
  });

  it("handles a network exception (invoke throws) with 'network' error type", async () => {
    mockInvoke.mockRejectedValue(new Error("fetch failed"));

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
      })
    );

    let startResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      startResult = await result.current.submitPhone();
    });

    expect(startResult?.status).toBe("error");
    expect(result.current.errorType).toBe("network");
    expect(result.current.phoneStatus).toBe("otp_failed");
  });
});

describe("usePhonePipeline submitOtp — edge cases and security guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 234-1234",
      rawDigits: "3052341234",
      e164: "+13052341234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("classifies an expired-session message as 'expired_session' error type", async () => {
    const errorContextJson = vi.fn().mockResolvedValue({
      error: "Verification session expired or not found. Please request a new code.",
    });

    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: errorContextJson,
        },
      },
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
        scanSessionId: "session_abc",
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("123456");
    });

    expect(verifyResult?.status).toBe("invalid_code");
    expect(result.current.errorType).toBe("expired_session");
    expect(result.current.phoneStatus).toBe("otp_sent"); // allows retry
  });

  it("handles a network exception during verify-otp gracefully", async () => {
    mockInvoke.mockRejectedValue(new Error("network failure"));

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
        scanSessionId: "session_abc",
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("123456");
    });

    expect(verifyResult?.status).toBe("error");
    expect(result.current.errorType).toBe("network");
    expect(result.current.phoneStatus).toBe("otp_sent"); // allows retry
  });

  it("returns invalid_code when verify-otp responds with verified=false in body", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: false, error: "Code does not match." },
      error: null,
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
        scanSessionId: "session_abc",
      })
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("000000");
    });

    expect(verifyResult?.status).toBe("invalid_code");
    expect(verifyResult?.error).toBe("Code does not match.");
    expect(result.current.phoneStatus).toBe("otp_sent");
  });

  it("does not call verify-otp when no active phone is available", async () => {
    // No external phone + local e164 is null
    mockUsePhoneInput.mockReturnValue({
      displayValue: "",
      rawDigits: "",
      e164: null,
      isValid: false,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {})
    );

    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("123456");
    });

    expect(verifyResult?.status).toBe("error");
    expect(verifyResult?.error).toBe("Enter the full 6-digit code.");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("usePhonePipeline resend — no phone guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "",
      rawDigits: "",
      e164: null,
      isValid: false,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("returns blocked when no phone is available for resend", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {})
    );

    let resendResult: Awaited<ReturnType<typeof result.current.resend>> | null = null;
    await act(async () => {
      resendResult = await result.current.resend();
    });

    expect(resendResult?.status).toBe("blocked");
    expect(mockInvoke).not.toHaveBeenCalled();
  });
});

describe("usePhonePipeline reset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 234-1234",
      rawDigits: "3052341234",
      e164: "+13052341234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("resets phoneStatus to idle and clears error", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13052341234",
      })
    );

    // Put pipeline into otp_sent state
    await act(async () => {
      await result.current.submitPhone();
    });
    expect(result.current.phoneStatus).toBe("otp_sent");

    await act(async () => {
      result.current.reset();
    });

    expect(result.current.phoneStatus).toBe("idle");
    expect(result.current.errorMsg).toBe("");
    expect(result.current.errorType).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Contract — payload shape (regression lock)
// ════════════════════════════════════════════════════════════════════════════
describe("usePhonePipeline — Contract — payload shape", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("send-otp payload includes phone_e164 and scan_session_id when present", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
      })
    );
    await act(async () => { await result.current.submitPhone(); });
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: "session_abc" },
    });
  });

  it("send-otp payload sets scan_session_id to undefined when absent", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
      })
    );
    await act(async () => { await result.current.submitPhone(); });
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: undefined },
    });
  });

  it("verify-otp returns the SERVER-CANONICAL phone, not the input", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055550000" },
      error: null,
    });
    const onVerified = vi.fn();
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
        onVerified,
      })
    );
    let verifyResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      verifyResult = await result.current.submitOtp("123456");
    });
    expect(verifyResult?.e164).toBe("+13055550000");
    expect(verifyResult?.e164).not.toBe("+13055551234");
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("resend forwards a per-call scanSessionId override", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_default",
      })
    );
    await act(async () => {
      await result.current.resend({ scanSessionId: "session_override" });
    });
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: "session_override" },
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Concurrency guards
// ════════════════════════════════════════════════════════════════════════════
describe("usePhonePipeline — Concurrency guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
  });

  it("submitOtp twice in rapid succession invokes verify-otp exactly once", async () => {
    let resolveFirst: ((v: any) => void) | null = null;
    mockInvoke.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; })
    );

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
        scanSessionId: "session_abc",
      })
    );

    let secondResult: Awaited<ReturnType<typeof result.current.submitOtp>> | null = null;
    await act(async () => {
      const firstPromise = result.current.submitOtp("123456");
      secondResult = await result.current.submitOtp("123456");
      resolveFirst!({ data: { verified: true, phone_e164: "+13055551234" }, error: null });
      await firstPromise;
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(secondResult?.status).toBe("error");
  });

  it("submitPhone twice in rapid succession invokes send-otp exactly once", async () => {
    let resolveFirst: ((v: any) => void) | null = null;
    mockInvoke.mockImplementationOnce(
      () => new Promise((res) => { resolveFirst = res; })
    );

    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", {
        externalPhoneE164: "+13055551234",
      })
    );

    let secondResult: Awaited<ReturnType<typeof result.current.submitPhone>> | null = null;
    await act(async () => {
      const firstPromise = result.current.submitPhone();
      secondResult = await result.current.submitPhone();
      resolveFirst!({ data: { success: true }, error: null });
      await firstPromise;
    });

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(secondResult?.status).toBe("error");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Resend cooldown — does NOT invoke send-otp when blocked
// ════════════════════════════════════════════════════════════════════════════
describe("usePhonePipeline — Resend cooldown invocation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUsePhoneInput.mockReturnValue({
      displayValue: "(305) 555-1234",
      rawDigits: "3055551234",
      e164: "+13055551234",
      isValid: true,
      handleChange: vi.fn(),
      setValue: vi.fn(),
    });
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
  });

  it("a second resend within cooldown does NOT call send-otp again", async () => {
    const { result } = renderHook(() =>
      usePhonePipeline("validate_and_send_otp", { externalPhoneE164: "+13055551234" })
    );
    await act(async () => { await result.current.resend(); });
    expect(mockInvoke).toHaveBeenCalledTimes(1);

    let blocked: Awaited<ReturnType<typeof result.current.resend>> | null = null;
    await act(async () => { blocked = await result.current.resend(); });

    expect(blocked?.status).toBe("blocked");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
