/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Sprint 5 — dispatch-lead Edge Function
 * ═══════════════════════════════════════════════════════════════════════════
 * Drains pending rows from `webhook_deliveries` (claimed via
 * `claim_pending_deliveries` SKIP LOCKED) and delivers each to the
 * Sprint-4-resolved contractor destination (webhook or email).
 *
 * Hard contracts:
 *   - Every attempt writes ONE row to `webhook_delivery_attempts` (append-only).
 *   - The per-lead queue row in `webhook_deliveries` is updated only to flip
 *     terminal status / schedule the next retry — attempt-level data lives
 *     ONLY in the immutable attempt log.
 *   - No silent failures: every code path that touches a delivery row also
 *     writes an attempt row (even unsupported_dispatch_method / missing_destination).
 *   - No global destination assumptions: the URL/email is read off the
 *     queue row's `destination_snapshot`, which was stamped by the
 *     trigger using `resolve_route_for_lead` at enqueue time.
 *   - Secrets are never logged; response bodies are truncated to 2KB.
 *
 * Auth model:
 *   - Caller must present `x-dispatch-secret` matching env DISPATCH_LEAD_SECRET.
 *   - On first successful boot the function seeds vault with the dispatch
 *     URL + secret so the `fire_crm_handoff` trigger can pg_net→ this
 *     function for low-latency wake-ups.
 *
 * Invocation modes (POST JSON):
 *   - { "delivery_id": "<uuid>" }   → process exactly that row (used by trigger)
 *   - { "limit": 25 }               → drain up to N rows (used by manual / cron)
 *   - {}                            → drain default batch (25)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// Local loose alias. The Deno typecheck infers ReturnType<typeof createClient>
// as SupabaseClient<unknown, never, GenericSchema>, which is incompatible with
// the actual SupabaseClient<any, "public", any> the runtime constructs. We use
// `any` here strictly to keep helper signatures permissive without altering
// any runtime behavior.
// deno-lint-ignore no-explicit-any
type AnySupabaseClient = any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dispatch-secret",
};

const MAX_ATTEMPTS = 5;
const HTTP_TIMEOUT_MS = 8000;
const RESPONSE_SNIPPET_BYTES = 2048;
const RETRY_BACKOFF_MINUTES = [1, 5, 30, 120] as const;

// ─── Types ────────────────────────────────────────────────────────────────
type ClaimedDelivery = {
  delivery_id: string;
  lead_id: string;
  client_slug: string | null;
  contractor_id: string | null;
  assignment_id: string | null;
  dispatch_method: "webhook" | "email" | "manual" | "none" | string;
  destination_snapshot: Record<string, unknown> | null;
  attempt_count: number;
  payload_json: Record<string, unknown> | null;
  webhook_url: string | null;
};

type AttemptOutcome =
  | "http_2xx"
  | "http_4xx"
  | "http_5xx"
  | "http_redirect"
  | "timeout"
  | "network_error"
  | "resend_accepted"
  | "resend_rejected"
  | "unsupported_dispatch_method"
  | "missing_destination"
  | "exception";

interface AttemptResult {
  success: boolean;
  outcome: AttemptOutcome;
  responseStatusCode: number | null;
  responseBodySnippet: string | null;
  durationMs: number;
  errorClass: string | null;
  errorMessage: string | null;
  retryable: boolean;
}

// ─── Vault bootstrap (one-time, idempotent) ───────────────────────────────
async function ensureVaultSeeded(supabase: AnySupabaseClient) {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/dispatch-lead`;
  const secret = Deno.env.get("DISPATCH_LEAD_SECRET");
  if (!secret) return;

  // Best-effort upsert; ignore failures (vault may not be writable from anon key).
  try {
    await supabase.rpc("vault_upsert_dispatch_secrets" as never, {
      p_url: url,
      p_secret: secret,
    } as never);
  } catch {
    // Silently ignore — trigger pg_net call is a low-latency optimisation,
    // cron / manual invoke is the source of truth.
  }
}

// ─── Attempt executors ────────────────────────────────────────────────────
async function attemptWebhook(
  destination: Record<string, unknown>,
  payload: Record<string, unknown>,
): Promise<AttemptResult> {
  const url = String(destination.webhook_url ?? "");
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), HTTP_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const text = await response.text().catch(() => "");
    const snippet = text.slice(0, RESPONSE_SNIPPET_BYTES);
    const durationMs = Date.now() - startedAt;

    if (response.status >= 200 && response.status < 300) {
      return {
        success: true,
        outcome: "http_2xx",
        responseStatusCode: response.status,
        responseBodySnippet: snippet,
        durationMs,
        errorClass: null,
        errorMessage: null,
        retryable: false,
      };
    }
    if (response.status >= 300 && response.status < 400) {
      return {
        success: false,
        outcome: "http_redirect",
        responseStatusCode: response.status,
        responseBodySnippet: snippet,
        durationMs,
        errorClass: "redirect",
        errorMessage: `Unexpected redirect: ${response.status}`,
        retryable: false,
      };
    }
    if (
      response.status >= 400 && response.status < 500 &&
      response.status !== 408 && response.status !== 429
    ) {
      return {
        success: false,
        outcome: "http_4xx",
        responseStatusCode: response.status,
        responseBodySnippet: snippet,
        durationMs,
        errorClass: "client_error",
        errorMessage: `HTTP ${response.status}`,
        retryable: false,
      };
    }
    return {
      success: false,
      outcome: response.status >= 500 ? "http_5xx" : "http_4xx",
      responseStatusCode: response.status,
      responseBodySnippet: snippet,
      durationMs,
      errorClass: "server_error",
      errorMessage: `HTTP ${response.status}`,
      retryable: true,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isTimeout = message.toLowerCase().includes("timeout") ||
      message.toLowerCase().includes("abort");
    return {
      success: false,
      outcome: isTimeout ? "timeout" : "network_error",
      responseStatusCode: null,
      responseBodySnippet: null,
      durationMs: Date.now() - startedAt,
      errorClass: isTimeout ? "timeout" : "network",
      errorMessage: message,
      retryable: true,
    };
  } finally {
    clearTimeout(timer);
  }
}

async function attemptEmail(
  destination: Record<string, unknown>,
  payload: Record<string, unknown>,
  delivery: ClaimedDelivery,
): Promise<AttemptResult> {
  const to = String(destination.email ?? "");
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const resendKey = Deno.env.get("RESEND_API_KEY");
  const startedAt = Date.now();

  if (!resendKey || !lovableKey) {
    return {
      success: false,
      outcome: "exception",
      responseStatusCode: null,
      responseBodySnippet: null,
      durationMs: 0,
      errorClass: "config_error",
      errorMessage: "RESEND_API_KEY or LOVABLE_API_KEY not configured",
      retryable: false,
    };
  }

  const fromAddr = Deno.env.get("REPORT_FROM_EMAIL") ??
    "WindowMan <onboarding@resend.dev>";
  const subject = `[WindowMan] Qualified lead — ${
    delivery.client_slug ?? "unknown client"
  } — ${delivery.lead_id}`;
  const html = `
    <h2>Qualified lead from WindowMan</h2>
    <p><strong>Lead ID:</strong> ${delivery.lead_id}</p>
    <p><strong>Client slug:</strong> ${delivery.client_slug ?? "(none)"}</p>
    <p><strong>Assignment:</strong> ${delivery.assignment_id ?? "(none)"}</p>
    <pre style="background:#f5f5f5;padding:12px;border-radius:6px;font-size:12px;overflow:auto;">
${escapeHtml(JSON.stringify(payload, null, 2))}
    </pre>
  `;

  try {
    const response = await fetch(
      "https://connector-gateway.lovable.dev/resend/emails",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": resendKey,
        },
        body: JSON.stringify({ from: fromAddr, to: [to], subject, html }),
      },
    );
    const text = await response.text().catch(() => "");
    const snippet = text.slice(0, RESPONSE_SNIPPET_BYTES);
    const durationMs = Date.now() - startedAt;

    if (response.ok) {
      return {
        success: true,
        outcome: "resend_accepted",
        responseStatusCode: response.status,
        responseBodySnippet: snippet,
        durationMs,
        errorClass: null,
        errorMessage: null,
        retryable: false,
      };
    }
    return {
      success: false,
      outcome: "resend_rejected",
      responseStatusCode: response.status,
      responseBodySnippet: snippet,
      durationMs,
      errorClass: response.status >= 500 ? "server_error" : "client_error",
      errorMessage: `Resend HTTP ${response.status}`,
      retryable: response.status >= 500 || response.status === 429,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      outcome: "network_error",
      responseStatusCode: null,
      responseBodySnippet: null,
      durationMs: Date.now() - startedAt,
      errorClass: "network",
      errorMessage: message,
      retryable: true,
    };
  }
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (
      c,
    ) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c] ?? c),
  );
}

function nextRetryAt(attemptNumber: number): string | null {
  const idx = attemptNumber - 1;
  const minutes = RETRY_BACKOFF_MINUTES[idx];
  if (!minutes || attemptNumber >= MAX_ATTEMPTS) return null;
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// ─── Per-row pipeline ─────────────────────────────────────────────────────
async function processDelivery(
  supabase: AnySupabaseClient,
  delivery: ClaimedDelivery,
): Promise<{ delivery_id: string; final_status: string; success: boolean }> {
  const attemptNumber = (delivery.attempt_count ?? 0) + 1;
  const requestStartedAt = new Date().toISOString();
  let result: AttemptResult;

  // Build the outbound payload (pulls the full contractor brief if available).
  const payload = await buildOutboundPayload(supabase, delivery);

  if (!delivery.destination_snapshot) {
    result = {
      success: false,
      outcome: "missing_destination",
      responseStatusCode: null,
      responseBodySnippet: null,
      durationMs: 0,
      errorClass: "config_error",
      errorMessage: "destination_snapshot is null",
      retryable: false,
    };
  } else if (delivery.dispatch_method === "webhook") {
    if (!delivery.destination_snapshot.webhook_url) {
      result = {
        success: false,
        outcome: "missing_destination",
        responseStatusCode: null,
        responseBodySnippet: null,
        durationMs: 0,
        errorClass: "config_error",
        errorMessage: "webhook_url missing",
        retryable: false,
      };
    } else {
      result = await attemptWebhook(delivery.destination_snapshot, payload);
    }
  } else if (delivery.dispatch_method === "email") {
    if (!delivery.destination_snapshot.email) {
      result = {
        success: false,
        outcome: "missing_destination",
        responseStatusCode: null,
        responseBodySnippet: null,
        durationMs: 0,
        errorClass: "config_error",
        errorMessage: "email missing",
        retryable: false,
      };
    } else {
      result = await attemptEmail(
        delivery.destination_snapshot,
        payload,
        delivery,
      );
    }
  } else {
    result = {
      success: false,
      outcome: "unsupported_dispatch_method",
      responseStatusCode: null,
      responseBodySnippet: null,
      durationMs: 0,
      errorClass: "config_error",
      errorMessage: `dispatch_method=${delivery.dispatch_method} not supported`,
      retryable: false,
    };
  }

  // 1. APPEND immutable attempt row (always, no silent failures).
  await supabase.from("webhook_delivery_attempts").insert({
    delivery_id: delivery.delivery_id,
    lead_id: delivery.lead_id,
    client_slug: delivery.client_slug,
    contractor_id: delivery.contractor_id,
    assignment_id: delivery.assignment_id,
    dispatch_method: delivery.dispatch_method,
    destination_snapshot: delivery.destination_snapshot ?? {},
    attempt_number: attemptNumber,
    request_started_at: requestStartedAt,
    request_completed_at: new Date().toISOString(),
    duration_ms: result.durationMs,
    response_status_code: result.responseStatusCode,
    response_body_snippet: result.responseBodySnippet,
    success: result.success,
    outcome: result.outcome,
    error_class: result.errorClass,
    error_message: result.errorMessage,
  });

  // 2. Update queue row with terminal/transitional state.
  let nextStatus: string;
  let terminal_at: string | null = null;
  let next_retry_at: string | null = null;

  if (result.success) {
    nextStatus = "delivered";
    terminal_at = new Date().toISOString();
  } else if (!result.retryable || attemptNumber >= MAX_ATTEMPTS) {
    nextStatus = "dead_letter";
    terminal_at = new Date().toISOString();
  } else {
    nextStatus = "failed";
    next_retry_at = nextRetryAt(attemptNumber);
  }

  await supabase
    .from("webhook_deliveries")
    .update({
      status: nextStatus,
      attempt_count: attemptNumber,
      last_attempt_at: new Date().toISOString(),
      last_http_status: result.responseStatusCode,
      last_error: result.errorMessage,
      next_retry_at,
      terminal_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", delivery.delivery_id);

  // 3. Audit on lead_events for terminal outcomes.
  if (nextStatus === "delivered" || nextStatus === "dead_letter") {
    await supabase.from("lead_events").insert({
      lead_id: delivery.lead_id,
      event_name: nextStatus === "delivered"
        ? "crm_handoff_delivered"
        : "crm_handoff_dead_letter",
      event_source: "edge:dispatch-lead",
      metadata: {
        delivery_id: delivery.delivery_id,
        attempt_number: attemptNumber,
        outcome: result.outcome,
        contractor_id: delivery.contractor_id,
        assignment_id: delivery.assignment_id,
        dispatch_method: delivery.dispatch_method,
        client_slug: delivery.client_slug,
      },
    });
  }

  return {
    delivery_id: delivery.delivery_id,
    final_status: nextStatus,
    success: result.success,
  };
}

async function buildOutboundPayload(
  supabase: AnySupabaseClient,
  delivery: ClaimedDelivery,
): Promise<Record<string, unknown>> {
  const base = (delivery.payload_json ?? {}) as Record<string, unknown>;

  // Best-effort: attach the contractor brief from the latest analysis. This is
  // the actual deliverable the contractor wants to receive. Failures here MUST
  // NOT block delivery — fall back to the minimal enqueue snapshot.
  try {
    const { data: lead } = await supabase
      .from("leads")
      .select(
        "id,first_name,last_name,phone_e164,email,county,project_type,window_count,grade,quote_amount,latest_analysis_id,client_slug",
      )
      .eq("id", delivery.lead_id)
      .maybeSingle();

    let brief: Record<string, unknown> | null = null;
    if (lead?.latest_analysis_id) {
      const { data: analysis } = await supabase
        .from("analyses")
        .select(
          "id,grade,confidence_score,contractor_brief,contractor_brief_json,price_fairness,markup_estimate,negotiation_leverage",
        )
        .eq("id", lead.latest_analysis_id)
        .maybeSingle();
      brief = (analysis as Record<string, unknown> | null) ?? null;
    }

    return {
      ...base,
      lead: lead ?? { id: delivery.lead_id },
      analysis: brief,
      delivery: {
        delivery_id: delivery.delivery_id,
        client_slug: delivery.client_slug,
        contractor_id: delivery.contractor_id,
        assignment_id: delivery.assignment_id,
        dispatch_method: delivery.dispatch_method,
      },
    };
  } catch {
    return base;
  }
}

// ─── HTTP entry ──────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const expected = Deno.env.get("DISPATCH_LEAD_SECRET");
  if (!expected) {
    return json({ error: "DISPATCH_LEAD_SECRET is not configured" }, 500);
  }
  const provided = req.headers.get("x-dispatch-secret");
  if (provided !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  let body: { delivery_id?: string; limit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // One-time vault seed (best-effort).
  await ensureVaultSeeded(supabase);

  // Branch A: targeted single-row dispatch (used by trigger pg_net call).
  if (body.delivery_id) {
    const { data: rows, error } = await supabase
      .rpc("claim_pending_deliveries" as never, { p_limit: 100 } as never);

    if (error) return json({ error: error.message }, 500);

    const target = (rows as ClaimedDelivery[] | null)?.find((r) =>
      r.delivery_id === body.delivery_id
    );
    if (!target) {
      // Either already terminal or claimed by a concurrent worker. Both safe.
      return json({
        ok: true,
        processed: 0,
        note: "delivery not in claimable set",
      }, 200);
    }
    const result = await processDelivery(supabase, target);
    return json({ ok: true, processed: 1, results: [result] }, 200);
  }

  // Branch B: drain a batch.
  const limit = Math.min(Math.max(body.limit ?? 25, 1), 100);
  const { data: rows, error } = await supabase
    .rpc("claim_pending_deliveries" as never, { p_limit: limit } as never);

  if (error) return json({ error: error.message }, 500);

  const claimed = (rows as ClaimedDelivery[] | null) ?? [];
  const results = [];
  for (const row of claimed) {
    try {
      results.push(await processDelivery(supabase, row));
    } catch (e) {
      // Belt-and-braces: never throw out of the loop. Record an exception attempt.
      const msg = e instanceof Error ? e.message : String(e);
      await supabase.from("webhook_delivery_attempts").insert({
        delivery_id: row.delivery_id,
        lead_id: row.lead_id,
        client_slug: row.client_slug,
        contractor_id: row.contractor_id,
        assignment_id: row.assignment_id,
        dispatch_method: row.dispatch_method,
        destination_snapshot: row.destination_snapshot ?? {},
        attempt_number: (row.attempt_count ?? 0) + 1,
        request_started_at: new Date().toISOString(),
        request_completed_at: new Date().toISOString(),
        duration_ms: 0,
        response_status_code: null,
        response_body_snippet: null,
        success: false,
        outcome: "exception",
        error_class: "worker_exception",
        error_message: msg,
      });
      await supabase
        .from("webhook_deliveries")
        .update({
          status: "failed",
          attempt_count: (row.attempt_count ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
          last_error: msg,
          next_retry_at: nextRetryAt((row.attempt_count ?? 0) + 1),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.delivery_id);
      results.push({
        delivery_id: row.delivery_id,
        final_status: "failed",
        success: false,
      });
    }
  }

  return json({ ok: true, processed: claimed.length, results }, 200);
});

function json(payload: unknown, status: number) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
