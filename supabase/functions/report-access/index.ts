/**
 * report-access — Production-safe service-role proxy for private report RPCs.
 *
 * Both get_analysis_preview and get_analysis_full are SECURITY DEFINER functions
 * executable only by service_role. The browser anon/publishable key cannot call
 * them directly. This Edge Function bridges that gap without exposing the
 * service-role key to the browser.
 *
 * POST { mode: "preview", scan_session_id: string }
 *   → { ok: true, mode: "preview", data: PreviewRow }
 *
 * POST { mode: "full", scan_session_id: string, phone_e164: string }
 *   → { ok: true, mode: "full", authorized: true, data: FullRow }
 *   → { ok: true, mode: "full", authorized: false, locked: true, reason: "unauthorized" }
 *
 * Security invariants:
 * - Only the service-role key is used internally; never the anon key.
 * - full_json is never returned in preview mode (belt-and-suspenders strip).
 * - Internal DB errors, env vars, and stack traces are never sent to the browser.
 * - No imports from _shared (isolation from potentially polluted shared paths).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// E.164: + followed by 1-3 digit country code and at least 7 digits, max 15 total.
const E164_RE = /^\+[1-9]\d{7,14}$/;

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Invalid request" }, 405);
  }

  // ── Parse body ──────────────────────────────────────────────────────────────

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  const params = body as Record<string, unknown>;
  const mode = params.mode;
  const scanSessionId = params.scan_session_id;

  // ── Validate mode ───────────────────────────────────────────────────────────

  if (mode !== "preview" && mode !== "full") {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  // ── Validate scan_session_id ────────────────────────────────────────────────

  if (typeof scanSessionId !== "string" || !UUID_RE.test(scanSessionId)) {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  // ── Validate phone_e164 for full mode ───────────────────────────────────────

  if (mode === "full") {
    const phone = params.phone_e164;
    if (typeof phone !== "string" || !E164_RE.test(phone.trim())) {
      return json({ ok: false, error: "Invalid request" }, 400);
    }
  }

  // ── Service-role client ─────────────────────────────────────────────────────
  // Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Supabase-managed env.
  // These are never read from the request or exposed in any response.

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    // Missing env is a deployment configuration error, not a client error.
    console.error("[report-access] Missing required environment variables");
    return json({ ok: false, error: "Report processing failed" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Preview mode ──────────────────────────────────────────────────────────────

  if (mode === "preview") {
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc(
        "get_analysis_preview",
        { p_scan_session_id: scanSessionId },
      );

      if (rpcErr) {
        console.error(
          "[report-access] get_analysis_preview RPC error:",
          rpcErr.message,
        );
        return json({ ok: false, error: "Report processing failed" }, 500);
      }

      const row: Record<string, unknown> | null = Array.isArray(rows)
        ? (rows[0] ?? null)
        : (rows as Record<string, unknown> | null) ?? null;

      if (!row || typeof row.grade !== "string" || !row.grade) {
        return json({ ok: false, error: "Report not found" }, 404);
      }

      // Belt-and-suspenders: get_analysis_preview does not return full_json,
      // but strip it defensively in case the RPC definition ever changes.
      const { full_json: _fullJsonStripped, ...safeRow } = row;

      return json({ ok: true, mode: "preview", data: safeRow });
    } catch (err) {
      console.error(
        "[report-access] preview exception:",
        err instanceof Error ? err.message : String(err),
      );
      return json({ ok: false, error: "Report processing failed" }, 500);
    }
  }

  // ── Full mode ─────────────────────────────────────────────────────────────────

  const phoneE164 = (params.phone_e164 as string).trim();

  try {
    // supabase.rpc is untyped in Edge Functions (no Database generic here);
    // cast to any is consistent with the pattern used in compare-quotes and
    // generate-negotiation-script for this same RPC.
    const { data: rows, error: rpcErr } = await (supabase.rpc as (
      fn: string,
      args: Record<string, string>,
    ) => ReturnType<typeof supabase.rpc>)(
      "get_analysis_full",
      { p_scan_session_id: scanSessionId, p_phone_e164: phoneE164 },
    );

    if (rpcErr) {
      console.error(
        "[report-access] get_analysis_full RPC error:",
        rpcErr.message,
      );
      return json({ ok: false, error: "Report processing failed" }, 500);
    }

    const row: Record<string, unknown> | null = Array.isArray(rows)
      ? (rows[0] ?? null)
      : (rows as Record<string, unknown> | null) ?? null;

    if (!row || typeof row.grade !== "string" || !row.grade) {
      return json({ ok: false, error: "Report not found" }, 404);
    }

    // Backend sentinel: phone/session mismatch or phone not yet verified.
    if (row.grade === "__UNAUTHORIZED__") {
      return json({
        ok: true,
        mode: "full",
        authorized: false,
        locked: true,
        reason: "unauthorized",
      });
    }

    return json({
      ok: true,
      mode: "full",
      authorized: true,
      data: row,
    });
  } catch (err) {
    console.error(
      "[report-access] full exception:",
      err instanceof Error ? err.message : String(err),
    );
    return json({ ok: false, error: "Report processing failed" }, 500);
  }
});
