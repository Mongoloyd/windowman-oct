import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";
import {
  evaluateOtpQaBypassForVerify,
  type OtpQaBypassEnv,
} from "../_shared/otpQaBypass.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";

function loadOtpQaBypassEnv(): OtpQaBypassEnv {
  return {
    OTP_QA_BYPASS_ENABLED: Deno.env.get("OTP_QA_BYPASS_ENABLED"),
    OTP_QA_PHONE_E164: Deno.env.get("OTP_QA_PHONE_E164"),
    OTP_QA_CODE: Deno.env.get("OTP_QA_CODE"),
    OTP_QA_PROJECT_REF: Deno.env.get("OTP_QA_PROJECT_REF"),
    WM_SUPABASE_PROJECT_REF: Deno.env.get("WM_SUPABASE_PROJECT_REF"),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const phone_e164 = normalizePhone(body.phone_e164);
    const code = typeof body.code === "string" ? body.code.trim() : "";
    const scan_session_id = body.scan_session_id || undefined;

    if (!phone_e164 || !code) {
      return new Response(
        JSON.stringify({ error: "Phone and code are required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Strict US E.164 validation after normalization (belt-and-suspenders)
    if (!/^\+1\d{10}$/.test(phone_e164)) {
      return new Response(
        JSON.stringify({ error: "Invalid phone format." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── 1. Init Supabase admin client ───────────────────────────────────
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── 2. Select the latest pending phone_verifications row ────────────
    // STRICT SESSION BINDING:
    //   When a scan_session_id is provided, prefer the pending row that was
    //   bound to THIS scan at send time. This prevents a pending row created
    //   for Scan A from being verified-and-bound to Scan B in a follow-up
    //   request body. We fall back to a session-less pending row only as a
    //   last resort (legacy rows or send-otp calls without scan_session_id).
    let pendingRow: {
      id: string;
      phone_e164: string;
      scan_session_id: string | null;
    } | null = null;
    let pendingRowSource: "scan_bound" | "scan_null_legacy" | "none" = "none";

    if (scan_session_id) {
      const { data: scanBound } = await supabase
        .from("phone_verifications")
        .select("id, phone_e164, scan_session_id")
        .eq("phone_e164", phone_e164)
        .eq("status", "pending")
        .eq("scan_session_id", scan_session_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (scanBound) {
        pendingRow = scanBound as {
          id: string;
          phone_e164: string;
          scan_session_id: string | null;
        };
        pendingRowSource = "scan_bound";
      }
    }

    if (!pendingRow) {
      // Legacy fallback — only matches rows with NULL scan_session_id, so we
      // never silently re-bind a pending row that belongs to a different scan.
      const { data: legacyRow } = await supabase
        .from("phone_verifications")
        .select("id, phone_e164, scan_session_id")
        .eq("phone_e164", phone_e164)
        .eq("status", "pending")
        .is("scan_session_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (legacyRow) {
        pendingRow = legacyRow as {
          id: string;
          phone_e164: string;
          scan_session_id: string | null;
        };
        pendingRowSource = "scan_null_legacy";
      }
    }

    console.log(
      "[VERIFY_OTP_FORENSIC]",
      JSON.stringify({
        phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
        pendingRowFound: !!pendingRow,
        pendingRowId: pendingRow?.id ?? null,
        pendingRowSource,
        requestedScanSessionId: scan_session_id ?? null,
        pendingRowScanSessionId: pendingRow?.scan_session_id ?? null,
        timestamp: new Date().toISOString(),
      }),
    );

    // Defensive sanity check: if a scan_session_id was requested AND we matched
    // the legacy fallback, make sure we never have a mismatched non-null binding
    // (the .is("scan_session_id", null) filter above should already guarantee
    // this, but the explicit check defends against query-builder regressions).
    if (
      scan_session_id &&
      pendingRow &&
      pendingRow.scan_session_id &&
      pendingRow.scan_session_id !== scan_session_id
    ) {
      console.error(
        "[VERIFY_OTP_SESSION_MISMATCH]",
        JSON.stringify({
          phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
          requested_scan_session_id: scan_session_id,
          pending_scan_session_id: pendingRow.scan_session_id,
        }),
      );
      return new Response(
        JSON.stringify({
          error:
            "Verification could not be matched to your scan. Please request a new code.",
          verified: false,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // The phone we send to Twilio: prefer DB value, fall back to normalized value
    const twilioPhone = pendingRow?.phone_e164 ?? phone_e164;

    const qaBypassEval = evaluateOtpQaBypassForVerify({
      phoneE164: phone_e164,
      code,
      scanSessionId: scan_session_id,
      env: loadOtpQaBypassEnv(),
    });
    const qaBypassApproved = qaBypassEval.approved && !!pendingRow;

    if (qaBypassApproved) {
      console.log(
        "[VERIFY_OTP_QA_BYPASS]",
        JSON.stringify({
          approved: true,
          phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
          scan_session_id,
          pending_row_id: pendingRow!.id,
          timestamp: new Date().toISOString(),
        }),
      );
    } else {
      // ── 3. Twilio VerificationCheck ─────────────────────────────────────
      const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
      const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
      const verifySid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

      const twilioBody = new URLSearchParams({ To: twilioPhone, Code: code });

      const twilioRes = await fetch(
        `https://verify.twilio.com/v2/Services/${verifySid}/VerificationCheck`,
        {
          method: "POST",
          headers: {
            Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: twilioBody,
        },
      );

      const twilioData = await twilioRes.json();

      if (!twilioRes.ok || twilioData.status !== "approved") {
        let userMsg = "Invalid or expired code.";
        if (twilioData.code === 20404) {
          userMsg =
            "Verification session expired or not found. Please request a new code.";
        }
        return new Response(
          JSON.stringify({ error: userMsg, verified: false }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const verificationChannel = qaBypassApproved ? "qa_bypass" : "twilio_verify";

    // ── 4. Twilio approved — update DB ──────────────────────────────────
    const now = new Date().toISOString();

    // Resolve lead_id from scan_sessions (if provided)
    let resolvedLeadId: string | null = null;
    if (scan_session_id) {
      const { data: session } = await supabase
        .from("scan_sessions")
        .select("lead_id")
        .eq("id", scan_session_id)
        .maybeSingle();
      resolvedLeadId = session?.lead_id || null;

      // ── Defensive integrity guard ──
      // If scan_session_id was provided but has no lead_id, we cannot bind
      // the verification to a lead. Log and fail rather than silently
      // succeeding with an unbindable verification.
      if (!resolvedLeadId) {
        console.error(
          "[VERIFY_OTP_INTEGRITY_GUARD]",
          JSON.stringify({
            scan_session_id,
            phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
            reason: "scan_session has no lead_id — cannot bind verification",
            timestamp: new Date().toISOString(),
          }),
        );
        return new Response(
          JSON.stringify({
            error:
              "Verification could not be linked to your session. Please try again.",
            verified: false,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── 5. Update the pending row — mark verified + bind lead_id ────────
    // CRITICAL: If this write fails, the frontend must know so it can
    // prompt the user to resend/retry instead of silently succeeding
    // while get_analysis_full remains unauthorized.
    if (pendingRow) {
      const updatePayload: Record<string, unknown> = {
        status: "verified",
        verified_at: now,
      };
      if (resolvedLeadId) {
        updatePayload.lead_id = resolvedLeadId;
      }
      // Persist the scan_session_id binding on the verified row so
      // get_analysis_full can enforce strict session-bound authorization.
      // If the pending row was created by send-otp without a scan_session_id
      // (legacy flow) but the verify request carries one, stamp it now.
      if (scan_session_id) {
        updatePayload.scan_session_id = scan_session_id;
      }

      const { error: updateErr } = await supabase
        .from("phone_verifications")
        .update(updatePayload)
        .eq("id", pendingRow.id);

      if (updateErr) {
        console.error(
          "[verify-otp] CRITICAL: failed to persist verification status:",
          updateErr,
        );
        return new Response(
          JSON.stringify({
            error:
              "Verification confirmed but could not be saved. Please request a new code and try again.",
            verified: false,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── 6. If lead found, mark lead.phone_verified + phone + timestamp ──
    // Both phone_verified AND phone_verified_at are required:
    //   - get_analysis_full checks leads.phone_verified = true
    //   - fire_crm_handoff trigger reads leads.phone_verified_at
    if (resolvedLeadId) {
      const { error: leadErr } = await supabase
        .from("leads")
        .update({
          phone_verified: true,
          phone_e164: twilioPhone,
          phone_verified_at: now,
        })
        .eq("id", resolvedLeadId);

      if (leadErr) {
        console.error(
          "[verify-otp] CRITICAL: failed to update lead verification:",
          leadErr,
        );
        return new Response(
          JSON.stringify({
            error:
              "Verification confirmed but could not be saved. Please request a new code and try again.",
            verified: false,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── 7. Persist canonical events (phone_verified + report_revealed) ──
    // Both events are persisted server-side AND their event_ids are returned
    // to the browser so the frontend dataLayer push can use the SAME id.
    // This makes the cross-lane (browser → GTM, server → CAPI) dedup work.
    let phoneVerifiedEventId: string | null = null;
    let reportRevealedEventId: string | null = null;

    if (resolvedLeadId) {
      // Stable, time-independent ids keyed by entity. Same id is computed
      // on the browser via `buildCanonicalEventId({ ...,  now: <fixed> })`
      // — but to fully eliminate clock drift, we return them in the response.
      phoneVerifiedEventId = `wmc_phone_verified_lead-${resolvedLeadId}${
        scan_session_id ? `_scan-${scan_session_id}` : ""
      }`;

      try {
        await persistCanonicalEvent(supabase, {
          eventId: phoneVerifiedEventId,
          eventName: "phone_verified",
          eventTimestamp: now,
          leadId: resolvedLeadId,
          scanSessionId: scan_session_id ?? undefined,
          payload: {
            identity: {
              leadId: resolvedLeadId,
              phone: twilioPhone,
              phoneVerifiedAt: now,
            },
            journey: {
              route: "/verify",
              flow: "public",
              scanSessionId: scan_session_id ?? undefined,
            },
            source: {
              sourceSystem: "edge_function",
            },
            metadata: {
              verification_channel: verificationChannel,
            },
          },
        });
      } catch (canonicalError) {
        console.error(
          "[verify-otp] phone_verified canonical event failed",
          canonicalError,
        );
      }
    }

    if (resolvedLeadId && scan_session_id) {
      reportRevealedEventId =
        `wmc_report_revealed_lead-${resolvedLeadId}_scan-${scan_session_id}`;
      try {
        await persistCanonicalEvent(supabase, {
          eventId: reportRevealedEventId,
          eventName: "report_revealed",
          eventTimestamp: now,
          leadId: resolvedLeadId,
          scanSessionId: scan_session_id,
          payload: {
            identity: {
              leadId: resolvedLeadId,
              phone: twilioPhone,
              phoneVerifiedAt: now,
            },
            journey: {
              route: "/verify",
              flow: "public",
              scanSessionId: scan_session_id,
            },
            source: {
              sourceSystem: "edge_function",
            },
            metadata: {
              unlock_moment: "otp_verified",
            },
          },
        });
      } catch (canonicalError) {
        console.error(
          "[verify-otp] report_revealed canonical event failed",
          canonicalError,
        );
      }
    }

    // Return canonical phone + canonical event_ids so the frontend can
    // (a) use the server-approved phone and (b) emit dataLayer events with
    // matching ids for downstream Meta/Google dedup.
    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        phone_e164: twilioPhone,
        phone_verified_event_id: phoneVerifiedEventId,
        report_revealed_event_id: reportRevealedEventId,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[verify-otp] unhandled exception:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
