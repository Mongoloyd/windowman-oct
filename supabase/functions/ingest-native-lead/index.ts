// supabase/functions/ingest-native-lead/index.ts
//
// Provider-neutral native lead form ingestion (Zapier → Edge Function).
// Active provider in this pass: nextdoor only.
// Reserved (not implemented): tiktok, google, meta, facebook.
//
// Canonical lead_captured emission intentionally deferred until dispatch
// eligibility and provider payload truth are verified.
//
// Local curl fixture (comment-only):
// {
//   "nd_lead_id": "test-nextdoor-lead-001",
//   "nd_form_id": "form-123",
//   "nd_campaign_id": "campaign-123",
//   "nd_ad_id": "ad-123",
//   "first_name": "Test",
//   "last_name": "Homeowner",
//   "email": "test@example.com",
//   "phone": "9545551212",
//   "zip": "33301",
//   "timeline": "Next 30 days",
//   "how_many_windows": "8-12"
// }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const FUNCTION_NAME = "ingest-native-lead";
const MAX_BODY_BYTES = 128 * 1024;
const MAX_TEXT = 500;
const LEAD_SOURCE = "nextdoor";
const LEAD_SOURCE_DETAIL = "nextdoor_native_lead";
const SOURCE_PLATFORM = "nextdoor";
const SOURCE_CHANNEL = "native_lead_form";
const SOURCE_DETAIL = "zapier";
const IMPORT_SOURCE = "ingest-native-lead";

const ACTIVE_PROVIDERS = new Set(["nextdoor"]);
const RESERVED_PROVIDERS = new Set(["tiktok", "google", "meta", "facebook"]);

const CORE_BODY_KEYS = new Set([
  "nd_lead_id",
  "lead_id",
  "leadid",
  "platform_lead_id",
  "platformleadid",
  "id",
  "submission_id",
  "submissionid",
  "nd_form_id",
  "form_id",
  "formid",
  "nd_campaign_id",
  "campaign_id",
  "campaignid",
  "campaign_name",
  "campaignname",
  "nd_ad_id",
  "ad_id",
  "adid",
  "ad_name",
  "adname",
  "nd_ad_group_id",
  "ad_group_id",
  "adgroupid",
  "adset_id",
  "adsetid",
  "first_name",
  "firstname",
  "last_name",
  "lastname",
  "full_name",
  "fullname",
  "name",
  "contact_name",
  "email",
  "email_address",
  "emailaddress",
  "phone",
  "phone_number",
  "phonenumber",
  "mobile_phone",
  "mobilephone",
  "phone_e164",
  "zip",
  "zip_code",
  "zipcode",
  "postal_code",
  "postalcode",
  "created_time",
  "createdtime",
  "platform_created_time",
  "submitted_at",
  "submittedat",
  "client_slug",
  "clientslug",
  "field_data",
  "fielddata",
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "ndclid",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-native-lead-secret, x-native-lead-provider, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

// deno-lint-ignore no-explicit-any
type NativeLeadSupabaseClient = any;

type NormalizedNextdoorLead = {
  providerSubmissionId: string;
  idempotencyKey: string;
  synthetic: boolean;
  formId: string | null;
  campaignId: string | null;
  campaignName: string | null;
  adId: string | null;
  adName: string | null;
  adsetId: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phoneE164: string | null;
  zip: string | null;
  clientSlug: string;
  platformCreatedTime: string | null;
  customAnswers: Record<string, unknown>;
  rawPayload: JsonRecord;
};

function jsonResponse(
  body: JsonRecord,
  status = 200,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);

  let diff = left.length ^ right.length;
  const length = Math.max(left.length, right.length);

  for (let i = 0; i < length; i += 1) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }

  return diff === 0;
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
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
  if (leadingPlus && digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
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

function normalizeClientSlug(value: unknown): string {
  const slug = cleanText(value, 100);
  return slug && slug.length > 0 ? slug : "direct";
}

function sanitizeSessionSuffix(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
  return cleaned.length > 0 ? cleaned : "unknown";
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getFieldMap(body: JsonRecord): Record<string, string> {
  const fieldMap: Record<string, string> = {};
  const fieldData = Array.isArray(body.field_data)
    ? body.field_data
    : Array.isArray(body.fieldData)
    ? body.fieldData
    : [];

  for (const item of fieldData) {
    const record = asRecord(item);
    if (!record) continue;
    const name = cleanText(record.name, 120)?.toLowerCase();
    if (!name) continue;
    const values = Array.isArray(record.values)
      ? record.values
      : Array.isArray(record.value)
      ? record.value
      : [record.value];
    const firstValue = values.find((entry) => cleanText(entry) !== null);
    const cleaned = cleanText(firstValue);
    if (cleaned) fieldMap[name] = cleaned;
  }

  return fieldMap;
}

function pick(
  body: JsonRecord,
  fieldMap: Record<string, string>,
  keys: string[],
  max = MAX_TEXT,
): string | null {
  for (const key of keys) {
    const fromBody = cleanText(body[key], max);
    if (fromBody) return fromBody;
    const fromField = cleanText(fieldMap[key.toLowerCase()], max);
    if (fromField) return fromField;
  }
  return null;
}

function splitName(
  fullName: string | null,
): { firstName: string | null; lastName: string | null } {
  if (!fullName) return { firstName: null, lastName: null };
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: null, lastName: null };
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function buildCustomAnswers(
  body: JsonRecord,
  fieldMap: Record<string, string>,
): Record<string, unknown> {
  const customAnswers: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (CORE_BODY_KEYS.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) continue;
    customAnswers[key] = value;
  }

  for (const [key, value] of Object.entries(fieldMap)) {
    if (CORE_BODY_KEYS.has(key)) continue;
    if (!(key in customAnswers)) {
      customAnswers[key] = value;
    }
  }

  return customAnswers;
}

async function buildSyntheticSubmissionId(args: {
  formId: string | null;
  email: string | null;
  phoneE164: string | null;
  createdTime: string | null;
}): Promise<string> {
  const formPart = args.formId ?? "unknown";
  const identityMaterial = args.email ?? args.phoneE164 ?? "no_identity";
  const identitySeed = await sha256Hex(identityMaterial);
  const hashInput =
    `nextdoor|${formPart}|${identitySeed}|${args.createdTime ?? ""}`;
  const hash = await sha256Hex(hashInput);
  return `nextdoor:${formPart}:${hash}`;
}

async function normalizeNextdoorPayload(
  body: JsonRecord,
): Promise<
  | { ok: true; payload: NormalizedNextdoorLead }
  | { ok: false; error: "missing_identity" }
> {
  const fieldMap = getFieldMap(body);

  const explicitSubmissionId = cleanText(
    pick(body, fieldMap, [
      "nd_lead_id",
      "lead_id",
      "leadId",
      "platform_lead_id",
      "platformLeadId",
      "submission_id",
      "submissionId",
      "id",
    ], 255),
    255,
  );

  const formId = cleanText(
    pick(body, fieldMap, ["nd_form_id", "form_id", "formId"], 255),
    255,
  );
  const campaignId = cleanText(
    pick(body, fieldMap, ["nd_campaign_id", "campaign_id", "campaignId"], 255),
    255,
  );
  const campaignName = cleanText(
    pick(body, fieldMap, ["campaign_name", "campaignName"], 500),
    500,
  );
  const adId = cleanText(
    pick(body, fieldMap, ["nd_ad_id", "ad_id", "adId"], 255),
    255,
  );
  const adName = cleanText(
    pick(body, fieldMap, ["ad_name", "adName"], 500),
    500,
  );
  const adsetId = cleanText(
    pick(body, fieldMap, [
      "nd_ad_group_id",
      "ad_group_id",
      "adGroupId",
      "adset_id",
      "adsetId",
    ], 255),
    255,
  );

  const email = cleanEmail(pick(body, fieldMap, ["email", "email_address", "emailAddress"]));
  const phoneE164 = normalizePhone(
    pick(body, fieldMap, [
      "phone_e164",
      "phone",
      "phone_number",
      "phoneNumber",
      "mobile_phone",
      "mobilePhone",
    ]),
  );

  if (!email && !phoneE164) {
    return { ok: false, error: "missing_identity" };
  }

  const fullName = pick(body, fieldMap, ["full_name", "fullName", "name", "contact_name"]);
  const split = splitName(fullName);
  const firstName = pick(body, fieldMap, ["first_name", "firstName", "firstname"], 120) ??
    split.firstName;
  const lastName = pick(body, fieldMap, ["last_name", "lastName", "lastname"], 120) ??
    split.lastName;
  const zip = cleanText(
    pick(body, fieldMap, ["zip", "zip_code", "zipcode", "postal_code", "postalCode"], 20),
    20,
  );
  const platformCreatedTime = normalizeTimestamp(
    pick(body, fieldMap, [
      "created_time",
      "createdTime",
      "platform_created_time",
      "submitted_at",
      "submittedAt",
    ]),
  );
  const clientSlug = normalizeClientSlug(
    pick(body, fieldMap, ["client_slug", "clientSlug"], 100),
  );

  let providerSubmissionId = explicitSubmissionId;
  let synthetic = false;

  if (!providerSubmissionId) {
    providerSubmissionId = await buildSyntheticSubmissionId({
      formId,
      email,
      phoneE164,
      createdTime: platformCreatedTime,
    });
    synthetic = true;
  }

  const idempotencyKey = providerSubmissionId.startsWith("nextdoor:")
    ? providerSubmissionId
    : `nextdoor:${providerSubmissionId}`;

  return {
    ok: true,
    payload: {
      providerSubmissionId,
      idempotencyKey,
      synthetic,
      formId,
      campaignId,
      campaignName,
      adId,
      adName,
      adsetId,
      firstName,
      lastName,
      email,
      phoneE164,
      zip,
      clientSlug,
      platformCreatedTime,
      customAnswers: buildCustomAnswers(body, fieldMap),
      rawPayload: body,
    },
  };
}

function mergeNativeLeadQualification(
  existing: unknown,
  nativeLeadBlock: Record<string, unknown>,
): Record<string, unknown> {
  const base = asRecord(existing) ?? {};
  const prevNative = asRecord(base.native_lead) ?? {};
  const prevCustom = asRecord(prevNative.custom_answers) ?? {};
  const nextCustom = asRecord(nativeLeadBlock.custom_answers) ?? {};

  return {
    ...base,
    native_lead: {
      ...prevNative,
      ...nativeLeadBlock,
      custom_answers: {
        ...prevCustom,
        ...nextCustom,
      },
    },
  };
}

function mergeAttributionJson(
  existing: unknown,
  additions: Record<string, unknown>,
): Record<string, unknown> {
  const base = asRecord(existing) ?? {};
  const out: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(additions)) {
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }

  return out;
}

function authOk(req: Request, expectedSecret: string): boolean {
  const headerSecret = req.headers.get("x-native-lead-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (headerSecret && constantTimeEqual(headerSecret, expectedSecret)) {
    return true;
  }
  if (bearer && constantTimeEqual(bearer, expectedSecret)) {
    return true;
  }
  return false;
}

function isPostgresUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

async function lookupAttributionByPlatformLeadId(
  supabase: NativeLeadSupabaseClient,
  platformLeadId: string,
) {
  return supabase
    .from("lead_attribution_details")
    .select("id, lead_id")
    .eq("source_platform", SOURCE_PLATFORM)
    .eq("platform_lead_id", platformLeadId)
    .maybeSingle();
}

async function respondDuplicateAttribution(
  supabase: NativeLeadSupabaseClient,
  providerRaw: string,
  payload: NormalizedNextdoorLead,
  existingAttribution: { id: string; lead_id: string },
  now: string,
): Promise<Response> {
  await writeOperationalAudit(supabase, "native_lead_ingest_deduped", {
    provider: providerRaw,
    platform_lead_id: payload.providerSubmissionId,
    form_id: payload.formId,
    campaign_id: payload.campaignId,
    ad_id: payload.adId,
    duplicate: true,
    synthetic: payload.synthetic,
    has_email: !!payload.email,
    has_phone: !!payload.phoneE164,
    client_slug: payload.clientSlug,
    timestamp: now,
  }, existingAttribution.lead_id);

  return jsonResponse({
    ok: true,
    provider: providerRaw,
    submission_id: payload.providerSubmissionId,
    idempotency_key: payload.idempotencyKey,
    lead_id: existingAttribution.lead_id,
    attribution_id: existingAttribution.id,
    duplicate: true,
  });
}

async function writeOperationalAudit(
  supabase: NativeLeadSupabaseClient,
  eventName: string,
  metadata: Record<string, unknown>,
  leadId?: string | null,
): Promise<void> {
  try {
    await supabase.from("event_logs").insert({
      event_name: eventName,
      flow_type: IMPORT_SOURCE,
      route: `/${FUNCTION_NAME}`,
      lead_id: leadId ?? null,
      metadata,
    });
  } catch (err) {
    console.warn(`[${FUNCTION_NAME}] event_logs insert failed`, {
      event_name: eventName,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({
      ok: false,
      error: "method_not_allowed",
      message: "Use POST.",
    }, 405);
  }

  const expectedSecret = Deno.env.get("NATIVE_LEAD_INGEST_SECRET");
  if (!expectedSecret) {
    return jsonResponse({
      ok: false,
      error: "server_misconfigured",
      message: "Native lead ingest secret is not configured.",
    }, 500);
  }

  if (!authOk(req, expectedSecret)) {
    return jsonResponse({
      ok: false,
      error: "unauthorized",
      message: "Invalid native lead ingest credentials.",
    }, 401);
  }

  const providerRaw = req.headers.get("x-native-lead-provider")?.trim().toLowerCase() ??
    "";
  if (!providerRaw) {
    return jsonResponse({
      ok: false,
      error: "unknown_provider",
      message: "Unsupported native lead provider.",
    }, 400);
  }

  if (RESERVED_PROVIDERS.has(providerRaw)) {
    return jsonResponse({
      ok: false,
      error: "provider_not_implemented",
      message: "This native lead provider is reserved but not implemented yet.",
    }, 400);
  }

  if (!ACTIVE_PROVIDERS.has(providerRaw)) {
    return jsonResponse({
      ok: false,
      error: "unknown_provider",
      message: "Unsupported native lead provider.",
    }, 400);
  }

  const bodyBuffer = await req.arrayBuffer();
  if (bodyBuffer.byteLength > MAX_BODY_BYTES) {
    return jsonResponse({
      ok: false,
      error: "payload_too_large",
      message: "Payload exceeds native lead ingest limit.",
    }, 413);
  }

  let rawBody: unknown;
  try {
    const rawText = new TextDecoder().decode(bodyBuffer);
    rawBody = rawText.trim().length > 0 ? JSON.parse(rawText) : null;
  } catch (_err) {
    return jsonResponse({
      ok: false,
      error: "invalid_json",
      message: "Body must be valid JSON.",
    }, 400);
  }

  const body = asRecord(rawBody);
  if (!body) {
    return jsonResponse({
      ok: false,
      error: "invalid_json",
      message: "Body must be a JSON object.",
    }, 400);
  }

  const normalized = await normalizeNextdoorPayload(body);
  if (!normalized.ok) {
    return jsonResponse({
      ok: false,
      error: "missing_identity",
      message: "A native lead requires at least email or phone.",
    }, 400);
  }

  const payload = normalized.payload;
  const now = new Date().toISOString();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: existingAttribution, error: attributionLookupError } =
      await lookupAttributionByPlatformLeadId(
        supabase,
        payload.providerSubmissionId,
      );

    if (attributionLookupError) throw attributionLookupError;

    if (existingAttribution?.lead_id && existingAttribution?.id) {
      return await respondDuplicateAttribution(
        supabase,
        providerRaw,
        payload,
        {
          id: existingAttribution.id as string,
          lead_id: existingAttribution.lead_id as string,
        },
        now,
      );
    }

    let leadId: string | undefined;

    if (payload.phoneE164) {
      const { data: leadByPhone, error } = await supabase
        .from("leads")
        .select("id, qualification_answers_json, attribution, query_params")
        .eq("phone_e164", payload.phoneE164)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      leadId = leadByPhone?.id as string | undefined;
    }

    if (!leadId && payload.email) {
      const { data: leadByEmail, error } = await supabase
        .from("leads")
        .select("id, qualification_answers_json, attribution, query_params")
        .eq("email", payload.email)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      leadId = leadByEmail?.id as string | undefined;
    }

    const nativeLeadBlock: Record<string, unknown> = {
      provider: SOURCE_PLATFORM,
      source_channel: SOURCE_CHANNEL,
      import_source: IMPORT_SOURCE,
      form_id: payload.formId,
      campaign_id: payload.campaignId,
      ad_id: payload.adId,
      custom_answers: payload.customAnswers,
    };

    const attributionAdditions: Record<string, unknown> = {
      nd_lead_id: payload.synthetic ? null : payload.providerSubmissionId,
      nd_form_id: payload.formId,
      nd_campaign_id: payload.campaignId,
      nd_ad_id: payload.adId,
      nd_ad_group_id: payload.adsetId,
      utm_source: "nextdoor",
      utm_medium: SOURCE_CHANNEL,
      utm_campaign: payload.campaignId,
    };

    const leadPatch: JsonRecord = {
      source: LEAD_SOURCE_DETAIL,
      lead_source: LEAD_SOURCE,
      client_slug: payload.clientSlug,
      updated_at: now,
      utm_source: "nextdoor",
      utm_medium: SOURCE_CHANNEL,
      utm_campaign: payload.campaignId,
      utm_content: payload.adId,
    };

    const optionalLeadFields: JsonRecord = {
      first_name: payload.firstName,
      last_name: payload.lastName,
      email: payload.email,
      phone_e164: payload.phoneE164,
      zip: payload.zip,
    };

    for (const [key, value] of Object.entries(optionalLeadFields)) {
      if (value !== null && value !== undefined) leadPatch[key] = value;
    }

    if (leadId) {
      const { data: existingLead, error: existingLeadError } = await supabase
        .from("leads")
        .select("id, qualification_answers_json, attribution, query_params")
        .eq("id", leadId)
        .maybeSingle();
      if (existingLeadError) throw existingLeadError;

      leadPatch.qualification_answers_json = mergeNativeLeadQualification(
        existingLead?.qualification_answers_json,
        nativeLeadBlock,
      );
      leadPatch.attribution = mergeAttributionJson(
        existingLead?.attribution,
        attributionAdditions,
      );
      leadPatch.query_params = mergeAttributionJson(
        existingLead?.query_params,
        {
          nd_lead_id: payload.synthetic ? null : payload.providerSubmissionId,
          nd_form_id: payload.formId,
          nd_campaign_id: payload.campaignId,
          nd_ad_id: payload.adId,
          nd_ad_group_id: payload.adsetId,
          wm_intent: "native_lead_form",
        },
      );

      const { error: updateError } = await supabase
        .from("leads")
        .update(leadPatch)
        .eq("id", leadId);
      if (updateError) throw updateError;
    } else {
      leadPatch.status = "new";
      leadPatch.session_id = `ndla_${sanitizeSessionSuffix(payload.providerSubmissionId)}`;
      leadPatch.phone_verified = false;
      leadPatch.phone_verified_at = null;
      leadPatch.report_unlocked_at = null;
      leadPatch.otp_state = null;
      leadPatch.otp_failure_count = 0;
      leadPatch.last_otp_verified_at = null;
      leadPatch.qualification_answers_json = mergeNativeLeadQualification(
        {},
        nativeLeadBlock,
      );
      leadPatch.attribution = mergeAttributionJson({}, attributionAdditions);
      leadPatch.query_params = mergeAttributionJson({}, {
        nd_lead_id: payload.synthetic ? null : payload.providerSubmissionId,
        nd_form_id: payload.formId,
        nd_campaign_id: payload.campaignId,
        nd_ad_id: payload.adId,
        nd_ad_group_id: payload.adsetId,
        wm_intent: "native_lead_form",
      });

      const { data: insertedLead, error: insertError } = await supabase
        .from("leads")
        .insert(leadPatch)
        .select("id")
        .single();
      if (insertError) throw insertError;
      leadId = insertedLead.id as string;
    }

    const attributionRow = {
      lead_id: leadId,
      source_platform: SOURCE_PLATFORM,
      source_channel: SOURCE_CHANNEL,
      source_detail: SOURCE_DETAIL,
      campaign_id: payload.campaignId,
      campaign_name: payload.campaignName,
      adset_id: payload.adsetId,
      ad_id: payload.adId,
      ad_name: payload.adName,
      form_id: payload.formId,
      platform_lead_id: payload.providerSubmissionId,
      platform_created_time: payload.platformCreatedTime,
      utm_source: "nextdoor",
      utm_medium: SOURCE_CHANNEL,
      utm_campaign: payload.campaignId,
      utm_content: payload.adId,
      import_source: IMPORT_SOURCE,
      imported_at: now,
      raw_payload: payload.rawPayload,
      updated_at: now,
    };

    const { data: insertedAttribution, error: attributionInsertError } =
      await supabase
        .from("lead_attribution_details")
        .insert(attributionRow)
        .select("id")
        .single();

    if (attributionInsertError) {
      if (isPostgresUniqueViolation(attributionInsertError)) {
        const { data: racedAttribution, error: raceLookupError } =
          await lookupAttributionByPlatformLeadId(
            supabase,
            payload.providerSubmissionId,
          );
        if (raceLookupError) throw raceLookupError;
        if (racedAttribution?.lead_id && racedAttribution?.id) {
          return await respondDuplicateAttribution(
            supabase,
            providerRaw,
            payload,
            {
              id: racedAttribution.id as string,
              lead_id: racedAttribution.lead_id as string,
            },
            now,
          );
        }
      }
      throw attributionInsertError;
    }

    await writeOperationalAudit(supabase, "native_lead_ingest_imported", {
      provider: providerRaw,
      platform_lead_id: payload.providerSubmissionId,
      form_id: payload.formId,
      campaign_id: payload.campaignId,
      ad_id: payload.adId,
      duplicate: false,
      synthetic: payload.synthetic,
      has_email: !!payload.email,
      has_phone: !!payload.phoneE164,
      client_slug: payload.clientSlug,
      timestamp: now,
    }, leadId);

    // Canonical lead_captured emission intentionally deferred until dispatch
    // eligibility and provider payload truth are verified.

    return jsonResponse({
      ok: true,
      provider: providerRaw,
      submission_id: payload.providerSubmissionId,
      idempotency_key: payload.idempotencyKey,
      lead_id: leadId,
      attribution_id: insertedAttribution.id,
      duplicate: false,
      event: "lead_captured_deferred",
    });
  } catch (err) {
    console.error(`[${FUNCTION_NAME}:ERROR]`, {
      message: err instanceof Error ? err.message : String(err),
    });

    await writeOperationalAudit(supabase, "native_lead_ingest_failed", {
      provider: providerRaw,
      platform_lead_id: payload.providerSubmissionId,
      form_id: payload.formId,
      duplicate: false,
      synthetic: payload.synthetic,
      has_email: !!payload.email,
      has_phone: !!payload.phoneE164,
      timestamp: now,
    });

    return jsonResponse({
      ok: false,
      error: "import_failed",
      message: "Native lead ingest failed.",
    }, 500);
  }
});
