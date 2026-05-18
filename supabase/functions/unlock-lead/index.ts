/**
 * unlock-lead — Authenticated contractor lead unlock.
 *
 * Wraps the atomic `public.unlock_contractor_lead` RPC.
 * Deducts 1 credit and records the unlock. Idempotent for repeat calls.
 *
 * Inputs: { lead_id: uuid }
 * Auth: JWT required (contractor's auth.uid() used as contractor_id)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──────────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({
        success: false,
        error_code: "unauthenticated",
        message: "Missing auth token.",
      }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabase.auth.getUser(
      jwt,
    );
    if (userErr || !userData?.user?.id) {
      return json({
        success: false,
        error_code: "unauthenticated",
        message: "Invalid auth token.",
      }, 401);
    }
    const contractorId = userData.user.id;

    // ── Input ─────────────────────────────────────────────────────
    const body = await req.json();
    const leadId = body?.lead_id;
    if (!leadId || typeof leadId !== "string") {
      return json({
        success: false,
        error_code: "invalid_input",
        message: "lead_id is required.",
      }, 400);
    }

    // ── RPC call (service role for SECURITY DEFINER) ──────────────
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await serviceClient.rpc("unlock_contractor_lead", {
      p_contractor_id: contractorId,
      p_lead_id: leadId,
    });

    if (error) {
      console.error("[unlock-lead] RPC error:", error);
      return json({
        success: false,
        error_code: "rpc_error",
        message: error.message,
      }, 500);
    }

    const result = data as Record<string, unknown>;

    // ── Map RPC result to HTTP status ─────────────────────────────
    if (result.success) {
      return json({
        success: true,
        already_unlocked: result.already_unlocked,
        remaining_balance: result.remaining_balance,
        lead_id: result.lead_id,
        message: result.message,
        error_code: null,
      });
    }

    const code = result.error_code as string;
    const statusMap: Record<string, number> = {
      contractor_not_found: 404,
      contractor_inactive: 403,
      lead_not_found: 404,
      no_credit_account: 402,
      insufficient_credits: 402,
    };

    return json(
      {
        success: false,
        already_unlocked: false,
        remaining_balance: result.remaining_balance,
        lead_id: result.lead_id,
        message: result.message,
        error_code: code,
      },
      statusMap[code] ?? 400,
    );
  } catch (err) {
    console.error("[unlock-lead] Unhandled error:", err);
    return json({
      success: false,
      error_code: "internal_error",
      message: "Internal server error.",
    }, 500);
  }
});
