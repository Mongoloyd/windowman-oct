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
//   - No PII is logged.
//
// Contract
//   Method: POST
//   Body  : { session_id, storage_path, file_name?, file_size?, file_type? }
//   Resp  : { success: true,  scan_session_id, quote_file_id, lead_id }
//         | { success: false, code, message, details? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function badRequest(code: string, message: string, details?: unknown): Response {
  return jsonResponse(400, { success: false, code, message, details });
}

function serverError(code: string, message: string, details?: unknown): Response {
  return jsonResponse(500, { success: false, code, message, details });
}

function parsePayload(raw: unknown): { ok: true; value: BootstrapPayload } | { ok: false; reason: string } {
  if (!raw || typeof raw !== "object") return { ok: false, reason: "body_not_object" };
  const r = raw as Record<string, unknown>;

  const session_id = typeof r.session_id === "string" ? r.session_id.trim() : "";
  if (!UUID_RE.test(session_id)) return { ok: false, reason: "invalid_session_id" };

  const storage_path = typeof r.storage_path === "string" ? r.storage_path.trim() : "";
  if (!storage_path || storage_path.length > 1024) {
    return { ok: false, reason: "invalid_storage_path" };
  }

  const file_name =
    typeof r.file_name === "string" && r.file_name.length <= 512 ? r.file_name : null;
  const file_size =
    typeof r.file_size === "number" && Number.isFinite(r.file_size) && r.file_size >= 0
      ? Math.floor(r.file_size)
      : null;
  const file_type =
    typeof r.file_type === "string" && r.file_type.length <= 128 ? r.file_type : null;

  return {
    ok: true,
    value: { session_id, storage_path, file_name, file_size, file_type },
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse(405, { success: false, code: "method_not_allowed", message: "POST only" });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return badRequest("invalid_json", "Request body must be valid JSON.");
  }

  const parsed = parsePayload(raw);
  if (!parsed.ok) {
    return badRequest("invalid_payload", `Payload validation failed: ${parsed.reason}`);
  }
  const { session_id, storage_path, file_name, file_size, file_type } = parsed.value;

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return serverError("server_misconfigured", "Service credentials missing.");
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 1. Resolve or create the parent lead bound to this session_id ─────────
  let lead_id: string | null = null;
  try {
    const { data: existingLeads, error: rpcErr } = await admin.rpc("get_lead_by_session", {
      p_session_id: session_id,
    });
    if (rpcErr) {
      console.error("[start-upload-scan-session] get_lead_by_session failed", {
        code: rpcErr.code, message: rpcErr.message,
      });
    } else if (Array.isArray(existingLeads) && existingLeads.length > 0) {
      lead_id = (existingLeads[0]?.id as string) ?? null;
    }
  } catch (e) {
    console.error("[start-upload-scan-session] get_lead_by_session threw", { error: String(e) });
  }

  if (!lead_id) {
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
      console.error("[start-upload-scan-session] lead insert failed", {
        code: leadErr?.code, message: leadErr?.message, hint: leadErr?.hint,
      });
      return serverError("lead_create_failed", "Failed to initialize session.", {
        code: leadErr?.code ?? null, message: leadErr?.message ?? null,
      });
    }
    lead_id = newLead.id as string;
  }

  // ── 2. Resolve or create the quote_files row keyed by storage_path ────────
  let quote_file_id: string | null = null;
  {
    const { data: existingFiles, error: qfLookupErr } = await admin
      .from("quote_files")
      .select("id, lead_id")
      .eq("storage_path", storage_path)
      .order("created_at", { ascending: false })
      .limit(1);

    if (qfLookupErr) {
      console.error("[start-upload-scan-session] quote_files lookup failed", {
        code: qfLookupErr.code, message: qfLookupErr.message,
      });
    } else if (existingFiles && existingFiles.length > 0) {
      quote_file_id = (existingFiles[0].id as string) ?? null;
      // Honor the existing lead binding when one is present — never re-parent.
      const existingLeadId = (existingFiles[0].lead_id as string | null) ?? null;
      if (existingLeadId) lead_id = existingLeadId;
    }
  }

  if (!quote_file_id) {
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
      console.error("[start-upload-scan-session] quote_files insert failed", {
        code: qfInsertErr?.code, message: qfInsertErr?.message, hint: qfInsertErr?.hint,
      });
      return serverError("quote_file_create_failed", "Failed to register your file.", {
        code: qfInsertErr?.code ?? null, message: qfInsertErr?.message ?? null,
      });
    }
    quote_file_id = newFile.id as string;
  }

  // ── 3. Resolve or create the scan_sessions row keyed by quote_file_id ─────
  let scan_session_id: string | null = null;
  {
    const { data: existingSessions, error: ssLookupErr } = await admin
      .from("scan_sessions")
      .select("id")
      .eq("quote_file_id", quote_file_id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (ssLookupErr) {
      console.error("[start-upload-scan-session] scan_sessions lookup failed", {
        code: ssLookupErr.code, message: ssLookupErr.message,
      });
    } else if (existingSessions && existingSessions.length > 0) {
      scan_session_id = (existingSessions[0].id as string) ?? null;
    }
  }

  if (!scan_session_id) {
    const { data: newSession, error: ssInsertErr } = await admin
      .from("scan_sessions")
      .insert({
        status: "uploading",
        lead_id,
        quote_file_id,
        // user_id intentionally NULL — preserves anon ownership semantics
        // the existing RLS policy is shaped around.
        user_id: null,
      })
      .select("id")
      .single();

    if (ssInsertErr || !newSession?.id) {
      console.error("[start-upload-scan-session] scan_sessions insert failed", {
        code: ssInsertErr?.code, message: ssInsertErr?.message, hint: ssInsertErr?.hint,
      });
      return serverError("scan_session_create_failed", "Failed to start scan session.", {
        code: ssInsertErr?.code ?? null, message: ssInsertErr?.message ?? null,
      });
    }
    scan_session_id = newSession.id as string;
  }

  // ── Telemetry (non-PII) ───────────────────────────────────────────────────
  console.info("[start-upload-scan-session] ok", {
    session_id_short: session_id.slice(0, 8),
    lead_id_short: lead_id?.slice(0, 8),
    quote_file_id_short: quote_file_id?.slice(0, 8),
    scan_session_id_short: scan_session_id?.slice(0, 8),
    file_size, file_type, has_file_name: Boolean(file_name),
  });

  return jsonResponse(200, {
    success: true,
    scan_session_id,
    quote_file_id,
    lead_id,
  });
});
