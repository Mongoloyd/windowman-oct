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

import { describe, it, expect, expectTypeOf, vi, beforeEach, afterEach } from "vitest";
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

// ════════════════════════════════════════════════════════════════════════════
// SPRINT 1 — send-otp contract hardening
//
// Locks the wire shape, error-code taxonomy, verbatim phone passthrough, and
// confirms the service is a pure single-shot (no hidden retries). Drift in any
// of these breaks Twilio Verify integration AND the consumer error UX.
// ════════════════════════════════════════════════════════════════════════════
describe("phoneVerificationService — Sprint 1: send-otp contract hardening", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.useRealTimers());

  it("wire-shape lock: exact body keys when scan_session_id provided", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await sendOtp("+13055551234", "sess_1");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: "sess_1" },
    });
    expect(mockInvoke.mock.calls[0]).toMatchInlineSnapshot(`
      [
        "send-otp",
        {
          "body": {
            "phone_e164": "+13055551234",
            "scan_session_id": "sess_1",
          },
        },
      ]
    `);
  });

  it("wire-shape lock: scan_session_id is undefined when not provided", async () => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await sendOtp("+13055551234");
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: "+13055551234", scan_session_id: undefined },
    });
  });

  it.each([
    "+13055551234",
    "+1 (305) 555-1234",
    "  +13055551234  ",
    "+447911123456",
  ])("verbatim passthrough: forwards %j byte-for-byte (no normalization)", async (input) => {
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await sendOtp(input);
    expect(mockInvoke).toHaveBeenCalledWith("send-otp", {
      body: { phone_e164: input, scan_session_id: undefined },
    });
  });

  it("HTTP 429 → errorCode='rate_limit'", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 429,
          json: vi.fn().mockResolvedValue({ error: "Too many requests. Try again later." }),
        },
      },
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.errorCode).toBe("rate_limit");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("blocked_prefix via twilio_code 60410 → errorCode='blocked_prefix'", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: vi.fn().mockResolvedValue({
            error: "This phone number is blocked by our carrier.",
            twilio_code: 60410,
          }),
        },
      },
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r as OtpServiceErr).errorCode).toBe("blocked_prefix");
  });

  it("expired_session via 'expired' message → errorCode='expired_session'", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: vi.fn().mockResolvedValue({ error: "Verification session expired." }),
        },
      },
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r as OtpServiceErr).errorCode).toBe("expired_session");
  });

  it("context.json() throws → falls back cleanly to errorCode='generic' (no unhandled rejection)", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 500,
          json: vi.fn().mockRejectedValue(new Error("body is not JSON")),
        },
      },
    });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.errorCode).toBe("generic");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("malformed body { data:null, error:null } → errorCode='generic'", async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.errorCode).toBe("generic");
      expect(err.message.length).toBeGreaterThan(0);
    }
  });

  it("network exception → errorCode='network'", async () => {
    mockInvoke.mockRejectedValue(new Error("fetch failed"));
    const r = await sendOtp("+13055551234");
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r as OtpServiceErr).errorCode).toBe("network");
  });

  it("no hidden retries: invokes exactly once even after 60s of fake timers", async () => {
    vi.useFakeTimers();
    mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
    await sendOtp("+13055551234");
    vi.advanceTimersByTime(60_000);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  it("type-safety: sendOtp success branch returns { success: true }", () => {
    type S = Awaited<ReturnType<typeof sendOtp>>;
    type Ok = Extract<S, { ok: true }>;
    type Err = Extract<S, { ok: false }>;
    expectTypeOf<Ok["data"]>().toEqualTypeOf<{ success: true }>();
    expectTypeOf<Err["errorCode"]>().toEqualTypeOf<
      "rate_limit" | "blocked_prefix" | "expired_session" | "invalid_code" | "network" | "generic"
    >();
    expectTypeOf<Err["message"]>().toEqualTypeOf<string>();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SPRINT 2 — verify-otp contract + canonical phone handoff
//
// CRITICAL: the server-canonical divergence test (below) is the regression
// guard for the __UNAUTHORIZED__ hot-fix in:
//   - src/components/TruthReportFindings/VerifyGate.tsx
//   - src/components/TruthReportFindings/PhoneVerifyModal.tsx
// Those components previously discarded result.data.phone_e164 and called
// onVerified() with no argument, causing fetchFull(undefined) and a guaranteed
// __UNAUTHORIZED__ response from get_analysis_full RPC. The fix forwards
// result.data.phone_e164. If this test ever flips green→red, verify the
// service still returns the SERVER value, not the input.
// ════════════════════════════════════════════════════════════════════════════
describe("phoneVerificationService — Sprint 2: verify-otp contract + canonical handoff", () => {
  beforeEach(() => vi.clearAllMocks());

  it("wire-shape lock: exact body keys { phone_e164, code, scan_session_id }", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055551234" },
      error: null,
    });
    await verifyOtp("+13055551234", "123456", "sess_1");
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith("verify-otp", {
      body: {
        phone_e164: "+13055551234",
        code: "123456",
        scan_session_id: "sess_1",
      },
    });
  });

  it("REGRESSION (VerifyGate / PhoneVerifyModal __UNAUTHORIZED__ hot-fix): server-canonical phone wins over input", async () => {
    // Input is "+13055551234" but the server normalizes to "+13055550000".
    // The service MUST surface the server value — consumers pass this into
    // fetchFull() to match phone_verifications.phone_e164 exactly.
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055550000" },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "123456", "sess_1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.phone_e164).toBe("+13055550000");
      expect(r.data.phone_e164).not.toBe("+13055551234");
    }
  });

  it("expired_session → errorCode='expired_session'", async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: {
        context: {
          status: 400,
          json: vi.fn().mockResolvedValue({ error: "Session expired or not found." }),
        },
      },
    });
    const r = await verifyOtp("+13055551234", "123456", "sess_1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect((r as OtpServiceErr).errorCode).toBe("expired_session");
  });

  it("invalid_code: err branch carries no `data` field (discriminated union holds)", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: false, error: "Code does not match." },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "000000");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const err = r as OtpServiceErr;
      expect(err.errorCode).toBe("invalid_code");
      // The err branch type does not include `data` — accessing it returns undefined.
      expect((err as unknown as { data?: unknown }).data).toBeUndefined();
    }
  });

  it("surfaces phone_verified_event_id and report_revealed_event_id when present", async () => {
    mockInvoke.mockResolvedValue({
      data: {
        verified: true,
        phone_e164: "+13055551234",
        phone_verified_event_id: "evt_phone_001",
        report_revealed_event_id: "evt_reveal_002",
      },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "123456");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.phone_verified_event_id).toBe("evt_phone_001");
      expect(r.data.report_revealed_event_id).toBe("evt_reveal_002");
    }
  });

  it("event_ids default to null when server omits them (forward-compat)", async () => {
    mockInvoke.mockResolvedValue({
      data: { verified: true, phone_e164: "+13055551234" },
      error: null,
    });
    const r = await verifyOtp("+13055551234", "123456");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.phone_verified_event_id).toBeNull();
      expect(r.data.report_revealed_event_id).toBeNull();
    }
  });

  it("type-safety: success branch guarantees phone_e164 is string (not optional)", () => {
    type V = Awaited<ReturnType<typeof verifyOtp>>;
    type Ok = Extract<V, { ok: true }>;
    expectTypeOf<Ok["data"]["phone_e164"]>().toEqualTypeOf<string>();
    expectTypeOf<Ok["data"]["phone_verified_event_id"]>().toEqualTypeOf<string | null>();
    expectTypeOf<Ok["data"]["report_revealed_event_id"]>().toEqualTypeOf<string | null>();
  });
});
