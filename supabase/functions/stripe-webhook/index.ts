/**
 * stripe-webhook — Handles Stripe webhook events for credit purchases.
 *
 * Public endpoint (no JWT). Authenticates via Stripe signature verification.
 *
 * Handled events:
 *   - checkout.session.completed → mark paid → fulfill credits
 *   - checkout.session.expired   → mark expired
 */

import { createClient } from "npm:@supabase/supabase-js@2";

/* ── CORS (minimal — webhooks don't need browser CORS, but kept for consistency) */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── Stripe signature verification using Web Crypto API ──────────── */

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string,
  toleranceSec = 300,
): Promise<boolean> {
  const parts = sigHeader.split(",").reduce(
    (acc, part) => {
      const [key, val] = part.split("=");
      if (key === "t") acc.timestamp = val;
      if (key === "v1") acc.signatures.push(val);
      return acc;
    },
    { timestamp: "", signatures: [] as string[] },
  );

  if (!parts.timestamp || parts.signatures.length === 0) return false;

  // Timestamp tolerance check
  const ts = parseInt(parts.timestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > toleranceSec) return false;

  // Compute expected signature
  const signedPayload = `${parts.timestamp}.${payload}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload),
  );

  const expectedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (expectedHex.length !== parts.signatures[0].length) return false;

  let mismatch = 0;
  for (let i = 0; i < expectedHex.length; i++) {
    mismatch |= expectedHex.charCodeAt(i) ^ parts.signatures[0].charCodeAt(i);
  }

  return mismatch === 0;
}

/* ── Handler ─────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? null;
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
    return json({ error: "Webhook secret not configured" }, 500);
  }

  // ── 1. Read raw body and verify signature ─────────────────────
  const sigHeader = req.headers.get("stripe-signature");
  if (!sigHeader) {
    return json({ error: "Missing stripe-signature header" }, 400);
  }

  const rawBody = await req.text();

  const isValid = await verifyStripeSignature(
    rawBody,
    sigHeader,
    webhookSecret,
  );
  if (!isValid) {
    console.warn("[stripe-webhook] Invalid signature — rejecting");
    return json({ error: "Invalid signature" }, 401);
  }

  // ── 2. Parse event ────────────────────────────────────────────
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  console.log(`[stripe-webhook] Received event: ${event.type}`);

  // ── 3. Service client ─────────────────────────────────────────
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // ═══════════════════════════════════════════════════════════════
  // EVENT: checkout.session.completed
  // ═══════════════════════════════════════════════════════════════
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const sessionId = session.id as string;
    const paymentIntentId = (session.payment_intent as string) ?? null;
    const paymentStatus = session.payment_status as string;

    console.log(
      `[stripe-webhook] checkout.session.completed: ${sessionId}, payment_status=${paymentStatus}`,
    );

    // Only fulfill if payment is actually complete
    if (paymentStatus !== "paid") {
      console.log(
        `[stripe-webhook] Skipping fulfillment — payment_status is "${paymentStatus}", not "paid"`,
      );
      return json({ received: true, action: "skipped_unpaid" });
    }

    // Mark purchase as paid
    const { error: updateErr } = await svc
      .from("contractor_credit_purchases")
      .update({
        status: "paid",
        stripe_payment_intent_id: paymentIntentId,
        stripe_customer_id: (session.customer as string) ?? null,
      })
      .eq("stripe_checkout_session_id", sessionId)
      .in("status", ["pending", "paid"]); // idempotent — skip if already fulfilled

    if (updateErr) {
      console.error(
        "[stripe-webhook] Failed to update purchase to paid:",
        updateErr,
      );
      return json({ error: "Failed to update purchase" }, 500);
    }

    // Call idempotent fulfillment RPC
    const { data: result, error: rpcErr } = await svc.rpc(
      "fulfill_contractor_credit_purchase",
      {
        p_session_id: sessionId,
        p_payment_intent_id: paymentIntentId,
      },
    );

    if (rpcErr) {
      console.error("[stripe-webhook] Fulfillment RPC error:", rpcErr);
      return json({ error: "Fulfillment failed" }, 500);
    }

    const fulfillResult = result as Record<string, unknown>;
    console.log(
      `[stripe-webhook] Fulfillment result: success=${fulfillResult.success}, already_fulfilled=${fulfillResult.already_fulfilled}`,
    );

    if (!fulfillResult.success) {
      console.error(
        "[stripe-webhook] Fulfillment returned failure:",
        fulfillResult,
      );
      // Return 200 to prevent Stripe retry if it's a data issue, not transient
      if (fulfillResult.error_code === "purchase_not_found") {
        return json({ received: true, action: "purchase_not_found" });
      }
      return json({ error: "Fulfillment failed", detail: fulfillResult }, 500);
    }

    return json({
      received: true,
      action: fulfillResult.already_fulfilled
        ? "already_fulfilled"
        : "fulfilled",
      credits: fulfillResult.credits,
      new_balance: fulfillResult.new_balance,
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // EVENT: checkout.session.expired
  // ═══════════════════════════════════════════════════════════════
  if (event.type === "checkout.session.expired") {
    const session = event.data.object;
    const sessionId = session.id as string;

    console.log(`[stripe-webhook] checkout.session.expired: ${sessionId}`);

    // Only expire if still pending (don't overwrite paid/fulfilled)
    const { error: expireErr } = await svc
      .from("contractor_credit_purchases")
      .update({ status: "expired" })
      .eq("stripe_checkout_session_id", sessionId)
      .eq("status", "pending");

    if (expireErr) {
      console.error("[stripe-webhook] Failed to expire purchase:", expireErr);
    }

    return json({ received: true, action: "expired" });
  }

  // ── Unhandled event type — acknowledge to prevent retries ─────
  console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
  return json({ received: true, action: "ignored" });
});
