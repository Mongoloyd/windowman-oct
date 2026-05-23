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

const FUNCTION_NAME = "start-upload-scan-session";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BootstrapPayload {
  session_id: string;
  storage_path: string;
  file_name?: string | null;
  file_size?: number | null;
  file_type?: string | null;
}

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

/**
 * Strict scope check: storage_path must be `${session_id}/...filename`.
 * Rejects path traversal, leading slashes, double slashes, and empty
 * filename segments.
 */
function validateStoragePathScope(
  storage_path: string,
  session_id: string,
): { ok: true } | { ok: false; reason: string } {
  if (!storage_path) return { ok: false, reason: "empty_path" };
  if (storage_path.startsWith("/")) {
    return { ok: false, reason: "leading_slash" };
  }
  if (storage_path.includes("//")) return { ok: false, reason: "double_slash" };
  if (storage_path.includes("../") || storage_path.includes("..\\")) {
    return { ok: false, reason: "path_traversal" };
  }
  const requiredPrefix = `${session_id}/`;
  if (!storage_path.startsWith(requiredPrefix)) {
    return { ok: false, reason: "prefix_mismatch" };
  }
  const remainder = storage_path.slice(requiredPrefix.length);
  if (remainder.length === 0) return { ok: false, reason: "empty_filename" };
  // Reject any empty segment (e.g. "sess/sub//file.pdf" — covered above —
  // and trailing slash).
  if (remainder.endsWith("/")) return { ok: false, reason: "trailing_slash" };
  const segments = remainder.split("/");
  if (segments.some((s) => s.length === 0)) {
    return { ok: false, reason: "empty_segment" };
  }
  return { ok: true };
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
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

function parsePayload(
  raw: unknown,
): { ok: true; value: BootstrapPayload } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") {
    return { ok: false, reason: "body_not_object" };
  }
  const r = raw as Record<string, unknown>;

  const session_id = typeof r.session_id === "string"
    ? r.session_id.trim()
    : "";
  if (!UUID_RE.test(session_id)) {
    return { ok: false, reason: "invalid_session_id" };
  }

  const storage_path = typeof r.storage_path === "string"
    ? r.storage_path.trim()
    : "";
  if (!storage_path || storage_path.length > 1024) {
    return { ok: false, reason: "invalid_storage_path" };
  }

  const file_name = typeof r.file_name === "string" && r.file_name.length <= 512
    ? r.file_name
    : null;
  const file_size =
    typeof r.file_size === "number" && Number.isFinite(r.file_size) &&
      r.file_size >= 0
      ? Math.floor(r.file_size)
      : null;
  const file_type = typeof r.file_type === "string" && r.file_type.length <= 128
    ? r.file_type
    : null;

  return {
    ok: true,
    value: { session_id, storage_path, file_name, file_size, file_type },
  };
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

  const parsed = parsePayload(raw);
  if (!parsed.ok) {
    audit(null, {
      stage: "validation_failed",
      status: "failed",
      error_code: "invalid_payload",
      error_message: `Payload validation failed: ${parsed.reason}`,
    });
    return badRequest(
      "invalid_payload",
      `Payload validation failed: ${parsed.reason}`,
    );
  }
  const { session_id, storage_path, file_name, file_size, file_type } =
    parsed.value;

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

  // ── Storage path scope check ───────────────────────────────────────────────
  // storage_path MUST be scoped to `${session_id}/...filename`. Reject path
  // traversal, leading/double slashes, empty filename segments.
  const scopeCheck = validateStoragePathScope(storage_path, session_id);
  if (!scopeCheck.ok) {
    audit(admin, {
      stage: "storage_path_scope_mismatch",
      status: "failed",
      session_id,
      error_code: "storage_path_scope_mismatch",
      error_message: `storage_path scope rejected: ${scopeCheck.reason}`,
    });
    return jsonResponse(400, {
      success: false,
      code: "storage_path_scope_mismatch",
      message: "storage_path must be scoped to the supplied session_id.",
    });
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
    } else {
      // Mirror the previous browser-fallback insert: minimal lead, safe defaults.
      const { data: newLead, error: leadErr } = await admin
        .from("leads")
        .insert({
          session_id,
          source: "direct_upload",
          status: "new",
          phone_verified: false,
          otp_failure_count: 0,
        })
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
    } else {
      const { data: newSession, error: ssInsertErr } = await admin
        .from("scan_sessions")
        .insert({
          status: "uploading",
          lead_id,
          quote_file_id,
          user_id: null,
        })
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
