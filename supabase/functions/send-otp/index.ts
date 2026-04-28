// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── Rate-limit constants ────────────────────────────────────────────── */
const COOLDOWN_SECONDS = 30; // min gap between sends for same phone
const WINDOW_MINUTES = 15; // rolling window
const MAX_SENDS_PER_WINDOW = 5; // max sends in that window
const MAX_IP_SENDS_PER_WINDOW = 10; // max sends per IP in the window

async function runPhoneLookup(
  phoneE164: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const lookupEnabled = Deno.env.get("TWILIO_LOOKUP_ENABLED") === "true";

  // Fail-open unless explicitly enabled. This keeps blast radius small in environments
  // where lookup credentials/permissions are not configured yet.
  if (!lookupEnabled || !accountSid || !authToken) {
    return { ok: true };
  }

  try {
    const encodedPhone = encodeURIComponent(phoneE164);
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodedPhone}?Fields=line_type_intelligence`,
      {
        method: "GET",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error("[send-otp] Twilio Lookup failed:", {
        status: res.status,
        body,
      });
      return {
        ok: false,
        reason: "Phone number could not be verified. Please check your number.",
      };
    }

    return { ok: true };
  } catch (err) {
    console.error("[send-otp] Twilio Lookup exception:", err);
    return {
      ok: false,
      reason: "Phone screening unavailable. Please try again.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const phone_e164 = normalizePhone(body.phone_e164);
    const scan_session_id = body.scan_session_id || null;
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

    if (!phone_e164) {
      return new Response(
        JSON.stringify({ error: "phone_e164 is required." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Strict US E.164 validation after normalization (belt-and-suspenders)
    if (!/^\+1\d{10}$/.test(phone_e164)) {
      return new Response(
        JSON.stringify({
          error: "Invalid US phone number. Expected format: +1XXXXXXXXXX",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const lookupResult = await runPhoneLookup(phone_e164);
    if (!lookupResult.ok) {
      return new Response(
        JSON.stringify({ error: lookupResult.reason, success: false }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ── Rate-limit check ────────────────────────────────────────────────
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000)
      .toISOString();

    const { data: recentRows, error: rlErr } = await supabase
      .from("phone_verifications")
      .select("created_at")
      .eq("phone_e164", phone_e164)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false });

    if (rlErr) {
      console.error("[send-otp] rate-limit query failed:", rlErr);
    }

    if (recentRows && recentRows.length > 0) {
      const lastSendAt = new Date(recentRows[0].created_at).getTime();
      const secondsSinceLast = (Date.now() - lastSendAt) / 1000;
      if (secondsSinceLast < COOLDOWN_SECONDS) {
        const waitSec = Math.ceil(COOLDOWN_SECONDS - secondsSinceLast);
        return new Response(
          JSON.stringify({
            error:
              `Too many code requests. Please wait ${waitSec} seconds before trying again.`,
            success: false,
            retry_after: waitSec,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if (recentRows.length >= MAX_SENDS_PER_WINDOW) {
        return new Response(
          JSON.stringify({
            error:
              `Too many code requests. Please wait a few minutes before trying again.`,
            success: false,
            retry_after: WINDOW_MINUTES * 60,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // ── Secondary: IP-based rate limit (catches phone-cycling bots) ─────
    if (clientIp !== "unknown") {
      const { data: ipRows } = await supabase
        .from("phone_verifications")
        .select("id")
        .eq("ip_address", clientIp)
        .gte("created_at", windowStart);

      if (ipRows && ipRows.length >= MAX_IP_SENDS_PER_WINDOW) {
        console.warn("[send-otp] IP rate limit hit:", {
          ip: clientIp,
          count: ipRows.length,
        });
        return new Response(
          JSON.stringify({
            error:
              "Too many requests from this network. Please wait a few minutes.",
            success: false,
            retry_after: WINDOW_MINUTES * 60,
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }
    // ── Twilio Verify: send code ────────────────────────────────────────
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID")!;
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")!;
    const verifySid = Deno.env.get("TWILIO_VERIFY_SERVICE_SID")!;

    const twilioRes = await fetch(
      `https://verify.twilio.com/v2/Services/${verifySid}/Verifications`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: phone_e164, Channel: "sms" }),
      },
    );

    const twilioData = await twilioRes.json();

    if (!twilioRes.ok) {
      console.error("[send-otp] Twilio error:", twilioData);

      let userMessage = "Failed to send verification code.";
      if (twilioData.code === 60410) {
        userMessage =
          "This phone number prefix has been temporarily blocked by our carrier. Please try a different number.";
      } else if (twilioData.code === 60203) {
        userMessage =
          "Too many verification attempts. Please wait before trying again.";
      }

      return new Response(
        JSON.stringify({
          error: userMessage,
          success: false,
          twilio_code: twilioData.code,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── DB: expire older pending rows, then insert fresh one ────────────
    const { error: expireErr } = await supabase
      .from("phone_verifications")
      .update({ status: "expired" })
      .eq("phone_e164", phone_e164)
      .eq("status", "pending");
    if (expireErr) {
      console.error("[send-otp] failed to expire old pending rows:", expireErr);
    }

    console.log(
      "[SEND_OTP_FORENSIC_START]",
      JSON.stringify({
        phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
        expireResult: expireErr
          ? { code: expireErr.code, message: expireErr.message }
          : "ok",
        timestamp: new Date().toISOString(),
      }),
    );

    // Bind the pending row to its originating scan_session_id at send time.
    // This is the foundation for strict session-bound unlock authorization
    // in get_analysis_full — without it, a verified phone for one scan
    // could authorize unlock of another scan owned by the same lead.
    const { error: insertErr } = await supabase.from("phone_verifications")
      .insert({
        phone_e164,
        status: "pending",
        ip_address: clientIp,
        scan_session_id: scan_session_id || null,
      });
    if (insertErr) {
      console.error(
        "[SEND_OTP_DB_ERROR]",
        JSON.stringify({
          code: insertErr.code,
          message: insertErr.message,
          details: insertErr.details,
          hint: insertErr.hint,
          phone_masked: "xxx-xxx-" + phone_e164.slice(-4),
        }),
      );
      return new Response(
        JSON.stringify({
          error: "Failed to create verification record.",
          success: false,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[send-otp] error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
