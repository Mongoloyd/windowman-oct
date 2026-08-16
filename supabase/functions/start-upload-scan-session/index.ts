// supabase/functions/start-upload-scan-session/index.ts
//
// UploadZone scan-session bootstrap.
//
// Why this exists
//   UploadZone (browser) used to insert directly into `leads`, `quote_files`
//   and `scan_sessions`. The `leads` and `scan_sessions` INSERT policies are
//   `TO anon` only, so when the same browser holds an admin/operator JWT
//   the request runs as `authenticated` and Postgres rejects it with
//   `42501 — new row violates row-level security policy`. That surfaces as
//   the orange "Failed to start scan session. Please try again." panel.
//
//   This function performs the writes with the service role so the upload
//   path works in both anon and authenticated browser states without
//   weakening the public RLS posture.
//
// Hard rules respected
//   - Service-role key never leaves this function.
//   - Public RLS posture for leads / quote_files / scan_sessions is unchanged.
//   - OTP / verified-state columns are forced to safe defaults — this path
//     can never elevate a lead to phone_verified.
//   - `scan_sessions.user_id` is left NULL, matching the anon ownership
//     semantics the table is policy-shaped around.
//   - Idempotent: repeated calls with the same `storage_path` reuse the
//     same quote_files + scan_sessions rows. No duplicates.
//   - No PII is logged. Audit events log structured non-PII metadata only.
//
// Audit logging
//   Every meaningful stage emits a structured `audit()` event with timestamp,
//   stage, status, session_id, ids (when known), error_code/message (when
//   applicable), and safe size/type metadata. Telemetry/audit insert failures
//   NEVER block funnel success.
//
// Contract
//   Method: POST
//   Body  : { session_id, storage_path, file_name?, file_size?, file_type? }
//   Resp  : { success: true,  scan_session_id, quote_file_id, lead_id }
//         | { success: false, code, message, details? }

import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  type BootstrapResponse,
  RequestSchema,
  ResponseSchema,
} from "./contracts/schemas.ts";
import {
  hasAttributionPayload,
  mergeAttribution,
  mergeQueryParams,
  promoteLeadScalarFields,
  resolveUploadLeadSource,
  sanitizeAttributionInput,
  sanitizeQueryParamsInput,
} from "../_shared/attributionMerge.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { emitLeadActivity } from "../_shared/emitLeadActivity.ts";
import { validateStoredWmChatIntake } from "../_shared/wmchatIntake.ts";

const FUNCTION_NAME = "start-upload-scan-session";

async function emitQuoteUploadedActivity(
  admin: SupabaseClient,
  args: {
    lead_id: string;
    scan_session_id: string;
    quote_file_id: string;
  },
): Promise<void> {
  const { data: leadRow } = await admin
    .from("leads")
    .select("email, phone_e164")
    .eq("id", args.lead_id)
    .maybeSingle();

  await emitLeadActivity({
    supabaseAdmin: admin,
    leadId: args.lead_id,
    eventName: "quote_uploaded",
    scanSessionId: args.scan_session_id,
    metadata: {
      lead_id: args.lead_id,
      scan_session_id: args.scan_session_id,
      quote_file_id: args.quote_file_id,
    },
    contact: {
      email: leadRow?.email ?? null,
      phone_e164: leadRow?.phone_e164 ?? null,
    },
  });
}

// NOTE: Request shape (incl. UUID + storage_path scope) is owned by
// `./contracts/schemas.ts` (RequestSchema). The historical UUID_RE and
// BootstrapPayload/validateStoragePathScope helpers have been removed in
// favor of zod parsing — see Deno.serve handler below.

type AuditStatus = "started" | "succeeded" | "failed" | "reused" | "skipped";

interface AuditEvent {
  ts: string;
  fn: string;
  stage: string;
  status: AuditStatus;
  session_id?: string | null;
  lead_id?: string | null;
  quote_file_id?: string | null;
  scan_session_id?: string | null;
  error_code?: string | null;
  error_message?: string | null;
  file_size?: number | null;
  file_type?: string | null;
  has_file_name?: boolean;
  http_status?: number;
}

/**
 * Stages persisted to `event_logs`. All other stages remain console-only.
 * This keeps the persisted trail focused on outcomes/failures.
 */
const PERSISTED_STAGES = new Set<string>([
  "validation_failed",
  "storage_object_missing",
  "storage_path_scope_mismatch",
  "lead_resolve_failed",
  "quote_file_create_failed",
  "scan_session_create_failed",
  "unexpected_error",
  "response_sent",
]);

/**
 * Emit a structured audit event. Always console-logged at the appropriate
 * level. Persists to `event_logs` only for summary/failure stages
 * (see PERSISTED_STAGES). Persistence failures NEVER block funnel success.
 *
 * Strictly non-PII: never accepts raw file_name, raw payloads, or secrets.
 * file_name is reduced to a `has_file_name` boolean.
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

  if (admin && PERSISTED_STAGES.has(evt.stage)) {
    admin
      .from("event_logs")
      .insert({
        event_name: "upload_bootstrap_audit",
        session_id: evt.session_id ?? null,
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

const STORAGE_BUCKET = "quotes";

const LEAD_SCALAR_SELECT =
  "attribution, query_params, client_slug, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, fbc, fbp, ttclid, msclkid, wbraid, gbraid, landing_page_url, first_page_path, initial_referrer, source";

function resolveEffectiveClientSlug(
  requestClientSlug: string | null | undefined,
  attribution: Record<string, unknown>,
): string | null {
  const fromRequest = requestClientSlug?.trim() || null;
  if (fromRequest) return fromRequest;

  const fromAttribution = typeof attribution.client_slug === "string"
    ? attribution.client_slug.trim()
    : "";
  if (fromAttribution && fromAttribution !== "direct") return fromAttribution;

  return null;
}

async function mergeLeadAttribution(
  admin: SupabaseClient,
  leadId: string,
  sanitizedAttribution: Record<string, unknown>,
  sanitizedQueryParams: Record<string, string | string[]>,
  effectiveClientSlug: string | null,
): Promise<void> {
  if (
    !hasAttributionPayload(sanitizedAttribution, sanitizedQueryParams) &&
    !effectiveClientSlug
  ) {
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

  if (!existing?.client_slug && effectiveClientSlug) {
    updateRow.client_slug = effectiveClientSlug;
  }

  if (
    existing?.source === "direct_upload" &&
    resolveUploadLeadSource(mergedAttribution) === "paid_upload"
  ) {
    updateRow.source = "paid_upload";
  }

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

async function mergeScanSessionAttribution(
  admin: SupabaseClient,
  scanSessionId: string,
  sanitizedAttribution: Record<string, unknown>,
  sanitizedQueryParams: Record<string, string | string[]>,
  effectiveClientSlug: string | null,
): Promise<void> {
  if (
    !hasAttributionPayload(sanitizedAttribution, sanitizedQueryParams) &&
    !effectiveClientSlug
  ) {
    return;
  }

  const { data: existing, error } = await admin
    .from("scan_sessions")
    .select("attribution, query_params, client_slug")
    .eq("id", scanSessionId)
    .maybeSingle();

  if (error) {
    console.warn(`[${FUNCTION_NAME}] scan_session attribution fetch failed`, {
      code: error.code,
      message: error.message,
    });
    return;
  }

  const updateRow: Record<string, unknown> = {
    attribution: mergeAttribution(existing?.attribution, sanitizedAttribution),
    query_params: mergeQueryParams(
      existing?.query_params,
      sanitizedQueryParams,
    ),
  };

  if (!existing?.client_slug && effectiveClientSlug) {
    updateRow.client_slug = effectiveClientSlug;
  }

  const { error: updateErr } = await admin
    .from("scan_sessions")
    .update(updateRow)
    .eq("id", scanSessionId);

  if (updateErr) {
    console.warn(`[${FUNCTION_NAME}] scan_session attribution merge failed`, {
      code: updateErr.code,
      message: updateErr.message,
    });
  }
}

/**
 * Validate the outgoing body against the published ResponseSchema before
 * serializing. A schema violation here means the handler itself drifted
 * (e.g. forgot a field, returned a non-UUID id) — fail closed with a
 * generic 500 rather than shipping a malformed envelope to the client.
 */
function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  corsHeaders: Record<string, string>,
): Response {
  let validatedBody: BootstrapResponse;
  try {
    validatedBody = ResponseSchema.parse(body);
  } catch (e) {
    console.error(`[${FUNCTION_NAME}] response contract violation`, {
      status,
      body,
      issues: (e as { issues?: unknown }).issues,
    });
    const fallback = {
      success: false as const,
      code: "unexpected_error" as const,
      message: "Response contract violation.",
    };
    return new Response(JSON.stringify(fallback), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(validatedBody), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(
  code: string,
  message: string,
  corsHeaders: Record<string, string>,
  details?: unknown,
): Response {
  return jsonResponse(
    400,
    { success: false, code, message, details },
    corsHeaders,
  );
}

function serverError(
  code: string,
  message: string,
  corsHeaders: Record<string, string>,
  details?: unknown,
): Response {
  return jsonResponse(
    500,
    { success: false, code, message, details },
    corsHeaders,
  );
}

// ── Contact-owned upload enforcer (Sprint 1 V2) ────────────────────────────
// These helpers are pure / dependency-injected so they can be unit-tested in
// `index_test.ts` without a live Supabase client or network. The handler wires
// them to the real admin client. See docs/sprints/sprint-1-enforcer.md.

export const CONTACT_REQUIRED_MESSAGE = "Contact is required before upload.";
export const SESSION_MISMATCH_MESSAGE =
  "Upload session does not match the lead.";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * Server-side-only transport bypass. ONLY an exact `Bearer ${SERVICE_ROLE}`
 * Authorization header may bypass contact-owned upload enforcement. No request
 * body flag, cookie, query param, or attribution flag may bypass.
 */
export function isServiceRoleBypass(
  authorization: string | null,
  serviceRole: string | null | undefined,
): boolean {
  return Boolean(serviceRole) && authorization === `Bearer ${serviceRole}`;
}

/**
 * A contact-owned lead (Sprint 1 definition) requires a non-empty trimmed
 * `first_name` AND `email`. Whitespace-only values are invalid. Phone and ZIP
 * are intentionally NOT required in Sprint 1, and `lead.status` is NOT checked.
 */
export function hasContactOwnedFields(
  lead: { first_name?: string | null; email?: string | null },
): boolean {
  return (
    String(lead.first_name ?? "").trim().length > 0 &&
    String(lead.email ?? "").trim().length > 0
  );
}

/**
 * Build the structured, non-PII log payload for a rejected enforced public
 * upload. Never includes first_name, email, phone, zip, storage_path, the
 * service role key, full attribution, or full query params.
 */
export function buildRejectedUploadLogPayload(args: {
  error_code: string;
  session_id?: string | null;
  lead_id?: string | null;
  attribution?: { utm_source?: string | null } | null;
}): {
  timestamp: string;
  error_code: string;
  session_id: string | null;
  lead_id: string | null;
  client_source: string | null;
} {
  return {
    timestamp: new Date().toISOString(),
    error_code: args.error_code,
    session_id: args.session_id ?? null,
    lead_id: args.lead_id ?? null,
    client_source: args.attribution?.utm_source ?? null,
  };
}

export interface ContactOwnedLeadRow {
  id: string;
  session_id: string | null;
  first_name: string | null;
  email: string | null;
  phone_e164?: string | null;
  source?: string | null;
  query_params?: unknown;
  qualification_answers_json?: unknown;
}

export interface WmChatServiceConsentRow {
  decision: string | null;
  source: string | null;
  session_id: string | null;
  created_at?: string | null;
  id?: string | null;
}

/**
 * Tiny dependency surface so the enforcement helper can be tested with a stub
 * instead of a live Supabase client.
 */
export interface ContactOwnedLeadFetcher {
  fetchLeadById(leadId: string): Promise<{
    data: ContactOwnedLeadRow | null;
    error: { code?: string | null; message?: string | null } | null;
  }>;
  fetchLatestServiceConsent: (
    leadId: string,
    sessionId: string,
  ) => Promise<{
    data: WmChatServiceConsentRow | null;
    error: { code?: string | null; message?: string | null } | null;
  }>;
}

type ServiceConsentLookupResult = {
  data: WmChatServiceConsentRow | null;
  error: { code?: string | null; message?: string | null } | null;
};

/**
 * Selects an unambiguous latest consent event from one complete query result.
 * Conflicting events at the newest timestamp fail closed because UUID order
 * cannot represent insertion order.
 */
export function resolveLatestServiceConsentRows(
  rows: readonly WmChatServiceConsentRow[],
  totalCount: number | null,
): ServiceConsentLookupResult {
  if (totalCount === null || totalCount !== rows.length) {
    return { data: null, error: { message: "Consent history was truncated." } };
  }
  if (rows.length === 0) return { data: null, error: null };

  const timestampedRows = rows.map((row) => ({
    row,
    timestamp: typeof row.created_at === "string"
      ? Date.parse(row.created_at)
      : Number.NaN,
  }));
  if (timestampedRows.some(({ timestamp }) => Number.isNaN(timestamp))) {
    return { data: null, error: null };
  }

  const latestTimestamp = Math.max(
    ...timestampedRows.map(({ timestamp }) => timestamp),
  );
  const latestRows = timestampedRows
    .filter(({ timestamp }) => timestamp === latestTimestamp)
    .map(({ row }) => row);
  const selected = latestRows[0];
  const hasConflict = latestRows.some(
    (row) =>
      row.decision !== selected.decision ||
      row.source !== selected.source ||
      row.session_id !== selected.session_id,
  );
  if (hasConflict) {
    return { data: null, error: null };
  }

  return { data: selected, error: null };
}

export type ContactOwnedValidationResult =
  | { ok: true; lead_id: string }
  | {
    ok: false;
    httpStatus: 400;
    code: "contact_required_before_upload" | "session_mismatch_with_lead";
    message: string;
  }
  | { ok: false; httpStatus: 500; code: "unexpected_error"; message: string };

/**
 * Enforced public validation (ENFORCE_CONTACT_OWNED_UPLOAD === "1" and not a
 * service-role bypass). Runs BEFORE any storage probe, DB insert, quote_file
 * reuse, or fallback lead insert.
 *
 *   Step 1 — require lead_id (present + non-empty)
 *   Step 2 — fetch lead by id
 *   Step 3 — verify lead exists (db error → 500 unexpected_error)
 *   Step 4 — preserve legacy trimmed first_name + email eligibility
 *   Step 5 — otherwise require exact persisted /wmchat source, mobile,
 *            stored intake, and latest granted service consent
 *   Step 6 — verify lead.session_id === body.session_id before consent/storage
 *   Step 7 — return validated lead id as the sole authority
 */
export async function validateContactOwnedUploadLead(
  args: { leadId: string | null | undefined; sessionId: string },
  deps: ContactOwnedLeadFetcher,
): Promise<ContactOwnedValidationResult> {
  const leadId = typeof args.leadId === "string" ? args.leadId.trim() : "";
  if (!leadId) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  const { data: lead, error } = await deps.fetchLeadById(leadId);

  if (error) {
    return {
      ok: false,
      httpStatus: 500,
      code: "unexpected_error",
      message: "An unexpected error occurred.",
    };
  }

  if (!lead) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  if (lead.id !== leadId) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  const queryParams = isPlainObject(lead.query_params)
    ? lead.query_params
    : null;
  const qualification = isPlainObject(lead.qualification_answers_json)
    ? lead.qualification_answers_json
    : null;
  const hasWmChatMarker = queryParams?.source_path === "/wmchat" ||
    queryParams?.intake_version === "wmchat_v1" ||
    Boolean(
      qualification &&
        Object.prototype.hasOwnProperty.call(qualification, "wmchat_v1"),
    );

  // Preserve the legacy first-name + email path only for unmarked rows. Once
  // any durable /wmchat marker exists, contradictory or incomplete metadata
  // must fail closed instead of falling back to legacy eligibility.
  if (!hasWmChatMarker) {
    if (!hasContactOwnedFields(lead)) {
      return {
        ok: false,
        httpStatus: 400,
        code: "contact_required_before_upload",
        message: CONTACT_REQUIRED_MESSAGE,
      };
    }
    if (lead.session_id !== args.sessionId) {
      return {
        ok: false,
        httpStatus: 400,
        code: "session_mismatch_with_lead",
        message: SESSION_MISMATCH_MESSAGE,
      };
    }
    return { ok: true, lead_id: lead.id };
  }

  const isWmChatSource = lead.source === "windowman-first-quote" &&
    queryParams?.source_path === "/wmchat" &&
    queryParams?.intake_version === "wmchat_v1";

  if (!isWmChatSource) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  if (lead.session_id !== args.sessionId) {
    return {
      ok: false,
      httpStatus: 400,
      code: "session_mismatch_with_lead",
      message: SESSION_MISMATCH_MESSAGE,
    };
  }

  if (
    lead.email !== null ||
    typeof lead.phone_e164 !== "string" ||
    !/^\+1\d{10}$/.test(lead.phone_e164)
  ) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  const storedIntake = validateStoredWmChatIntake(
    qualification?.wmchat_v1,
  );
  if (
    !storedIntake.ok || storedIntake.intake.continuation !== "sms_then_voice"
  ) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  let consent: WmChatServiceConsentRow | null = null;
  try {
    const consentResult = await deps.fetchLatestServiceConsent(
      lead.id,
      args.sessionId,
    );
    if (consentResult.error) {
      return {
        ok: false,
        httpStatus: 500,
        code: "unexpected_error",
        message: "An unexpected error occurred.",
      };
    }
    consent = consentResult.data;
  } catch {
    return {
      ok: false,
      httpStatus: 500,
      code: "unexpected_error",
      message: "An unexpected error occurred.",
    };
  }

  if (
    consent?.decision !== "granted" ||
    consent.source !== "windowman-first-quote" ||
    consent.session_id !== args.sessionId
  ) {
    return {
      ok: false,
      httpStatus: 400,
      code: "contact_required_before_upload",
      message: CONTACT_REQUIRED_MESSAGE,
    };
  }

  return { ok: true, lead_id: lead.id };
}

export const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) });
  }

  const corsHeaders = getCorsHeaders(req);

  audit(null, { stage: "request_received", status: "started" });

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      code: "method_not_allowed",
      message: "POST only",
    }, corsHeaders);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: "invalid_json",
      error_message: "Request body must be valid JSON.",
    });
    return badRequest(
      "invalid_json",
      "Request body must be valid JSON.",
      corsHeaders,
    );
  }

  // ── Request contract validation (zod) ─────────────────────────────────────
  // The RequestSchema enforces shape, UUID, length, and the storage_path
  // scope rule (must start with `${session_id}/...`). Scope-rule failures
  // are routed to the dedicated `storage_path_scope_mismatch` error code
  // for observability parity with the pre-zod handler.
  const SCOPE_REASONS = new Set([
    "leading_slash",
    "double_slash",
    "path_traversal",
    "prefix_mismatch",
    "empty_filename",
    "trailing_slash",
    "empty_segment",
  ]);
  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const isScopeIssue = issue?.path?.[0] === "storage_path" &&
      SCOPE_REASONS.has(issue.message);
    if (isScopeIssue) {
      audit(null, {
        stage: "storage_path_scope_mismatch",
        status: "failed",
        error_code: "storage_path_scope_mismatch",
        error_message: `storage_path scope rejected: ${issue.message}`,
      });
      return jsonResponse(400, {
        success: false,
        code: "storage_path_scope_mismatch",
        message: "storage_path must be scoped to the supplied session_id.",
      }, corsHeaders);
    }
    const reason = issue
      ? `${issue.path.join(".") || "(root)"}: ${issue.message}`
      : "unknown";
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: "invalid_payload",
      error_message: `Payload validation failed: ${reason}`,
    });
    return badRequest(
      "invalid_payload",
      `Payload validation failed: ${reason}`,
      corsHeaders,
    );
  }
  const {
    session_id,
    storage_path,
    file_name,
    file_size,
    file_type,
    client_slug,
    attribution: rawAttribution,
    query_params: rawQueryParams,
  } = {
    file_name: null as string | null,
    file_size: null as number | null,
    file_type: null as string | null,
    client_slug: null as string | null,
    attribution: null as Record<string, unknown> | null,
    query_params: undefined as Record<string, string | string[]> | undefined,
    ...parsed.data,
  };

  // Parsed, schema-validated request body. Used by the contact-owned enforcer
  // and its structured (non-PII) logging so field names match the contract.
  const body = parsed.data;

  const sanitizedAttribution = sanitizeAttributionInput(rawAttribution);
  const sanitizedQueryParams = sanitizeQueryParamsInput(rawQueryParams);
  const effectiveClientSlug = resolveEffectiveClientSlug(
    client_slug,
    sanitizedAttribution,
  );

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    audit(null, {
      stage: "unexpected_error",
      status: "failed",
      session_id,
      error_code: "server_misconfigured",
      error_message: "Service credentials missing.",
    });
    return serverError(
      "server_misconfigured",
      "Service credentials missing.",
      corsHeaders,
    );
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Contact-owned upload enforcement decision ──────────────────────────────
  // Feature flag + service-role transport bypass are resolved here, before any
  // lead resolution, so the control flow is unambiguous. Flag OFF or bypass →
  // legacy behavior. Flag ON (public) → strict contact-owned validation.
  const enforceContactOwnedUpload =
    Deno.env.get("ENFORCE_CONTACT_OWNED_UPLOAD") === "1";

  const authorization = req.headers.get("Authorization");
  const isBypass = isServiceRoleBypass(authorization, SERVICE_ROLE);

  if (isBypass) {
    // Non-PII admin/dev bypass marker. Never logs the service role key.
    console.log(JSON.stringify({
      admin_bypass: true,
      timestamp: new Date().toISOString(),
      lead_id: body.lead_id ?? null,
      session_id: body.session_id ?? null,
    }));
  }

  const enforcedPublicMode = enforceContactOwnedUpload && !isBypass;

  // In enforced public mode, contact-owned lead validation MUST run before the
  // storage probe, any DB insert, or any quote_file reuse. The validated lead
  // becomes the sole authority; no fallback shell lead may be created.
  let enforcedLeadId: string | null = null;
  if (enforcedPublicMode) {
    const result = await validateContactOwnedUploadLead(
      { leadId: body.lead_id, sessionId: session_id },
      {
        fetchLeadById: async (leadId: string) => {
          const { data, error } = await admin
            .from("leads")
            .select(
              "id, session_id, first_name, email, phone_e164, source, query_params, qualification_answers_json",
            )
            .eq("id", leadId)
            .maybeSingle();
          return {
            data: (data as ContactOwnedLeadRow | null) ?? null,
            error,
          };
        },
        fetchLatestServiceConsent: async (
          leadId: string,
          consentSessionId: string,
        ) => {
          // Resolve the latest service decision first. Do not filter by source:
          // a later withdrawal or wrong-source decision must remain authoritative
          // and fail closed instead of revealing an older matching grant.
          const { data, error, count } = await admin
            .from("lead_consent_events")
            .select("id, decision, source, session_id, created_at", {
              count: "exact",
            })
            .eq("lead_id", leadId)
            .eq("session_id", consentSessionId)
            .eq("purpose", "service_communications");
          if (error) return { data: null, error };
          return resolveLatestServiceConsentRows(
            Array.isArray(data) ? data as WmChatServiceConsentRow[] : [],
            count,
          );
        },
      },
    );

    if (!result.ok) {
      if (result.httpStatus === 400) {
        console.log(JSON.stringify(buildRejectedUploadLogPayload({
          error_code: result.code,
          session_id: body.session_id,
          lead_id: body.lead_id ?? null,
          attribution: body.attribution,
        })));
        audit(admin, {
          stage: "validation_failed",
          status: "failed",
          session_id,
          lead_id: body.lead_id ?? null,
          error_code: result.code,
          error_message: result.message,
        });
        return badRequest(result.code, result.message, corsHeaders);
      }
      audit(admin, {
        stage: "lead_resolve_failed",
        status: "failed",
        session_id,
        lead_id: body.lead_id ?? null,
        error_code: result.code,
        error_message: result.message,
      });
      return serverError(result.code, result.message, corsHeaders);
    }

    enforcedLeadId = result.lead_id;
  }

  // ── Storage object existence check ─────────────────────────────────────────
  // Verify the uploaded object actually exists in the private quotes bucket
  // before any DB row creation. Use a signed URL probe (service-role bypasses
  // bucket RLS, so success implies the object is materialized).
  try {
    const { data: signed, error: signErr } = await admin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storage_path, 60);

    if (signErr || !signed?.signedUrl) {
      audit(admin, {
        stage: "storage_object_missing",
        status: "failed",
        session_id,
        error_code: "storage_object_missing",
        error_message: signErr?.message ??
          "Object not found in private bucket.",
      });
      return jsonResponse(400, {
        success: false,
        code: "storage_object_missing",
        message: "Uploaded file was not found.",
      }, corsHeaders);
    }
  } catch (e) {
    audit(admin, {
      stage: "storage_object_missing",
      status: "failed",
      session_id,
      error_code: "storage_object_missing",
      error_message: String(e),
    });
    return jsonResponse(400, {
      success: false,
      code: "storage_object_missing",
      message: "Uploaded file was not found.",
    }, corsHeaders);
  }

  // Wrap the entire pipeline so any throw is captured as `unexpected_error`.
  try {
    // ── 1. Resolve or create the parent lead bound to this session_id ───────
    // Enforced public mode: the contact-owned lead validated above the storage
    // probe is the sole authority. Legacy/bypass mode: resolve by session_id
    // via RPC and fall back to shell-lead creation as before.
    let lead_id: string | null = enforcedPublicMode ? enforcedLeadId : null;

    if (!enforcedPublicMode) {
      audit(admin, {
        stage: "lead_resolve_started",
        status: "started",
        session_id,
        file_size,
        file_type,
        has_file_name: Boolean(file_name),
      });

      try {
        const { data: existingLeads, error: rpcErr } = await admin.rpc(
          "get_lead_by_session",
          {
            p_session_id: session_id,
          },
        );
        if (rpcErr) {
          audit(admin, {
            stage: "lead_resolve_failed",
            status: "failed",
            session_id,
            error_code: rpcErr.code,
            error_message: rpcErr.message,
          });
        } else if (Array.isArray(existingLeads) && existingLeads.length > 0) {
          lead_id = (existingLeads[0]?.id as string) ?? null;
        }
      } catch (e) {
        audit(admin, {
          stage: "lead_resolve_failed",
          status: "failed",
          session_id,
          error_message: String(e),
        });
      }
    }

    if (lead_id) {
      audit(admin, {
        stage: "lead_resolved",
        status: "reused",
        session_id,
        lead_id,
      });
      await mergeLeadAttribution(
        admin,
        lead_id,
        sanitizedAttribution,
        sanitizedQueryParams,
        effectiveClientSlug,
      );
    } else {
      // Safety net: enforced public mode guarantees lead_id is set above, so
      // fallback shell-lead creation is unreachable there. Guard anyway so a
      // future refactor can never silently re-open the shell-lead hole.
      if (enforcedPublicMode) {
        audit(admin, {
          stage: "lead_resolve_failed",
          status: "failed",
          session_id,
          error_code: "contact_required_before_upload",
          error_message: "Enforced upload reached fallback without a lead.",
        });
        return serverError(
          "unexpected_error",
          "An unexpected error occurred.",
          corsHeaders,
        );
      }
      const insertRow: Record<string, unknown> = {
        session_id,
        source: resolveUploadLeadSource(sanitizedAttribution),
        status: "new",
        phone_verified: false,
        otp_failure_count: 0,
        attribution: mergeAttribution({}, sanitizedAttribution),
        query_params: mergeQueryParams({}, sanitizedQueryParams),
        ...promoteLeadScalarFields(sanitizedAttribution),
      };

      if (effectiveClientSlug) {
        insertRow.client_slug = effectiveClientSlug;
      }

      const { data: newLead, error: leadErr } = await admin
        .from("leads")
        .insert(insertRow)
        .select("id")
        .single();

      if (leadErr || !newLead?.id) {
        audit(admin, {
          stage: "lead_resolve_failed",
          status: "failed",
          session_id,
          error_code: leadErr?.code ?? "lead_create_failed",
          error_message: leadErr?.message ?? "Failed to initialize session.",
        });
        return serverError(
          "lead_create_failed",
          "Failed to initialize session.",
          corsHeaders,
          {
            code: leadErr?.code ?? null,
            message: leadErr?.message ?? null,
          },
        );
      }
      lead_id = newLead.id as string;
      audit(admin, {
        stage: "lead_created",
        status: "succeeded",
        session_id,
        lead_id,
      });
    }

    // ── 2. Resolve or create the quote_files row keyed by storage_path ──────
    let quote_file_id: string | null = null;

    audit(admin, {
      stage: "quote_file_lookup_started",
      status: "started",
      session_id,
      lead_id,
    });

    {
      const { data: existingFiles, error: qfLookupErr } = await admin
        .from("quote_files")
        .select("id, lead_id")
        .eq("storage_path", storage_path)
        .order("created_at", { ascending: false })
        .limit(1);

      if (qfLookupErr) {
        audit(admin, {
          stage: "quote_file_lookup_started",
          status: "failed",
          session_id,
          lead_id,
          error_code: qfLookupErr.code,
          error_message: qfLookupErr.message,
        });
      } else if (existingFiles && existingFiles.length > 0) {
        quote_file_id = (existingFiles[0].id as string) ?? null;
        const existingLeadId = (existingFiles[0].lead_id as string | null) ??
          null;
        if (enforcedPublicMode) {
          // The validated contact-owned lead stays authoritative. If a prior
          // quote_files row is owned by a different lead, reject rather than
          // overwrite the validated lead_id.
          if (existingLeadId && existingLeadId !== lead_id) {
            console.log(JSON.stringify(buildRejectedUploadLogPayload({
              error_code: "session_mismatch_with_lead",
              session_id: body.session_id,
              lead_id: body.lead_id ?? null,
              attribution: body.attribution,
            })));
            audit(admin, {
              stage: "validation_failed",
              status: "failed",
              session_id,
              lead_id,
              quote_file_id,
              error_code: "session_mismatch_with_lead",
              error_message: "Existing quote_file is owned by another lead.",
            });
            return badRequest(
              "session_mismatch_with_lead",
              SESSION_MISMATCH_MESSAGE,
              corsHeaders,
            );
          }
        } else if (existingLeadId) {
          lead_id = existingLeadId;
        }
      }
    }

    if (quote_file_id) {
      audit(admin, {
        stage: "quote_file_reused",
        status: "reused",
        session_id,
        lead_id,
        quote_file_id,
      });
    } else {
      const { data: newFile, error: qfInsertErr } = await admin
        .from("quote_files")
        .insert({
          lead_id,
          storage_path,
          status: "pending",
        })
        .select("id")
        .single();

      if (qfInsertErr || !newFile?.id) {
        audit(admin, {
          stage: "quote_file_created",
          status: "failed",
          session_id,
          lead_id,
          error_code: qfInsertErr?.code ?? "quote_file_create_failed",
          error_message: qfInsertErr?.message ??
            "Failed to register your file.",
        });
        return serverError(
          "quote_file_create_failed",
          "Failed to register your file.",
          corsHeaders,
          {
            code: qfInsertErr?.code ?? null,
            message: qfInsertErr?.message ?? null,
          },
        );
      }
      quote_file_id = newFile.id as string;
      audit(admin, {
        stage: "quote_file_created",
        status: "succeeded",
        session_id,
        lead_id,
        quote_file_id,
      });
    }

    // ── 3. Resolve or create the scan_sessions row keyed by quote_file_id ───
    let scan_session_id: string | null = null;

    audit(admin, {
      stage: "scan_session_lookup_started",
      status: "started",
      session_id,
      lead_id,
      quote_file_id,
    });

    {
      const { data: existingSessions, error: ssLookupErr } = await admin
        .from("scan_sessions")
        .select("id")
        .eq("quote_file_id", quote_file_id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (ssLookupErr) {
        audit(admin, {
          stage: "scan_session_lookup_started",
          status: "failed",
          session_id,
          lead_id,
          quote_file_id,
          error_code: ssLookupErr.code,
          error_message: ssLookupErr.message,
        });
      } else if (existingSessions && existingSessions.length > 0) {
        scan_session_id = (existingSessions[0].id as string) ?? null;
      }
    }

    if (scan_session_id) {
      audit(admin, {
        stage: "scan_session_reused",
        status: "reused",
        session_id,
        lead_id,
        quote_file_id,
        scan_session_id,
      });
      await mergeScanSessionAttribution(
        admin,
        scan_session_id,
        sanitizedAttribution,
        sanitizedQueryParams,
        effectiveClientSlug,
      );
    } else {
      const scanInsertRow: Record<string, unknown> = {
        status: "uploading",
        lead_id,
        quote_file_id,
        user_id: null,
        attribution: mergeAttribution({}, sanitizedAttribution),
        query_params: mergeQueryParams({}, sanitizedQueryParams),
      };

      if (effectiveClientSlug) {
        scanInsertRow.client_slug = effectiveClientSlug;
      }

      const { data: newSession, error: ssInsertErr } = await admin
        .from("scan_sessions")
        .insert(scanInsertRow)
        .select("id")
        .single();

      if (ssInsertErr || !newSession?.id) {
        audit(admin, {
          stage: "scan_session_created",
          status: "failed",
          session_id,
          lead_id,
          quote_file_id,
          error_code: ssInsertErr?.code ?? "scan_session_create_failed",
          error_message: ssInsertErr?.message ??
            "Failed to start scan session.",
        });
        return serverError(
          "scan_session_create_failed",
          "Failed to start scan session.",
          corsHeaders,
          {
            code: ssInsertErr?.code ?? null,
            message: ssInsertErr?.message ?? null,
          },
        );
      }
      scan_session_id = newSession.id as string;
      audit(admin, {
        stage: "scan_session_created",
        status: "succeeded",
        session_id,
        lead_id,
        quote_file_id,
        scan_session_id,
      });
    }

    audit(admin, {
      stage: "response_sent",
      status: "succeeded",
      session_id,
      lead_id,
      quote_file_id,
      scan_session_id,
      file_size,
      file_type,
      has_file_name: Boolean(file_name),
      http_status: 200,
    });

    if (lead_id && scan_session_id && quote_file_id) {
      await emitQuoteUploadedActivity(admin, {
        lead_id,
        scan_session_id,
        quote_file_id,
      });
    }

    return jsonResponse(200, {
      success: true,
      scan_session_id,
      quote_file_id,
      lead_id,
    }, corsHeaders);
  } catch (e) {
    audit(admin, {
      stage: "unexpected_error",
      status: "failed",
      session_id,
      error_message: String(e),
    });
    return serverError(
      "unexpected_error",
      "An unexpected error occurred.",
      corsHeaders,
    );
  }
};

if (import.meta.main) {
  Deno.serve(handler);
}
