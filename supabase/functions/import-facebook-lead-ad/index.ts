import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-import-secret",
};

type JsonRecord = Record<string, unknown>;

type NormalizedLeadAdPayload = {
  platformLeadId: string;
  sourcePlatform: string;
  sourceChannel: string;
  sourceDetail: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adsetId: string | null;
  adsetName: string | null;
  adId: string | null;
  adName: string | null;
  formId: string | null;
  platformCreatedTime: string | null;
  fbclid: string | null;
  gclid: string | null;
  fbc: string | null;
  fbp: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  landingPageUrl: string | null;
  firstPagePath: string | null;
  initialReferrer: string | null;
  clientSlug: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  phoneE164: string | null;
  county: string | null;
  rawPayload: JsonRecord | null;
};

const MAX_TEXT = 500;
const SOURCE = "facebook_lead_ads";

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function cleanText(value: unknown, max = MAX_TEXT): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const cleaned = String(value).trim();
  if (!cleaned) return null;
  return cleaned.slice(0, max);
}

function cleanEmail(value: unknown): string | null {
  const email = cleanText(value, 255)?.toLowerCase() ?? null;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function normalizePhone(value: unknown): string | null {
  const raw = cleanText(value, 40);
  if (!raw) return null;
  const leadingPlus = raw.trim().startsWith("+");
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (leadingPlus && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
}

function normalizeTimestamp(value: unknown): string | null {
  const raw = cleanText(value, 80);
  if (!raw) return null;
  const time = Date.parse(raw);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function getFieldMap(body: JsonRecord): Record<string, string> {
  const fieldMap: Record<string, string> = {};
  const fieldData = Array.isArray(body.field_data) ? body.field_data : Array.isArray(body.fieldData) ? body.fieldData : [];

  for (const item of fieldData) {
    const record = asRecord(item);
    if (!record) continue;
    const name = cleanText(record.name, 120)?.toLowerCase();
    if (!name) continue;
    const values = Array.isArray(record.values) ? record.values : Array.isArray(record.value) ? record.value : [record.value];
    const firstValue = values.find((entry) => cleanText(entry) !== null);
    const cleaned = cleanText(firstValue);
    if (cleaned) fieldMap[name] = cleaned;
  }

  return fieldMap;
}

function getNested(body: JsonRecord, path: string[]): unknown {
  let current: unknown = body;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function pick(body: JsonRecord, fieldMap: Record<string, string>, keys: string[], max = MAX_TEXT): string | null {
  for (const key of keys) {
    const fromBody = cleanText(body[key], max);
    if (fromBody) return fromBody;
    const fromField = cleanText(fieldMap[key.toLowerCase()], max);
    if (fromField) return fromField;
  }
  return null;
}

function splitName(fullName: string | null): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function normalizePayload(body: JsonRecord): { ok: true; payload: NormalizedLeadAdPayload } | { ok: false; error: string } {
  const fieldMap = getFieldMap(body);

  const platformLeadId = cleanText(
    body.platform_lead_id ?? body.platformLeadId ?? body.leadgen_id ?? body.leadgenId ?? body.id ?? getNested(body, ["lead", "id"]),
    255,
  );

  if (!platformLeadId) return { ok: false, error: "platform_lead_id_required" };

  const email = cleanEmail(pick(body, fieldMap, ["email", "email_address"]));
  const phoneE164 = normalizePhone(pick(body, fieldMap, ["phone", "phone_number", "mobile_phone", "phone_e164"]));
  const fullName = pick(body, fieldMap, ["full_name", "name", "contact_name"]);
  const split = splitName(fullName);
  const firstName = pick(body, fieldMap, ["first_name", "firstname"], 120) ?? split.firstName;
  const lastName = pick(body, fieldMap, ["last_name", "lastname"], 120) ?? split.lastName;

  if (!email && !phoneE164) return { ok: false, error: "email_or_phone_required" };

  return {
    ok: true,
    payload: {
      platformLeadId,
      sourcePlatform: "facebook",
      sourceChannel: "lead_ads",
      sourceDetail: SOURCE,
      campaignId: cleanText(body.campaign_id ?? body.campaignId, 255),
      campaignName: cleanText(body.campaign_name ?? body.campaignName, 500),
      adsetId: cleanText(body.adset_id ?? body.adsetId, 255),
      adsetName: cleanText(body.adset_name ?? body.adsetName, 500),
      adId: cleanText(body.ad_id ?? body.adId, 255),
      adName: cleanText(body.ad_name ?? body.adName, 500),
      formId: cleanText(body.form_id ?? body.formId, 255),
      platformCreatedTime: normalizeTimestamp(body.created_time ?? body.createdTime ?? body.platform_created_time),
      fbclid: cleanText(body.fbclid, 500),
      gclid: cleanText(body.gclid, 500),
      fbc: cleanText(body.fbc, 500),
      fbp: cleanText(body.fbp, 500),
      utmSource: cleanText(body.utm_source ?? body.utmSource, 255) ?? "facebook",
      utmMedium: cleanText(body.utm_medium ?? body.utmMedium, 255) ?? "lead_ad",
      utmCampaign: cleanText(body.utm_campaign ?? body.utmCampaign, 500),
      utmTerm: cleanText(body.utm_term ?? body.utmTerm, 500),
      utmContent: cleanText(body.utm_content ?? body.utmContent, 500),
      landingPageUrl: cleanText(body.landing_page_url ?? body.landingPageUrl, 2000),
      firstPagePath: cleanText(body.first_page_path ?? body.firstPagePath, 500),
      initialReferrer: cleanText(body.initial_referrer ?? body.initialReferrer, 1000),
      clientSlug: cleanText(body.client_slug ?? body.clientSlug, 80) ?? "direct",
      firstName,
      lastName,
      fullName,
      email,
      phoneE164,
      county: cleanText(body.county, 120),
      rawPayload: asRecord(body.raw_payload) ?? body,
    },
  };
}

function authOk(req: Request): boolean {
  const expected = Deno.env.get("FACEBOOK_LEAD_AD_IMPORT_SECRET");
  if (!expected) return false;
  const importSecret = req.headers.get("x-import-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return importSecret === expected || bearer === expected;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  if (!authOk(req)) return jsonResponse({ success: false, error: "unauthorized" }, 401);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch (_err) {
    return jsonResponse({ success: false, error: "invalid_json" }, 400);
  }

  const body = asRecord(rawBody);
  if (!body) return jsonResponse({ success: false, error: "payload_must_be_object" }, 400);

  const normalized = normalizePayload(body);
  if (!normalized.ok) return jsonResponse({ success: false, error: normalized.error }, 400);

  const payload = normalized.payload;
  const now = new Date().toISOString();

  try {
    const { data: existingAttribution, error: attributionLookupError } = await supabase
      .from("lead_attribution_details")
      .select("id, lead_id")
      .eq("source_platform", payload.sourcePlatform)
      .eq("platform_lead_id", payload.platformLeadId)
      .maybeSingle();

    if (attributionLookupError) throw attributionLookupError;

    let leadId = existingAttribution?.lead_id as string | undefined;
    let deduped = Boolean(leadId);

    if (!leadId) {
      if (payload.email) {
        const { data: leadByEmail, error } = await supabase
          .from("leads")
          .select("id")
          .eq("email", payload.email)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        leadId = leadByEmail?.id as string | undefined;
      }

      if (!leadId && payload.phoneE164) {
        const { data: leadByPhone, error } = await supabase
          .from("leads")
          .select("id")
          .eq("phone_e164", payload.phoneE164)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        leadId = leadByPhone?.id as string | undefined;
      }
    }

    const leadPatch: JsonRecord = {
      source: SOURCE,
      lead_source: SOURCE,
      client_slug: payload.clientSlug,
      updated_at: now,
    };

    const optionalLeadFields: JsonRecord = {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_e164: payload.phoneE164,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      landing_page_url: payload.landingPageUrl,
    };

    for (const [key, value] of Object.entries(optionalLeadFields)) {
      if (value !== null && value !== undefined) leadPatch[key] = value;
    }

    if (leadId) {
      const { error } = await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId);
      if (error) throw error;
    } else {
      const { data: insertedLead, error } = await supabase
        .from("leads")
        .insert({
          ...leadPatch,
          phone_verified: false,
          session_id: `fbla_${payload.platformLeadId}`,
          status: "new",
          created_at: now,
        })
        .select("id")
        .single();
      if (error) throw error;
      leadId = insertedLead.id as string;
    }

    const attributionRow = {
      lead_id: leadId,
      source_platform: payload.sourcePlatform,
      source_channel: payload.sourceChannel,
      campaign_id: payload.campaignId,
      campaign_name: payload.campaignName,
      adset_id: payload.adsetId,
      adset_name: payload.adsetName,
      ad_id: payload.adId,
      ad_name: payload.adName,
      form_id: payload.formId,
      platform_lead_id: payload.platformLeadId,
      fbclid: payload.fbclid,
      gclid: payload.gclid,
      fbc: payload.fbc,
      fbp: payload.fbp,
      utm_source: payload.utmSource,
      utm_medium: payload.utmMedium,
      utm_campaign: payload.utmCampaign,
      utm_term: payload.utmTerm,
      utm_content: payload.utmContent,
      landing_page_url: payload.landingPageUrl,
      imported_at: now,
      raw_payload: body,
      updated_at: now,
    };

    if (existingAttribution?.id) {
      const { error } = await supabase
        .from("lead_attribution_details")
        .update(attributionRow)
        .eq("id", existingAttribution.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("lead_attribution_details")
        .insert(attributionRow);
      if (error) throw error;
    }

    await supabase.from("event_logs").insert({
      event_name: deduped ? "facebook_lead_ad_import_deduped" : "facebook_lead_ad_imported",
      flow_type: SOURCE,
      route: "import-facebook-lead-ad",
      lead_id: leadId,
      session_id: `fbla_${payload.platformLeadId}`,
      metadata: {
        platform_lead_id: payload.platformLeadId,
        source_platform: payload.sourcePlatform,
        source_channel: payload.sourceChannel,
        campaign_id: payload.campaignId,
        campaign_name: payload.campaignName,
        adset_id: payload.adsetId,
        adset_name: payload.adsetName,
        ad_id: payload.adId,
        ad_name: payload.adName,
        form_id: payload.formId,
        deduped,
        phone_verified: false,
        imported_at: now,
      },
    });

    return jsonResponse({
      success: true,
      lead_id: leadId,
      platform_lead_id: payload.platformLeadId,
      deduped,
      source: SOURCE,
      phone_verified: false,
    });
  } catch (err) {
    console.error("[FB_LEAD_AD_IMPORT:ERROR]", err);
    try {
      await supabase.from("event_logs").insert({
        event_name: "facebook_lead_ad_import_failed",
        flow_type: SOURCE,
        route: "import-facebook-lead-ad",
        metadata: {
          platform_lead_id: payload.platformLeadId,
          error: err instanceof Error ? err.message : String(err),
          imported_at: now,
        },
      });
    } catch (_logErr) {
      // Best-effort audit logging must never hide the import failure response.
    }

    return jsonResponse({ success: false, error: "import_failed" }, 500);
  }
});
