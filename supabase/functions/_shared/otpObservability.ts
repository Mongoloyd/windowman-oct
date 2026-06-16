/**
 * OTP/Twilio observability — best-effort writes only.
 * Does not authorize report unlock. Never stores OTP codes or raw phone in metadata.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const METADATA_WHITELIST = new Set([
  "reason",
  "branch",
  "request_origin",
  "has_lead_id",
  "has_scan_session_id",
  "has_phone_verification_id",
  "twilio_status",
  "twilio_error_code",
  "rate_limit_bucket",
  "retry_after_sec",
  "qa_bypass",
  "pending_row_source",
]);

const MAX_SAFE_MESSAGE_LENGTH = 300;

export type OtpLifecycleEventType =
  | "send_requested"
  | "send_accepted"
  | "send_failed"
  | "rate_limited"
  | "verify_submitted"
  | "verify_approved"
  | "verify_failed";

export type OtpLifecycleEventStatus = "ok" | "failed" | "blocked" | "info";

export type OtpLifecycleActor =
  | "homeowner"
  | "edge_send_otp"
  | "edge_verify_otp";

export type OtpLifecycleSource = "send-otp" | "verify-otp";

export type SendOutcome =
  | "accepted"
  | "failed"
  | "rate_limited"
  | "lookup_rejected"
  | "qa_bypass";

export type VerificationChannel = "twilio_verify" | "qa_bypass";

export interface OtpObsContext {
  scanSessionId?: string | null;
  leadId?: string | null;
  phoneVerificationId?: string | null;
  ipAddress?: string | null;
}

export interface LogOtpLifecycleEventInput {
  eventType: OtpLifecycleEventType;
  eventStatus: OtpLifecycleEventStatus;
  actor: OtpLifecycleActor;
  source: OtpLifecycleSource;
  context: OtpObsContext;
  twilioErrorCode?: number | null;
  twilioVerificationSid?: string | null;
  metadata?: Record<string, unknown>;
}

export interface PhoneVerificationObservabilityPatch {
  twilio_verification_sid?: string | null;
  send_outcome?: SendOutcome | null;
  twilio_send_error_code?: number | null;
  twilio_send_error_message?: string | null;
  verify_attempt_count?: number | null;
  last_verify_at?: string | null;
  last_verify_error_code?: number | null;
  verification_channel?: VerificationChannel | null;
  initiated_by?: "homeowner" | "admin_resend" | "system" | null;
  initiated_by_user_id?: string | null;
}

export interface SafeTwilioError {
  code: number | null;
  message: string | null;
}

function logObsFailure(branch: string, code?: string): void {
  console.warn("[otp-obs] write failed", {
    branch,
    code: code ?? "unknown",
  });
}

export function safeMetadata(
  input: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { request_origin: "edge" };
  }

  const out: Record<string, unknown> = { request_origin: "edge" };
  for (const [key, value] of Object.entries(input)) {
    if (!METADATA_WHITELIST.has(key)) continue;
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function safeRedactTwilioError(
  twilioData: unknown,
): SafeTwilioError {
  if (!twilioData || typeof twilioData !== "object" || Array.isArray(twilioData)) {
    return { code: null, message: null };
  }

  const record = twilioData as Record<string, unknown>;
  const rawCode = record.code;
  const code = typeof rawCode === "number"
    ? rawCode
    : typeof rawCode === "string" && /^\d+$/.test(rawCode)
    ? Number(rawCode)
    : null;

  let message: string | null = null;
  if (typeof record.message === "string" && record.message.trim()) {
    message = record.message.trim().slice(0, MAX_SAFE_MESSAGE_LENGTH);
  }

  return { code, message };
}

export async function resolveLeadIdForObservability(
  supabase: SupabaseClient,
  scanSessionId: string | null | undefined,
): Promise<string | null> {
  if (!scanSessionId) return null;

  try {
    const { data, error } = await supabase
      .from("scan_sessions")
      .select("lead_id")
      .eq("id", scanSessionId)
      .maybeSingle();

    if (error) {
      logObsFailure("resolve_lead_id", error.code);
      return null;
    }

    return typeof data?.lead_id === "string" ? data.lead_id : null;
  } catch {
    logObsFailure("resolve_lead_id", "exception");
    return null;
  }
}

function assertPreInsertBinding(input: LogOtpLifecycleEventInput): boolean {
  if (input.context.phoneVerificationId) return true;
  if (input.source !== "send-otp") return false;
  if (
    !["send_requested", "rate_limited", "send_failed"].includes(input.eventType)
  ) return false;
  if (!["info", "blocked", "failed"].includes(input.eventStatus)) return false;
  if (!["homeowner", "edge_send_otp"].includes(input.actor)) return false;
  return true;
}

export async function logOtpLifecycleEvent(
  supabase: SupabaseClient,
  input: LogOtpLifecycleEventInput,
): Promise<void> {
  const phoneVerificationId = input.context.phoneVerificationId ?? null;

  if (!phoneVerificationId && !assertPreInsertBinding({
    ...input,
    context: { ...input.context, phoneVerificationId: null },
  })) {
    logObsFailure("lifecycle_binding_rejected");
    return;
  }

  if (
    input.source === "verify-otp" &&
    !phoneVerificationId
  ) {
    logObsFailure("verify_lifecycle_missing_pv_id");
    return;
  }

  const metadata = safeMetadata({
    ...input.metadata,
    has_lead_id: !!input.context.leadId,
    has_scan_session_id: !!input.context.scanSessionId,
    has_phone_verification_id: !!phoneVerificationId,
  });

  try {
    const { error } = await supabase.from("otp_lifecycle_events").insert({
      phone_verification_id: phoneVerificationId,
      lead_id: input.context.leadId ?? null,
      scan_session_id: input.context.scanSessionId ?? null,
      event_type: input.eventType,
      event_status: input.eventStatus,
      actor: input.actor,
      source: input.source,
      twilio_error_code: input.twilioErrorCode ?? null,
      twilio_verification_sid: input.twilioVerificationSid ?? null,
      metadata,
      ip_address: input.context.ipAddress ?? null,
    });

    if (error) {
      logObsFailure("lifecycle_insert", error.code);
    }
  } catch {
    logObsFailure("lifecycle_insert", "exception");
  }
}

export async function updatePhoneVerificationObservability(
  supabase: SupabaseClient,
  phoneVerificationId: string,
  patch: PhoneVerificationObservabilityPatch,
): Promise<void> {
  if (!phoneVerificationId) return;

  const updatePayload: PhoneVerificationObservabilityPatch = { ...patch };

  if (updatePayload.twilio_send_error_message) {
    updatePayload.twilio_send_error_message =
      updatePayload.twilio_send_error_message.slice(0, MAX_SAFE_MESSAGE_LENGTH);
  }

  try {
    const { error } = await supabase
      .from("phone_verifications")
      .update(updatePayload)
      .eq("id", phoneVerificationId);

    if (error) {
      logObsFailure("phone_verifications_obs_update", error.code);
    }
  } catch {
    logObsFailure("phone_verifications_obs_update", "exception");
  }
}

export async function incrementVerifyAttemptObservability(
  supabase: SupabaseClient,
  phoneVerificationId: string,
  options: {
    failed: boolean;
    twilioErrorCode?: number | null;
    verificationChannel?: VerificationChannel | null;
  },
): Promise<void> {
  try {
    const { data, error: readErr } = await supabase
      .from("phone_verifications")
      .select("verify_attempt_count")
      .eq("id", phoneVerificationId)
      .maybeSingle();

    if (readErr) {
      logObsFailure("verify_attempt_read", readErr.code);
      return;
    }

    const current = typeof data?.verify_attempt_count === "number"
      ? data.verify_attempt_count
      : 0;

    const patch: PhoneVerificationObservabilityPatch = {
      verify_attempt_count: current + 1,
      last_verify_at: new Date().toISOString(),
    };

    if (options.failed) {
      patch.last_verify_error_code = options.twilioErrorCode ?? null;
    }

    if (options.verificationChannel) {
      patch.verification_channel = options.verificationChannel;
    }

    await updatePhoneVerificationObservability(
      supabase,
      phoneVerificationId,
      patch,
    );
  } catch {
    logObsFailure("verify_attempt_increment", "exception");
  }
}
