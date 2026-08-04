/**
 * verify-otp — Twilio Verify check → exact-session verification finalization.
 *
 * Phase A2a containment: neither Twilio nor the QA bypass may run until ONE
 * exact scan-bound pending verification row and a valid scan→lead binding are
 * proven. The required order is:
 *
 *   valid request
 *   → exact pending phone/scan row
 *   → exact scan session and non-null lead
 *   → QA bypass or Twilio approval
 *   → exact pending-row compare-and-set
 *   → required exact-lead update
 *   → canonical success events
 *   → verified response
 *
 * Every failed prerequisite prevents all later trusted side effects.
 *
 * The request handler is exported and dependency-injected so the fail-closed
 * ordering can be proven by unit tests (see handler.test.ts). Deno.serve is
 * started under `if (import.meta.main)`, so importing this module does not bind
 * a port and never constructs a production Supabase client.
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";
import {
  evaluateOtpQaBypassForVerify,
  type OtpQaBypassEnv,
} from "../_shared/otpQaBypass.ts";
import {
  incrementVerifyAttemptObservability,
  logOtpLifecycleEvent,
  safeRedactTwilioError,
  updatePhoneVerificationObservability,
  type OtpObsContext,
  type VerificationChannel,
} from "../_shared/otpObservability.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";
import {
  evaluatePendingRowEligibility,
  evaluateScanLeadBinding,
  evaluateVerificationCasResult,
  maskPhoneForLog,
  PENDING_STATUS,
  validateVerifyOtpRequest,
  type PendingVerificationRow,
  type ScanSessionLeadRow,
} from "./pendingRowBinding.ts";

/**
 * Service-role client contract for this handler. Derived from the Supabase
 * client type already imported above, because the shared observability and
 * canonical-event helpers require the real `SupabaseClient` signature.
 */
export type VerifyOtpSupabaseClient = SupabaseClient;

export interface VerifyOtpDeps {
  supabase?: VerifyOtpSupabaseClient;
  fetchImpl?: typeof globalThis.fetch;
  now?: () => Date;
}

function loadOtpQaBypassEnv(): OtpQaBypassEnv {
  return {
    OTP_QA_BYPASS_ENABLED: Deno.env.get("OTP_QA_BYPASS_ENABLED"),
    OTP_QA_PHONE_E164: Deno.env.get("OTP_QA_PHONE_E164"),
    OTP_QA_CODE: Deno.env.get("OTP_QA_CODE"),
    OTP_QA_PROJECT_REF: Deno.env.get("OTP_QA_PROJECT_REF"),
    WM_SUPABASE_PROJECT_REF: Deno.env.get("WM_SUPABASE_PROJECT_REF"),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// User-safe messages. Never leak database errors, SQL, IDs, or stack traces.
// Every terminal denial tells the homeowner to request a new code, because A2a
// requires a fresh pending row rather than reusing a consumed one.
const MSG_MISSING_FIELDS = "Phone and code are required.";
const MSG_INVALID_PHONE = "Invalid phone format.";
const MSG_SCAN_MISMATCH =
  "Verification could not be matched to your scan. Please request a new code.";
const MSG_SESSION_LINK =
  "Verification could not be linked to your session. Please try again.";
const MSG_INVALID_CODE = "Invalid or expired code.";
const MSG_EXPIRED_SESSION =
  "Verification session expired or not found. Please request a new code.";
const MSG_PERSIST_FAILED =
  "Verification confirmed but could not be saved. Please request a new code and try again.";
const MSG_TWILIO_UNAVAILABLE =
  "Verification is temporarily unavailable. Please try again in a moment.";
const MSG_INTERNAL = "Internal server error.";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function handleVerifyOtpRequest(
  request: Request,
  deps: VerifyOtpDeps = {},
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await request.json();

    // ── 1. Deterministic request validation ─────────────────────────────
    // Missing or malformed scan binding fails closed here — before Twilio,
    // before QA success, before any verification or lead mutation, and before
    // any canonical success event.
    const validated = validateVerifyOtpRequest({
      normalizedPhoneE164: normalizePhone(body.phone_e164),
      code: body.code,
      scanSessionId: body.scan_session_id,
    });

    if (!validated.ok) {
      if (validated.reason === "missing_phone_or_code") {
        return jsonResponse(400, { error: MSG_MISSING_FIELDS });
      }
      if (validated.reason === "invalid_phone") {
        return jsonResponse(400, { error: MSG_INVALID_PHONE });
      }

      // No pending row is known yet, so `otp_lifecycle_events` cannot be bound
      // (logOtpLifecycleEvent rejects verify-otp events without a
      // phone_verification_id). Masked console telemetry only.
      console.warn(
        "[VERIFY_OTP_SCAN_BINDING_REJECTED]",
        JSON.stringify({
          reason: validated.reason,
          timestamp: new Date().toISOString(),
        }),
      );
      return jsonResponse(400, { error: MSG_SCAN_MISMATCH, verified: false });
    }

    const { phoneE164, code, scanSessionId } = validated;
    const phoneMasked = maskPhoneForLog(phoneE164);
    const nowFn = deps.now ?? (() => new Date());
    const fetchImpl = deps.fetchImpl ?? globalThis.fetch;

    // ── 2. Service-role client ──────────────────────────────────────────
    // Constructed lazily so importing this module (tests) never reads
    // production secrets. Tests always inject `supabase` and `fetchImpl`.
    const supabase: VerifyOtpSupabaseClient = deps.supabase ??
      createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );

    // ── 3. Exact scan-bound pending verification row ─────────────────────
    // Strict binding: only the pending row that send-otp bound to THIS scan is
    // eligible. There is no null-session fallback and no re-binding: a row
    // created for Scan A can never be verified against Scan B, and a
    // session-less row can never be stamped with the requested scan.
    const pendingRowQuery = await supabase
      .from("phone_verifications")
      .select("id, phone_e164, status, scan_session_id, lead_id, created_at")
      .eq("phone_e164", phoneE164)
      .eq("status", PENDING_STATUS)
      .eq("scan_session_id", scanSessionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pendingRowQuery.error) {
      console.error(
        "[VERIFY_OTP_PENDING_LOOKUP_FAILED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          db_error_code: pendingRowQuery.error.code ?? null,
          timestamp: new Date().toISOString(),
        }),
      );
      return jsonResponse(500, { error: MSG_SESSION_LINK, verified: false });
    }

    const eligibility = evaluatePendingRowEligibility({
      pendingRow: pendingRowQuery.data as PendingVerificationRow | null,
      phoneE164,
      scanSessionId,
    });

    if (!eligibility.eligible) {
      console.warn(
        "[VERIFY_OTP_PENDING_ROW_REJECTED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          reason: eligibility.reason,
          timestamp: new Date().toISOString(),
        }),
      );
      return jsonResponse(400, { error: MSG_SCAN_MISMATCH, verified: false });
    }

    const pendingRow = eligibility.row;
    const baseObs: OtpObsContext = {
      phoneVerificationId: pendingRow.id,
      scanSessionId,
      leadId: pendingRow.lead_id,
    };

    /**
     * Fail-closed denial for a request that already resolved its pending row.
     * Emits the same lifecycle event shape the pre-A2a guards used so the
     * observability read model keeps seeing these branches.
     */
    const denyWithPendingRow = async (args: {
      status: number;
      message: string;
      reason: string;
      branch: string;
      eventStatus: "blocked" | "failed";
      leadId?: string | null;
      /**
       * `verify_attempt_count` is telemetry only — nothing gates on it. The
       * pre-A2a session-mismatch and integrity guards incremented it, so the
       * equivalent authority-chain denials keep doing so. An indeterminate
       * infrastructure outcome must not (ADR-005 §6.10.4).
       */
      attempt:
        | { count: false }
        | { count: true; channel: VerificationChannel | null };
      twilioErrorCode?: number | null;
    }): Promise<Response> => {
      await logOtpLifecycleEvent(supabase, {
        eventType: "verify_failed",
        eventStatus: args.eventStatus,
        actor: "edge_verify_otp",
        source: "verify-otp",
        context: { ...baseObs, leadId: args.leadId ?? null },
        twilioErrorCode: args.twilioErrorCode ?? null,
        metadata: {
          reason: args.reason,
          branch: args.branch,
          pending_row_source: "scan_bound",
          twilio_error_code: args.twilioErrorCode ?? undefined,
        },
      });

      if (args.attempt.count) {
        await incrementVerifyAttemptObservability(supabase, pendingRow.id, {
          failed: true,
          twilioErrorCode: args.twilioErrorCode ?? null,
          verificationChannel: args.attempt.channel,
        });
      }

      return jsonResponse(args.status, {
        error: args.message,
        verified: false,
      });
    };

    // ── 4. Exact scan session + non-null lead ───────────────────────────
    const scanSessionQuery = await supabase
      .from("scan_sessions")
      .select("id, lead_id")
      .eq("id", scanSessionId)
      .maybeSingle();

    if (scanSessionQuery.error) {
      console.error(
        "[VERIFY_OTP_SCAN_LOOKUP_FAILED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          db_error_code: scanSessionQuery.error.code ?? null,
          timestamp: new Date().toISOString(),
        }),
      );
      return await denyWithPendingRow({
        status: 500,
        message: MSG_SESSION_LINK,
        reason: "scan_lookup_failed",
        branch: "authority_chain",
        eventStatus: "blocked",
        attempt: { count: true, channel: null },
      });
    }

    const leadBinding = evaluateScanLeadBinding({
      pendingRow,
      scanSession: scanSessionQuery.data as ScanSessionLeadRow | null,
    });

    if (!leadBinding.ok) {
      console.error(
        "[VERIFY_OTP_AUTHORITY_CHAIN_REJECTED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          reason: leadBinding.reason,
          timestamp: new Date().toISOString(),
        }),
      );

      // `scan_lead_missing` preserves the pre-A2a integrity-guard response
      // (500 + "could not be linked"). The other two are request-level
      // mismatches and stay 400.
      return await denyWithPendingRow({
        status: leadBinding.reason === "scan_lead_missing" ? 500 : 400,
        message: leadBinding.reason === "scan_lead_missing"
          ? MSG_SESSION_LINK
          : MSG_SCAN_MISMATCH,
        reason: leadBinding.reason,
        branch: "authority_chain",
        eventStatus: "blocked",
        attempt: { count: true, channel: null },
      });
    }

    const resolvedLeadId = leadBinding.leadId;

    // Prefer the persisted phone. Eligibility already proved it equals the
    // normalized request phone, so this is a no-op guard against drift.
    const twilioPhone = pendingRow.phone_e164;

    // ── 5. QA bypass or Twilio — only after the full authority chain ─────
    // The QA bypass can no longer substitute for a pending row, a valid scan,
    // a non-null lead, or lead consistency: all of those already passed above.
    const qaBypassApproved = evaluateOtpQaBypassForVerify({
      phoneE164,
      code,
      scanSessionId,
      env: loadOtpQaBypassEnv(),
    }).approved;

    await logOtpLifecycleEvent(supabase, {
      eventType: "verify_submitted",
      eventStatus: "info",
      actor: "homeowner",
      source: "verify-otp",
      context: { ...baseObs, leadId: resolvedLeadId },
      metadata: {
        pending_row_source: "scan_bound",
        qa_bypass: qaBypassApproved,
        branch: "verify_check",
      },
    });

    if (qaBypassApproved) {
      console.log(
        "[VERIFY_OTP_QA_BYPASS]",
        JSON.stringify({
          approved: true,
          phone_masked: phoneMasked,
          scan_session_id: scanSessionId,
          pending_row_id: pendingRow.id,
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
      const verifySid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

      const twilioBody = new URLSearchParams({ To: twilioPhone, Code: code });

      let twilioRes: Response;
      let twilioData: unknown;
      try {
        twilioRes = await fetchImpl(
          `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`,
          {
            method: "POST",
            headers: {
              Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: twilioBody,
          },
        );

        twilioData = await twilioRes.json();
      } catch (twilioError) {
        // Indeterminate: network failure, timeout, or unparseable body. Never
        // verified, never reported as a wrong code, safely retryable.
        console.error(
          "[VERIFY_OTP_TWILIO_INDETERMINATE]",
          JSON.stringify({
            phone_masked: phoneMasked,
            pending_row_id: pendingRow.id,
            error_name: twilioError instanceof Error
              ? twilioError.name
              : "unknown",
            timestamp: new Date().toISOString(),
          }),
        );
        return await denyWithPendingRow({
          status: 503,
          message: MSG_TWILIO_UNAVAILABLE,
          reason: "twilio_indeterminate",
          branch: "twilio_verify",
          eventStatus: "failed",
          leadId: resolvedLeadId,
          attempt: { count: false },
        });
      }

      const twilioRecord = twilioData as {
        status?: unknown;
        code?: unknown;
      } | null;

      if (!twilioRes.ok || twilioRecord?.status !== "approved") {
        let userMsg = MSG_INVALID_CODE;
        let failureReason = "invalid_code";
        if (twilioRecord?.code === 20404) {
          userMsg = MSG_EXPIRED_SESSION;
          failureReason = "expired_session";
        }

        const twilioErr = safeRedactTwilioError(twilioData);
        return await denyWithPendingRow({
          status: 400,
          message: userMsg,
          reason: failureReason,
          branch: "twilio_verify",
          eventStatus: "failed",
          leadId: resolvedLeadId,
          attempt: { count: true, channel: "twilio_verify" },
          twilioErrorCode: twilioErr.code,
        });
      }
    }

    const verificationChannel: VerificationChannel = qaBypassApproved
      ? "qa_bypass"
      : "twilio_verify";

    const now = nowFn().toISOString();

    // ── 6. Exact-row compare-and-set ────────────────────────────────────
    // Finalize ONLY the row selected above, and only while it is still
    // `pending`. `scan_session_id` is never stamped or changed here.
    const casQuery = await supabase
      .from("phone_verifications")
      .update({
        status: "verified",
        verified_at: now,
        lead_id: resolvedLeadId,
      })
      .eq("id", pendingRow.id)
      .eq("status", PENDING_STATUS)
      .select("id");

    if (casQuery.error) {
      console.error(
        "[VERIFY_OTP_FINALIZE_FAILED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          pending_row_id: pendingRow.id,
          db_error_code: casQuery.error.code ?? null,
          timestamp: new Date().toISOString(),
        }),
      );
      return await denyWithPendingRow({
        status: 500,
        message: MSG_PERSIST_FAILED,
        reason: "verification_finalize_failed",
        branch: "verification_cas",
        eventStatus: "blocked",
        leadId: resolvedLeadId,
        attempt: { count: false },
      });
    }

    const casOutcome = evaluateVerificationCasResult({
      expectedRowId: pendingRow.id,
      data: casQuery.data,
    });

    if (!casOutcome.ok) {
      // Zero rows means a concurrent request already finalized this row. No
      // lead update, no canonical success event, and no verified response.
      console.error(
        "[VERIFY_OTP_FINALIZE_CONFLICT]",
        JSON.stringify({
          phone_masked: phoneMasked,
          pending_row_id: pendingRow.id,
          reason: casOutcome.reason,
          timestamp: new Date().toISOString(),
        }),
      );
      return await denyWithPendingRow({
        status: 500,
        message: MSG_PERSIST_FAILED,
        reason: casOutcome.reason,
        branch: "verification_cas",
        eventStatus: "blocked",
        leadId: resolvedLeadId,
        attempt: { count: false },
      });
    }

    // ── 7. Update ONLY the lead resolved from the exact scan session ─────
    // Both fields are required downstream: `get_analysis_full` checks
    // `leads.phone_verified`, and the CRM handoff trigger reads
    // `leads.phone_verified_at`.
    const leadUpdate = await supabase
      .from("leads")
      .update({
        phone_verified: true,
        phone_e164: twilioPhone,
        phone_verified_at: now,
      })
      .eq("id", resolvedLeadId);

    if (leadUpdate.error) {
      // RESIDUAL A2a NON-ATOMICITY (accepted, documented, not fixed here):
      // the verification row may now be `verified` while the lead remains
      // unverified, because these are two separate non-transactional writes.
      // No compensating reversal is attempted in A2a. This still fails closed
      // for reveal: `get_analysis_full` requires `leads.phone_verified = true`,
      // so no full report is authorized. ADR-005 §6.10 transactional
      // finalization (Phase A2b) is the resolution.
      console.error(
        "[VERIFY_OTP_LEAD_UPDATE_FAILED]",
        JSON.stringify({
          phone_masked: phoneMasked,
          pending_row_id: pendingRow.id,
          db_error_code: leadUpdate.error.code ?? null,
          residual_state: "verification_verified_lead_unverified",
          timestamp: new Date().toISOString(),
        }),
      );
      return await denyWithPendingRow({
        status: 500,
        message: MSG_PERSIST_FAILED,
        reason: "lead_update_failed",
        branch: "lead_finalize",
        eventStatus: "blocked",
        leadId: resolvedLeadId,
        attempt: { count: false },
      });
    }

    // ── 8. Success observability (only after both trusted writes) ────────
    const successObs: OtpObsContext = {
      ...baseObs,
      leadId: resolvedLeadId,
    };

    await logOtpLifecycleEvent(supabase, {
      eventType: "verify_approved",
      eventStatus: "ok",
      actor: "edge_verify_otp",
      source: "verify-otp",
      context: successObs,
      metadata: {
        verification_channel: verificationChannel,
        branch: "verify_approved",
        qa_bypass: qaBypassApproved,
      },
    });
    await incrementVerifyAttemptObservability(supabase, pendingRow.id, {
      failed: false,
      verificationChannel,
    });
    await updatePhoneVerificationObservability(supabase, pendingRow.id, {
      verification_channel: verificationChannel,
    });

    // ── 9. Persist canonical events (phone_verified + report_revealed) ──
    // Both events are persisted server-side AND their event_ids are returned
    // to the browser so the frontend dataLayer push can use the SAME id.
    // This makes the cross-lane (browser → GTM, server → CAPI) dedup work.
    //
    // Event-ID formats are unchanged. `scan_session_id` is now mandatory, so
    // the `_scan-` suffix is always present and neither id is ever null.
    const phoneVerifiedEventId =
      `wmc_phone_verified_lead-${resolvedLeadId}_scan-${scanSessionId}`;
    const reportRevealedEventId =
      `wmc_report_revealed_lead-${resolvedLeadId}_scan-${scanSessionId}`;

    try {
      await persistCanonicalEvent(supabase, {
        eventId: phoneVerifiedEventId,
        eventName: "phone_verified",
        eventTimestamp: now,
        leadId: resolvedLeadId,
        scanSessionId,
        payload: {
          identity: {
            leadId: resolvedLeadId,
            phone: twilioPhone,
            phoneVerifiedAt: now,
          },
          journey: {
            route: "/verify",
            flow: "public",
            scanSessionId,
          },
          source: {
            sourceSystem: "edge_function",
          },
          metadata: {
            verification_channel: verificationChannel,
          },
        },
      });
    } catch (canonicalError) {
      console.error(
        "[verify-otp] phone_verified canonical event failed",
        canonicalError,
      );
    }

    try {
      await persistCanonicalEvent(supabase, {
        eventId: reportRevealedEventId,
        eventName: "report_revealed",
        eventTimestamp: now,
        leadId: resolvedLeadId,
        scanSessionId,
        payload: {
          identity: {
            leadId: resolvedLeadId,
            phone: twilioPhone,
            phoneVerifiedAt: now,
          },
          journey: {
            route: "/verify",
            flow: "public",
            scanSessionId,
          },
          source: {
            sourceSystem: "edge_function",
          },
          metadata: {
            unlock_moment: "otp_verified",
          },
        },
      });
    } catch (canonicalError) {
      console.error(
        "[verify-otp] report_revealed canonical event failed",
        canonicalError,
      );
    }

    // Return canonical phone + canonical event_ids so the frontend can
    // (a) use the server-approved phone and (b) emit dataLayer events with
    // matching ids for downstream Meta/Google dedup.
    return jsonResponse(200, {
      success: true,
      verified: true,
      phone_e164: twilioPhone,
      phone_verified_event_id: phoneVerifiedEventId,
      report_revealed_event_id: reportRevealedEventId,
    });
  } catch (err) {
    console.error("[verify-otp] unhandled exception:", err);
    return jsonResponse(500, { error: MSG_INTERNAL });
  }
}

if (import.meta.main) {
  Deno.serve((request) => handleVerifyOtpRequest(request));
}
