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
  RequestSchema,
  ResponseSchema,
  type BootstrapResponse,
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

const FUNCTION_NAME = "start-upload-scan-session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
  "attribution, query_params, client_slug, utm_source, utm_medium, utm_campaign, utm_term, utm_content, fbclid, gclid, fbc, fbp, ttclid, msclkid, wbraid, gbraid, landing_page_url, first_page_path, initial_referrer, intent, source";

function resolveEffectiveClientSlug(
  requestClientSlug: string | null | undefined,
  attribution: Record<string, unknown>,
): string | null {
  const fromRequest = requestClientSlug?.trim() || null;
  if (fromRequest) return fromRequest;

  const fromAttribution =
    typeof attribution.client_slug === "string"
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
function jsonResponse(status: number, body: Record<string, unknown>): Response {
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
  details?: unknown,
): Response {
  return jsonResponse(400, { success: false, code, message, details });
}

function serverError(
  code: string,
  message: string,
  details?: unknown,
): Response {
  return jsonResponse(500, { success: false, code, message, details });
}


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  audit(null, { stage: "request_received", status: "started" });

  if (req.method !== "POST") {
    return jsonResponse(405, {
      success: false,
      code: "method_not_allowed",
      message: "POST only",
    });
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
    return badRequest("invalid_json", "Request body must be valid JSON.");
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
    const isScopeIssue =
      issue?.path?.[0] === "storage_path" && SCOPE_REASONS.has(issue.message);
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
      });
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
    return badRequest("invalid_payload", `Payload validation failed: ${reason}`);
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
    return serverError("server_misconfigured", "Service credentials missing.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });


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
      });
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
    });
  }

  // Wrap the entire pipeline so any throw is captured as `unexpected_error`.
  try {
    // ── 1. Resolve or create the parent lead bound to this session_id ───────
    let lead_id: string | null = null;

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
        if (existingLeadId) lead_id = existingLeadId;
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

    return jsonResponse(200, {
      success: true,
      scan_session_id,
      quote_file_id,
      lead_id,
    });
  } catch (e) {
    audit(admin, {
      stage: "unexpected_error",
      status: "failed",
      session_id,
      error_message: String(e),
    });
    return serverError("unexpected_error", "An unexpected error occurred.");
  }
});
