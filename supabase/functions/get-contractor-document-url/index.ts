/**
 * get-contractor-document-url — Secure signed URL delivery for quote documents.
 *
 * Verifies the contractor has unlocked the lead (or has an approved release
 * via the opportunity routing system) before returning a short-lived signed URL.
 *
 * Inputs: { analysis_id: uuid }
 * Auth: JWT required (contractor auth user)
 */

// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
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
      return json(
        { error: "unauthenticated", message: "Missing auth token." },
        401,
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: claimsData, error: claimsErr } = await anonClient.auth
      .getClaims(
        authHeader.replace("Bearer ", ""),
      );
    if (claimsErr || !claimsData?.claims?.sub) {
      return json(
        { error: "unauthenticated", message: "Invalid auth token." },
        401,
      );
    }
    const authUserId = claimsData.claims.sub as string;

    // ── Input ─────────────────────────────────────────────────────
    const body = await req.json();
    const analysisId = body?.analysis_id;
    if (!analysisId || typeof analysisId !== "string") {
      return json({
        error: "invalid_input",
        message: "analysis_id is required.",
      }, 400);
    }

    // ── Service client ───────────────────────────────────────────
    const svc = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Resolve analysis → scan_session → quote_file ─────────────
    const { data: analysis } = await svc
      .from("analyses")
      .select("id, lead_id, scan_session_id")
      .eq("id", analysisId)
      .maybeSingle();

    if (!analysis) {
      return json({ error: "not_found", message: "Analysis not found." }, 404);
    }

    const leadId = analysis.lead_id as string | null;
    const scanSessionId = analysis.scan_session_id as string | null;

    if (!leadId) {
      return json({
        error: "not_found",
        message: "No lead linked to this analysis.",
      }, 404);
    }

    // ── Authorization check ──────────────────────────────────────
    // Check 1: contractor has unlocked the lead via credit system
    const { data: unlock } = await svc
      .from("contractor_unlocked_leads")
      .select("id")
      .eq("contractor_id", authUserId)
      .eq("lead_id", leadId)
      .maybeSingle();

    let authorized = !!unlock;

    // Check 2: contractor has an approved/released route via opportunity system
    if (!authorized) {
      // Resolve marketplace contractor id via bridge
      const { data: contractor } = await svc
        .from("contractors")
        .select("id")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (contractor) {
        // Find opportunity for this analysis
        const { data: opp } = await svc
          .from("contractor_opportunities")
          .select("id")
          .eq("analysis_id", analysisId)
          .maybeSingle();

        if (opp) {
          const { data: route } = await svc
            .from("contractor_opportunity_routes")
            .select("id, release_status, contact_released")
            .eq("opportunity_id", opp.id)
            .eq("contractor_id", contractor.id)
            .maybeSingle();

          if (
            route &&
            (route.release_status === "released" ||
              route.contact_released === true)
          ) {
            authorized = true;
          }
        }
      }
    }

    if (!authorized) {
      return json({
        error: "unauthorized",
        message:
          "You must unlock this lead or have an approved release to access the document.",
      }, 403);
    }

    // ── Resolve quote file path ──────────────────────────────────
    if (!scanSessionId) {
      return json({
        error: "no_document",
        message: "No scan session linked to this analysis.",
      }, 404);
    }

    const { data: session } = await svc
      .from("scan_sessions")
      .select("quote_file_id")
      .eq("id", scanSessionId)
      .maybeSingle();

    if (!session?.quote_file_id) {
      return json({
        error: "no_document",
        message: "No document attached to this scan.",
      }, 404);
    }

    const { data: quoteFile } = await svc
      .from("quote_files")
      .select("storage_path")
      .eq("id", session.quote_file_id)
      .maybeSingle();

    if (!quoteFile?.storage_path) {
      return json({
        error: "no_document",
        message: "Document file record not found.",
      }, 404);
    }

    // ── Generate signed URL (5 minutes) ──────────────────────────
    const { data: signedData, error: signErr } = await svc
      .storage
      .from("quotes")
      .createSignedUrl(quoteFile.storage_path, 300);

    if (signErr || !signedData?.signedUrl) {
      console.error("[get-contractor-document-url] Signed URL error:", signErr);
      return json({
        error: "storage_error",
        message: "Failed to generate document URL.",
      }, 500);
    }

    return json({
      success: true,
      signed_url: signedData.signedUrl,
      expires_in_seconds: 300,
      analysis_id: analysisId,
    });
  } catch (err) {
    console.error("[get-contractor-document-url] Unhandled error:", err);
    return json(
      { error: "internal_error", message: "Internal server error." },
      500,
    );
  }
});
