import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePhone } from "../_shared/normalizePhone.ts";
import { persistCanonicalEvent } from "../_shared/tracking/canonicalBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type LeadQualificationRequest = {
  name: string;
  email: string;
  phone: string;
  source: string;
  context?: Record<string, unknown>;
};

type LookupOutcome = {
  checked: boolean;
  valid: boolean;
  lineType: string | null;
  carrierName: string | null;
  riskTier: string | null;
  reason: string | null;
};

type LeadQualificationResponse = {
  success: boolean;
  lead_id: string | null;
  qualified: boolean;
  can_run_ai: boolean;
  phone_e164: string | null;
  phone_line_type: string | null;
  reason: string | null;
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function badRequest(reason: string): Response {
  const payload: LeadQualificationResponse = {
    success: false,
    lead_id: null,
    qualified: false,
    can_run_ai: false,
    phone_e164: null,
    phone_line_type: null,
    reason,
  };

  return new Response(JSON.stringify(payload), {
    status: 400,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizePayload(input: unknown): LeadQualificationRequest | null {
  if (!input || typeof input !== "object") return null;

  const body = input as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string"
    ? body.email.trim().toLowerCase()
    : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const source = typeof body.source === "string" ? body.source.trim() : "";
  const context = body.context && typeof body.context === "object" &&
      !Array.isArray(body.context)
    ? (body.context as Record<string, unknown>)
    : undefined;

  if (!name || !email || !phone || !source) return null;

  return { name, email, phone, source, context };
}

function isMobileLineType(lineType: string | null): boolean {
  if (!lineType) return false;
  return lineType.toLowerCase() === "mobile";
}

async function runTwilioLookup(phoneE164: string): Promise<LookupOutcome> {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
  const lookupEnabled = Deno.env.get("TWILIO_LOOKUP_ENABLED") === "true";

  // Fail-closed for qualification: if lookup is unavailable, no qualification can occur.
  if (!lookupEnabled || !accountSid || !authToken) {
    return {
      checked: false,
      valid: false,
      lineType: null,
      carrierName: null,
      riskTier: null,
      reason: "Phone verification service is currently unavailable.",
    };
  }

  try {
    const encodedPhone = encodeURIComponent(phoneE164);
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort("twilio_lookup_timeout"),
      8000,
    );

    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodedPhone}?Fields=line_type_intelligence,sms_pumping_risk`,
      {
        method: "GET",
        headers: {
          Authorization: "Basic " + btoa(`${accountSid}:${authToken}`),
        },
        signal: controller.signal,
      },
    ).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      const body = await res.text();
      console.error("[qualify-homepage-lead] Twilio Lookup failed", {
        status: res.status,
        body,
      });
      return {
        checked: true,
        valid: false,
        lineType: null,
        carrierName: null,
        riskTier: null,
        reason: "Phone number could not be verified.",
      };
    }

    const lookupData = await res.json();
    const lineType = lookupData?.line_type_intelligence?.type ?? null;
    const carrierName = lookupData?.line_type_intelligence?.carrier_name ??
      null;
    const riskTier = lookupData?.sms_pumping_risk?.risk_level ?? null;

    if (!isMobileLineType(lineType)) {
      return {
        checked: true,
        valid: false,
        lineType,
        carrierName,
        riskTier,
        reason: `Phone line type '${lineType ?? "unknown"}' is not eligible.`,
      };
    }

    return {
      checked: true,
      valid: true,
      lineType,
      carrierName,
      riskTier,
      reason: null,
    };
  } catch (error) {
    console.error("[qualify-homepage-lead] Twilio Lookup exception", error);
    return {
      checked: false,
      valid: false,
      lineType: null,
      carrierName: null,
      riskTier: null,
      reason: "Phone screening unavailable. Please try again.",
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawPayload = await req.json();
    const payload = normalizePayload(rawPayload);

    if (!payload) {
      return badRequest("name, email, phone, and source are required.");
    }

    if (!EMAIL_REGEX.test(payload.email)) {
      return badRequest("A valid email address is required.");
    }

    const phoneE164 = normalizePhone(payload.phone);
    if (!/^\+1\d{10}$/.test(phoneE164)) {
      return badRequest(
        "Invalid US phone number. Expected format: +1XXXXXXXXXX",
      );
    }

    const lookup = await runTwilioLookup(phoneE164);
    const qualified = lookup.valid;
    const nowIso = new Date().toISOString();

    const qualificationStatus = qualified
      ? "homepage_qualified_mobile"
      : lookup.checked
      ? "homepage_disqualified_phone"
      : "homepage_lookup_failed";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const escapedEmailForFilter = payload.email
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');

    const { data: existingLeadRows, error: leadQueryError } = await supabase
      .from("leads")
      .select("id, phone_e164, email, created_at")
      .or(`phone_e164.eq."${phoneE164}",email.eq."${escapedEmailForFilter}"`)
      .order("created_at", { ascending: false })
      .limit(5);

    if (leadQueryError) {
      console.error(
        "[qualify-homepage-lead] lead lookup failed",
        leadQueryError,
      );
    }

    const prioritizedLead = existingLeadRows?.find((row) =>
      row.phone_e164 === phoneE164
    ) ??
      existingLeadRows?.find((row) => row.email === payload.email) ??
      null;

    let leadId = prioritizedLead?.id ?? null;

    const trimmedName = payload.name?.trim() ?? "";
    const nameParts = trimmedName ? trimmedName.split(/\s+/) : [];
    const firstName = nameParts.length > 0 ? nameParts[0] : null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(" ") : null;

    const leadPatch = {
      first_name: firstName,
      last_name: lastName,
      email: payload.email,
      phone_e164: phoneE164,
      source: payload.source,
      lead_source: payload.source,
      qualification_status: qualificationStatus,
      phone_lookup_valid: qualified,
      phone_lookup_checked_at: lookup.checked ? nowIso : null,
      phone_line_type: lookup.lineType,
      phone_carrier_name: lookup.carrierName,
      phone_risk_tier: lookup.riskTier,
      qualification_answers_json: {
        qualification_origin: "homepage_demo_module",
        qualified,
        can_run_ai: qualified,
        reason: lookup.reason,
        context: payload.context ?? {},
      },
      updated_at: nowIso,
    };

    if (leadId) {
      const { error: updateError } = await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId);

      if (updateError) {
        console.error(
          "[qualify-homepage-lead] failed to update lead",
          updateError,
        );
        throw new Error("Failed to persist lead qualification state.");
      }
    } else {
      const { data: insertedLead, error: insertError } = await supabase
        .from("leads")
        .insert({
          ...leadPatch,
          session_id: crypto.randomUUID(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error(
          "[qualify-homepage-lead] failed to insert lead",
          insertError,
        );
        throw new Error("Failed to create lead qualification state.");
      }

      leadId = insertedLead.id;
    }

    const response: LeadQualificationResponse = {
      success: true,
      lead_id: leadId,
      qualified,
      can_run_ai: qualified,
      phone_e164: phoneE164,
      phone_line_type: lookup.lineType,
      reason: lookup.reason,
    };

    if (leadId) {
      try {
        await persistCanonicalEvent(supabase, {
          eventName: "lead_identified",
          leadId,
          payload: {
            identity: {
              leadId,
              email: payload.email,
              phone: phoneE164,
              clickId: typeof payload.context?.gclid === "string"
                ? payload.context.gclid
                : undefined,
              gclid: typeof payload.context?.gclid === "string"
                ? payload.context.gclid
                : undefined,
              fbc: typeof payload.context?.fbc === "string"
                ? payload.context.fbc
                : undefined,
              fbp: typeof payload.context?.fbp === "string"
                ? payload.context.fbp
                : undefined,
            },
            journey: {
              route: typeof payload.context?.route === "string"
                ? payload.context.route
                : "/",
              flow: "public",
              sessionId: typeof payload.context?.session_id === "string"
                ? payload.context.session_id
                : undefined,
            },
            source: {
              sourceSystem: "edge_function",
              utmSource: typeof payload.context?.utm_source === "string"
                ? payload.context.utm_source
                : undefined,
              utmMedium: typeof payload.context?.utm_medium === "string"
                ? payload.context.utm_medium
                : undefined,
              utmCampaign: typeof payload.context?.utm_campaign === "string"
                ? payload.context.utm_campaign
                : undefined,
            },
            metadata: {
              qualification_status: qualificationStatus,
              phone_line_type: lookup.lineType,
            },
          },
        });
      } catch (canonicalError) {
        console.error(
          "[qualify-homepage-lead] canonical event failed",
          canonicalError,
        );
      }
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[qualify-homepage-lead] unexpected error", error);
    const response: LeadQualificationResponse = {
      success: false,
      lead_id: null,
      qualified: false,
      can_run_ai: false,
      phone_e164: null,
      phone_line_type: null,
      reason: "Internal server error.",
    };

    return new Response(JSON.stringify(response), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
