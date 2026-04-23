/**
 * phoneVerificationService — Supabase transport for OTP send/verify.
 *
 * SOLE TRANSPORT for `send-otp` / `verify-otp`. Do not invoke these edge
 * functions directly from components — extend this service or
 * `usePhonePipeline` instead. Payload shape is locked by
 * `usePhonePipeline.test.ts`.
 */

import { supabase } from "@/integrations/supabase/client";
import type { OtpErrorCode } from "@/types/serviceResults";

// ── Result types ────────────────────────────────────────────────────────────

export type OtpServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; errorCode: OtpErrorCode };

export interface OtpSendResult {
  success: true;
}

export interface OtpVerifyResult {
  verified: true;
  /** Server-canonical phone in E.164 */
  phone_e164: string;
  /** Server-generated canonical event_id for the phone_verified business event (browser must reuse for dedup). */
  phone_verified_event_id: string | null;
  /** Server-generated canonical event_id for the report_revealed business event (browser must reuse for dedup). */
  report_revealed_event_id: string | null;
}

// ── Error classification helpers ────────────────────────────────────────────

async function parseEdgeFunctionError(
  error: any,
  fallbackMsg: string
): Promise<{ message: string; code: OtpErrorCode; twilioCode?: number }> {
  let parsedMsg = fallbackMsg;
  let code: OtpErrorCode = "generic";
  let twilioCode: number | undefined;

  try {
    if (error.context && typeof error.context.json === "function") {
      const body = await error.context.json();
      parsedMsg = body?.error || parsedMsg;
      twilioCode = body?.twilio_code;

      if (twilioCode === 60410 || parsedMsg.toLowerCase().includes("blocked by our carrier")) {
        code = "blocked_prefix";
      } else if (error.context.status === 429 || parsedMsg.toLowerCase().includes("too many")) {
        code = "rate_limit";
      } else if (parsedMsg.toLowerCase().includes("expired") || parsedMsg.toLowerCase().includes("not found")) {
        code = "expired_session";
      }
    }
  } catch {
    // unparseable — use defaults
  }

  return { message: parsedMsg, code, twilioCode };
}

// ── Send OTP ────────────────────────────────────────────────────────────────

export async function sendOtp(
  phoneE164: string,
  scanSessionId?: string
): Promise<OtpServiceResult<OtpSendResult>> {
  try {
    const { data, error } = await supabase.functions.invoke("send-otp", {
      body: {
        phone_e164: phoneE164,
        scan_session_id: scanSessionId || undefined,
      },
    });

    if (error) {
      const parsed = await parseEdgeFunctionError(error, "Failed to send verification code.");
      console.error("[phoneVerificationService] send-otp error:", parsed);
      return { ok: false, message: parsed.message, errorCode: parsed.code };
    }

    if (!data?.success) {
      const msg = data?.error || "Failed to send verification code.";
      console.error("[phoneVerificationService] send-otp success=false:", data);
      return { ok: false, message: msg, errorCode: "generic" };
    }

    return { ok: true, data: { success: true } };
  } catch (err) {
    console.error("[phoneVerificationService] send-otp network exception:", err);
    return { ok: false, message: "Network error. Check your connection and try again.", errorCode: "network" };
  }
}

// ── Verify OTP ──────────────────────────────────────────────────────────────

export async function verifyOtp(
  phoneE164: string,
  code: string,
  scanSessionId?: string
): Promise<OtpServiceResult<OtpVerifyResult>> {
  try {
    const { data, error } = await supabase.functions.invoke("verify-otp", {
      body: {
        phone_e164: phoneE164,
        code,
        scan_session_id: scanSessionId || undefined,
      },
    });

    if (error) {
      const parsed = await parseEdgeFunctionError(error, "Invalid or expired code.");
      // Default to invalid_code for verify errors unless a more specific code was found
      if (parsed.code === "generic") parsed.code = "invalid_code";
      console.error("[phoneVerificationService] verify-otp error:", parsed);
      return { ok: false, message: parsed.message, errorCode: parsed.code };
    }

    if (!data?.verified) {
      const msg = data?.error || "Invalid or expired code.";
      console.error("[phoneVerificationService] verify-otp verified=false:", data);
      return { ok: false, message: msg, errorCode: "invalid_code" };
    }

    const canonicalPhone = data?.phone_e164 || phoneE164;
    return {
      ok: true,
      data: {
        verified: true,
        phone_e164: canonicalPhone,
        phone_verified_event_id: data?.phone_verified_event_id ?? null,
        report_revealed_event_id: data?.report_revealed_event_id ?? null,
      },
    };
  } catch (err) {
    console.error("[phoneVerificationService] verify-otp network exception:", err);
    return { ok: false, message: "Network error. Check your connection and try again.", errorCode: "network" };
  }
}
