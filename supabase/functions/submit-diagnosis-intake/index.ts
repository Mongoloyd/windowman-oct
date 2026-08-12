/**
 * submit-diagnosis-intake — diagnosis persistence + callback outbox.
 *
 * Service-role writer. No JWT required (frontend invokes with anon key).
 *
 * IDENTITY AUTHORITY (server-derived):
 *   The browser sends scan_session_id + diagnosis_submission_id. Canonical
 *   lead_id is resolved HERE from scan_sessions.lead_id.
 *
 * ELIGIBILITY (fail-closed): same session-bound phone verification as
 * public.get_analysis_full.
 *
 * SUCCESS BOUNDARY: diagnosis_intakes + voice_followups + wm_event_log +
 * wm_platform_dispatch_log (meta). lead_events / funnel update are best-effort.
 */

import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  CALLBACK_CONFLICT_ERROR,
  createSupabaseDiagnosisCallbackDb,
  DIAGNOSIS_CALLBACK_CTA_SOURCE,
  DIAGNOSIS_CALLBACK_INTENT,
  isUniqueViolation,
  queueDiagnosisCallback,
} from "../_shared/queueDiagnosisCallback.ts";
import {
  resolveMarketingConsent,
  createSupabaseMarketingConsentFetcher,
} from "../_shared/resolveMarketingConsent.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";
import { normalizeAndHashIdentity } from "../_shared/tracking/canonical/identity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SubmitBody {
  lead_id?: unknown;
  scan_session_id?: unknown;
  diagnosis_submission_id?: unknown;
  analysis_id?: unknown;
  report_grade?: unknown;
  primary_diagnosis?: unknown;
  secondary_clarifiers?: unknown;
  other_text?: unknown;
  window_intelligence?: unknown;
  counter_offer?: unknown;
  top_insights_snapshot?: unknown;
  confidence?: unknown;
  prescription_path?: unknown;
  attribution_snapshot?: unknown;
}

export const isUuid = (v: unknown): v is string =>
  typeof v === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

const isStr = (v: unknown): v is string =>
  typeof v === "string" && v.trim().length > 0;

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};

export const INVALID_CONTEXT_ERROR = "Invalid report context";
export const NOT_VERIFIED_ERROR = "Report not verified for this session";
export const SUBMISSION_ID_ERROR = "diagnosis_submission_id must be a uuid";
export const INTAKE_CONFLICT_ERROR =
  "Request already bound to a different report";

export interface ScanSessionLeadRow {
  lead_id: string | null;
}

export interface LeadEligibilityRow {
  phone_verified: boolean | null;
  phone_e164?: string | null;
  phone_verified_at?: string | null;
  session_id?: string | null;
  client_slug?: string | null;
  fbp?: string | null;
  fbc?: string | null;
}

export interface DiagnosisLeadFetcher {
  getScanSessionLead(scanSessionId: string): Promise<ScanSessionLeadRow | null>;
  getLeadEligibility(leadId: string): Promise<LeadEligibilityRow | null>;
  hasVerifiedSessionBinding(
    scanSessionId: string,
    leadId: string,
  ): Promise<boolean>;
}

export type DiagnosisLeadResolution =
  | { ok: true; leadId: string; lead: LeadEligibilityRow }
  | { ok: false; status: number; error: string };

export async function resolveDiagnosisLeadAuthority(
  fetcher: DiagnosisLeadFetcher,
  input: { scanSessionId: string; clientLeadId?: string | null },
): Promise<DiagnosisLeadResolution> {
  const scan = await fetcher.getScanSessionLead(input.scanSessionId);
  if (!scan) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  const canonicalLeadId =
    typeof scan.lead_id === "string" && scan.lead_id.length > 0
      ? scan.lead_id
      : null;
  if (!canonicalLeadId) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  if (
    input.clientLeadId !== undefined &&
    input.clientLeadId !== null &&
    input.clientLeadId !== canonicalLeadId
  ) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }

  const lead = await fetcher.getLeadEligibility(canonicalLeadId);
  if (!lead) {
    return { ok: false, status: 400, error: INVALID_CONTEXT_ERROR };
  }
  if (lead.phone_verified !== true) {
    return { ok: false, status: 403, error: NOT_VERIFIED_ERROR };
  }

  const bound = await fetcher.hasVerifiedSessionBinding(
    input.scanSessionId,
    canonicalLeadId,
  );
  if (!bound) {
    return { ok: false, status: 403, error: NOT_VERIFIED_ERROR };
  }

  return { ok: true, leadId: canonicalLeadId, lead };
}

export function sanitizeEventIdSegment(value: unknown): string {
  if (value === null || value === undefined) return "unknown";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

export function buildCallbackRequestedEventId(input: {
  leadId: string;
  scanSessionId: string;
}): string {
  return `wmc_callback_requested_lead-${
    sanitizeEventIdSegment(input.leadId)
  }_scan-${sanitizeEventIdSegment(input.scanSessionId)}`;
}

export function buildSuccessBody(input: {
  eventId: string;
  diagnosisIntakeId: string;
  voiceFollowupId: string;
  reused: boolean;
  metaDispatchStatus: "pending" | "suppressed";
}): {
  success: true;
  event_id: string;
  diagnosis_intake_id: string;
  voice_followup_id: string;
  reused: boolean;
  meta_dispatch_status: "pending" | "suppressed";
} {
  return {
    success: true,
    event_id: input.eventId,
    diagnosis_intake_id: input.diagnosisIntakeId,
    voice_followup_id: input.voiceFollowupId,
    reused: input.reused,
    meta_dispatch_status: input.metaDispatchStatus,
  };
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function createSupabaseLeadFetcher(
  supabase: SupabaseClient,
): DiagnosisLeadFetcher {
  return {
    async getScanSessionLead(scanSessionId) {
      const { data, error } = await supabase
        .from("scan_sessions")
        .select("id, lead_id")
        .eq("id", scanSessionId)
        .maybeSingle();
      if (error) throw error;
      return data ? { lead_id: data.lead_id as string | null } : null;
    },
    async getLeadEligibility(leadId) {
      const { data, error } = await supabase
        .from("leads")
        .select(
          "id, phone_verified, phone_e164, phone_verified_at, session_id, client_slug, fbp, fbc",
        )
        .eq("id", leadId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        phone_verified: data.phone_verified as boolean | null,
        phone_e164: data.phone_e164 as string | null,
        phone_verified_at: data.phone_verified_at as string | null,
        session_id: data.session_id as string | null,
        client_slug: data.client_slug as string | null,
        fbp: data.fbp as string | null,
        fbc: data.fbc as string | null,
      };
    },
    async hasVerifiedSessionBinding(scanSessionId, leadId) {
      const { data, error } = await supabase
        .from("phone_verifications")
        .select("id")
        .eq("scan_session_id", scanSessionId)
        .eq("lead_id", leadId)
        .eq("status", "verified")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
  };
}

type IntakeRow = {
  id: string;
  lead_id: string;
  scan_session_id: string;
};

async function persistDiagnosisIntake(
  supabase: SupabaseClient,
  input: {
    diagnosisSubmissionId: string;
    leadId: string;
    scanSessionId: string;
    analysisId: string | null;
    reportGrade: string;
    primaryDiagnosis: string;
    secondaryClarifiers: Record<string, unknown>;
    otherText: string | null;
    windowIntelligence: Record<string, unknown>;
    counterOffer: Record<string, unknown>;
    topInsightsSnapshot: Record<string, unknown>;
    confidence: string | null;
    prescriptionPath: string | null;
    attributionSnapshot: Record<string, unknown>;
  },
): Promise<
  | { ok: true; intake: IntakeRow; reused: boolean }
  | { ok: false; status: number; error: string }
> {
  const { data: existing, error: existingErr } = await supabase
    .from("diagnosis_intakes")
    .select("id, lead_id, scan_session_id")
    .eq("diagnosis_submission_id", input.diagnosisSubmissionId)
    .maybeSingle();
  if (existingErr) {
    console.error("[submit-diagnosis-intake] intake lookup failed:", existingErr);
    return { ok: false, status: 500, error: "Failed to submit diagnosis" };
  }
  if (existing) {
    if (
      existing.lead_id !== input.leadId ||
      existing.scan_session_id !== input.scanSessionId
    ) {
      return { ok: false, status: 409, error: INTAKE_CONFLICT_ERROR };
    }
    return {
      ok: true,
      reused: true,
      intake: {
        id: existing.id as string,
        lead_id: existing.lead_id as string,
        scan_session_id: existing.scan_session_id as string,
      },
    };
  }

  const { data: inserted, error: insertErr } = await supabase
    .from("diagnosis_intakes")
    .insert({
      lead_id: input.leadId,
      scan_session_id: input.scanSessionId,
      diagnosis_submission_id: input.diagnosisSubmissionId,
      analysis_id: input.analysisId,
      report_grade: input.reportGrade,
      source: "post_report_diagnostic_intake",
      primary_diagnosis: input.primaryDiagnosis,
      secondary_clarifiers: input.secondaryClarifiers,
      other_text: input.otherText,
      window_intelligence: input.windowIntelligence,
      counter_offer: input.counterOffer,
      top_insights_snapshot: input.topInsightsSnapshot,
      confidence: input.confidence,
      prescription_path: input.prescriptionPath,
      attribution_snapshot: input.attributionSnapshot,
      status: "completed",
    })
    .select("id, lead_id, scan_session_id")
    .single();

  if (insertErr) {
    if (isUniqueViolation(insertErr)) {
      const { data: winner, error: winnerErr } = await supabase
        .from("diagnosis_intakes")
        .select("id, lead_id, scan_session_id")
        .eq("diagnosis_submission_id", input.diagnosisSubmissionId)
        .maybeSingle();
      if (winnerErr || !winner) {
        console.error(
          "[submit-diagnosis-intake] intake unique recovery failed:",
          winnerErr,
        );
        return { ok: false, status: 500, error: "Failed to submit diagnosis" };
      }
      if (
        winner.lead_id !== input.leadId ||
        winner.scan_session_id !== input.scanSessionId
      ) {
        return { ok: false, status: 409, error: INTAKE_CONFLICT_ERROR };
      }
      return {
        ok: true,
        reused: true,
        intake: {
          id: winner.id as string,
          lead_id: winner.lead_id as string,
          scan_session_id: winner.scan_session_id as string,
        },
      };
    }
    console.error("[submit-diagnosis-intake] insert intake failed:", insertErr);
    return { ok: false, status: 500, error: "Failed to submit diagnosis" };
  }

  if (!inserted) {
    return { ok: false, status: 500, error: "Failed to submit diagnosis" };
  }

  return {
    ok: true,
    reused: false,
    intake: {
      id: inserted.id as string,
      lead_id: inserted.lead_id as string,
      scan_session_id: inserted.scan_session_id as string,
    },
  };
}

async function maybeInsertLegacyLeadEvent(
  supabase: SupabaseClient,
  input: {
    leadId: string;
    scanSessionId: string;
    analysisId: string | null;
    diagnosisIntakeId: string;
    primaryDiagnosis: string;
    prescriptionPath: string | null;
    confidence: string | null;
    reportGrade: string;
    skip: boolean;
  },
): Promise<void> {
  if (input.skip) return;
  try {
    const { error } = await supabase.from("lead_events").insert({
      lead_id: input.leadId,
      scan_session_id: input.scanSessionId,
      analysis_id: input.analysisId,
      event_name: "diagnosis_completed",
      event_source: "submit-diagnosis-intake",
      status: "completed",
      metadata: {
        diagnosis_intake_id: input.diagnosisIntakeId,
        primary_diagnosis: input.primaryDiagnosis,
        prescription_path: input.prescriptionPath,
        confidence: input.confidence,
        report_grade: input.reportGrade,
      },
    });
    if (error) {
      console.warn(
        "[submit-diagnosis-intake] lead_events insert failed:",
        error,
      );
    }
  } catch (error) {
    console.warn("[submit-diagnosis-intake] lead_events insert threw:", error);
  }
}

async function maybeUpdateLeadFunnel(
  supabase: SupabaseClient,
  leadId: string,
  skip: boolean,
): Promise<void> {
  if (skip) return;
  const { error } = await supabase
    .from("leads")
    .update({
      funnel_stage: "diagnosis_completed",
      diagnosis_completed_at: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) {
    console.warn(
      "[submit-diagnosis-intake] leads funnel update failed:",
      error,
    );
  }
}

async function fireCallbackWebhookOnce(
  input: {
    followupId: string;
    diagnosisSubmissionId: string;
    scanSessionId: string;
    leadId: string;
    phoneE164: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const webhookUrl = Deno.env.get("PHONECALL_BOT_WEBHOOK_URL");
  if (!webhookUrl) {
    console.log(
      "[submit-diagnosis-intake] PHONECALL_BOT_WEBHOOK_URL not set — skipping",
    );
    return;
  }
  try {
    const resp = await fetchImpl(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: input.phoneE164,
        info: {
          lead_id: input.leadId,
          scan_session_id: input.scanSessionId,
          followup_id: input.followupId,
          diagnosis_submission_id: input.diagnosisSubmissionId,
          call_intent: DIAGNOSIS_CALLBACK_INTENT,
          cta_source: DIAGNOSIS_CALLBACK_CTA_SOURCE,
        },
      }),
    });
    await resp.text();
    if (!resp.ok) {
      console.error(
        "[submit-diagnosis-intake] webhook non-OK status:",
        resp.status,
      );
    }
  } catch {
    // Fetch errors can embed the full webhook URL, including secret-bearing
    // query parameters. Keep logs useful without serializing the raw error.
    console.error("[submit-diagnosis-intake] webhook request failed");
  }
}

type PublicMetaDispatchStatus = "pending" | "suppressed";

type CallbackEventState = {
  eventExists: boolean;
  metaDispatchStatus: PublicMetaDispatchStatus | null;
};

const META_DISPATCH_STATUSES = new Set([
  "not_applicable",
  "pending",
  "processing",
  "sent",
  "suppressed",
  "dead_letter",
  "dispatched",
  "blocked",
  "failed",
]);

function toPublicMetaDispatchStatus(
  status: unknown,
): PublicMetaDispatchStatus | null {
  if (status === "pending") return "pending";
  if (typeof status === "string" && META_DISPATCH_STATUSES.has(status)) {
    // The public response predates the worker's full status set. Map every
    // claimed or terminal row to the safe non-pending state without mutating
    // the authoritative outbox row or implying that it was re-enqueued.
    return "suppressed";
  }
  return null;
}

async function readCallbackEventState(
  supabase: SupabaseClient,
  eventId: string,
  leadId: string,
  scanSessionId: string,
): Promise<CallbackEventState | null> {
  const { data: eventRow, error: eventErr } = await supabase
    .from("wm_event_log")
    .select("id,event_name,lead_id,scan_session_id")
    .eq("event_id", eventId)
    .maybeSingle();
  if (eventErr) return null;
  if (!eventRow?.id) {
    return { eventExists: false, metaDispatchStatus: null };
  }
  if (
    eventRow.event_name !== "callback_requested" ||
    eventRow.lead_id !== leadId ||
    eventRow.scan_session_id !== scanSessionId
  ) {
    return null;
  }

  const { data: dispatchRow, error: dispatchErr } = await supabase
    .from("wm_platform_dispatch_log")
    .select("dispatch_status")
    .eq("event_log_id", eventRow.id as string)
    .eq("platform_name", "meta")
    .maybeSingle();
  if (dispatchErr) return null;
  if (!dispatchRow) {
    return { eventExists: true, metaDispatchStatus: null };
  }

  const metaDispatchStatus = toPublicMetaDispatchStatus(
    dispatchRow.dispatch_status,
  );
  if (!metaDispatchStatus) return null;
  return { eventExists: true, metaDispatchStatus };
}

export type SubmitDiagnosisDeps = {
  supabase?: SupabaseClient;
  fetchImpl?: typeof fetch;
};

export async function handleRequest(
  req: Request,
  deps: SubmitDiagnosisDeps = {},
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body: SubmitBody;
  try {
    body = (await req.json()) as SubmitBody;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  if (!isUuid(body.scan_session_id)) {
    return jsonResponse({ error: "scan_session_id must be a uuid" }, 400);
  }
  if (!isUuid(body.diagnosis_submission_id)) {
    return jsonResponse({ error: SUBMISSION_ID_ERROR }, 400);
  }
  if (
    body.lead_id !== undefined && body.lead_id !== null &&
    !isUuid(body.lead_id)
  ) {
    return jsonResponse({ error: "lead_id must be a uuid when provided" }, 400);
  }
  if (
    body.analysis_id !== undefined && body.analysis_id !== null &&
    !isUuid(body.analysis_id)
  ) {
    return jsonResponse(
      { error: "analysis_id must be a uuid when provided" },
      400,
    );
  }
  if (!isStr(body.report_grade)) {
    return jsonResponse({ error: "report_grade is required" }, 400);
  }
  if (!isStr(body.primary_diagnosis)) {
    return jsonResponse({ error: "primary_diagnosis is required" }, 400);
  }

  const supabase = deps.supabase ??
    createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

  const scan_session_id = body.scan_session_id as string;
  const diagnosis_submission_id = body.diagnosis_submission_id as string;
  const client_lead_id = isUuid(body.lead_id) ? (body.lead_id as string) : null;
  const analysis_id = isUuid(body.analysis_id)
    ? (body.analysis_id as string)
    : null;

  let lead_id: string;
  let lead: LeadEligibilityRow;
  try {
    const resolution = await resolveDiagnosisLeadAuthority(
      createSupabaseLeadFetcher(supabase),
      { scanSessionId: scan_session_id, clientLeadId: client_lead_id },
    );
    if (!resolution.ok) {
      return jsonResponse({ error: resolution.error }, resolution.status);
    }
    lead_id = resolution.leadId;
    lead = resolution.lead;
  } catch (e) {
    console.error(
      "[submit-diagnosis-intake] lead-authority resolution threw:",
      e,
    );
    return jsonResponse({ error: "Failed to validate report context" }, 500);
  }

  const phone_e164 = typeof lead.phone_e164 === "string" &&
      lead.phone_e164.trim().length > 0
    ? lead.phone_e164.trim()
    : null;
  if (!phone_e164) {
    return jsonResponse({ error: INVALID_CONTEXT_ERROR }, 400);
  }

  if (analysis_id) {
    try {
      const { data: analysisRow, error: analysisErr } = await supabase
        .from("analyses")
        .select("id, scan_session_id")
        .eq("id", analysis_id)
        .maybeSingle();
      if (analysisErr) {
        console.error(
          "[submit-diagnosis-intake] analysis lookup failed:",
          analysisErr,
        );
        return jsonResponse({ error: "Failed to validate report context" }, 500);
      }
      if (!analysisRow || analysisRow.scan_session_id !== scan_session_id) {
        return jsonResponse({ error: INVALID_CONTEXT_ERROR }, 400);
      }
    } catch (e) {
      console.error("[submit-diagnosis-intake] analysis validation threw:", e);
      return jsonResponse({ error: "Failed to validate report context" }, 500);
    }
  }

  const report_grade = (body.report_grade as string).trim();
  const primary_diagnosis = (body.primary_diagnosis as string).trim();
  const other_text = isStr(body.other_text)
    ? (body.other_text as string).trim()
    : null;
  const confidence = isStr(body.confidence)
    ? (body.confidence as string).trim()
    : null;
  const prescription_path = isStr(body.prescription_path)
    ? (body.prescription_path as string).trim()
    : null;

  try {
    const intakeResult = await persistDiagnosisIntake(supabase, {
      diagnosisSubmissionId: diagnosis_submission_id,
      leadId: lead_id,
      scanSessionId: scan_session_id,
      analysisId: analysis_id,
      reportGrade: report_grade,
      primaryDiagnosis: primary_diagnosis,
      secondaryClarifiers: asObj(body.secondary_clarifiers),
      otherText: other_text,
      windowIntelligence: asObj(body.window_intelligence),
      counterOffer: asObj(body.counter_offer),
      topInsightsSnapshot: asObj(body.top_insights_snapshot),
      confidence,
      prescriptionPath: prescription_path,
      attributionSnapshot: asObj(body.attribution_snapshot),
    });
    if (!intakeResult.ok) {
      return jsonResponse({ error: intakeResult.error }, intakeResult.status);
    }

    const callbackResult = await queueDiagnosisCallback(
      createSupabaseDiagnosisCallbackDb(supabase as never),
      {
        leadId: lead_id,
        scanSessionId: scan_session_id,
        diagnosisSubmissionId: diagnosis_submission_id,
        phoneE164: phone_e164,
      },
    );
    if (!callbackResult.ok) {
      const error = callbackResult.status === 409
        ? CALLBACK_CONFLICT_ERROR
        : callbackResult.error;
      return jsonResponse({ error }, callbackResult.status);
    }

    if (!callbackResult.reused) {
      await fireCallbackWebhookOnce({
        followupId: callbackResult.followup_id,
        diagnosisSubmissionId: diagnosis_submission_id,
        scanSessionId: scan_session_id,
        leadId: lead_id,
        phoneE164: phone_e164,
      }, deps.fetchImpl ?? fetch);
    }

    const eventId = buildCallbackRequestedEventId({
      leadId: lead_id,
      scanSessionId: scan_session_id,
    });
    let callbackEventState = await readCallbackEventState(
      supabase,
      eventId,
      lead_id,
      scan_session_id,
    );
    if (!callbackEventState) {
      console.error(
        "[submit-diagnosis-intake] canonical callback lookup failed",
      );
      return jsonResponse({ error: "Failed to submit diagnosis" }, 500);
    }

    if (!callbackEventState.metaDispatchStatus) {
      const consent = await resolveMarketingConsent(
        createSupabaseMarketingConsentFetcher(supabase as never),
        lead_id,
      );
      const hashedIdentity = await normalizeAndHashIdentity({
        phone: phone_e164,
      });

      try {
        await persistCanonicalEvent(supabase as never, {
          eventId,
          eventName: "callback_requested",
          leadId: lead_id,
          scanSessionId: scan_session_id,
          analysisId: analysis_id ?? undefined,
          clientSlug: lead.client_slug ?? undefined,
          dispatchPolicy: {
            allowedPlatforms: ["meta"],
            metaConsent: consent.state,
            metaSuppressionReason: consent.suppressionReason ?? undefined,
          },
          payload: {
            identity: {
              leadId: lead_id,
              phoneHash: hashedIdentity.phoneHash,
              phoneVerifiedAt: lead.phone_verified_at ?? undefined,
              fbp: lead.fbp ?? undefined,
              fbc: lead.fbc ?? undefined,
            },
            journey: {
              route: "/diagnosis",
              flow: "public",
              sessionId: lead.session_id ?? undefined,
              scanSessionId: scan_session_id,
            },
            source: { sourceSystem: "edge_function" },
            metadata: {
              diagnosis_intake_id: intakeResult.intake.id,
              voice_followup_id: callbackResult.followup_id,
              diagnosis_submission_id,
              call_intent: DIAGNOSIS_CALLBACK_INTENT,
              cta_source: DIAGNOSIS_CALLBACK_CTA_SOURCE,
              consent_state: consent.state,
            },
          },
          rawPayload: {},
        });
      } catch (error) {
        console.error(
          "[submit-diagnosis-intake] canonical event persist failed:",
          error,
        );
        return jsonResponse({ error: "Failed to submit diagnosis" }, 500);
      }

      callbackEventState = await readCallbackEventState(
        supabase,
        eventId,
        lead_id,
        scan_session_id,
      );
      if (!callbackEventState?.metaDispatchStatus) {
        console.error(
          "[submit-diagnosis-intake] meta outbox row missing after persist",
        );
        return jsonResponse({ error: "Failed to submit diagnosis" }, 500);
      }
    }

    const metaDispatchStatus = callbackEventState.metaDispatchStatus;

    await maybeInsertLegacyLeadEvent(supabase, {
      leadId: lead_id,
      scanSessionId: scan_session_id,
      analysisId: analysis_id,
      diagnosisIntakeId: intakeResult.intake.id,
      primaryDiagnosis: primary_diagnosis,
      prescriptionPath: prescription_path,
      confidence,
      reportGrade: report_grade,
      skip: intakeResult.reused,
    });
    await maybeUpdateLeadFunnel(supabase, lead_id, intakeResult.reused);

    return jsonResponse(
      buildSuccessBody({
        eventId,
        diagnosisIntakeId: intakeResult.intake.id,
        voiceFollowupId: callbackResult.followup_id,
        reused: callbackResult.reused,
        metaDispatchStatus,
      }),
      200,
    );
  } catch (e) {
    console.error("[submit-diagnosis-intake] unhandled error:", e);
    return jsonResponse({ error: "Failed to submit diagnosis" }, 500);
  }
}

if (import.meta.main) {
  Deno.serve((req) => handleRequest(req));
}
