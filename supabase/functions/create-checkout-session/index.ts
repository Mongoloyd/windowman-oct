/**
 * create-checkout-session — Creates a Stripe Checkout Session for contractor credit purchases.
 *
 * Auth: JWT required (contractor auth user).
 * Preview fallback: If PREVIEW_CHECKOUT_ENABLED=true and no auth, uses PREVIEW_CONTRACTOR_PROFILE_ID.
 * Does NOT grant credits — that happens in the webhook fulfillment flow.
 *
 * POST body: { pack_code: string, origin?: string }
 * Returns:   { url: string, session_id: string }
 *
 * Supported modes:
 *   "payment"      — one-off credit pack (price_data built dynamically)
 *   "subscription" — recurring seat fee (uses hardcoded Stripe Price ID)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17.7.0";

/* ── CORS ────────────────────────────────────────────────────────────── */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/* ── Credit Pack Config ──────────────────────────────────────────────── */

// ── SYNDICATE: added mode + price_id fields ───────────────────────────
interface CreditPack {
  code: string;
  label: string;
  credits: number; // 0 for subscription tiers (access-based, not credit-based)
  amount_cents: number; // display price; for subscriptions, Stripe Price ID governs billing
  mode: "payment" | "subscription";
  price_id?: string; // Stripe Price ID — required for mode: "subscription"
}

const CREDIT_PACKS: Record<string, CreditPack> = {
  pack_10_credits: {
    code: "pack_10_credits",
    label: "10 Lead Credits",
    credits: 10,
    amount_cents: 50000,
    mode: "payment",
  },
  pack_25_credits: {
    code: "pack_25_credits",
    label: "25 Lead Credits",
    credits: 25,
    amount_cents: 112500,
    mode: "payment",
  },
  pack_50_credits: {
    code: "pack_50_credits",
    label: "50 Lead Credits",
    credits: 50,
    amount_cents: 200000,
    mode: "payment",
  },
  // ── SYNDICATE: Broward County recurring seat fee ──────────────────
  syndicate_broward: {
    code: "syndicate_broward",
    label: "WindowMan Syndicate Access — Broward County",
    credits: 0, // Access-based tier; credits field unused for subscriptions
    amount_cents: 100000, // $1,000/mo (for display only — Stripe Price ID governs)
    mode: "subscription",
    price_id: "price_1TOUYxEt4CZTlrNuhXhwkqWW",
  },
};

/* ── Resolve contractor identity ─────────────────────────────────────── */

/**
 * Resolves the contractor identity from auth JWT or preview fallback.
 * Returns the raw contractor ID — profile/credits validation happens in the main handler.
 */
async function resolveContractorIdentity(
  req: Request,
): Promise<
  {
    contractorId: string | null;
    isPreview: boolean;
    errorResponse: Response | null;
  }
> {
  // ── Try real auth first ──────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (!userErr && userData?.user?.id) {
      return {
        contractorId: userData.user.id,
        isPreview: false,
        errorResponse: null,
      };
    }
  }

  // ── Preview fallback (server-side only, env-gated) ────────────────
  const previewEnabled = Deno.env.get("PREVIEW_CHECKOUT_ENABLED")?.trim()
    .toLowerCase();
  const previewContractorId =
    Deno.env.get("PREVIEW_CONTRACTOR_PROFILE_ID")?.trim() ||
    Deno.env.get("PREVIEW_CONTRACTOR_ID")?.trim();

  if (previewEnabled === "true" && previewContractorId) {
    // Only allow in Stripe test mode
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    if (!stripeKey.startsWith("sk_test_")) {
      console.warn(
        "[create-checkout-session] Preview fallback blocked — not in Stripe test mode",
      );
      return {
        contractorId: null,
        isPreview: false,
        errorResponse: json({
          error: "preview_blocked",
          message: "Preview checkout only available in test mode.",
        }, 403),
      };
    }

    console.log(
      `[create-checkout-session] Using preview contractor: ${previewContractorId}`,
    );
    return {
      contractorId: previewContractorId,
      isPreview: true,
      errorResponse: null,
    };
  }

  // ── Neither path available ────────────────────────────────────────
  return {
    contractorId: null,
    isPreview: false,
    errorResponse: json({
      error: "unauthenticated",
      message: "Sign in to purchase credits.",
    }, 401),
  };
}

/* ── Validate contractor profile + credits ───────────────────────────── */

async function validateContractor(
  svc: ReturnType<typeof createClient>,
  contractorId: string,
  isPreview: boolean,
): Promise<{ errorResponse: Response | null }> {
  // 1. Profile must exist and be active
  const { data: profile } = await svc
    .from("contractor_profiles")
    .select("id, status")
    .eq("id", contractorId)
    .maybeSingle();

  if (!profile) {
    const ctx = isPreview ? "preview config" : "auth";
    console.error(
      `[create-checkout-session] No contractor_profiles row for ${contractorId} (${ctx})`,
    );
    return {
      errorResponse: json({
        error: isPreview ? "config_error" : "no_contractor_profile",
        message: isPreview
          ? "Preview contractor profile not found. Check PREVIEW_CONTRACTOR_PROFILE_ID secret."
          : "No contractor profile found.",
      }, isPreview ? 422 : 404),
    };
  }

  if (profile.status !== "active") {
    console.error(
      `[create-checkout-session] Contractor ${contractorId} status is '${profile.status}'`,
    );
    return {
      errorResponse: json({
        error: "contractor_inactive",
        message: `Contractor account is ${profile.status}.`,
      }, 403),
    };
  }

  // 2. Credits row must exist
  const { data: credits } = await svc
    .from("contractor_credits")
    .select("contractor_id")
    .eq("contractor_id", contractorId)
    .maybeSingle();

  if (!credits) {
    console.error(
      `[create-checkout-session] No contractor_credits row for ${contractorId}`,
    );
    return {
      errorResponse: json({
        error: isPreview ? "config_error" : "no_credit_account",
        message: isPreview
          ? "Preview contractor has no credit account. Seed a contractor_credits row first."
          : "No credit account found. Contact support.",
      }, isPreview ? 422 : 404),
    };
  }

  return { errorResponse: null };
}

/* ── Handler ─────────────────────────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  /* ── GET = preview checkout diagnostic (read-only) ────────────── */
  if (req.method === "GET") {
    const previewEnabled =
      Deno.env.get("PREVIEW_CHECKOUT_ENABLED")?.trim().toLowerCase() === "true";
    const contractorId =
      Deno.env.get("PREVIEW_CONTRACTOR_PROFILE_ID")?.trim() ||
      Deno.env.get("PREVIEW_CONTRACTOR_ID")?.trim() ||
      null;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
    const stripeTestMode = stripeKey.startsWith("sk_test_");

    const result: Record<string, unknown> = {
      preview_enabled: previewEnabled,
      contractor_id_configured: !!contractorId,
      contractor_id: contractorId,
      stripe_test_mode: stripeTestMode,
      profile_exists: false,
      profile_status: null,
      credits_row_exists: false,
      credits_balance: null,
      ready: false,
      // ── SYNDICATE: surface available packs in diagnostic ─────────
      available_packs: Object.keys(CREDIT_PACKS),
    };

    if (contractorId) {
      try {
        const svc = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );

        const { data: profile } = await svc
          .from("contractor_profiles")
          .select("id, status")
          .eq("id", contractorId)
          .maybeSingle();

        if (profile) {
          result.profile_exists = true;
          result.profile_status = profile.status;
        }

        const { data: credits } = await svc
          .from("contractor_credits")
          .select("contractor_id, balance")
          .eq("contractor_id", contractorId)
          .maybeSingle();

        if (credits) {
          result.credits_row_exists = true;
          result.credits_balance = credits.balance;
        }
      } catch (dbErr) {
        console.error("[create-checkout-session] Diagnostic DB error:", dbErr);
      }
    }

    result.ready = previewEnabled &&
      !!contractorId &&
      stripeTestMode &&
      result.profile_exists === true &&
      result.profile_status === "active" &&
      result.credits_row_exists === true;

    return json(result);
  }

  try {
    // ── 1. Service client ─────────────────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 2. Resolve contractor identity ────────────────────────────
    const { contractorId, isPreview, errorResponse: identityErr } =
      await resolveContractorIdentity(req);
    if (identityErr) return identityErr;
    if (!contractorId) {
      return json({
        error: "unauthenticated",
        message: "Could not resolve contractor identity.",
      }, 401);
    }

    // ── 3. Validate contractor profile + credits ──────────────────
    const { errorResponse: validationErr } = await validateContractor(
      svc,
      contractorId,
      isPreview,
    );
    if (validationErr) return validationErr;

    // ── 4. Parse & validate request body ──────────────────────────
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({
        error: "invalid_body",
        message: "Request body must be valid JSON.",
      }, 400);
    }

    const packCode = body.pack_code as string | undefined;
    if (!packCode) {
      return json({
        error: "missing_pack_code",
        message: "pack_code is required.",
      }, 400);
    }

    const pack = CREDIT_PACKS[packCode];
    if (!pack) {
      return json({
        error: "invalid_pack_code",
        message: `Unknown pack_code: ${packCode}. Valid: ${
          Object.keys(CREDIT_PACKS).join(", ")
        }`,
      }, 400);
    }

    // ── SYNDICATE: validate subscription packs have a price_id ────
    if (pack.mode === "subscription" && !pack.price_id) {
      console.error(
        `[create-checkout-session] Subscription pack ${packCode} missing price_id`,
      );
      return json({
        error: "config_error",
        message: "Subscription product not configured.",
      }, 500);
    }

    // ── 5. Build URLs ─────────────────────────────────────────────
    const origin = (body.origin as string) || Deno.env.get("REPORT_BASE_URL") ||
      "https://wmmvp.lovable.app";
    const successUrl =
      `${origin}/partner/opportunities?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/partner/opportunities?payment=cancel`;

    // ── 6. Create Stripe Checkout Session ─────────────────────────
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error(
        "[create-checkout-session] STRIPE_SECRET_KEY not configured",
      );
      return json({
        error: "config_error",
        message: "Payment system not configured.",
      }, 500);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const sharedMetadata = {
      contractor_id: contractorId,
      credit_pack_code: pack.code,
      credits_purchased: String(pack.credits),
      ...(isPreview ? { preview_purchase: "true" } : {}),
    };

    // ── SYNDICATE: dynamic line_items and mode based on pack.mode ─
    const isSubscription = pack.mode === "subscription";

    const session = await stripe.checkout.sessions.create({
      mode: pack.mode,
      payment_method_types: ["card"],

      line_items: isSubscription
        // Subscription: reference the pre-built Stripe Price directly
        ? [{ price: pack.price_id!, quantity: 1 }]
        // One-off: build price_data dynamically (no pre-built Stripe Price needed)
        : [
          {
            price_data: {
              currency: "usd",
              unit_amount: pack.amount_cents,
              product_data: {
                name: pack.label,
                description:
                  `${pack.credits} lead unlock credits for WindowMan.app`,
              },
            },
            quantity: 1,
          },
        ],

      metadata: sharedMetadata,

      // ── SYNDICATE: propagate contractor_id into subscription metadata
      // so stripe-webhook can identify the subscriber on renewal events
      ...(isSubscription
        ? {
          subscription_data: {
            metadata: sharedMetadata,
          },
        }
        : {}),

      success_url: successUrl,
      cancel_url: cancelUrl,
    });

    if (!session.url) {
      console.error(
        "[create-checkout-session] Stripe returned no URL",
        session.id,
      );
      return json({
        error: "stripe_error",
        message: "Failed to create checkout session.",
      }, 500);
    }

    // ── 7. Insert pending purchase row (FAIL CLOSED) ──────────────
    // Must succeed before returning the Stripe URL. If this fails,
    // we expire the orphaned Stripe session so no payment occurs.
    const { error: insertErr } = await svc
      .from("contractor_credit_purchases")
      .insert({
        contractor_id: contractorId,
        stripe_checkout_session_id: session.id,
        credit_pack_code: pack.code,
        credits_purchased: pack.credits,
        amount_total_cents: pack.amount_cents,
        currency: "usd",
        status: "pending",
        mode: pack.mode, // ── SYNDICATE: new column
      });

    if (insertErr) {
      console.error(
        "[create-checkout-session] FAIL CLOSED — pending purchase insert failed:",
        JSON.stringify(insertErr),
      );

      // Best-effort: expire the orphaned Stripe session
      try {
        await stripe.checkout.sessions.expire(session.id);
        console.log(
          `[create-checkout-session] Expired orphaned Stripe session ${session.id}`,
        );
      } catch (expireErr) {
        console.warn(
          `[create-checkout-session] Could not expire Stripe session ${session.id}:`,
          expireErr,
        );
      }

      return json({
        error: "purchase_record_failed",
        message:
          "Failed to record purchase. Payment was not initiated. Please try again.",
      }, 500);
    }

    // ── 8. Return checkout URL (only after confirmed insert) ──────
    console.log(
      `[create-checkout-session] Created ${pack.mode} session ${session.id}` +
        ` for contractor ${contractorId}${
          isPreview ? " (preview)" : ""
        }, pack ${pack.code}`,
    );

    return json({ url: session.url, session_id: session.id });
  } catch (err) {
    console.error("[create-checkout-session] Unhandled error:", err);
    return json(
      { error: "internal_error", message: "Internal server error." },
      500,
    );
  }
});
