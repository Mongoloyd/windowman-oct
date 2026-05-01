// ═══════════════════════════════════════════════════════════════════════════════
// DEV-ONLY: dev-create-quote-scenario
// Server-side scaffold for the Dev Quote Generator.
// Bypasses RLS using the service role to create the lead/quote_file/scan_session
// rows the dev scenarios need, then invokes scan-quote with dev bypass.
//
// Security posture:
//   - Gated by DEV_BYPASS_SECRET (timing-safe compare). No/invalid secret → 403.
//   - Fails fast on missing env (no `!` non-null assertions on env reads).
//   - Returns controlled `stage` codes only: env | auth | body | lead |
//     quote_file | scan_session | scan_quote. Never returns raw Postgres
//     messages or raw downstream payloads to the client.
//   - Internal errors are logged server-side via console.error for debugging.
//   - Only writes rows tagged source="dev_quote_generator" + client_slug="dev"
//     and storage paths under dev-bypass/{dev_run_id}/{scenario_key}/ for
//     future cleanup.
//   - Does NOT weaken RLS. Production scanner / OTP / report paths untouched.
// ═══════════════════════════════════════════════════════════════════════════════

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Stage =
  | "env"
  | "auth"
  | "body"
  | "lead"
  | "quote_file"
  | "scan_session"
  | "scan_quote";

interface RequestBody {
  scenario_key?: string;
  dev_secret?: string;
  dev_run_id?: string;
  dev_extraction_override?: unknown;
  existing_session_id?: string | null;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(stage: Stage, message: string, status: number) {
  return json({ error: message, stage }, status);
}

/** Constant-time string compare to avoid timing oracles on the dev secret. */
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 1. Env validation (fail fast, no `!` assertions) ───────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const devSecretEnv = Deno.env.get("DEV_BYPASS_SECRET");

  if (!supabaseUrl || !serviceKey || !devSecretEnv) {
    console.error("[dev-create-quote-scenario] missing env", {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!serviceKey,
      hasDevSecret: !!devSecretEnv,
    });
    return fail("env", "server misconfigured", 500);
  }

  // ── 2. Body parsing ────────────────────────────────────────────────────────
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
    if (!body || typeof body !== "object") throw new Error("not an object");
  } catch (err) {
    console.error("[dev-create-quote-scenario] bad body", err);
    return fail("body", "invalid JSON body", 400);
  }

  const {
    scenario_key,
    dev_secret,
    dev_extraction_override,
    existing_session_id,
  } = body;

  // ── 3. Auth (timing-safe) ──────────────────────────────────────────────────
  if (!dev_secret || typeof dev_secret !== "string" ||
      !timingSafeEqual(dev_secret, devSecretEnv)) {
    return fail("auth", "forbidden", 403);
  }

  // ── 4. Body shape validation ───────────────────────────────────────────────
  if (!scenario_key || typeof scenario_key !== "string") {
    return fail("body", "scenario_key required", 400);
  }
  if (dev_extraction_override === undefined) {
    return fail("body", "dev_extraction_override required", 400);
  }

  const safeKey = scenario_key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  const devRunId =
    body.dev_run_id && /^[a-zA-Z0-9_-]{1,64}$/.test(body.dev_run_id)
      ? body.dev_run_id
      : crypto.randomUUID();

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── 5. Lead ──────────────────────────────────────────────────────────────
    const leadId = crypto.randomUUID();
    const sessionMarker = existing_session_id || crypto.randomUUID();
    const { error: leadErr } = await admin.from("leads").insert({
      id: leadId,
      session_id: sessionMarker,
      source: "dev_quote_generator",
      // client_slug intentionally omitted — column does not exist on public.leads
    });
    if (leadErr) {
      console.error("[dev-create-quote-scenario] lead insert failed", leadErr);
      return fail("lead", "failed to create lead", 500);
    }

    // ── 6. quote_files (path namespaced for future cleanup) ──────────────────
    const quoteFileId = crypto.randomUUID();
    const storagePath = `dev-bypass/${devRunId}/${safeKey}/${quoteFileId}.json`;
    const { error: qfErr } = await admin.from("quote_files").insert({
      id: quoteFileId,
      lead_id: leadId,
      storage_path: storagePath,
      status: "pending",
    });
    if (qfErr) {
      console.error("[dev-create-quote-scenario] quote_files insert failed", qfErr);
      return fail("quote_file", "failed to create quote file", 500);
    }

    // ── 7. scan_sessions ─────────────────────────────────────────────────────
    const scanSessionId = crypto.randomUUID();
    const { error: ssErr } = await admin.from("scan_sessions").insert({
      id: scanSessionId,
      status: "uploading",
      lead_id: leadId,
      quote_file_id: quoteFileId,
    });
    if (ssErr) {
      console.error("[dev-create-quote-scenario] scan_sessions insert failed", ssErr);
      return fail("scan_session", "failed to create scan session", 500);
    }

    // ── 8. Invoke scan-quote (server-to-server, service role auth) ──────────
    let invokeStatus = 0;
    try {
      const invokeRes = await fetch(`${supabaseUrl}/functions/v1/scan-quote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          scan_session_id: scanSessionId,
          dev_extraction_override,
          dev_secret,
        }),
      });
      invokeStatus = invokeRes.status;

      // Drain body for logs only — never return downstream details to client.
      let downstreamLog: unknown = null;
      try {
        downstreamLog = await invokeRes.json();
      } catch {
        /* ignore */
      }

      if (!invokeRes.ok) {
        console.error("[dev-create-quote-scenario] scan-quote failed", {
          status: invokeStatus,
          downstreamLog,
        });
        return json(
          {
            error: "scan-quote failed",
            stage: "scan_quote" satisfies Stage,
            status: invokeStatus,
            dev_run_id: devRunId,
            scan_session_id: scanSessionId,
            lead_id: leadId,
          },
          502,
        );
      }
    } catch (err) {
      console.error("[dev-create-quote-scenario] scan-quote fetch threw", err);
      return json(
        {
          error: "scan-quote unreachable",
          stage: "scan_quote" satisfies Stage,
          dev_run_id: devRunId,
          scan_session_id: scanSessionId,
          lead_id: leadId,
        },
        502,
      );
    }

    // ── 9. Success ───────────────────────────────────────────────────────────
    return json(
      {
        ok: true,
        dev_run_id: devRunId,
        scan_session_id: scanSessionId,
        lead_id: leadId,
        quote_file_id: quoteFileId,
        storage_path: storagePath,
      },
      200,
    );
  } catch (err) {
    console.error("[dev-create-quote-scenario] unhandled error", err);
    return fail("env", "internal error", 500);
  }
});
