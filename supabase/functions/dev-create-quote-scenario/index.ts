// ═══════════════════════════════════════════════════════════════════════════════
// DEV-ONLY: dev-create-quote-scenario
// Server-side scaffold for the Dev Quote Generator.
// Bypasses RLS using the service role to create the lead/quote_file/scan_session
// rows the dev scenarios need, then invokes scan-quote with dev bypass.
//
// Security:
//   - Gated entirely by DEV_BYPASS_SECRET. No secret → 401.
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

interface RequestBody {
  scenario_key?: string;
  dev_secret?: string;
  dev_run_id?: string;
  dev_extraction_override?: unknown;
  existing_session_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const devSecretEnv = Deno.env.get("DEV_BYPASS_SECRET");
    if (!devSecretEnv) {
      return json({ error: "DEV_BYPASS_SECRET not configured" }, 500);
    }

    const body = (await req.json()) as RequestBody;
    const {
      scenario_key,
      dev_secret,
      dev_extraction_override,
      existing_session_id,
    } = body;

    if (!dev_secret || dev_secret !== devSecretEnv) {
      return json({ error: "unauthorized" }, 401);
    }
    if (!scenario_key || typeof scenario_key !== "string") {
      return json({ error: "scenario_key required" }, 400);
    }
    if (dev_extraction_override === undefined) {
      return json({ error: "dev_extraction_override required" }, 400);
    }

    const safeKey = scenario_key.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
    const devRunId = body.dev_run_id && /^[a-zA-Z0-9_-]{1,64}$/.test(body.dev_run_id)
      ? body.dev_run_id
      : crypto.randomUUID();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // 1. Lead — tagged for cleanup
    const leadId = crypto.randomUUID();
    const sessionMarker = existing_session_id || crypto.randomUUID();
    const { error: leadErr } = await admin.from("leads").insert({
      id: leadId,
      session_id: sessionMarker,
      source: "dev_quote_generator",
      client_slug: "dev",
    });
    if (leadErr) return json({ error: `lead: ${leadErr.message}` }, 500);

    // 2. quote_files — placeholder, path namespaced for future cleanup
    const quoteFileId = crypto.randomUUID();
    const storagePath = `dev-bypass/${devRunId}/${safeKey}/${quoteFileId}.json`;
    const { error: qfErr } = await admin.from("quote_files").insert({
      id: quoteFileId,
      lead_id: leadId,
      storage_path: storagePath,
      status: "pending",
    });
    if (qfErr) return json({ error: `quote_files: ${qfErr.message}` }, 500);

    // 3. scan_sessions
    const scanSessionId = crypto.randomUUID();
    const { error: ssErr } = await admin.from("scan_sessions").insert({
      id: scanSessionId,
      status: "uploading",
      lead_id: leadId,
      quote_file_id: quoteFileId,
    });
    if (ssErr) return json({ error: `scan_sessions: ${ssErr.message}` }, 500);

    // 4. Invoke scan-quote with bypass (server-to-server, service role auth)
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

    let invokeJson: unknown = null;
    try {
      invokeJson = await invokeRes.json();
    } catch {
      /* ignore */
    }

    if (!invokeRes.ok) {
      return json(
        {
          error: "scan-quote failed",
          status: invokeRes.status,
          details: invokeJson,
          dev_run_id: devRunId,
          scan_session_id: scanSessionId,
          lead_id: leadId,
        },
        502,
      );
    }

    return json({
      ok: true,
      dev_run_id: devRunId,
      scan_session_id: scanSessionId,
      lead_id: leadId,
      quote_file_id: quoteFileId,
      storage_path: storagePath,
      scan_quote_response: invokeJson,
    }, 200);
  } catch (err) {
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
