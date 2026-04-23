/**
 * phoneVerificationService — Return-shape contract lock.
 *
 * VerifyGate.tsx and PhoneVerifyModal.tsx depend on the EXACT shape of these
 * results. Drift here = silent UI breakage.
 *
 * What components consume:
 *   sendOtp:    result.ok (bool), result.message (on error)
 *   verifyOtp:  result.ok (bool), result.message (on error)
 *               result.data.phone_e164 (server-canonical, success)
 *
 * Loading / error timing semantics: components await once and branch on
 * `result.ok`. There is no intermediate state — the service returns a single
 * envelope per call. Locked here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { OtpServiceErr } from "@/types/serviceResults";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

import { sendOtp, verifyOtp } from "./phoneVerificationService";

describe("phoneVerificationService — sendOtp shape (consumed by VerifyGate, PhoneVerifyModal)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("on success returns { ok: true, data: { success: true } }", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ success: true });
  });

  it("on edge-function error surfaces body.error as result.message (matches old data?.error fallback)", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: { status: 400, json: vi.fn().mockResolvedValue({ error: "Phone number invalid." }) },
      },
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.message).toBe("Phone number invalid.");
      expect(typeof err.errorCode).toBe("string");
    }
  });

  it("on body success=false surfaces body.error as result.message", async () => {
    mockInvoke.mockResolvedValue({
      data: { success: false, error: "Phone not reachable." },
      error: null,
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.message).toBe("Phone not reachable.");
    }
  });

  it("on network exception returns ok:false with a non-empty message (network category)", async () => {
    mockInvoke.mockRejectedValue(new Error("fetch failed"));
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.message.length).toBeGreaterThan(0);
      expect(err.errorCode).toBe("network");
    }
  });

  it("omits scan_session_id when not provided (preserves VerifyGate/Modal wire shape)", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await sendOtp("+13055551234");
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: undefined },
    });
  });
});

describe("phoneVerificationService — verifyOtp shape (consumed by VerifyGate, PhoneVerifyModal)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("on success returns ok:true with server-canonical phone in data.phone_e164", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055550000" },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "123456", "session_abc");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.verified).toBe(true);
      expect(r.data.phone_e164).toBe("+13055550000");
    }
  });

  it("on body verified=false surfaces body.error as result.message", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: false, error: "Code does not match." },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.message).toBe("Code does not match.");
      expect(err.errorCode).toBe("invalid_code");
    }
  });

  it("on edge-function error surfaces body.error as result.message", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: { status: 400, json: vi.fn().mockResolvedValue({ error: "Invalid verification code" }) },
      },
    });
    const r = await verifyOtp("+13055551234", "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.message).toBe("Invalid verification code");
    }
  });

  it("forwards scan_session_id when provided (matches Modal/VerifyGate wire shape)", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055551234" },
      error: null,
    });
    await verifyOtp("+13055551234", "123456", "session_xyz");
    expect(mockInvoke).toHaveBeenCalledWith("verify-otp", {
      body: { phone_e164: "+13055551234", code: "123456", scan_session_id: "session_xyz" },
    });
  });
});
