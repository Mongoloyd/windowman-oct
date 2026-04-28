import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Retry schedule (exponential backoff) ─────────────────────────────── */
const RETRY_DELAYS_MS = [
  30_000, // 30s
  2 * 60_000, // 2m
  10 * 60_000, // 10m
  60 * 60_000, // 1h
  6 * 60 * 60_000, // 6h
];

/* ── HMAC-SHA256 signing ──────────────────────────────────────────────── */
async function signPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* ── Build payload for a delivery ─────────────────────────────────────── */
async function buildPayload(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  delivery: { id: string; lead_id: string; event_type: string },
): Promise<Record<string, unknown>> {
  // Fetch lead data for the payload
  const { data: lead } = await supabase
    .from("leads")
    .select(
      "id, phone_e164, grade, grade_score, county, project_type, window_count, latest_analysis_id, suggested_contractor_id, phone_verified_at",
    )
    .eq("id", delivery.lead_id)
    .single();

  return {
    delivery_id: delivery.id,
    event_type: delivery.event_type,
    lead_id: delivery.lead_id,
    grade: lead?.grade ?? null,
    grade_score: lead?.grade_score ?? null,
    county: lead?.county ?? null,
    project_type: lead?.project_type ?? null,
    window_count: lead?.window_count ?? null,
    analysis_id: lead?.latest_analysis_id ?? null,
    contractor_id: lead?.suggested_contractor_id ?? null,
    phone_verified_at: lead?.phone_verified_at ?? null,
    timestamp: new Date().toISOString(),
  };
}

/* ── Log audit event to lead_events ───────────────────────────────────── */
async function logLeadEvent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  leadId: string,
  eventName: string,
  metadata: Record<string, unknown>,
) {
  const { error } = await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_name: eventName,
    event_source: "process-webhook",
    metadata,
  });
  if (error) {
    console.error(`[process-webhook] Failed to log ${eventName}:`, error);
  }
}

/* ── Main handler ─────────────────────────────────────────────────────── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const webhookUrl = Deno.env.get("CRM_WEBHOOK_URL") || "";
  const webhookSecret = Deno.env.get("CRM_WEBHOOK_SECRET") || "";
  const isMockMode = !webhookUrl || webhookUrl === "mock";

  // Fetch pending deliveries that are due for processing
  const { data: deliveries, error: fetchErr } = await supabase
    .from("webhook_deliveries")
    .select("*")
    .in("status", ["pending", "failed"])
    .lt("attempt_count", 5)
    .or(`next_retry_at.is.null,next_retry_at.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(10);

  if (fetchErr) {
    console.error("[process-webhook] Failed to fetch deliveries:", fetchErr);
    return new Response(
      JSON.stringify({ error: "Failed to fetch deliveries" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (!deliveries || deliveries.length === 0) {
    return new Response(
      JSON.stringify({ processed: 0, mode: isMockMode ? "mock" : "live" }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const results: Array<{ id: string; status: string }> = [];

  for (const delivery of deliveries) {
    const attemptNum = delivery.attempt_count + 1;

    try {
      // Build the payload (cache it on first attempt)
      const payload = delivery.payload_json ??
        await buildPayload(supabase, delivery);
      const payloadString = JSON.stringify(payload);

      if (isMockMode) {
        // ── Mock/Dry-Run mode ────────────────────────────────────────
        const mockSig = webhookSecret
          ? await signPayload(payloadString, webhookSecret)
          : "no-secret-configured";

        console.log(
          "[process-webhook] MOCK DELIVERY",
          JSON.stringify({
            delivery_id: delivery.id,
            lead_id: delivery.lead_id,
            event_type: delivery.event_type,
            hmac_signature: `sha256=${mockSig}`,
            payload,
          }),
        );

        await supabase
          .from("webhook_deliveries")
          .update({
            status: "mock_delivered",
            payload_json: payload,
            attempt_count: attemptNum,
            last_attempt_at: new Date().toISOString(),
            last_http_status: 200,
          })
          .eq("id", delivery.id);

        await logLeadEvent(
          supabase,
          delivery.lead_id,
          "crm_handoff_mock_delivered",
          {
            delivery_id: delivery.id,
            attempt: attemptNum,
            mode: "mock",
          },
        );

        results.push({ id: delivery.id, status: "mock_delivered" });
      } else {
        // ── Live mode — real fetch with HMAC ─────────────────────────
        const signature = webhookSecret
          ? await signPayload(payloadString, webhookSecret)
          : "";

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Delivery-Id": delivery.id,
        };
        if (signature) {
          headers["X-Signature-256"] = `sha256=${signature}`;
        }

        const res = await fetch(webhookUrl, {
          method: "POST",
          headers,
          body: payloadString,
        });

        const httpStatus = res.status;
        await res.text(); // consume body

        if (httpStatus >= 200 && httpStatus < 300) {
          await supabase
            .from("webhook_deliveries")
            .update({
              status: "delivered",
              payload_json: payload,
              webhook_url: webhookUrl,
              attempt_count: attemptNum,
              last_attempt_at: new Date().toISOString(),
              last_http_status: httpStatus,
            })
            .eq("id", delivery.id);

          await logLeadEvent(
            supabase,
            delivery.lead_id,
            "crm_handoff_delivered",
            {
              delivery_id: delivery.id,
              attempt: attemptNum,
              http_status: httpStatus,
            },
          );

          results.push({ id: delivery.id, status: "delivered" });
        } else {
          // Failed — schedule retry or dead-letter
          const nextStatus = attemptNum >= 5 ? "dead_letter" : "failed";
          const nextRetry = attemptNum < 5
            ? new Date(Date.now() + RETRY_DELAYS_MS[attemptNum - 1])
              .toISOString()
            : null;

          await supabase
            .from("webhook_deliveries")
            .update({
              status: nextStatus,
              payload_json: payload,
              webhook_url: webhookUrl,
              attempt_count: attemptNum,
              last_attempt_at: new Date().toISOString(),
              last_http_status: httpStatus,
              last_error: `HTTP ${httpStatus}`,
              next_retry_at: nextRetry,
            })
            .eq("id", delivery.id);

          await logLeadEvent(supabase, delivery.lead_id, "crm_handoff_failed", {
            delivery_id: delivery.id,
            attempt: attemptNum,
            http_status: httpStatus,
            will_retry: nextStatus === "failed",
          });

          results.push({ id: delivery.id, status: nextStatus });
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(
        `[process-webhook] Error processing ${delivery.id}:`,
        errorMsg,
      );

      const nextStatus = attemptNum >= 5 ? "dead_letter" : "failed";
      const nextRetry = attemptNum < 5
        ? new Date(Date.now() + RETRY_DELAYS_MS[attemptNum - 1]).toISOString()
        : null;

      await supabase
        .from("webhook_deliveries")
        .update({
          status: nextStatus,
          attempt_count: attemptNum,
          last_attempt_at: new Date().toISOString(),
          last_error: errorMsg,
          next_retry_at: nextRetry,
        })
        .eq("id", delivery.id);

      await logLeadEvent(supabase, delivery.lead_id, "crm_handoff_failed", {
        delivery_id: delivery.id,
        attempt: attemptNum,
        error: errorMsg,
        will_retry: nextStatus === "failed",
      });

      results.push({ id: delivery.id, status: nextStatus });
    }
  }

  return new Response(
    JSON.stringify({
      processed: results.length,
      mode: isMockMode ? "mock" : "live",
      results,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
