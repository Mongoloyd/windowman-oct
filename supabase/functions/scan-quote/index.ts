// ═══════════════════════════════════════════════════════════════════════════════
// SCANNER BRAIN — scan-quote Edge Function
// Orchestrates: file download → Gemini extraction → Zod validation →
//               deterministic scoring → analyses upsert
// Uses: Direct Gemini API via GEMINI_API_KEY
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { computeDerivedMetrics } from "../_shared/metrics.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";
import {
  buildGeminiUrl,
  getScannerRuntimeConfig,
} from "../_shared/scannerConfig.ts";
import {
  extractParseErrorMeta,
  isGeminiOutputTruncated,
  normalizeGeminiJsonText,
} from "../_shared/geminiJson.ts";
import {
  logScanError,
  logScanInfo,
  logScanWarn,
} from "../_shared/scannerLogger.ts";
import { parseScanQuoteRequest } from "./requestSchema.ts";
import { decideSessionRecovery } from "./sessionRecovery.ts";
import {
  buildPreviewPillarScores,
  // deno-lint-ignore no-unused-vars
  clamp,
  computeGrade,
  type ExtractionResult,
  // deno-lint-ignore no-unused-vars
  GRADE_RANK,
  // deno-lint-ignore no-unused-vars
  GRADE_THRESHOLDS,
  // deno-lint-ignore no-unused-vars
  type GradeResult,
  // deno-lint-ignore no-unused-vars
  letterGrade,
  type LineItem,
  // deno-lint-ignore no-unused-vars
  PILLAR_WEIGHTS,
  // deno-lint-ignore no-unused-vars
  type PillarScores,
  // deno-lint-ignore no-unused-vars
  type PreviewPillarScores,
  // deno-lint-ignore no-unused-vars
  type PreviewPillarStatus,
  RUBRIC_VERSION,
  // deno-lint-ignore no-unused-vars
  scoreFinePrint,
  // deno-lint-ignore no-unused-vars
  scoreInstall,
  // deno-lint-ignore no-unused-vars
  scorePrice,
  // deno-lint-ignore no-unused-vars
  scoreSafety,
  // deno-lint-ignore no-unused-vars
  scoreWarranty,
  // deno-lint-ignore no-unused-vars
  toPreviewPillarStatus,
} from "./scoring.ts";
import { compileReportOutput } from "./reportCompiler.ts";
// deno-lint-ignore no-unused-vars
import { detectFlags, type Flag } from "./flagging.ts";
import {
  classifyScanGate,
  type NormalizedClassification,
  normalizeClassification,
  type RejectReason,
} from "./classificationGate.ts";

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: CLASSIFICATION-GATE HANDLER GLUE
//
// Pure normalization + fail-closed decision logic lives in ./classificationGate.ts
// (unit-tested under ../tests/scan-quote/). This section only contains the
// DB/side-effecting glue that runs the decision.
// ═══════════════════════════════════════════════════════════════════════════════

function coerceParsedForExtraction(
  parsed: unknown,
  norm: NormalizedClassification,
): unknown {
  if (!parsed || typeof parsed !== "object") return parsed;
  return {
    ...(parsed as Record<string, unknown>),
    is_window_door_related: norm.related,
    confidence: norm.confidence,
    document_type: norm.documentType ??
      (typeof (parsed as Record<string, unknown>).document_type === "string"
        ? (parsed as Record<string, unknown>).document_type
        : "unknown"),
  };
}

type TerminateScanArgs = {
  supabase: SupabaseClient;
  scanSessionId: string;
  leadId: string | null;
  analysisStatus: "invalid_document" | "needs_better_upload";
  sessionStatus: "invalid_document" | "needs_better_upload";
  rejectReason: RejectReason;
  reason: string;
  norm: NormalizedClassification;
};

async function terminateScan(
  args: TerminateScanArgs,
): Promise<Response> {
  const {
    supabase,
    scanSessionId,
    leadId,
    analysisStatus,
    sessionStatus,
    rejectReason,
    reason,
    norm,
  } = args;

  logScanInfo("classification", {
    scan_session_id: scanSessionId,
    reject_reason: rejectReason,
    analysis_status: analysisStatus,
    session_status: sessionStatus,
    related: norm.related,
    confidence: norm.confidence,
    line_item_count: norm.lineItemCount,
  });

  const analysisPayload: Record<string, unknown> = {
    scan_session_id: scanSessionId,
    lead_id: leadId,
    analysis_status: analysisStatus,
    document_is_window_door_related: norm.related,
    document_type: norm.documentType ?? "unknown",
    confidence_score: norm.confidence,
    rubric_version: RUBRIC_VERSION,
  };

  const analysisUpsert = await upsertAnalysisRecord(
    supabase,
    analysisPayload,
    "analyses upsert failed on classification gate",
    {
      error: "Failed to persist analysis state",
      scan_session_id: scanSessionId,
      analysis_status: "processing",
      scan_session_status: "processing",
    },
  );
  if (!analysisUpsert.success) {
    return analysisUpsert.response;
  }

  const statusUpdate = await updateScanSessionStatus(
    supabase,
    scanSessionId,
    sessionStatus,
    `scan_sessions ${sessionStatus} update failed on classification gate`,
    {
      error: "Failed to persist scan session state",
      scan_session_id: scanSessionId,
      analysis_status: analysisStatus,
      scan_session_status: "processing",
    },
  );
  if (!statusUpdate.success) {
    return statusUpdate.response;
  }

  const body: Record<string, unknown> = {
    scan_session_id: scanSessionId,
    analysis_status: analysisStatus,
    scan_session_status: sessionStatus,
    reject_reason: rejectReason,
    reason,
  };
  if (norm.confidence !== null) {
    body.confidence = norm.confidence;
  }

  return jsonResponse(body, 200);
}

/**
 * Full extraction validation: ensures line_items and detailed fields are present.
 * Only called AFTER document is confirmed as window/door related.
 */
function validateExtraction(
  raw: unknown,
): { success: true; data: ExtractionResult } | {
  success: false;
  error: string;
} {
  if (!raw || typeof raw !== "object") {
    return { success: false, error: "Not an object" };
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.document_type !== "string") {
    return { success: false, error: "Missing document_type" };
  }
  if (typeof obj.is_window_door_related !== "boolean") {
    return { success: false, error: "Missing is_window_door_related" };
  }
  if (
    typeof obj.confidence !== "number" || obj.confidence < 0 ||
    obj.confidence > 1
  ) return { success: false, error: "Invalid confidence" };
  if (!Array.isArray(obj.line_items)) {
    return { success: false, error: "Missing line_items array" };
  }

  for (const item of obj.line_items) {
    if (
      !item || typeof item !== "object" ||
      typeof (item as Record<string, unknown>).description !== "string"
    ) {
      return { success: false, error: "Invalid line_item" };
    }
  }

  return { success: true, data: raw as ExtractionResult };
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: FORENSIC (red flag detection) — imported from ./flagging.ts
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4b: DERIVED FINANCIAL METRICS — canonical implementation in _shared/metrics.ts
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: ORCHESTRATION (HTTP handler)
type ScanSessionStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "preview_ready"
  | "complete"
  | "invalid_document"
  | "needs_better_upload"
  | "error";
// ═══════════════════════════════════════════════════════════════════════════════

// CRASH RECOVERY:
// If this function crashes after setting status='processing', the session
// stays in 'processing' with no analyses row. A recovery sweep can detect
// sessions stuck in 'processing' for >N minutes and re-invoke this function.
// The upsert pattern on analyses ensures re-invocation is safe (idempotent).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export async function updateScanSessionStatus(
  supabase: SupabaseClient,
  scanSessionId: string,
  status: ScanSessionStatus,
  logMessage: string,
  failureBody?: Record<string, unknown>,
): Promise<{ success: true } | { success: false; response: Response }> {
  const { data, error } = await supabase
    .from("scan_sessions")
    .update({ status })
    .eq("id", scanSessionId)
    .select("id");

  if (error) {
    console.error(logMessage, error);
    return {
      success: false,
      response: jsonResponse(
        failureBody ?? {
          error: "Failed to persist scan session state",
          scan_session_id: scanSessionId,
        },
        500,
      ),
    };
  }

  if (!data || data.length === 0) {
    console.error(
      `${logMessage} — no scan_sessions row updated for id=${scanSessionId}`,
    );
    return {
      success: false,
      response: jsonResponse(
        failureBody ?? {
          error: "Failed to persist scan session state",
          scan_session_id: scanSessionId,
          analysis_status: "processing",
          scan_session_status: "processing",
        },
        500,
      ),
    };
  }

  return { success: true };
}

export async function upsertAnalysisRecord(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  logMessage: string,
  failureBody: Record<string, unknown>,
  status = 500,
): Promise<
  { success: true; analysisId: string | null } | {
    success: false;
    response: Response;
  }
> {
  const { data, error } = await supabase
    .from("analyses")
    .upsert(payload, { onConflict: "scan_session_id" })
    .select("id");

  if (error) {
    console.error(logMessage, error);
    return {
      success: false,
      response: jsonResponse(failureBody, status),
    };
  }

  const analysisId = data?.[0]?.id ?? null;
  return { success: true, analysisId };
}

function mimeFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    heic: "image/heic",
  };
  return map[ext] || "application/octet-stream";
}

const GEMINI_EXTRACTION_PROMPT =
  `You are a forensic document extraction engine for impact window and door quotes.

Analyze the uploaded document and extract ALL structured data into the JSON schema below.

═══════════════════════════════════════════════════════════════════════════════
EXTRACTION RULES
═══════════════════════════════════════════════════════════════════════════════

Rules:
- Set is_window_door_related to true ONLY if this is an impact window, impact door, or hurricane fenestration quote/proposal.
- Set confidence between 0.0 and 1.0 based on how readable and complete the document is.
- Extract every line item you can identify (windows, doors, panels, screens, etc.)
- For each line item, extract brand, series, DP rating, NOA number, dimensions, quantity, unit price, and total price where visible.
- Extract warranty, permit, installation, and cancellation details if present.
- If a field is not explicitly stated in the document, return the key with a literal JSON null value. Do not guess, infer, fabricate, or omit the key.
- Extract payment facts exactly as stated in the document: deposit_percent, deposit_amount, payment_schedule_text, final_payment_before_inspection, subject_to_remeasure_present, and subject_to_remeasure_text. Do not label deposits excessive. Do not call payment terms predatory. Do not determine severity.
- Detect scope gaps such as missing wall repair, debris removal, engineering, or permit fee clarity.
- Detect generic product descriptions that do not clearly identify the manufacturer/series.
- Extract the contractor address if shown.
- Do not infer compliance from branding alone. Only mark fields true when supported by visible document language.
- Extract opening-by-opening schedule details when visible, including room/location, dimensions, and product assignment.
- Extract glass package details for each opening when visible, including whether glass appears to be Low-E, Argon-filled, monolithic laminated, or insulated laminated.
- Detect blanket glass language such as "impact glass throughout" when opening-level glass detail is missing.
- Detect change-order rules, especially whether written homeowner approval is required before extra charges for hidden rot, bad bucks, or substrate conditions.
- Detect whether the quote gives the contractor unilateral price-adjustment power.
- Extract any unit pricing or allowances for hidden rot, substrate damage, or buck replacement.
- Extract installation method specifics including anchoring method, fastener/anchor spacing, waterproofing/sealant method, buck treatment, and any statement that installation follows manufacturer instructions or local code.
- Extract warranty execution details, including who performs service, leak callback timelines, callback process, and exclusions for stucco, paint, or water intrusion.
- If the quote does not say something explicitly, leave the field null. Do not infer premium glass features or approval mechanics from branding alone.

hvhz_zone:
- Set true only if the document explicitly references HVHZ, High-Velocity Hurricane Zone, Miami-Dade, Broward HVHZ, or equivalent high-velocity wind zone/code language.
- Return null if not explicitly stated. Do not infer HVHZ from project location alone.

insurance_proof_mentioned:
- Set true only if the document explicitly mentions or attaches Certificate of Insurance, COI, liability insurance, general liability insurance, workers compensation proof, or proof of insurance.
- Return null if not explicitly stated. Do not infer insurance status from contractor name, logo, or general professionalism.

licensing_proof_mentioned:
- Set true only if the document explicitly shows a Florida contractor license number, license credential, license ID, explicit licensing proof, or "licensed and insured" with license detail.
- Return null if not explicitly stated. Do not infer licensing from contractor name, logo, or general professionalism.

glass_spec_complete (per relevant line item):
- Set true only when the document explicitly includes glass makeup/type (laminated, insulated, monolithic, impact laminated, or equivalent) AND at least one specific performance/detail feature (Low-E, argon, tint, thickness, glass package, or equivalent).
- Set false when glass is mentioned but the specification is incomplete.
- Return null when no glass detail is present. Do not infer glass package completeness from product type alone.

dimensions (per line item):
- Extract dimensions exactly as printed, including units where present (examples: 36" x 60", 3 ft x 5 ft, 914mm x 1524mm, or 36 x 60 if that is exactly what the quote prints).
- Do not normalize units. Do not invent missing units. Do not convert dimensions.
- If dimensions are printed without units, preserve the raw printed dimension text. Do not null it solely because units are missing.
- Return null only if no dimensions are shown.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "document_type": "string",
  "is_window_door_related": boolean,
  "confidence": number,
  "page_count": number | null,
  "contractor_name": "string | null",
  "opening_count": number | null,
  "total_quoted_price": number | null,
  "hvhz_zone": boolean | null,
  "cancellation_policy": "string | null",
  "subject_to_remeasure_present": "boolean | null",
  "subject_to_remeasure_text": "string | null",
  "deposit_percent": "number | null",
  "deposit_amount": "number | null",
  "final_payment_before_inspection": "boolean | null",
  "payment_schedule_text": "string | null",
  "terms_conditions_present": "boolean | null",
  "wall_repair_scope": "string | null",
  "stucco_repair_included": "boolean | null",
  "drywall_repair_included": "boolean | null",
  "paint_touchup_included": "boolean | null",
  "debris_removal_included": "boolean | null",
  "engineering_mentioned": "boolean | null",
  "engineering_fees_included": "boolean | null",
  "permit_fees_itemized": "boolean | null",
  "insurance_proof_mentioned": "boolean | null",
  "licensing_proof_mentioned": "boolean | null",
  "completion_timeline_text": "string | null",
  "lead_paint_disclosure_present": "boolean | null",
  "generic_product_description_present": "boolean | null",
  "contractor_address_text": "string | null",
  "opening_level_glass_specs_present": boolean | null,
  "blanket_glass_language_present": boolean | null,
  "mixed_glass_package_visibility": boolean | null,
  "opening_schedule_present": boolean | null,
  "opening_schedule_room_labels_present": boolean | null,
  "opening_schedule_dimensions_complete": boolean | null,
  "opening_schedule_product_assignments_present": boolean | null,
  "bulk_scope_blob_present": boolean | null,
  "change_order_policy_text": "string | null",
  "written_change_order_required": boolean | null,
  "homeowner_approval_required_for_change_orders": boolean | null,
  "unilateral_price_adjustment_allowed": boolean | null,
  "substrate_condition_clause_present": boolean | null,
  "rot_unit_pricing_present": boolean | null,
  "buck_replacement_unit_pricing_present": boolean | null,
  "substrate_allowance_text": "string | null",
  "remeasure_price_adjustment_cap_present": boolean | null,
  "anchoring_method_text": "string | null",
  "anchor_spacing_specified": boolean | null,
  "fastener_type_specified": boolean | null,
  "waterproofing_method_text": "string | null",
  "sealant_specified": boolean | null,
  "buck_treatment_method_text": "string | null",
  "manufacturer_install_compliance_stated": boolean | null,
  "code_compliance_install_statement_present": boolean | null,
  "warranty_execution_details_present": boolean | null,
  "warranty_service_provider_type": "string | null",
  "warranty_service_provider_name": "string | null",
  "leak_callback_sla_days": number | null,
  "labor_service_sla_days": number | null,
  "callback_process_text": "string | null",
  "post_install_stucco_excluded": boolean | null,
  "post_install_paint_excluded": boolean | null,
  "water_intrusion_damage_excluded": boolean | null,
  "line_items": [
    {
      "description": "string",
      "quantity": number | null,
      "unit_price": number | null,
      "total_price": number | null,
      "brand": "string | null",
      "series": "string | null",
      "dp_rating": "string | null",
      "noa_number": "string | null",
      "dimensions": "string | null",
      "opening_location": "string | null",
      "opening_tag": "string | null",
      "product_assignment_text": "string | null",
      "glass_package_text": "string | null",
      "glass_makeup_type": "string | null",
      "glass_low_e_present": boolean | null,
      "glass_argon_present": boolean | null,
      "glass_tint_text": "string | null",
      "glass_spec_complete": boolean | null
    }
  ],
  "warranty": {
    "labor_years": number | null,
    "manufacturer_years": number | null,
    "transferable": boolean | null,
    "details": "string | null"
  } | null,
  "permits": {
    "included": boolean | null,
    "responsible_party": "string | null",
    "details": "string | null"
  } | null,
  "installation": {
    "scope_detail": "string | null",
    "disposal_included": boolean | null,
    "accessories_mentioned": boolean | null
  } | null
}`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 0. Request boundary validation (Zod) ──
  // Fail fast on malformed bodies before touching the DB or AI provider.
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (parseErr) {
    logScanError("request_validation", {
      detail: "json_parse_failed",
      error: String(parseErr),
    });
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const parsedRequest = parseScanQuoteRequest(rawBody);
  if (!parsedRequest.ok) {
    logScanError("request_validation", {
      detail: parsedRequest.error,
      fields: parsedRequest.details,
    });
    return jsonResponse({
      error: parsedRequest.error,
      details: parsedRequest.details,
    }, 400);
  }

  const {
    scan_session_id,
    dev_extraction_override,
    dev_secret,
    event_id: client_event_id,
  } = parsedRequest.value;

  // Forever rule observability: if the schema substituted a bad/oversized
  // event_id with a server-minted UUID, surface it as a warning so we catch
  // frontend regressions without ever 400'ing the scan.
  const rawIncomingEventId = (rawBody as { event_id?: unknown } | null)
    ?.event_id;
  const wasSubstituted = typeof rawIncomingEventId !== "string" ||
    rawIncomingEventId.trim().length === 0 ||
    rawIncomingEventId.trim().length > 128 ||
    rawIncomingEventId.trim() !== client_event_id;
  if (wasSubstituted) {
    logScanWarn("request_validation", {
      scan_session_id,
      detail: "event_id_substituted",
      reason: typeof rawIncomingEventId !== "string"
        ? "missing_or_non_string"
        : rawIncomingEventId.trim().length === 0
        ? "empty"
        : rawIncomingEventId.trim().length > 128
        ? "oversized"
        : "trimmed",
      original_length: typeof rawIncomingEventId === "string"
        ? rawIncomingEventId.length
        : null,
      replacement_event_id: client_event_id,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      logScanError("request_validation", {
        scan_session_id,
        detail: "supabase_env_missing",
      });
      return jsonResponse({ error: "Server not configured" }, 500);
    }

    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const _devBypassSecretEarly = Deno.env.get("DEV_BYPASS_SECRET");
    const _isDevBypass = Boolean(
      dev_extraction_override !== undefined &&
        dev_secret &&
        _devBypassSecretEarly &&
        dev_secret === _devBypassSecretEarly,
    );

    if (!geminiKey && !_isDevBypass) {
      logScanError("request_validation", {
        scan_session_id,
        detail: "gemini_key_missing",
      });
      return jsonResponse({ error: "AI service not configured" }, 500);
    }

    // Single source of truth for model + timeout + stale-session threshold.
    const scannerCfg = getScannerRuntimeConfig();

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Rate-limit constants ──
    const RATE_LIMIT_MAX = 3;
    const RATE_LIMIT_WINDOW_MINUTES = 60;

    // Capture client IP for rate-limit tracking
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-real-ip") ||
      "unknown";

    // 1. Load scan session (include timestamps for stale-recovery decision)
    const { data: session, error: sessionErr } = await supabase
      .from("scan_sessions")
      .select("id, quote_file_id, lead_id, status, created_at, updated_at")
      .eq("id", scan_session_id)
      .single();

    if (sessionErr || !session) {
      logScanError("session_load", {
        scan_session_id,
        detail: "session_not_found",
        error: sessionErr?.message,
      });
      return jsonResponse({ error: "Session not found" }, 404);
    }

    // ── Idempotency + stuck-session recovery guard ──
    // Terminal statuses → idempotent no-op return.
    // `processing` younger than the stale threshold → reject (something else
    //   is still working on it; do not double-write `analyses`).
    // `processing` older than the threshold → take it over (recovery path).
    // The dev-bypass path skips this guard so test fixtures stay deterministic.
    if (!_isDevBypass) {
      const decision = decideSessionRecovery(
        {
          status: session.status,
          updated_at: session.updated_at,
          created_at: session.created_at,
        },
        scannerCfg.staleProcessingMinutes,
      );

      if (decision.kind === "skip_terminal") {
        logScanInfo("status_processing", {
          scan_session_id,
          detail: "idempotent_terminal_status",
          status: decision.status,
        });
        return jsonResponse({ scan_session_id, status: decision.status }, 200);
      }

      if (decision.kind === "skip_in_flight") {
        logScanInfo("status_processing", {
          scan_session_id,
          detail: "in_flight_invocation_active",
          age_ms: decision.ageMs,
          stale_threshold_minutes: scannerCfg.staleProcessingMinutes,
        });
        return jsonResponse(
          {
            scan_session_id,
            status: "processing",
            message: "Scan already in progress.",
          },
          202,
        );
      }

      if (decision.kind === "takeover_stale") {
        logScanWarn("recovery_takeover", {
          scan_session_id,
          detail: "stale_processing_takeover",
          age_ms: decision.ageMs,
          stale_threshold_minutes: scannerCfg.staleProcessingMinutes,
        });
        // Fall through into normal processing path — analyses upsert is
        // idempotent on scan_session_id, so re-processing is safe.
      }
    }

    // ── Rate-limit check (by lead_id — one lead per visitor session) ──
    if (session.lead_id && !_isDevBypass) {
      const cutoff = new Date(
        Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
      ).toISOString();
      const { count, error: rlErr } = await supabase
        .from("scan_sessions")
        .select("id", { count: "exact", head: true })
        .eq("lead_id", session.lead_id)
        .gte("created_at", cutoff);

      if (!rlErr && (count ?? 0) > RATE_LIMIT_MAX) {
        logScanWarn("rate_limit", {
          scan_session_id,
          lead_id: session.lead_id,
          ip: clientIp,
          count,
        });
        // Mark this session so it doesn't sit in "uploading" forever
        await supabase.from("scan_sessions").update({ status: "error" }).eq(
          "id",
          scan_session_id,
        );
        return jsonResponse({
          error: "rate_limit_exceeded",
          message:
            "You've reached the limit for free scans this hour. Please try again in a bit or contact us for a bulk review.",
        }, 429);
      }
    }

    // 2. Set status to processing
    const processingUpdate = await updateScanSessionStatus(
      supabase,
      scan_session_id,
      "processing",
      "scan_sessions processing update failed",
    );
    if (!processingUpdate.success) {
      logScanError("status_processing", {
        scan_session_id,
        detail: "status_update_failed",
      });
      return processingUpdate.response;
    }

    try {
      // ── DEV BYPASS: skip file download + Gemini when override provided ──
      const _devBypassSecret = Deno.env.get("DEV_BYPASS_SECRET");
      const _useBypass = dev_extraction_override && dev_secret &&
        _devBypassSecret && dev_secret === _devBypassSecret;
      let parsed: unknown;

      if (_useBypass) {
        console.log(
          `[DEV BYPASS] Using extraction override for session ${scan_session_id}`,
        );
        parsed = dev_extraction_override;
      } else {
        // 3. Load quote file
        const { data: qf, error: qfErr } = await supabase
          .from("quote_files")
          .select("storage_path")
          .eq("id", session.quote_file_id)
          .single();

        if (qfErr || !qf) {
          console.error("Quote file not found:", qfErr);
          const missingFileStatusUpdate = await updateScanSessionStatus(
            supabase,
            scan_session_id,
            "needs_better_upload",
            "scan_sessions needs_better_upload update failed after missing quote file",
            {
              error: "Failed to persist scan session state",
              scan_session_id,
              analysis_status: "processing",
              scan_session_status: "processing",
            },
          );
          if (!missingFileStatusUpdate.success) {
            return missingFileStatusUpdate.response;
          }

          return jsonResponse({
            error: "Quote file not found",
            scan_session_id,
            analysis_status: "needs_better_upload",
            scan_session_status: "needs_better_upload",
          }, 404);
        }

        // 4. Download file from storage
        const { data: fileData, error: dlErr } = await supabase.storage
          .from("quotes")
          .download(qf.storage_path);

        if (dlErr || !fileData) {
          logScanError("storage_download", {
            scan_session_id,
            detail: "download_failed",
            error: dlErr?.message,
          });
          const downloadFailureStatusUpdate = await updateScanSessionStatus(
            supabase,
            scan_session_id,
            "needs_better_upload",
            "scan_sessions needs_better_upload update failed after file download error",
            {
              error: "Failed to persist scan session state",
              scan_session_id,
              analysis_status: "processing",
              scan_session_status: "processing",
            },
          );
          if (!downloadFailureStatusUpdate.success) {
            return downloadFailureStatusUpdate.response;
          }

          return jsonResponse({
            error: "File download failed",
            scan_session_id,
            analysis_status: "needs_better_upload",
            scan_session_status: "needs_better_upload",
          }, 500);
        }

        // 5. Base64 encode file (with size guard so we never blow up the AI call)
        const arrayBuf = await fileData.arrayBuffer();
        if (arrayBuf.byteLength > scannerCfg.maxFileBytes) {
          logScanError("storage_download", {
            scan_session_id,
            detail: "file_too_large",
            file_bytes: arrayBuf.byteLength,
            max_bytes: scannerCfg.maxFileBytes,
          });
          const oversizeStatusUpdate = await updateScanSessionStatus(
            supabase,
            scan_session_id,
            "needs_better_upload",
            "scan_sessions needs_better_upload update failed after oversize upload",
          );
          if (!oversizeStatusUpdate.success) {
            return oversizeStatusUpdate.response;
          }
          return jsonResponse({
            error: "File too large",
            scan_session_id,
            analysis_status: "needs_better_upload",
            scan_session_status: "needs_better_upload",
          }, 413);
        }
        const uint8 = new Uint8Array(arrayBuf);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64Data = btoa(binary);
        const mimeType = mimeFromPath(qf.storage_path);

        // 6. Call Gemini API (model + timeout pulled from shared scannerConfig
        //    so operators can override via GEMINI_SCAN_MODEL / GEMINI_SCAN_TIMEOUT_MS).
        const geminiUrl = buildGeminiUrl(scannerCfg.geminiModel, geminiKey!);

        const geminiPayload = {
          contents: [
            {
              parts: [
                { text: GEMINI_EXTRACTION_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: scannerCfg.geminiMaxOutputTokens,
          },
        };

        const geminiController = new AbortController();
        const geminiTimeout = setTimeout(
          () => geminiController.abort("gemini_timeout"),
          scannerCfg.geminiTimeoutMs,
        );

        let geminiResp: Response;
        try {
          geminiResp = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(geminiPayload),
            signal: geminiController.signal,
          });
        } catch (fetchErr) {
          // Network error / timeout / abort: keep the session in `processing`
          // so the stale-recovery sweep can retry, but never leak provider
          // internals to the client.
          const isAbort = (fetchErr instanceof DOMException &&
            fetchErr.name === "AbortError") ||
            String(fetchErr).includes("gemini_timeout");
          logScanError("gemini_request", {
            scan_session_id,
            detail: isAbort ? "timeout" : "network_error",
            model: scannerCfg.geminiModel,
            timeout_ms: scannerCfg.geminiTimeoutMs,
            error: String(fetchErr),
          });
          return jsonResponse({
            error: isAbort
              ? "AI extraction timed out"
              : "AI extraction unavailable",
            scan_session_id,
            analysis_status: "processing",
            scan_session_status: "processing",
          }, 504);
        } finally {
          clearTimeout(geminiTimeout);
        }

        if (!geminiResp.ok) {
          const errText = await geminiResp.text().catch(() => "");
          logScanError("gemini_request", {
            scan_session_id,
            detail: "non_2xx_response",
            model: scannerCfg.geminiModel,
            status: geminiResp.status,
            // Truncate provider error string so we never log raw document echoes.
            provider_snippet: errText.slice(0, 240),
          });
          // Stay in 'processing' for crash recovery
          return jsonResponse({
            error: "AI extraction failed",
            scan_session_id,
            analysis_status: "processing",
            scan_session_status: "processing",
          }, 502);
        }

        // 7. Parse Gemini response (defensively — never trust upstream JSON shape)
        let geminiJson: Record<string, unknown> | null = null;
        try {
          geminiJson = await geminiResp.json();
        } catch (jsonErr) {
          logScanError("gemini_parse", {
            scan_session_id,
            detail: "envelope_not_json",
            model: scannerCfg.geminiModel,
            error: String(jsonErr),
          });
          return jsonResponse({
            error: "AI returned malformed response",
            scan_session_id,
            analysis_status: "processing",
            scan_session_status: "processing",
          }, 502);
        }

        const rawText = (geminiJson as {
          candidates?: Array<
            {
              finishReason?: string;
              content?: { parts?: Array<{ text?: string }> };
            }
          >;
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        })
          ?.candidates?.[0]?.content?.parts?.[0]?.text;

        const geminiCandidate = (geminiJson as {
          candidates?: Array<{ finishReason?: string }>;
        })?.candidates?.[0];
        const finishReason = typeof geminiCandidate?.finishReason === "string"
          ? geminiCandidate.finishReason
          : null;
        const usageMetadata = (geminiJson as {
          usageMetadata?: {
            promptTokenCount?: number;
            candidatesTokenCount?: number;
            totalTokenCount?: number;
          };
        }).usageMetadata;

        if (!rawText) {
          logScanError("gemini_parse", {
            scan_session_id,
            detail: "empty_text_part",
            model: scannerCfg.geminiModel,
          });
          const emptyResponseStatusUpdate = await updateScanSessionStatus(
            supabase,
            scan_session_id,
            "needs_better_upload",
            "scan_sessions needs_better_upload update failed after empty Gemini response",
            {
              error: "Failed to persist scan session state",
              scan_session_id,
              analysis_status: "processing",
              scan_session_status: "processing",
            },
          );
          if (!emptyResponseStatusUpdate.success) {
            return emptyResponseStatusUpdate.response;
          }

          return jsonResponse({
            error: "AI returned empty response",
            scan_session_id,
            analysis_status: "needs_better_upload",
            scan_session_status: "needs_better_upload",
          }, 502);
        }

        const { normalizedText, flags: normFlags } = normalizeGeminiJsonText(
          rawText,
        );

        // parsed is declared above (hoisted for bypass support)
        try {
          parsed = JSON.parse(normalizedText);
        } catch (parseErr) {
          const parseMeta = extractParseErrorMeta(parseErr);
          const truncated = isGeminiOutputTruncated(finishReason);
          logScanError("gemini_parse", {
            scan_session_id,
            detail: truncated
              ? "extraction_output_truncated"
              : "extraction_json_parse_failed",
            model: scannerCfg.geminiModel,
            finishReason,
            promptTokenCount: usageMetadata?.promptTokenCount ?? null,
            candidatesTokenCount: usageMetadata?.candidatesTokenCount ?? null,
            totalTokenCount: usageMetadata?.totalTokenCount ?? null,
            rawTextLength: normFlags.rawLength,
            normalizedTextLength: normFlags.normalizedLength,
            startsWithMarkdownFence: normFlags.startsWithMarkdownFence,
            containsMarkdownFence: normFlags.containsMarkdownFence,
            strippedMarkdownFence: normFlags.strippedMarkdownFence,
            startsWithBraceAfterNormalization:
              normFlags.startsWithBraceAfterNormalization,
            endsWithBraceAfterNormalization:
              normFlags.endsWithBraceAfterNormalization,
            parseErrorName: parseMeta.parseErrorName,
            parseErrorMessage: parseMeta.parseErrorMessage,
            parseErrorPosition: parseMeta.parseErrorPosition,
          });
          const parseFailureStatusUpdate = await updateScanSessionStatus(
            supabase,
            scan_session_id,
            "needs_better_upload",
            "scan_sessions needs_better_upload update failed after Gemini JSON parse error",
            {
              error: "Failed to persist scan session state",
              scan_session_id,
              analysis_status: "processing",
              scan_session_status: "processing",
            },
          );
          if (!parseFailureStatusUpdate.success) {
            return parseFailureStatusUpdate.response;
          }

          return jsonResponse({
            error: "AI response not parseable",
            scan_session_id,
            analysis_status: "needs_better_upload",
            scan_session_status: "needs_better_upload",
          }, 200);
        }
      } // end else (non-bypass OCR path)

      // 8. CLASSIFICATION GATE — fail-closed; malformed fields never skip the gate
      const norm = normalizeClassification(parsed);
      const gateDecision = classifyScanGate(norm);

      if (gateDecision.action === "terminate") {
        return await terminateScan({
          supabase,
          scanSessionId: scan_session_id,
          leadId: session.lead_id,
          analysisStatus: gateDecision.analysisStatus,
          sessionStatus: gateDecision.sessionStatus,
          rejectReason: gateDecision.rejectReason,
          reason: gateDecision.reason,
          norm,
        });
      }

      // quote_uploaded fires only after the content gate passes (related + readable).
      try {
        await persistCanonicalEvent(supabase, {
          eventId:
            typeof client_event_id === "string" && client_event_id.length > 0
              ? client_event_id
              : undefined,
          eventName: "quote_uploaded",
          leadId: session.lead_id ?? undefined,
          scanSessionId: scan_session_id,
          quoteFileId: session.quote_file_id ?? undefined,
          payload: {
            identity: {
              leadId: session.lead_id ?? undefined,
            },
            journey: {
              route: "/vault/upload",
              flow: "vault",
              scanSessionId: scan_session_id,
            },
            quote: {
              quoteFileId: session.quote_file_id ?? undefined,
              isQuoteDocument: norm.related,
            },
            source: {
              sourceSystem: "edge_function",
            },
          },
        });
      } catch (canonicalErr) {
        console.error(
          "quote_uploaded canonical event failed (non-fatal):",
          canonicalErr,
        );
      }

      // 9. FULL EXTRACTION VALIDATION — only reached for gated window/door docs
      const coercedParsed = coerceParsedForExtraction(parsed, norm);
      const validation = validateExtraction(coercedParsed);
      if (!validation.success) {
        console.error("Extraction validation failed:", validation.error);
        return await terminateScan({
          supabase,
          scanSessionId: scan_session_id,
          leadId: session.lead_id,
          analysisStatus: "needs_better_upload",
          sessionStatus: "needs_better_upload",
          rejectReason: "unreadable",
          reason:
            "We found a window quote but couldn't extract all details. Please try a clearer upload.",
          norm,
        });
      }

      const extraction = validation.data;

      // 10b. Derive jurisdiction mismatch before scoring
      if (
        extraction.contractor_address_text &&
        /illinois|il\b/i.test(extraction.contractor_address_text) &&
        session?.lead_id
      ) {
        extraction.state_jurisdiction_mismatch = true;
      }

      // 11. Score all pillars
      const gradeResult = computeGrade(extraction);
      const flags = detectFlags(extraction);

      // 11b. Non-blocking county lookup for benchmark comparison
      let countyName: string | null = null;
      if (session?.lead_id) {
        try {
          const { data: leadRow } = await supabase
            .from("leads")
            .select("county")
            .eq("id", session.lead_id)
            .maybeSingle();
          countyName = leadRow?.county ?? null;
        } catch (countyErr) {
          console.warn(
            "County lookup failed (non-fatal, using fallback):",
            countyErr,
          );
        }
      }

      // 11c. Derive financial metrics (inline — deterministic math, no HTTP call)
      let derivedMetrics: Record<string, unknown> | null = null;
      try {
        derivedMetrics = computeDerivedMetrics(extraction, countyName);
      } catch (metricsErr) {
        console.error(
          "derived metrics computation failed (non-fatal):",
          metricsErr,
        );
        // Non-fatal: report still ships without financial cards
      }

      // 11d. Structured trace log for derived metrics (debugging & audit)
      console.log(
        "[WM_DERIVED_METRICS_TRACE]",
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            lead_id: session?.lead_id ?? null,
            county: countyName ?? null,
            derived_metrics: derivedMetrics,
          },
          null,
          2,
        ),
      );

      // 11e. Compile report output (deterministic compiler)
      const compiledReport = compileReportOutput(
        extraction,
        gradeResult,
        flags,
        derivedMetrics,
      );

      // 12. Build payloads
      const openingBucket =
        (extraction.opening_count || extraction.line_items.length) <= 5
          ? "1-5"
          : (extraction.opening_count || extraction.line_items.length) <= 10
          ? "6-10"
          : (extraction.opening_count || extraction.line_items.length) <= 20
          ? "11-20"
          : "20+";

      const proofOfRead = {
        page_count: extraction.page_count || null,
        opening_count: extraction.opening_count || extraction.line_items.length,
        contractor_name: extraction.contractor_name || null,
        document_type: extraction.document_type,
        line_item_count: extraction.line_items.length,
      };

      // Preview: limited info — enough for teaser, not enough for full report
      const previewJson = {
        grade: gradeResult.letterGrade,
        flag_count: flags.length,
        opening_count_bucket: openingBucket,
        quality_band: gradeResult.weightedAverage >= 70
          ? "good"
          : gradeResult.weightedAverage >= 50
          ? "fair"
          : "poor",
        hard_cap_applied: gradeResult.hardCapApplied,
        has_warranty: !!extraction.warranty,
        has_permits: !!extraction.permits,
        pillar_scores: buildPreviewPillarScores(gradeResult.pillarScores),
        top_warning: compiledReport.top_warning,
        top_missing_item: compiledReport.top_missing_item,
        missing_items_count: compiledReport.missing_items.length,
        payment_risk_detected: compiledReport.payment_risk_detected,
        scope_gap_detected: compiledReport.scope_gap_detected,
        price_per_opening_band: compiledReport.price_per_opening_band,
        summary_teaser: compiledReport.summary_teaser,
      };

      // Full JSON: complete analysis — gated behind SMS verification on client
      const fullJson = {
        grade: gradeResult.letterGrade,
        weighted_average: gradeResult.weightedAverage,
        hard_cap_applied: gradeResult.hardCapApplied,
        pillar_scores: gradeResult.pillarScores,
        flags: flags,
        extraction: extraction,
        derived_metrics: derivedMetrics,
        rubric_version: RUBRIC_VERSION,
        price_fairness: extraction.price_fairness || null,
        markup_estimate: extraction.markup_estimate || null,
        negotiation_leverage: extraction.negotiation_leverage || null,
        warnings: compiledReport.warnings,
        missing_items: compiledReport.missing_items,
        summary: compiledReport.summary,
        top_warning: compiledReport.top_warning,
        top_missing_item: compiledReport.top_missing_item,
        price_per_opening: compiledReport.price_per_opening,
        price_per_opening_band: compiledReport.price_per_opening_band,
        payment_risk_detected: compiledReport.payment_risk_detected,
        scope_gap_detected: compiledReport.scope_gap_detected,
      };

      // 13. Upsert full analyses row
      const completeAnalysisUpsert = await upsertAnalysisRecord(
        supabase,
        {
          scan_session_id: scan_session_id,
          lead_id: session.lead_id,
          analysis_status: "complete",
          document_is_window_door_related: true,
          document_type: extraction.document_type,
          confidence_score: extraction.confidence,
          grade: gradeResult.letterGrade,
          flags: flags,
          dollar_delta: null,
          proof_of_read: proofOfRead,
          preview_json: previewJson,
          full_json: fullJson,
          rubric_version: RUBRIC_VERSION,
          price_fairness: extraction.price_fairness || null,
          markup_estimate: extraction.markup_estimate || null,
          negotiation_leverage: extraction.negotiation_leverage || null,
        },
        "analyses upsert failed",
        {
          error: "Failed to persist analysis state",
          scan_session_id,
          analysis_status: "processing",
          scan_session_status: "processing",
        },
      );
      if (!completeAnalysisUpsert.success) {
        return completeAnalysisUpsert.response;
      }

      const analysisId = completeAnalysisUpsert.analysisId;

      // 13b. LEAD SNAPSHOT SYNC — update leads table with analysis results
      if (session.lead_id && analysisId) {
        const criticalCount = flags.filter((f) =>
          f.severity === "Critical"
        ).length;
        const redCount = flags.filter((f) => f.severity === "High").length;
        const amberCount = flags.filter((f) => f.severity === "Medium").length;

        try {
          const { error: leadUpdateErr } = await supabase
            .from("leads")
            .update({
              latest_analysis_id: analysisId,
              latest_scan_session_id: scan_session_id,
              grade: gradeResult.letterGrade,
              flag_count: flags.length,
              critical_flag_count: criticalCount,
              red_flag_count: redCount,
              amber_flag_count: amberCount,
              funnel_stage: "scanned",
            })
            .eq("id", session.lead_id);

          if (leadUpdateErr) {
            console.error(
              "Lead snapshot sync failed (non-fatal):",
              leadUpdateErr,
            );
          } else {
            console.log(
              `[LEAD_SNAPSHOT_SYNC] lead_id=${session.lead_id} analysis_id=${analysisId} grade=${gradeResult.letterGrade}`,
            );
          }
        } catch (leadSyncErr) {
          console.error(
            "Lead snapshot sync unexpected error (non-fatal):",
            leadSyncErr,
          );
        }

        // 13c. LEAD EVENT — append operational timeline entry
        try {
          const { error: eventErr } = await supabase
            .from("lead_events")
            .insert({
              lead_id: session.lead_id,
              scan_session_id: scan_session_id,
              analysis_id: analysisId,
              event_name: "scan_completed",
              event_source: "edge_function",
              metadata: {
                grade: gradeResult.letterGrade,
                flag_count: flags.length,
                confidence_score: extraction.confidence,
                rubric_version: RUBRIC_VERSION,
              },
            });

          if (eventErr) {
            console.error("Lead event insert failed (non-fatal):", eventErr);
          }
        } catch (eventInsertErr) {
          console.error(
            "Lead event insert unexpected error (non-fatal):",
            eventInsertErr,
          );
        }
      }

      try {
        await persistCanonicalEvent(supabase, {
          eventName: "quote_validation_passed",
          leadId: session.lead_id ?? undefined,
          analysisId: analysisId ?? undefined,
          scanSessionId: scan_session_id,
          quoteFileId: session.quote_file_id ?? undefined,
          payload: {
            identity: {
              leadId: session.lead_id ?? undefined,
            },
            journey: {
              route: "/vault/reports",
              flow: "vault",
              scanSessionId: scan_session_id,
            },
            quote: {
              analysisId: analysisId ?? undefined,
              quoteFileId: session.quote_file_id ?? undefined,
              documentType: extraction.document_type,
              isQuoteDocument: true,
              openingCount: typeof extraction.opening_count === "number"
                ? extraction.opening_count
                : undefined,
              quoteAmount: typeof extraction.total_quoted_price === "number"
                ? extraction.total_quoted_price
                : undefined,
              pricePerOpening:
                typeof compiledReport.price_per_opening === "number"
                  ? compiledReport.price_per_opening
                  : undefined,
              depositPercent: typeof extraction.deposit_percent === "number"
                ? extraction.deposit_percent
                : undefined,
              impossibleValuesDetected: flags.some((f) =>
                /impossible/i.test(f.flag) || /impossible/i.test(f.detail)
              ),
            },
            analytics: {
              ocrConfidence: Math.max(
                0,
                Math.min(1, extraction.confidence ?? 0),
              ),
              completeness: Math.max(
                0,
                Math.min(1, gradeResult.pillarScores.safety / 100),
              ),
              mathConsistency: Math.max(
                0,
                Math.min(1, gradeResult.pillarScores.price / 100),
              ),
              cohortFit: Math.max(
                0,
                Math.min(1, gradeResult.pillarScores.price / 100),
              ),
              scopeConsistency: Math.max(
                0,
                Math.min(1, gradeResult.pillarScores.install / 100),
              ),
              documentValidity: Math.max(
                0,
                Math.min(1, gradeResult.pillarScores.finePrint / 100),
              ),
              identityStrength: 0.4,
              anomalyScore: 0,
              trustScore: 0,
              anomalyStatus: "review",
              reasons: [],
            },
            source: {
              sourceSystem: "edge_function",
            },
            metadata: {
              grade: gradeResult.letterGrade,
              flag_count: flags.length,
            },
          },
        });
      } catch (canonicalErr) {
        console.error(
          "quote_validation_passed canonical event failed (non-fatal):",
          canonicalErr,
        );
      }

      // 14. Update session to preview_ready
      const previewReadyStatusUpdate = await updateScanSessionStatus(
        supabase,
        scan_session_id,
        "preview_ready",
        "scan_sessions preview_ready update failed",
        {
          error: "Failed to persist scan session state",
          scan_session_id,
          analysis_status: "complete",
          scan_session_status: "processing",
          grade: gradeResult.letterGrade,
        },
      );
      if (!previewReadyStatusUpdate.success) {
        // COMPENSATING ACTION:
        // If the scan session status failed to transition to preview_ready,
        // roll the analysis_status back from "complete" to "processing"
        // so that analyses + scan_sessions remain logically aligned.
        try {
          const rollbackAnalysis = await upsertAnalysisRecord(
            supabase,
            {
              scan_session_id: scan_session_id,
              lead_id: session.lead_id,
              analysis_status: "processing",
              document_is_window_door_related: true,
              document_type: extraction.document_type,
              confidence_score: extraction.confidence,
              grade: gradeResult.letterGrade,
              flags: flags,
              dollar_delta: null,
              proof_of_read: proofOfRead,
              preview_json: previewJson,
              full_json: fullJson,
              rubric_version: RUBRIC_VERSION,
            },
            "analyses rollback after scan_sessions preview_ready failure",
            {
              error:
                "Failed to rollback analysis after scan session status failure",
              scan_session_id,
              analysis_status: "processing",
              scan_session_status: "processing",
              grade: gradeResult.letterGrade,
            },
          );
          if (!rollbackAnalysis.success) {
            console.error(
              "Rollback of analysis record after scan_sessions preview_ready failure also failed",
              rollbackAnalysis.response,
            );
          }
        } catch (rollbackErr) {
          console.error(
            "Unexpected error during analysis rollback after scan_sessions preview_ready failure",
            rollbackErr,
          );
        }
        return previewReadyStatusUpdate.response;
      }

      return jsonResponse({
        scan_session_id,
        analysis_status: "complete",
        scan_session_status: "preview_ready",
        grade: gradeResult.letterGrade,
      }, 200);
    } catch (innerErr) {
      // CRASH RECOVERY: session stays in 'processing' — recoverable by the
      // stale-takeover path on the next invocation.
      logScanError("session_finalize", {
        scan_session_id,
        detail: "unexpected_inner_error",
        error: String(innerErr),
      });
      return jsonResponse({
        error: "Internal processing error",
        scan_session_id,
        analysis_status: "processing",
        scan_session_status: "processing",
      }, 500);
    }
  } catch (outerErr) {
    logScanError("request_validation", {
      detail: "unexpected_outer_error",
      error: String(outerErr),
    });
    return jsonResponse({ error: "Bad request" }, 400);
  }
});
