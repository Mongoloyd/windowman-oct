// supabase/functions/capture-truth-gate-lead/index.ts
//
// TruthGate front-door lead capture.
//
// Why this exists
//   Direct browser INSERT into public.leads is RLS-fragile because the same
//   browser session can be either anonymous OR carry an authenticated
//   admin/operator JWT (Supabase JS persists the session in localStorage).
//   The leads/event_logs anon-only insert policies reject the authenticated
//   request with 42501, which surfaces as the orange "Something went wrong"
//   button in TruthGateFlow. This edge function performs the insert with the
//   service role so the front door works in both states without weakening
//   public RLS or exposing service credentials to the client.
//
// Hard rules respected
//   - Service-role key never leaves this function.
//   - Public RLS posture for `leads` is unchanged.
//   - OTP / verified-state columns are forced to safe defaults — this path
//     can never elevate a lead to phone_verified.
//   - No PII is logged. Audit events log structured non-PII metadata only.
//
// Audit logging
//   Every meaningful stage emits a structured `audit()` event with timestamp,
//   stage, status, session_id, lead_id (when known), error_code/message
//   (when applicable), and safe boolean flags (has_phone, has_client_slug).
//   Telemetry/audit insert failures NEVER block funnel success.
//
// Contract
//   Method: POST
//   Body  : strict shape (see CapturePayload). Unknown keys are ignored.
//   Resp  : { success, lead_id, session_id, openai_ads_event_id? } on 200
//           (OpenAI ID exists only for a newly inserted truth-gate lead)
//           { success: false, code, message, details? } on 4xx/5xx

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  hasAttributionPayload,
  mergeAttribution,
  mergeQueryParams,
  promoteLeadScalarFields,
  sanitizeAttributionInput,
  sanitizeQueryParamsInput,
} from "../_shared/attributionMerge.ts";
import {
  getCorsHeaders,
  getOriginFromRequest,
  isAllowedOrigin,
} from "../_shared/cors.ts";
import { deriveLeadSourceFromSource } from "../_shared/deriveLeadSourceFromSource.ts";
import { emitLeadActivity } from "../_shared/emitLeadActivity.ts";
import {
  buildOpenAiAdsLeadEventId,
  extractOpenAiAdsClientIp,
  parseOpenAiAdsClientContext,
  readOpenAiAdsRuntimeConfig,
  scheduleOpenAiAdsConversion,
  sendOpenAiAdsLeadCreated,
} from "../_shared/openAiAdsConversions.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";
import { WMCHAT_DAY1_META_SCOPE } from "../_shared/tracking/canonical/routeOwnership.ts";
import {
  consentPersistFailureStatus,
  type ParsedConsentRequest,
  persistConsentBatch,
  resolveAdvertisingMeasurementConsent,
  validateConsentRequest,
} from "../_shared/consentCapture.ts";
import { stripConsentForLeadsInsert } from "../_shared/leadInsertPayload.ts";
import {
  buildStoredWmChatIntake,
  isProtectionKitWmChatIntake,
  mergeWmChatQualificationNamespace,
  type StoredWmChatIntake,
  type ValidatedWmChatIntake,
  validateStoredWmChatIntake,
  validateWmChatIntake,
} from "../_shared/wmchatIntake.ts";
import {
  lookupTwilioBasicPhone,
  type TwilioBasicLookupResult,
} from "../_shared/twilioLookup.ts";

const FUNCTION_NAME = "capture-truth-gate-lead";

const CANONICAL_LEAD_CAPTURED_ENABLED =
  Deno.env.get("CANONICAL_LEAD_CAPTURED_ENABLED") === "true";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const WMCHAT_POST_CAPTURE_MODE = "wmchat_post_capture_v1" as const;
const WMCHAT_POST_CAPTURE_SOURCE = "windowman-first-quote" as const;
const WMCHAT_POST_CAPTURE_SOURCE_PATH = "/wmchat" as const;
const WMCHAT_POST_CAPTURE_INTAKE_VERSION = "wmchat_v1" as const;

const WMCHAT_POST_CAPTURE_ROOT_KEYS = new Set([
  "mode",
  "source",
  "lead_id",
  "session_id",
  "submission_id",
  "query_params",
  "action",
  "property_address",
  "conversation_time_preference",
  "quote_readiness",
  "callback_preference",
]);
const WMCHAT_POST_CAPTURE_QUERY_KEYS = new Set([
  "source_path",
  "intake_version",
]);
const WMCHAT_POST_CAPTURE_ADDRESS_KEYS = new Set([
  "line1",
  "line2",
  "city",
  "region",
  "postal_code",
]);
const WMCHAT_CONVERSATION_TIMES = new Set([
  "asap",
  "weekday_morning",
  "weekday_afternoon",
  "weekday_evening",
]);
const WMCHAT_CALLBACK_PREFERENCES = new Set([
  "next_week",
  "one_month",
  "three_months",
  "self_return",
]);

type WmChatPostCaptureAction =
  | "quote_request_game_plan"
  | "schedule_windowman_conversation"
  | "review_quote_when_ready";

type WmChatPostCaptureAddress = {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly region: string;
  readonly postal_code: string;
};

export type ValidatedWmChatPostCaptureRequest = {
  readonly leadId: string;
  readonly sessionId: string;
  readonly submissionId: string;
  readonly namespace: {
    readonly schema_version: "1";
    readonly mode: typeof WMCHAT_POST_CAPTURE_MODE;
    readonly source: typeof WMCHAT_POST_CAPTURE_SOURCE;
    readonly submission_id: string;
    readonly action: WmChatPostCaptureAction;
    readonly property_address: WmChatPostCaptureAddress | null;
    readonly conversation_time_preference: string | null;
    readonly quote_readiness: "not_yet" | null;
    readonly callback_preference: string | null;
  };
};

type WmChatPostCaptureParseResult =
  | { readonly ok: true; readonly request: ValidatedWmChatPostCaptureRequest }
  | {
    readonly ok: false;
    readonly code: "invalid_wmchat_post_capture";
    readonly message: string;
  };

type WmChatPostCaptureLeadRow = {
  readonly id: string;
  readonly session_id: string;
  readonly source: string;
  readonly qualification_answers_json: unknown;
};

type WmChatPostCaptureRpcRow = {
  readonly outcome: string;
  readonly lead_id: unknown;
  readonly session_id: unknown;
};

export type WmChatPostCapturePersistenceDeps = {
  readonly loadLead: (
    request: ValidatedWmChatPostCaptureRequest,
  ) => Promise<{
    readonly data: unknown;
    readonly error:
      | { readonly code?: string; readonly message?: string }
      | null;
  }>;
  readonly persistNamespace: (
    request: ValidatedWmChatPostCaptureRequest,
    expectedWmChatV1: StoredWmChatIntake,
  ) => Promise<{
    readonly data: unknown;
    readonly error:
      | { readonly code?: string; readonly message?: string }
      | null;
  }>;
};

export type WmChatPostCapturePersistenceResult =
  | {
    readonly ok: true;
    readonly outcome: "inserted" | "replayed";
    readonly leadId: string;
    readonly sessionId: string;
  }
  | {
    readonly ok: false;
    readonly kind:
      | "conflict"
      | "identity_mismatch"
      | "invalid_original"
      | "invalid_namespace"
      | "storage_unavailable";
  };

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function captureActivityEventName(source: string): string {
  return source === "nextdoor"
    ? "nextdoor_lead_captured"
    : "truth_gate_captured";
}

async function emitTruthGateCaptureActivity(
  admin: SupabaseClient,
  args: {
    leadId: string;
    source: string;
    email: string | null;
    phone_e164: string | null;
  },
): Promise<void> {
  await emitLeadActivity({
    supabaseAdmin: admin,
    leadId: args.leadId,
    eventName: captureActivityEventName(args.source),
    metadata: { source: args.source },
    contact: {
      email: args.email,
      phone_e164: args.phone_e164,
    },
  });
}

const LEAD_SCALAR_SELECT =
  "attribution, query_params, client_slug, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, fbc, fbp, ttclid, msclkid, wbraid, gbraid, landing_page_url, first_page_path, initial_referrer";

async function mergeExistingLeadAttribution(
  admin: SupabaseClient,
  leadId: string,
  sanitizedAttribution: Record<string, unknown>,
  sanitizedQueryParams: Record<string, string | string[]>,
): Promise<void> {
  if (!hasAttributionPayload(sanitizedAttribution, sanitizedQueryParams)) {
    return;
  }

  const { data: existing, error } = await admin
    .from("leads")
    .select(LEAD_SCALAR_SELECT)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    console.warn(`[${FUNCTION_NAME}] lead attribution fetch failed`, {
      code: error.code,
      message: error.message,
    });
    return;
  }

  const mergedAttribution = mergeAttribution(
    existing?.attribution,
    sanitizedAttribution,
  );
  const mergedQueryParams = mergeQueryParams(
    existing?.query_params,
    sanitizedQueryParams,
  );
  const promoted = promoteLeadScalarFields(
    mergedAttribution,
    (existing ?? {}) as Record<string, unknown>,
  );

  const updateRow: Record<string, unknown> = {
    attribution: mergedAttribution,
    query_params: mergedQueryParams,
    ...promoted,
  };

  const { error: updateErr } = await admin
    .from("leads")
    .update(updateRow)
    .eq("id", leadId);

  if (updateErr) {
    console.warn(`[${FUNCTION_NAME}] lead attribution merge failed`, {
      code: updateErr.code,
      message: updateErr.message,
    });
  }
}

interface LeadCapturedCanonicalParams {
  leadId: string;
  sessionId: string;
  email: string | null;
  phoneE164: string | null;
  clientSlug: string | null;
  landingPageUrl: string | null;
  firstPagePath: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  source: string;
  attribution: Record<string, unknown>;
  fbc?: string | null;
  fbp?: string | null;
  gclid?: string | null;
  clientIp?: string | null;
  userAgent?: string | null;
  measurementScope?: typeof WMCHAT_DAY1_META_SCOPE;
}

function pickAttributionString(
  attribution: Record<string, unknown>,
  key: string,
  maxLen = 500,
): string | undefined {
  const val = attribution[key];
  if (typeof val !== "string") return undefined;
  const trimmed = val.trim();
  return trimmed ? trimmed.slice(0, maxLen) : undefined;
}

function buildLeadCapturedAttributionMetadata(
  params: LeadCapturedCanonicalParams,
): Record<string, unknown> {
  const attr = params.attribution;

  return {
    intake_source: params.source,
    utm_source: params.utmSource ??
      pickAttributionString(attr, "utm_source", 255),
    utm_medium: params.utmMedium ??
      pickAttributionString(attr, "utm_medium", 255),
    utm_campaign: params.utmCampaign ??
      pickAttributionString(attr, "utm_campaign", 255),
    utm_content: params.utmContent ??
      pickAttributionString(attr, "utm_content", 255),
    utm_term: params.utmTerm ?? pickAttributionString(attr, "utm_term", 255),
    wm_intent: pickAttributionString(attr, "wm_intent", 32),
    ndclid: pickAttributionString(attr, "ndclid"),
    nd_lead_id: pickAttributionString(attr, "nd_lead_id"),
    nd_form_id: pickAttributionString(attr, "nd_form_id"),
    nd_ad_id: pickAttributionString(attr, "nd_ad_id"),
    nd_ad_group_id: pickAttributionString(attr, "nd_ad_group_id"),
    nd_campaign_id: pickAttributionString(attr, "nd_campaign_id"),
    gclid: pickAttributionString(attr, "gclid"),
    gbraid: pickAttributionString(attr, "gbraid"),
    wbraid: pickAttributionString(attr, "wbraid"),
    fbclid: pickAttributionString(attr, "fbclid"),
    ttclid: pickAttributionString(attr, "ttclid"),
    msclkid: pickAttributionString(attr, "msclkid"),
    landing_page_url: params.landingPageUrl ??
      pickAttributionString(attr, "landing_page_url", 1000),
    event_source_url: params.landingPageUrl ??
      pickAttributionString(attr, "current_page_url", 1000),
    current_page_url: pickAttributionString(attr, "current_page_url", 1000),
    landing_path: params.firstPagePath ??
      pickAttributionString(attr, "landing_page", 500),
    referrer: pickAttributionString(attr, "referrer", 1000),
    has_phone: !!params.phoneE164,
    paid_attribution_signal: hasPaidAttributionSignal(params),
  };
}

function hasPaidAttributionSignal(
  params: LeadCapturedCanonicalParams,
): boolean {
  const attr = params.attribution;
  return Boolean(
    params.utmSource?.trim() ||
      params.utmMedium?.trim() ||
      pickAttributionString(attr, "ndclid") ||
      pickAttributionString(attr, "gclid") ||
      pickAttributionString(attr, "gbraid") ||
      pickAttributionString(attr, "wbraid") ||
      pickAttributionString(attr, "fbclid") ||
      pickAttributionString(attr, "ttclid") ||
      pickAttributionString(attr, "msclkid"),
  );
}

/**
 * Preserve site-wide attribution fields not yet in attributionMerge allowlist.
 */
function preserveSiteWideAttributionFields(
  sanitized: Record<string, unknown>,
  raw: unknown,
): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return sanitized;
  }

  const src = raw as Record<string, unknown>;
  const out = { ...sanitized };

  const currentPageUrl = asNullableString(src.current_page_url, 1000);
  if (currentPageUrl) out.current_page_url = currentPageUrl;

  if (
    typeof src.first_touch_at === "number" &&
    Number.isFinite(src.first_touch_at)
  ) {
    out.first_touch_at = Math.trunc(src.first_touch_at);
  }
  if (
    typeof src.latest_touch_at === "number" &&
    Number.isFinite(src.latest_touch_at)
  ) {
    out.latest_touch_at = Math.trunc(src.latest_touch_at);
  }

  return out;
}

function persistLeadCapturedCanonical(
  admin: SupabaseClient,
  params: LeadCapturedCanonicalParams,
  consent?: ParsedConsentRequest,
) {
  const metaConsent = consent
    ? resolveAdvertisingMeasurementConsent(consent)
    : undefined;
  const journeyRoute = params.measurementScope === WMCHAT_DAY1_META_SCOPE
    ? "/wmchat"
    : params.firstPagePath ?? params.landingPageUrl ?? "/";

  return persistCanonicalEvent(admin, {
    eventId:
      `wmc_lead_captured_lead-${params.leadId}_session-${params.sessionId}`,
    eventName: "lead_captured",
    leadId: params.leadId,
    clientSlug: params.clientSlug ?? undefined,
    payload: {
      identity: {
        leadId: params.leadId,
        ...(params.email ? { email: params.email } : {}),
        phone: params.phoneE164 ?? undefined,
        fbc: params.fbc ?? undefined,
        fbp: params.fbp ?? undefined,
        gclid: params.gclid ?? undefined,
        clientIp: params.clientIp ?? undefined,
        userAgent: params.userAgent ?? undefined,
      },
      journey: {
        route: journeyRoute,
        flow: "public",
        sessionId: params.sessionId,
      },
      source: {
        sourceSystem: "edge_function",
        utmSource: params.utmSource ?? undefined,
        utmMedium: params.utmMedium ?? undefined,
        utmCampaign: params.utmCampaign ?? undefined,
        referrer: pickAttributionString(params.attribution, "referrer", 1000),
      },
      metadata: {
        ...buildLeadCapturedAttributionMetadata(params),
        ...(params.measurementScope
          ? { measurement_scope: params.measurementScope }
          : {}),
      },
    },
    ...(metaConsent
      ? {
        dispatchPolicy: {
          allowedPlatforms: ["meta" as const],
          metaConsent,
          ...(metaConsent === "granted" ? {} : {
            metaSuppressionReason: metaConsent === "denied"
              ? "advertising_measurement_declined"
              : "advertising_measurement_missing",
          }),
        },
      }
      : {}),
  });
}

/** Legacy sources retain their existing feature flag and best-effort behavior. */
async function maybePersistLeadCapturedCanonical(
  admin: SupabaseClient,
  params: LeadCapturedCanonicalParams,
): Promise<void> {
  if (!CANONICAL_LEAD_CAPTURED_ENABLED) {
    return;
  }

  try {
    await persistLeadCapturedCanonical(admin, params);
  } catch (err) {
    console.warn(
      `[${FUNCTION_NAME}] lead_captured canonical scaffold failed (non-fatal)`,
      {
        lead_id: params.leadId,
        session_id: params.sessionId,
        message: err instanceof Error ? err.message : String(err),
      },
    );
  }
}

type CanonicalPersistResult = Awaited<
  ReturnType<typeof persistCanonicalEvent>
>;

export async function persistCanonicalEventWithRetry(
  persist: () => Promise<CanonicalPersistResult>,
): Promise<CanonicalPersistResult> {
  let lastError: unknown = new Error("canonical_persist_failed");
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await persist();
      if (!result.eventLogId || !result.dispatchPlatforms.includes("meta")) {
        throw new Error("canonical_meta_outbox_missing");
      }
      return result;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

/**
 * Marketing measurement is downstream of durable lead capture. Exhausting the
 * idempotent event/outbox retry records a repair signal but never converts a
 * persisted homeowner lead into an HTTP failure.
 */
export async function runWmChatMeasurementBestEffort(args: {
  persist: () => Promise<CanonicalPersistResult>;
  recordRepair: () => void | Promise<void>;
}): Promise<boolean> {
  try {
    await persistCanonicalEventWithRetry(args.persist);
    return true;
  } catch {
    await args.recordRepair();
    return false;
  }
}

async function persistWmChatLeadCapturedCanonicalBestEffort(args: {
  admin: SupabaseClient;
  leadId: string;
  sessionId: string;
  consent: ParsedConsentRequest;
  clientIp: string | null;
  userAgent: string | null;
}): Promise<void> {
  const { data, error } = await args.admin
    .from("leads")
    .select(
      "id, session_id, source, email, phone_e164, client_slug, attribution, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbc, fbp, gclid, landing_page_url, first_page_path",
    )
    .eq("id", args.leadId)
    .maybeSingle();

  const stored = data as Record<string, unknown> | null;
  if (
    error || !stored || stored.id !== args.leadId ||
    stored.session_id !== args.sessionId ||
    stored.source !== "windowman-first-quote" ||
    typeof stored.phone_e164 !== "string" ||
    !/^\+1\d{10}$/.test(stored.phone_e164)
  ) {
    audit(args.admin, {
      stage: "measurement_repair_required",
      status: "failed",
      session_id: args.sessionId,
      lead_id: args.leadId,
      error_code: "canonical_source_lead_unavailable",
      error_message:
        "Stored WMChat lead could not be loaded for measurement repair.",
    });
    return;
  }

  const attribution = isPlainRecord(stored.attribution)
    ? stored.attribution
    : {};
  const asStoredString = (value: unknown): string | null =>
    typeof value === "string" && value.trim() ? value : null;

  await runWmChatMeasurementBestEffort({
    persist: () =>
      persistLeadCapturedCanonical(args.admin, {
        leadId: args.leadId,
        sessionId: args.sessionId,
        email: asStoredString(stored.email),
        phoneE164: stored.phone_e164 as string,
        clientSlug: asStoredString(stored.client_slug),
        landingPageUrl: asStoredString(stored.landing_page_url),
        firstPagePath: asStoredString(stored.first_page_path),
        utmSource: asStoredString(stored.utm_source),
        utmMedium: asStoredString(stored.utm_medium),
        utmCampaign: asStoredString(stored.utm_campaign),
        utmContent: asStoredString(stored.utm_content),
        utmTerm: asStoredString(stored.utm_term),
        source: "windowman-first-quote",
        attribution,
        fbc: asStoredString(stored.fbc) ??
          pickAttributionString(attribution, "fbc"),
        fbp: asStoredString(stored.fbp) ??
          pickAttributionString(attribution, "fbp"),
        gclid: asStoredString(stored.gclid) ??
          pickAttributionString(attribution, "gclid"),
        clientIp: args.clientIp,
        userAgent: args.userAgent,
        measurementScope: WMCHAT_DAY1_META_SCOPE,
      }, args.consent),
    recordRepair: () =>
      audit(args.admin, {
        stage: "measurement_repair_required",
        status: "failed",
        session_id: args.sessionId,
        lead_id: args.leadId,
        error_code: "canonical_meta_outbox_persist_failed",
        error_message: "WMChat lead measurement requires idempotent repair.",
      }),
  });
}

interface CapturePayload {
  session_id: string;
  first_name: string | null;
  email: string | null;
  phone_e164: string | null;
  county: string | null;
  project_type: string | null;
  window_count: number | null;
  quote_range: string | null;
  source: string;

  client_slug: string | null;

  // Attribution (all optional; null-safe)
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  landing_page_url: string | null;
  first_page_path: string | null;
  initial_referrer: string | null;

  attribution: Record<string, unknown>;
  query_params: Record<string, string | string[]>;
  consent: ParsedConsentRequest;
  wmchat_intake: ValidatedWmChatIntake | null;
  wmchat_stored: StoredWmChatIntake | null;
  wmchat_capture_kind: "protection_kit" | null;
}

export type WmChatPhoneLookupGateResult =
  | { readonly ok: true }
  | {
    readonly ok: false;
    readonly code:
      | "wmchat_phone_invalid"
      | "wmchat_phone_lookup_unavailable";
    readonly message: string;
    readonly status: 422 | 503;
  };

type WmChatPhoneLookup = (
  phoneE164: string,
) => Promise<TwilioBasicLookupResult>;

function requiresFreshWmChatPhoneLookup(
  payload: CapturePayload,
): payload is CapturePayload & { phone_e164: string } {
  return payload.wmchat_stored !== null &&
    payload.wmchat_capture_kind === null &&
    payload.phone_e164 !== null;
}

/**
 * New-lead gate only. The handler intentionally calls this after session
 * reuse has been resolved and before any lead, consent, namespace, or
 * conversion write occurs.
 */
export async function validateFreshWmChatPhoneLookup(
  payload: CapturePayload,
  lookup: WmChatPhoneLookup,
): Promise<WmChatPhoneLookupGateResult> {
  if (!requiresFreshWmChatPhoneLookup(payload)) return { ok: true };

  const result = await lookup(payload.phone_e164);
  if (result.kind === "valid") return { ok: true };
  if (result.kind === "unavailable" && result.reason === "disabled") {
    return { ok: true };
  }
  if (result.kind === "invalid") {
    return {
      ok: false,
      code: "wmchat_phone_invalid",
      message: "That phone number could not be validated.",
      status: 422,
    };
  }
  return {
    ok: false,
    code: "wmchat_phone_lookup_unavailable",
    message: "Phone validation is temporarily unavailable.",
    status: 503,
  };
}

function lookupWmChatPhone(
  phoneE164: string,
): Promise<TwilioBasicLookupResult> {
  return lookupTwilioBasicPhone({
    phoneE164,
    enabled: Deno.env.get("TWILIO_LOOKUP_ENABLED") === "true",
    accountSid: Deno.env.get("TWILIO_ACCOUNT_SID"),
    authToken: Deno.env.get("TWILIO_AUTH_TOKEN"),
  });
}

type AuditStatus = "started" | "succeeded" | "failed" | "reused" | "skipped";

interface AuditEvent {
  ts: string;
  fn: string;
  stage: string;
  status: AuditStatus;
  session_id?: string | null;
  lead_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  has_phone?: boolean;
  has_client_slug?: boolean;
  http_status?: number;
}

/**
 * Stages that are persisted to `event_logs`. All other stages remain
 * console-only. This keeps the persisted audit trail focused on outcomes
 * and failures, not internal step-by-step noise.
 */
const PERSISTED_STAGES = new Set<string>([
  "validation_failed",
  "lead_insert_failed",
  "lead_insert_succeeded",
  "lead_reused",
  "consent_persist_failed",
  "required_capture_persist_failed",
  "measurement_repair_required",
  "unexpected_error",
  "response_sent",
]);

/**
 * Emit a structured audit event. Always console-logged at the appropriate
 * level. Persists to `event_logs` only for summary/failure stages
 * (see PERSISTED_STAGES). Persistence failures NEVER block funnel success.
 *
 * Strictly non-PII: never accepts raw email, phone, name, or file content.
 */
function audit(
  admin: SupabaseClient | null,
  evt: Omit<AuditEvent, "ts" | "fn">,
): void {
  const fullEvt: AuditEvent = {
    ...evt,
    ts: new Date().toISOString(),
    fn: FUNCTION_NAME,
  };

  if (evt.status === "failed") {
    console.error(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else if (evt.status === "skipped") {
    console.warn(`[${FUNCTION_NAME}:audit]`, fullEvt);
  } else {
    console.info(`[${FUNCTION_NAME}:audit]`, fullEvt);
  }

  // Persist only summary / failure / validation stages. Best-effort.
  if (admin && PERSISTED_STAGES.has(evt.stage)) {
    admin
      .from("event_logs")
      .insert({
        event_name: "truthgate_capture_audit",
        session_id: evt.session_id ?? null,
        lead_id: evt.lead_id ?? null,
        route: "/",
        metadata: fullEvt as unknown as Record<string, unknown>,
      })
      .then(({ error }) => {
        if (error) {
          console.warn(`[${FUNCTION_NAME}:audit] event_logs insert failed`, {
            stage: evt.stage,
            code: error.code,
            message: error.message,
          });
        }
      });
  }
}

function jsonResponse(
  body: unknown,
  status: number,
  corsHeaders: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asNullableString(v: unknown, max = 500): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function asRequiredString(v: unknown, max = 500): string | null {
  const s = asNullableString(v, max);
  return s && s.length > 0 ? s : null;
}

function asNullableInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
    return Math.trunc(Number(v));
  }
  return null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expected: ReadonlySet<string>,
): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.size &&
    keys.every((key) => expected.has(key));
}

function invalidWmChatPostCapture(): WmChatPostCaptureParseResult {
  return {
    ok: false,
    code: "invalid_wmchat_post_capture",
    message: "The WindowMan next-step request is invalid.",
  };
}

function normalizeWmChatPostCaptureAddress(
  value: unknown,
): WmChatPostCaptureAddress | null | undefined {
  if (value === null) return null;
  if (
    !isPlainRecord(value) ||
    !hasExactKeys(value, WMCHAT_POST_CAPTURE_ADDRESS_KEYS)
  ) {
    return undefined;
  }

  const { line1, line2, city, region, postal_code: postalCode } = value;
  if (
    typeof line1 !== "string" ||
    typeof line2 !== "string" ||
    typeof city !== "string" ||
    typeof region !== "string" ||
    typeof postalCode !== "string"
  ) {
    return undefined;
  }

  const normalized = {
    line1: line1.trim(),
    line2: line2.trim(),
    city: city.trim(),
    region: region.trim().toUpperCase(),
    postal_code: postalCode.trim(),
  };
  if (
    normalized.line1.length < 3 || normalized.line1.length > 120 ||
    normalized.line2.length > 120 ||
    normalized.city.length < 2 || normalized.city.length > 80 ||
    normalized.region.length < 2 || normalized.region.length > 40 ||
    !/^\d{5}$/.test(normalized.postal_code) ||
    [normalized.line1, normalized.line2, normalized.city, normalized.region]
      .some((entry) => /[\r\n]/.test(entry))
  ) {
    return undefined;
  }
  return normalized;
}

/**
 * Strict validator for the isolated Phase 2 continuation envelope. This runs
 * before the legacy lead-capture parser, attribution, consent, or measurement.
 */
export function parseWmChatPostCaptureRequest(
  input: unknown,
): WmChatPostCaptureParseResult {
  if (
    !isPlainRecord(input) ||
    !hasExactKeys(input, WMCHAT_POST_CAPTURE_ROOT_KEYS)
  ) {
    return invalidWmChatPostCapture();
  }

  const queryParams = input.query_params;
  if (
    input.mode !== WMCHAT_POST_CAPTURE_MODE ||
    input.source !== WMCHAT_POST_CAPTURE_SOURCE ||
    typeof input.lead_id !== "string" || !UUID_RE.test(input.lead_id) ||
    typeof input.session_id !== "string" || !UUID_RE.test(input.session_id) ||
    typeof input.submission_id !== "string" ||
    !UUID_RE.test(input.submission_id) ||
    !isPlainRecord(queryParams) ||
    !hasExactKeys(queryParams, WMCHAT_POST_CAPTURE_QUERY_KEYS) ||
    queryParams.source_path !== WMCHAT_POST_CAPTURE_SOURCE_PATH ||
    queryParams.intake_version !== WMCHAT_POST_CAPTURE_INTAKE_VERSION
  ) {
    return invalidWmChatPostCapture();
  }

  const action = input.action;
  if (
    action !== "quote_request_game_plan" &&
    action !== "schedule_windowman_conversation" &&
    action !== "review_quote_when_ready"
  ) {
    return invalidWmChatPostCapture();
  }

  const propertyAddress = normalizeWmChatPostCaptureAddress(
    input.property_address,
  );
  if (propertyAddress === undefined) return invalidWmChatPostCapture();

  const conversationTime = input.conversation_time_preference;
  const quoteReadiness = input.quote_readiness;
  const callbackPreference = input.callback_preference;

  if (action === "quote_request_game_plan") {
    if (
      conversationTime !== null ||
      quoteReadiness !== null ||
      callbackPreference !== null
    ) {
      return invalidWmChatPostCapture();
    }
  } else if (action === "schedule_windowman_conversation") {
    if (
      typeof conversationTime !== "string" ||
      !WMCHAT_CONVERSATION_TIMES.has(conversationTime) ||
      quoteReadiness !== null ||
      callbackPreference !== null
    ) {
      return invalidWmChatPostCapture();
    }
  } else if (
    propertyAddress !== null ||
    conversationTime !== null ||
    quoteReadiness !== "not_yet" ||
    typeof callbackPreference !== "string" ||
    !WMCHAT_CALLBACK_PREFERENCES.has(callbackPreference)
  ) {
    return invalidWmChatPostCapture();
  }

  return {
    ok: true,
    request: {
      leadId: input.lead_id,
      sessionId: input.session_id,
      submissionId: input.submission_id,
      namespace: {
        schema_version: "1",
        mode: WMCHAT_POST_CAPTURE_MODE,
        source: WMCHAT_POST_CAPTURE_SOURCE,
        submission_id: input.submission_id,
        action,
        property_address: propertyAddress,
        conversation_time_preference: action ===
            "schedule_windowman_conversation"
          ? conversationTime
          : null,
        quote_readiness: action === "review_quote_when_ready"
          ? "not_yet"
          : null,
        callback_preference: action === "review_quote_when_ready"
          ? callbackPreference
          : null,
      },
    },
  };
}

export function isWmChatPostCaptureCandidateEnvelope(input: unknown): boolean {
  return isPlainRecord(input) &&
    Object.prototype.hasOwnProperty.call(input, "mode");
}

export async function persistValidatedWmChatPostCapture(
  request: ValidatedWmChatPostCaptureRequest,
  deps: WmChatPostCapturePersistenceDeps,
): Promise<WmChatPostCapturePersistenceResult> {
  try {
    const loaded = await deps.loadLead(request);
    if (loaded.error) return { ok: false, kind: "storage_unavailable" };
    if (!isPlainRecord(loaded.data)) {
      return { ok: false, kind: "identity_mismatch" };
    }

    const row = loaded.data as unknown as WmChatPostCaptureLeadRow;
    if (
      row.id !== request.leadId ||
      row.session_id !== request.sessionId ||
      row.source !== WMCHAT_POST_CAPTURE_SOURCE ||
      !isPlainRecord(row.qualification_answers_json)
    ) {
      return { ok: false, kind: "identity_mismatch" };
    }

    const stored = validateStoredWmChatIntake(
      row.qualification_answers_json.wmchat_v1,
    );
    if (!stored.ok || stored.intake.continuation !== "sms_then_voice") {
      return { ok: false, kind: "invalid_original" };
    }

    const persisted = await deps.persistNamespace(request, stored.intake);
    if (persisted.error) return { ok: false, kind: "storage_unavailable" };
    if (
      !Array.isArray(persisted.data) || persisted.data.length !== 1 ||
      !isPlainRecord(persisted.data[0])
    ) {
      return { ok: false, kind: "storage_unavailable" };
    }

    const rpcRow = persisted.data[0] as unknown as WmChatPostCaptureRpcRow;
    if (rpcRow.outcome === "inserted" || rpcRow.outcome === "replayed") {
      if (
        rpcRow.lead_id !== request.leadId ||
        rpcRow.session_id !== request.sessionId
      ) {
        return { ok: false, kind: "identity_mismatch" };
      }
      return {
        ok: true,
        outcome: rpcRow.outcome,
        leadId: request.leadId,
        sessionId: request.sessionId,
      };
    }
    if (rpcRow.outcome === "conflict") {
      return { ok: false, kind: "conflict" };
    }
    if (rpcRow.outcome === "identity_mismatch") {
      return { ok: false, kind: "identity_mismatch" };
    }
    if (rpcRow.outcome === "invalid_original") {
      return { ok: false, kind: "invalid_original" };
    }
    if (rpcRow.outcome === "invalid_namespace") {
      return { ok: false, kind: "invalid_namespace" };
    }
    return { ok: false, kind: "storage_unavailable" };
  } catch {
    return { ok: false, kind: "storage_unavailable" };
  }
}

export function isValidCaptureIdentity(
  leadId: unknown,
  returnedSessionId: unknown,
  submittedSessionId: string,
): leadId is string {
  return typeof leadId === "string" && UUID_RE.test(leadId) &&
    typeof returnedSessionId === "string" &&
    UUID_RE.test(returnedSessionId) &&
    returnedSessionId === submittedSessionId;
}

function exactQueryString(
  queryParams: Record<string, string | string[]>,
  key: string,
): string | null {
  const value = queryParams[key];
  return typeof value === "string" ? value : null;
}

function isStrictWmChatConsent(consent: ParsedConsentRequest): boolean {
  if (consent.events.length < 1 || consent.events.length > 2) return false;

  const service = consent.events.find(
    (event) => event.purpose === "service_communications",
  );
  const measurement = consent.events.find(
    (event) => event.purpose === "advertising_measurement",
  );

  return service?.decision === "granted" &&
    (!measurement ||
      measurement.decision === "granted" ||
      measurement.decision === "declined") &&
    consent.events.every(
      (event) =>
        event.purpose === "service_communications" ||
        event.purpose === "advertising_measurement",
    );
}

function normalizeIntentValue(value: string): string {
  return value.trim().toLowerCase().replace(/-/g, "_");
}

function hasNoQuoteIntent(
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, string | string[]> | null | undefined,
): boolean {
  const intents: string[] = [];

  if (typeof attribution?.wm_intent === "string") {
    intents.push(attribution.wm_intent);
  }

  const queryIntent = queryParams?.wm_intent;
  if (typeof queryIntent === "string") {
    intents.push(queryIntent);
  } else if (Array.isArray(queryIntent)) {
    for (const value of queryIntent) {
      if (typeof value === "string") {
        intents.push(value);
      }
    }
  }

  return intents.map(normalizeIntentValue).includes("no_quote");
}

/**
 * Paid no_quote leads must complete organic quiz UI steps to reach the form.
 * Nullify project-scope quiz scalars before insert so CPL/ROI reporting is not
 * polluted by dummy answers. County is preserved (geo/routing). Attribution and
 * query_params (including wm_intent) are untouched.
 */
function scrubNoQuoteOrganicFields(payload: CapturePayload): void {
  if (!hasNoQuoteIntent(payload.attribution, payload.query_params)) return;

  payload.window_count = null;
  payload.project_type = null;
  payload.quote_range = null;
}

export function parseAndValidate(input: unknown):
  | { ok: true; payload: CapturePayload }
  | { ok: false; code: string; message: string; details?: unknown } {
  if (!input || typeof input !== "object") {
    return {
      ok: false,
      code: "invalid_body",
      message: "Body must be JSON object.",
    };
  }

  const b = input as Record<string, unknown>;

  const session_id = asRequiredString(b.session_id, 64);
  if (!session_id || !UUID_RE.test(session_id)) {
    return {
      ok: false,
      code: "invalid_session_id",
      message: "session_id must be a valid UUID.",
    };
  }

  const source = asRequiredString(b.source, 64) ?? "truth-gate";
  const sanitizedAttribution = preserveSiteWideAttributionFields(
    sanitizeAttributionInput(b.attribution),
    b.attribution,
  );
  const sanitizedQueryParams = sanitizeQueryParamsInput(b.query_params);

  const rawQueryParams = b.query_params &&
      typeof b.query_params === "object" &&
      !Array.isArray(b.query_params)
    ? b.query_params as Record<string, unknown>
    : {};
  const sourcePath = typeof rawQueryParams.source_path === "string"
    ? exactQueryString(sanitizedQueryParams, "source_path")
    : null;
  const intakeVersion = typeof rawQueryParams.intake_version === "string"
    ? exactQueryString(
      sanitizedQueryParams,
      "intake_version",
    )
    : null;
  const queryCaptureKind = typeof rawQueryParams.capture_kind === "string"
    ? exactQueryString(sanitizedQueryParams, "capture_kind")
    : null;
  const entryPoint = typeof rawQueryParams.entry_point === "string"
    ? exactQueryString(sanitizedQueryParams, "entry_point")
    : null;
  const hasWmChatMarker = b.wmchat_intake !== undefined ||
    b.wmchat_capture_kind !== undefined || sourcePath === "/wmchat" ||
    intakeVersion === "wmchat_v1";

  let first_name: string | null;
  let email: string | null;
  let phone_e164: string | null;
  let consentParsed: ReturnType<typeof validateConsentRequest>;
  let wmchat_intake: ValidatedWmChatIntake | null = null;
  let wmchat_stored: StoredWmChatIntake | null = null;
  let wmchat_capture_kind: "protection_kit" | null = null;

  if (hasWmChatMarker) {
    if (
      source !== "windowman-first-quote" ||
      sourcePath !== "/wmchat" ||
      intakeVersion !== "wmchat_v1"
    ) {
      return {
        ok: false,
        code: "invalid_wmchat_contract",
        message: "WindowMan capture markers do not agree.",
      };
    }

    const intakeParsed = validateWmChatIntake(b.wmchat_intake);
    if (!intakeParsed.ok) {
      return {
        ok: false,
        code: intakeParsed.code,
        message: intakeParsed.message,
      };
    }

    consentParsed = validateConsentRequest(b.consent, source);
    if (!consentParsed.ok) {
      return {
        ok: false,
        code: consentParsed.code,
        message: consentParsed.message,
      };
    }
    if (!isStrictWmChatConsent(consentParsed.consent)) {
      return {
        ok: false,
        code: "invalid_wmchat_consent",
        message: "WindowMan capture requires service-only authorization.",
      };
    }
    const isProtectionKitCapture = b.wmchat_capture_kind === "protection_kit" &&
      queryCaptureKind === "protection_kit" && entryPoint === "wm_chat" &&
      isProtectionKitWmChatIntake(intakeParsed.intake);

    if (isProtectionKitCapture) {
      if (b.first_name !== null || b.phone_e164 !== null) {
        return {
          ok: false,
          code: "invalid_wmchat_email_contact",
          message: "Protection Kit capture accepts email only.",
        };
      }
      const rawEmail = typeof b.email === "string" ? b.email.trim() : "";
      email = rawEmail.toLowerCase();
      if (!email || email.length > 255 || !EMAIL_RE.test(email)) {
        return {
          ok: false,
          code: "invalid_wmchat_email",
          message: "A valid email is required for the Protection Kit.",
        };
      }
      first_name = null;
      phone_e164 = null;
      wmchat_capture_kind = "protection_kit";
    } else {
      if (
        b.wmchat_capture_kind !== undefined || queryCaptureKind !== null ||
        isProtectionKitWmChatIntake(intakeParsed.intake)
      ) {
        return {
          ok: false,
          code: "invalid_wmchat_capture_kind",
          message: "WindowMan capture mode does not match the completed path.",
        };
      }
      if (b.email !== null) {
        return {
          ok: false,
          code: "invalid_wmchat_email",
          message: "WindowMan mobile capture does not accept email.",
        };
      }

      if (b.first_name === null) {
        first_name = null;
      } else if (typeof b.first_name === "string") {
        first_name = b.first_name.trim();
        if (first_name.length < 2 || first_name.length > 100) {
          return {
            ok: false,
            code: "invalid_first_name",
            message: "first_name must be null or 2–100 characters.",
          };
        }
      } else {
        return {
          ok: false,
          code: "invalid_first_name",
          message: "first_name must be null or 2–100 characters.",
        };
      }

      phone_e164 = asNullableString(b.phone_e164, 32);
      if (!phone_e164 || !/^\+1\d{10}$/.test(phone_e164)) {
        return {
          ok: false,
          code: "invalid_wmchat_phone",
          message: "A valid US mobile in E.164 format is required.",
        };
      }
      email = null;
    }
    wmchat_intake = intakeParsed.intake;
    wmchat_stored = buildStoredWmChatIntake(
      intakeParsed.intake,
      new Date().toISOString(),
    );
  } else {
    // Preserve the existing contact contract for every legacy caller.
    first_name = asRequiredString(b.first_name, 100);
    if (!first_name || first_name.length < 2) {
      return {
        ok: false,
        code: "invalid_first_name",
        message: "first_name is required (2+ chars).",
      };
    }

    const rawEmail = asRequiredString(b.email, 255);
    email = rawEmail ? rawEmail.toLowerCase() : null;
    if (!email || !EMAIL_RE.test(email)) {
      return {
        ok: false,
        code: "invalid_email",
        message: "A valid email is required.",
      };
    }

    // Legacy phone remains optional. A malformed optional value is dropped.
    phone_e164 = asNullableString(b.phone_e164, 32);
    if (phone_e164 && !/^\+\d{10,15}$/.test(phone_e164)) {
      phone_e164 = null;
    }

    consentParsed = validateConsentRequest(b.consent, source);
    if (!consentParsed.ok) {
      return {
        ok: false,
        code: consentParsed.code,
        message: consentParsed.message,
      };
    }
  }

  const payload: CapturePayload = {
    session_id,
    first_name,
    email,
    phone_e164,
    county: asNullableString(b.county, 100),
    project_type: asNullableString(b.project_type, 100),
    window_count: asNullableInt(b.window_count),
    quote_range: asNullableString(b.quote_range, 50),
    source,

    client_slug: asNullableString(b.client_slug, 100),

    utm_source: asNullableString(b.utm_source, 255),
    utm_medium: asNullableString(b.utm_medium, 255),
    utm_campaign: asNullableString(b.utm_campaign, 255),
    utm_term: asNullableString(b.utm_term, 255),
    utm_content: asNullableString(b.utm_content, 255),
    fbclid: asNullableString(b.fbclid, 500),
    gclid: asNullableString(b.gclid, 500),
    fbc: asNullableString(b.fbc, 500),
    fbp: asNullableString(b.fbp, 500),
    landing_page_url: asNullableString(b.landing_page_url, 1000),
    first_page_path: asNullableString(b.first_page_path, 500),
    initial_referrer: asNullableString(b.initial_referrer, 1000),

    attribution: sanitizedAttribution,
    query_params: sanitizedQueryParams,
    consent: consentParsed.consent,
    wmchat_intake,
    wmchat_stored,
    wmchat_capture_kind,
  };

  return { ok: true, payload };
}

async function persistCaptureConsent(
  admin: SupabaseClient,
  leadId: string,
  sessionId: string,
  consent: ParsedConsentRequest,
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  return persistConsentBatch({
    rpc: async (fn, args) => {
      const { error } = await admin.rpc(fn, args);
      return { error };
    },
  }, {
    leadId,
    sessionId,
    consent,
  });
}

type RequiredCaptureResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function recoverWmChatSessionUniqueConflict(args: {
  errorCode: string | null | undefined;
  hasWmChatIntake: boolean;
  loadExistingLeadId: () => Promise<string | null>;
  completeExistingLead: (leadId: string) => Promise<RequiredCaptureResult>;
}): Promise<
  | { recovered: false }
  | {
    recovered: true;
    leadId: string;
    completion: RequiredCaptureResult;
  }
> {
  if (args.errorCode !== "23505" || !args.hasWmChatIntake) {
    return { recovered: false };
  }

  const leadId = await args.loadExistingLeadId();
  if (!leadId) return { recovered: false };

  return {
    recovered: true,
    leadId,
    completion: await args.completeExistingLead(leadId),
  };
}

function requiredCaptureFailureStatus(code: string): number {
  return consentPersistFailureStatus(code);
}

export function buildWmChatInsertQualification(
  stored: StoredWmChatIntake,
): Record<string, unknown> {
  return mergeWmChatQualificationNamespace({}, stored);
}

export type ExpectedWmChatReuseContact =
  | {
    mode: "protection_kit";
    email: string;
  }
  | {
    mode: "mobile";
    phoneE164: string;
    firstName: string | null;
  };

export function isMatchingWmChatReuseLead(
  value: unknown,
  sessionId: string,
  expectedContact: ExpectedWmChatReuseContact,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const lead = value as Record<string, unknown>;
  if (
    typeof lead.id !== "string" || !UUID_RE.test(lead.id) ||
    lead.session_id !== sessionId || lead.source !== "windowman-first-quote"
  ) {
    return false;
  }
  if (expectedContact.mode === "protection_kit") {
    return typeof lead.email === "string" &&
      lead.email.trim().toLowerCase() === expectedContact.email &&
      lead.first_name === null && lead.phone_e164 === null;
  }

  return lead.email === null &&
    lead.phone_e164 === expectedContact.phoneE164 &&
    lead.first_name === expectedContact.firstName;
}

/**
 * Pure ordering boundary used by focused tests. A /wmchat response may not run
 * success effects until both append-only consent and the namespaced intake are
 * durable.
 */
export async function persistWmChatRequiredCaptureData(args: {
  verifyLead: () => Promise<RequiredCaptureResult>;
  persistConsent: () => Promise<RequiredCaptureResult>;
  persistNamespace: () => Promise<RequiredCaptureResult>;
  runSuccessEffects: () => Promise<RequiredCaptureResult>;
}): Promise<RequiredCaptureResult> {
  const verified = await args.verifyLead();
  if (!verified.ok) return verified;

  const consent = await args.persistConsent();
  if (!consent.ok) return consent;

  const namespace = await args.persistNamespace();
  if (!namespace.ok) return namespace;

  return args.runSuccessEffects();
}

async function loadWmChatQualificationForUpdate(
  admin: SupabaseClient,
  leadId: string,
  sessionId: string,
  stored: StoredWmChatIntake,
  expectedContact: ExpectedWmChatReuseContact,
): Promise<
  | { ok: true; qualification: Record<string, unknown> }
  | { ok: false; code: string; message: string }
> {
  const { data, error } = await admin
    .from("leads")
    .select(
      "id, session_id, source, email, first_name, phone_e164, qualification_answers_json",
    )
    .eq("id", leadId)
    .eq("session_id", sessionId)
    .eq("source", "windowman-first-quote")
    .maybeSingle();

  if (error || !isMatchingWmChatReuseLead(data, sessionId, expectedContact)) {
    return {
      ok: false,
      code: "wmchat_lead_mismatch",
      message: "WindowMan lead/session ownership could not be confirmed.",
    };
  }

  return {
    ok: true,
    qualification: mergeWmChatQualificationNamespace(
      (data as { qualification_answers_json?: unknown })
        .qualification_answers_json,
      stored,
    ),
  };
}

async function updateWmChatQualificationNamespace(
  admin: SupabaseClient,
  leadId: string,
  sessionId: string,
  qualification: Record<string, unknown>,
): Promise<RequiredCaptureResult> {
  const { data, error } = await admin
    .from("leads")
    .update({ qualification_answers_json: qualification })
    .eq("id", leadId)
    .eq("session_id", sessionId)
    .eq("source", "windowman-first-quote")
    .select("id, session_id")
    .maybeSingle();

  if (error || !data?.id || data.session_id !== sessionId) {
    return {
      ok: false,
      code: "wmchat_namespace_persist_failed",
      message: "Could not save the WindowMan intake.",
    };
  }
  return { ok: true };
}

async function persistCaptureRequirementsThenRunEffects(args: {
  admin: SupabaseClient;
  leadId: string;
  payload: CapturePayload;
  runSuccessEffects: () => Promise<RequiredCaptureResult>;
}): Promise<RequiredCaptureResult> {
  const { admin, leadId, payload } = args;
  if (!payload.wmchat_stored) {
    const consent = await persistCaptureConsent(
      admin,
      leadId,
      payload.session_id,
      payload.consent,
    );
    if (!consent.ok) return consent;
    return args.runSuccessEffects();
  }

  let preparedQualification: Record<string, unknown> | null = null;
  return persistWmChatRequiredCaptureData({
    verifyLead: async () => {
      const prepared = await loadWmChatQualificationForUpdate(
        admin,
        leadId,
        payload.session_id,
        payload.wmchat_stored!,
        payload.wmchat_capture_kind === "protection_kit"
          ? {
            mode: "protection_kit",
            email: payload.email!,
          }
          : {
            mode: "mobile",
            phoneE164: payload.phone_e164!,
            firstName: payload.first_name,
          },
      );
      if (!prepared.ok) return prepared;
      preparedQualification = prepared.qualification;
      return { ok: true };
    },
    persistConsent: () =>
      persistCaptureConsent(
        admin,
        leadId,
        payload.session_id,
        payload.consent,
      ),
    persistNamespace: () => {
      if (!preparedQualification) {
        return Promise.resolve({
          ok: false as const,
          code: "wmchat_namespace_persist_failed",
          message: "Could not save the WindowMan intake.",
        });
      }
      return updateWmChatQualificationNamespace(
        admin,
        leadId,
        payload.session_id,
        preparedQualification,
      );
    },
    runSuccessEffects: args.runSuccessEffects,
  });
}

async function completeWmChatLeadCaptureEffects(args: {
  admin: SupabaseClient;
  leadId: string;
  payload: CapturePayload;
  clientIp: string | null;
  userAgent: string | null;
  mergeAttribution: boolean;
}): Promise<RequiredCaptureResult> {
  if (args.mergeAttribution) {
    await mergeExistingLeadAttribution(
      args.admin,
      args.leadId,
      args.payload.attribution,
      args.payload.query_params,
    );
  }

  if (args.payload.wmchat_stored && args.payload.wmchat_capture_kind === null) {
    await persistWmChatLeadCapturedCanonicalBestEffort({
      admin: args.admin,
      leadId: args.leadId,
      sessionId: args.payload.session_id,
      consent: args.payload.consent,
      clientIp: args.clientIp,
      userAgent: args.userAgent,
    });
  } else {
    await maybePersistLeadCapturedCanonical(args.admin, {
      leadId: args.leadId,
      sessionId: args.payload.session_id,
      email: args.payload.email,
      phoneE164: args.payload.phone_e164,
      clientSlug: args.payload.client_slug,
      landingPageUrl: args.payload.landing_page_url,
      firstPagePath: args.payload.first_page_path,
      utmSource: args.payload.utm_source,
      utmMedium: args.payload.utm_medium,
      utmCampaign: args.payload.utm_campaign,
      utmContent: args.payload.utm_content,
      utmTerm: args.payload.utm_term,
      source: args.payload.source,
      attribution: args.payload.attribution,
    });
  }

  const derivedLeadSource = deriveLeadSourceFromSource(args.payload.source);
  await args.admin
    .from("leads")
    .update({ lead_source: derivedLeadSource })
    .eq("id", args.leadId);
  await emitTruthGateCaptureActivity(args.admin, {
    leadId: args.leadId,
    source: args.payload.source,
    email: args.payload.email,
    phone_e164: args.payload.phone_e164,
  });
  return { ok: true };
}

async function handleWmChatPostCapture(
  body: unknown,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const parsed = parseWmChatPostCaptureRequest(body);
  if (!parsed.ok) {
    return jsonResponse(
      { success: false, code: parsed.code, message: parsed.message },
      400,
      corsHeaders,
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    console.error(`[${FUNCTION_NAME}] missing service-role env`);
    return jsonResponse(
      {
        success: false,
        code: "server_misconfigured",
        message: "Server misconfigured.",
      },
      500,
      corsHeaders,
    );
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false },
  });
  const result = await persistValidatedWmChatPostCapture(parsed.request, {
    loadLead: async (request) => {
      const response = await admin
        .from("leads")
        .select("id, session_id, source, qualification_answers_json")
        .eq("id", request.leadId)
        .eq("session_id", request.sessionId)
        .eq("source", WMCHAT_POST_CAPTURE_SOURCE)
        .maybeSingle();
      return { data: response.data, error: response.error };
    },
    persistNamespace: async (request, expectedWmChatV1) => {
      const response = await admin.rpc("persist_wmchat_post_capture_v1", {
        p_lead_id: request.leadId,
        p_session_id: request.sessionId,
        p_source: WMCHAT_POST_CAPTURE_SOURCE,
        p_submission_id: request.submissionId,
        p_expected_wmchat_v1: expectedWmChatV1,
        p_namespace: request.namespace,
      });
      return { data: response.data, error: response.error };
    },
  });

  if (result.ok) {
    return jsonResponse(
      {
        success: true,
        lead_id: result.leadId,
        session_id: result.sessionId,
      },
      200,
      corsHeaders,
    );
  }

  const failure = {
    conflict: {
      status: 409,
      code: "wmchat_post_capture_conflict",
      message: "A different next step is already saved for this project.",
    },
    identity_mismatch: {
      status: 404,
      code: "wmchat_post_capture_identity_mismatch",
      message: "The saved project could not be matched.",
    },
    invalid_original: {
      status: 409,
      code: "wmchat_post_capture_original_invalid",
      message: "The saved project cannot accept this next step.",
    },
    invalid_namespace: {
      status: 400,
      code: "invalid_wmchat_post_capture",
      message: "The WindowMan next-step request is invalid.",
    },
    storage_unavailable: {
      status: 503,
      code: "wmchat_post_capture_unavailable",
      message: "The next step could not be saved safely.",
    },
  }[result.kind];

  return jsonResponse(
    { success: false, code: failure.code, message: failure.message },
    failure.status,
    corsHeaders,
  );
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  // request_received audit (no admin client yet — console-only)
  audit(null, { stage: "request_received", status: "started" });

  if (req.method !== "POST") {
    return jsonResponse(
      { success: false, code: "method_not_allowed", message: "Use POST." },
      405,
      corsHeaders,
    );
  }

  let bodyJson: unknown;
  try {
    bodyJson = await req.json();
  } catch {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: "invalid_json",
      error_message: "Body must be valid JSON.",
    });
    return jsonResponse(
      {
        success: false,
        code: "invalid_json",
        message: "Body must be valid JSON.",
      },
      400,
      corsHeaders,
    );
  }

  // The post-capture continuation is a deliberately isolated update mode.
  // It exits before legacy parsing, attribution, consent, audit persistence,
  // lead capture/reuse, CRM activity, and every conversion side effect.
  if (isWmChatPostCaptureCandidateEnvelope(bodyJson)) {
    return handleWmChatPostCapture(bodyJson, corsHeaders);
  }

  const parsed = parseAndValidate(bodyJson);
  if (!parsed.ok) {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: parsed.code,
      error_message: parsed.message,
    });
    return jsonResponse(
      {
        success: false,
        code: parsed.code,
        message: parsed.message,
        details: parsed.details ?? null,
      },
      400,
      corsHeaders,
    );
  }

  const { payload } = parsed;
  const openAiAdsContext = parseOpenAiAdsClientContext(bodyJson);
  scrubNoQuoteOrganicFields(payload);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    console.error(`[${FUNCTION_NAME}] missing service-role env`);
    audit(null, {
      stage: "lead_insert_failed",
      status: "failed",
      session_id: payload.session_id,
      error_code: "server_misconfigured",
      error_message: "Service credentials missing.",
    });
    return jsonResponse(
      {
        success: false,
        code: "server_misconfigured",
        message: "Server misconfigured.",
      },
      500,
      corsHeaders,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false },
  });

  audit(admin, {
    stage: "lead_insert_started",
    status: "started",
    session_id: payload.session_id,
    has_phone: !!payload.phone_e164,
    has_client_slug: !!payload.client_slug,
  });

  // ── Idempotency: lookup existing lead bound to this session_id ───────────
  // If found, reuse it. Do not insert a duplicate. Do not update OTP /
  // verified state. Do not overwrite PII in this pass.
  let reuseLeadResolved = false;
  try {
    const { data: existing, error: lookupErr } = await admin.rpc(
      "get_lead_by_session",
      { p_session_id: payload.session_id },
    );

    if (lookupErr) {
      if (payload.wmchat_stored) {
        return jsonResponse(
          {
            success: false,
            code: "wmchat_session_lookup_failed",
            message: "Could not safely check the existing WindowMan session.",
          },
          500,
          corsHeaders,
        );
      }
      // Lookup failure is non-fatal — fall through to insert. Postgres unique
      // constraints (if any) will still protect against true duplicates.
      console.warn(`[${FUNCTION_NAME}] session lookup failed`, {
        code: lookupErr.code,
        message: lookupErr.message,
      });
    } else if (
      Array.isArray(existing) && existing.length > 0 && existing[0]?.id
    ) {
      const reusedLeadId = existing[0].id as string;
      reuseLeadResolved = true;
      if (
        !isValidCaptureIdentity(
          reusedLeadId,
          payload.session_id,
          payload.session_id,
        )
      ) {
        return jsonResponse(
          {
            success: false,
            code: "invalid_reused_lead_id",
            message: "Stored lead identity is invalid.",
          },
          500,
          corsHeaders,
        );
      }
      // Required consent persistence FIRST — no success side effect (attribution
      // merge, canonical lead_captured, lead_source update, CRM activity) may
      // run unless the consent batch is durably recorded.
      const consentPersist = await persistCaptureRequirementsThenRunEffects({
        admin,
        leadId: reusedLeadId,
        payload,
        runSuccessEffects: () =>
          completeWmChatLeadCaptureEffects({
            admin,
            leadId: reusedLeadId,
            payload,
            clientIp: extractOpenAiAdsClientIp(req.headers),
            userAgent: req.headers.get("user-agent"),
            mergeAttribution: true,
          }),
      });
      if (!consentPersist.ok) {
        audit(admin, {
          stage: payload.wmchat_stored
            ? "required_capture_persist_failed"
            : "consent_persist_failed",
          status: "failed",
          session_id: payload.session_id,
          lead_id: reusedLeadId,
          error_code: consentPersist.code,
          error_message: consentPersist.message,
        });
        return jsonResponse(
          {
            success: false,
            code: consentPersist.code,
            message: consentPersist.message,
          },
          requiredCaptureFailureStatus(consentPersist.code),
          corsHeaders,
        );
      }
      audit(admin, {
        stage: "lead_reused",
        status: "reused",
        session_id: payload.session_id,
        lead_id: reusedLeadId,
        has_phone: !!payload.phone_e164,
        has_client_slug: !!payload.client_slug,
      });
      audit(admin, {
        stage: "response_sent",
        status: "succeeded",
        session_id: payload.session_id,
        lead_id: reusedLeadId,
        http_status: 200,
      });
      return jsonResponse(
        {
          success: true,
          lead_id: reusedLeadId,
          session_id: payload.session_id,
          reused: true,
        },
        200,
        corsHeaders,
      );
    }
  } catch (e) {
    if (reuseLeadResolved || payload.wmchat_stored) {
      audit(admin, {
        stage: "unexpected_error",
        status: "failed",
        session_id: payload.session_id,
        error_code: reuseLeadResolved
          ? "lead_reuse_failed"
          : "wmchat_session_lookup_failed",
        error_message: reuseLeadResolved
          ? "Existing lead reuse failed."
          : "WindowMan session lookup failed.",
      });
      return jsonResponse(
        {
          success: false,
          code: reuseLeadResolved
            ? "lead_reuse_failed"
            : "wmchat_session_lookup_failed",
          message: reuseLeadResolved
            ? "Could not safely reuse the existing lead."
            : "Could not safely check the existing WindowMan session.",
        },
        500,
        corsHeaders,
      );
    }
    // Non-fatal — proceed to insert path.
    console.warn(`[${FUNCTION_NAME}] session lookup threw`, String(e));
  }

  const wmchatPhoneLookup = await validateFreshWmChatPhoneLookup(
    payload,
    lookupWmChatPhone,
  );
  if (!wmchatPhoneLookup.ok) {
    audit(admin, {
      stage: "phone_lookup_failed",
      status: "failed",
      session_id: payload.session_id,
      error_code: wmchatPhoneLookup.code,
      error_message: wmchatPhoneLookup.message,
      has_phone: true,
      has_client_slug: !!payload.client_slug,
      http_status: wmchatPhoneLookup.status,
    });
    return jsonResponse(
      {
        success: false,
        code: wmchatPhoneLookup.code,
        message: wmchatPhoneLookup.message,
      },
      wmchatPhoneLookup.status,
      corsHeaders,
    );
  }

  // Force OTP-gate-safe defaults — this path must never elevate a lead.
  const promotedFromAttribution = promoteLeadScalarFields(
    payload.attribution,
    {
      utm_source: payload.utm_source,
      utm_medium: payload.utm_medium,
      utm_campaign: payload.utm_campaign,
      utm_term: payload.utm_term,
      utm_content: payload.utm_content,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      landing_page_url: payload.landing_page_url,
      first_page_path: payload.first_page_path,
      initial_referrer: payload.initial_referrer,
      client_slug: payload.client_slug,
    },
  );

  const strippedPayload = stripConsentForLeadsInsert(payload);
  const {
    wmchat_intake: _wmchatIntake,
    wmchat_stored: wmchatStored,
    wmchat_capture_kind: _wmchatCaptureKind,
    ...leadPayload
  } = strippedPayload;

  const insertRow = {
    ...leadPayload,
    ...promotedFromAttribution,
    utm_source: payload.utm_source ?? promotedFromAttribution.utm_source ??
      null,
    utm_medium: payload.utm_medium ?? promotedFromAttribution.utm_medium ??
      null,
    utm_campaign: payload.utm_campaign ??
      promotedFromAttribution.utm_campaign ?? null,
    utm_term: payload.utm_term ?? promotedFromAttribution.utm_term ?? null,
    utm_content: payload.utm_content ?? promotedFromAttribution.utm_content ??
      null,
    fbclid: payload.fbclid ?? promotedFromAttribution.fbclid ?? null,
    gclid: payload.gclid ?? promotedFromAttribution.gclid ?? null,
    fbc: payload.fbc ?? promotedFromAttribution.fbc ?? null,
    fbp: payload.fbp ?? promotedFromAttribution.fbp ?? null,
    landing_page_url: payload.landing_page_url ??
      promotedFromAttribution.landing_page_url ??
      null,
    first_page_path: payload.first_page_path ??
      promotedFromAttribution.first_page_path ??
      null,
    initial_referrer: payload.initial_referrer ??
      promotedFromAttribution.initial_referrer ??
      null,
    client_slug: payload.client_slug ?? promotedFromAttribution.client_slug ??
      null,
    status: "new",
    phone_verified: false,
    phone_verified_at: null,
    otp_state: null,
    otp_failure_count: 0,
    otp_locked_until: null,
    last_otp_verified_at: null,
    report_unlocked_at: null,
    lead_source: deriveLeadSourceFromSource(payload.source),
    ...(wmchatStored
      ? {
        qualification_answers_json: buildWmChatInsertQualification(
          wmchatStored,
        ),
      }
      : {}),
  };

  const { data, error } = await admin
    .from("leads")
    .insert(insertRow)
    .select("id, session_id")
    .single();

  if (error) {
    // The partial unique index on WMChat session_id closes the lookup/insert
    // race. The losing request completes the same idempotent consent,
    // namespace, event, and outbox path against the winner's durable lead.
    const conflictRecovery = await recoverWmChatSessionUniqueConflict({
      errorCode: error.code,
      hasWmChatIntake: payload.wmchat_stored !== null,
      loadExistingLeadId: async () => {
        const { data: existingAfterConflict, error: recoveryLookupError } =
          await admin.rpc("get_lead_by_session", {
            p_session_id: payload.session_id,
          });
        const recoveredLeadId = !recoveryLookupError &&
            Array.isArray(existingAfterConflict) &&
            typeof existingAfterConflict[0]?.id === "string"
          ? existingAfterConflict[0].id as string
          : null;
        return recoveredLeadId &&
            isValidCaptureIdentity(
              recoveredLeadId,
              payload.session_id,
              payload.session_id,
            )
          ? recoveredLeadId
          : null;
      },
      completeExistingLead: (leadId) =>
        persistCaptureRequirementsThenRunEffects({
          admin,
          leadId,
          payload,
          runSuccessEffects: () =>
            completeWmChatLeadCaptureEffects({
              admin,
              leadId,
              payload,
              clientIp: extractOpenAiAdsClientIp(req.headers),
              userAgent: req.headers.get("user-agent"),
              mergeAttribution: true,
            }),
        }),
    });

    if (conflictRecovery.recovered) {
      const recoveredLeadId = conflictRecovery.leadId;
      const recovered = conflictRecovery.completion;
      if (recovered.ok) {
        audit(admin, {
          stage: "lead_reused",
          status: "reused",
          session_id: payload.session_id,
          lead_id: recoveredLeadId,
          has_phone: true,
          has_client_slug: !!payload.client_slug,
        });
        audit(admin, {
          stage: "response_sent",
          status: "succeeded",
          session_id: payload.session_id,
          lead_id: recoveredLeadId,
          http_status: 200,
        });
        return jsonResponse(
          {
            success: true,
            lead_id: recoveredLeadId,
            session_id: payload.session_id,
            reused: true,
          },
          200,
          corsHeaders,
        );
      }

      audit(admin, {
        stage: "required_capture_persist_failed",
        status: "failed",
        session_id: payload.session_id,
        lead_id: recoveredLeadId,
        error_code: recovered.code,
        error_message: recovered.message,
      });
      return jsonResponse(
        {
          success: false,
          code: recovered.code,
          message: recovered.message,
        },
        requiredCaptureFailureStatus(recovered.code),
        corsHeaders,
      );
    }

    audit(admin, {
      stage: "lead_insert_failed",
      status: "failed",
      session_id: payload.session_id,
      error_code: error.code || "insert_failed",
      error_message: error.message || "Lead insert failed.",
      has_phone: !!payload.phone_e164,
      has_client_slug: !!payload.client_slug,
    });

    return jsonResponse(
      {
        success: false,
        code: error.code || "insert_failed",
        message: error.message || "Lead insert failed.",
        details: error.details ?? null,
        hint: error.hint ?? null,
      },
      500,
      corsHeaders,
    );
  }

  audit(admin, {
    stage: "lead_insert_succeeded",
    status: "succeeded",
    session_id: payload.session_id,
    lead_id: data?.id ?? null,
    has_phone: !!payload.phone_e164,
    has_client_slug: !!payload.client_slug,
  });

  // Server-canonical OpenAI Ads conversion identity exists only for this
  // successful new TruthGate insert. Reused and failed paths return earlier,
  // and the dispatch itself is deferred until required consent persistence
  // succeeds below — measurement is a success signal and must not fire for a
  // lead whose consent batch failed to record.
  let openAiAdsEventId: string | null = null;

  const insertedLeadId = data?.id as string | undefined;
  const insertedSessionId = data?.session_id as string | undefined;
  if (
    !isValidCaptureIdentity(
      insertedLeadId,
      insertedSessionId,
      payload.session_id,
    )
  ) {
    return jsonResponse(
      {
        success: false,
        code: "invalid_persisted_identity",
        message: "Lead identity could not be confirmed.",
      },
      500,
      corsHeaders,
    );
  }

  {
    // Required consent persistence FIRST. Lead/consent/namespace failures may
    // fail the capture; downstream advertising measurement may not. Canonical
    // event/outbox failure is retried and recorded for repair while the durable
    // homeowner lead still receives a successful response.
    const consentPersist = await persistCaptureRequirementsThenRunEffects({
      admin,
      leadId: insertedLeadId,
      payload,
      runSuccessEffects: () =>
        completeWmChatLeadCaptureEffects({
          admin,
          leadId: insertedLeadId,
          payload,
          clientIp: extractOpenAiAdsClientIp(req.headers),
          userAgent: req.headers.get("user-agent"),
          mergeAttribution: false,
        }),
    });
    if (!consentPersist.ok) {
      audit(admin, {
        stage: payload.wmchat_stored
          ? "required_capture_persist_failed"
          : "consent_persist_failed",
        status: "failed",
        session_id: payload.session_id,
        lead_id: insertedLeadId,
        error_code: consentPersist.code,
        error_message: consentPersist.message,
      });
      return jsonResponse(
        {
          success: false,
          code: consentPersist.code,
          message: consentPersist.message,
        },
        requiredCaptureFailureStatus(consentPersist.code),
        corsHeaders,
      );
    }
  }

  // OpenAI Ads conversion identity + server dispatch — runs ONLY after the
  // consent batch above persisted successfully (all failure paths returned).
  if (payload.source === "truth-gate" && payload.email) {
    try {
      openAiAdsEventId = buildOpenAiAdsLeadEventId(insertedLeadId);

      if (openAiAdsContext) {
        const requestOrigin = getOriginFromRequest(req);
        const trustedRequestOrigin = isAllowedOrigin(requestOrigin)
          ? requestOrigin
          : null;
        const openAiAdsConfig = readOpenAiAdsRuntimeConfig((name) =>
          Deno.env.get(name)
        );

        scheduleOpenAiAdsConversion(
          openAiAdsEventId,
          sendOpenAiAdsLeadCreated({
            eventId: openAiAdsEventId,
            timestampMs: Date.now(),
            email: payload.email,
            context: openAiAdsContext,
            requestOrigin: trustedRequestOrigin,
            canonicalSiteOrigin: openAiAdsConfig.canonicalSiteOrigin,
            ipAddress: extractOpenAiAdsClientIp(req.headers),
            userAgent: req.headers.get("user-agent"),
            pixelId: openAiAdsConfig.pixelId,
            apiKey: openAiAdsConfig.apiKey,
          }),
        );
      }
    } catch {
      // Measurement identity/dispatch can never fail a persisted lead.
      openAiAdsEventId = null;
    }
  }

  // Best-effort business telemetry — never block success.
  try {
    const { error: telemetryErr } = await admin.from("event_logs").insert({
      event_name: payload.phone_e164
        ? "lead_captured_with_phone"
        : "lead_captured_no_phone",
      session_id: payload.session_id,
      route: "/",
      metadata: {
        lead_id: data?.id ?? null,
        county: payload.county,
        has_phone: !!payload.phone_e164,
        client_slug: payload.client_slug,
        source: payload.source,
        timestamp: new Date().toISOString(),
      },
    });
    if (telemetryErr) {
      audit(admin, {
        stage: "telemetry_failed",
        status: "skipped",
        session_id: payload.session_id,
        lead_id: data?.id ?? null,
        error_code: telemetryErr.code,
        error_message: telemetryErr.message,
      });
    }
  } catch (telemetryErr) {
    audit(admin, {
      stage: "telemetry_failed",
      status: "skipped",
      session_id: payload.session_id,
      lead_id: data?.id ?? null,
      error_message: String(telemetryErr),
    });
  }

  audit(admin, {
    stage: "response_sent",
    status: "succeeded",
    session_id: payload.session_id,
    lead_id: data?.id ?? null,
    http_status: 200,
  });

  return jsonResponse(
    {
      success: true,
      lead_id: insertedLeadId,
      session_id: insertedSessionId,
      ...(openAiAdsEventId ? { openai_ads_event_id: openAiAdsEventId } : {}),
    },
    200,
    corsHeaders,
  );
};

if (import.meta.main) {
  Deno.serve(handler);
}
