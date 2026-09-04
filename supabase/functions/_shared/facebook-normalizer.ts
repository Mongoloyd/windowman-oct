export type JsonRecord = Record<string, unknown>;

export type NormalizedLeadAdPayload = {
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

export type FacebookNormalizationResult =
  | { ok: true; payload: NormalizedLeadAdPayload }
  | { ok: false; error: string };

export type RecognizedFacebookField = {
  original_key: string;
  question_label: string;
  canonical_key: string;
  sanitized_value: string | null;
};

export type UnknownFacebookField = {
  original_key: string;
  question_label: string;
  original_value: unknown;
};

export type FacebookNormalizationInspection = {
  recognized_fields: RecognizedFacebookField[];
  unknown_fields: UnknownFacebookField[];
  missing_required_fields: Array<"name" | "phone" | "email">;
  normalized_lead: JsonRecord;
  validation_errors: string[];
  form_id: string | null;
  platform_lead_id: string | null;
};

export const FACEBOOK_CANONICAL_MAPPING_OPTIONS = [
  { canonical_key: "first_name", label: "First name", destination: "lead" },
  { canonical_key: "last_name", label: "Last name", destination: "lead" },
  { canonical_key: "email", label: "Email", destination: "lead" },
  { canonical_key: "phone_e164", label: "Phone", destination: "lead" },
  { canonical_key: "county", label: "County", destination: "lead" },
  { canonical_key: "city", label: "City", destination: "lead" },
  { canonical_key: "zip", label: "ZIP code", destination: "lead" },
  { canonical_key: "project_type", label: "Project type", destination: "lead" },
  {
    canonical_key: "property_type",
    label: "Property type",
    destination: "lead",
  },
  {
    canonical_key: "property_type_detail",
    label: "Property type detail",
    destination: "lead",
  },
  { canonical_key: "quote_range", label: "Quote range", destination: "lead" },
  {
    canonical_key: "qualification_openings",
    label: "Openings qualification bucket",
    destination: "qualification",
  },
] as const;

export type FacebookCanonicalMappingKey =
  (typeof FACEBOOK_CANONICAL_MAPPING_OPTIONS)[number]["canonical_key"];

export type PreparedFacebookReplayFixture = {
  body: JsonRecord;
  source_shape: "field_data_array" | "direct_object" | "nested_object";
};

const MAX_TEXT = 500;
const SOURCE = "facebook_lead_ads";

const FIELD_CANONICAL_DESTINATIONS: Readonly<Record<string, string>> = {
  email: "email",
  email_address: "email",
  e_mail: "email",
  phone: "phone_e164",
  phone_number: "phone_e164",
  mobile_phone: "phone_e164",
  best_phone_number: "phone_e164",
  phone_e164: "phone_e164",
  full_name: "first_name + last_name",
  name: "first_name + last_name",
  contact_name: "first_name + last_name",
  first_name: "first_name",
  firstname: "first_name",
  last_name: "last_name",
  lastname: "last_name",
};

const FACEBOOK_CANONICAL_MAPPING_KEY_SET = new Set<string>(
  FACEBOOK_CANONICAL_MAPPING_OPTIONS.map((option) => option.canonical_key),
);

export function asJsonRecord(value: unknown): JsonRecord | null {
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

function normalizeFieldKey(value: unknown): string | null {
  const key = cleanText(value, 120);
  if (!key) return null;
  const normalized = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || null;
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

function getFieldData(body: JsonRecord): unknown[] {
  return Array.isArray(body.field_data)
    ? body.field_data
    : Array.isArray(body.fieldData)
    ? body.fieldData
    : [];
}

function getFirstFieldValue(record: JsonRecord): unknown {
  const values = Array.isArray(record.values)
    ? record.values
    : Array.isArray(record.value)
    ? record.value
    : [record.value];
  return values.find((entry) => cleanText(entry) !== null);
}

function getFieldMap(body: JsonRecord): Record<string, string> {
  const fieldMap: Record<string, string> = {};

  for (const item of getFieldData(body)) {
    const record = asJsonRecord(item);
    if (!record) continue;
    const name = normalizeFieldKey(record.name);
    if (!name) continue;
    const cleaned = cleanText(getFirstFieldValue(record));
    if (cleaned) fieldMap[name] = cleaned;
  }

  return fieldMap;
}

function getNested(body: JsonRecord, path: string[]): unknown {
  let current: unknown = body;
  for (const key of path) {
    const record = asJsonRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
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

type NormalizedLeadAdCandidate =
  & Omit<
    NormalizedLeadAdPayload,
    "platformLeadId"
  >
  & { platformLeadId: string | null };

function buildNormalizedCandidate(body: JsonRecord): NormalizedLeadAdCandidate {
  const fieldMap = getFieldMap(body);
  const platformLeadId = cleanText(
    body.platform_lead_id ?? body.platformLeadId ?? body.leadgen_id ??
      body.leadgenId ?? body.id ?? getNested(body, ["lead", "id"]),
    255,
  );
  const email = cleanEmail(
    pick(body, fieldMap, ["email", "email_address", "e_mail"]),
  );
  const phoneE164 = normalizePhone(
    pick(body, fieldMap, [
      "phone",
      "phone_number",
      "mobile_phone",
      "best_phone_number",
      "phone_e164",
    ]),
  );
  const fullName = pick(body, fieldMap, ["full_name", "name", "contact_name"]);
  const split = splitName(fullName);
  const firstName = pick(body, fieldMap, ["first_name", "firstname"], 120) ??
    split.firstName;
  const lastName = pick(body, fieldMap, ["last_name", "lastname"], 120) ??
    split.lastName;

  return {
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
    platformCreatedTime: normalizeTimestamp(
      body.created_time ?? body.createdTime ?? body.platform_created_time,
    ),
    fbclid: cleanText(body.fbclid, 500),
    gclid: cleanText(body.gclid, 500),
    fbc: cleanText(body.fbc, 500),
    fbp: cleanText(body.fbp, 500),
    utmSource: cleanText(body.utm_source ?? body.utmSource, 255) ??
      "facebook",
    utmMedium: cleanText(body.utm_medium ?? body.utmMedium, 255) ?? "lead_ad",
    utmCampaign: cleanText(body.utm_campaign ?? body.utmCampaign, 500),
    utmTerm: cleanText(body.utm_term ?? body.utmTerm, 500),
    utmContent: cleanText(body.utm_content ?? body.utmContent, 500),
    landingPageUrl: cleanText(
      body.landing_page_url ?? body.landingPageUrl,
      2000,
    ),
    firstPagePath: cleanText(body.first_page_path ?? body.firstPagePath, 500),
    initialReferrer: cleanText(
      body.initial_referrer ?? body.initialReferrer,
      1000,
    ),
    clientSlug: cleanText(body.client_slug ?? body.clientSlug, 80) ?? "direct",
    firstName,
    lastName,
    fullName,
    email,
    phoneE164,
    county: cleanText(body.county, 120),
    rawPayload: asJsonRecord(body.raw_payload) ?? body,
  };
}

export function normalizePayload(
  body: JsonRecord,
): FacebookNormalizationResult {
  const candidate = buildNormalizedCandidate(body);

  if (!candidate.platformLeadId) {
    return { ok: false, error: "platform_lead_id_required" };
  }
  if (!candidate.email && !candidate.phoneE164) {
    return { ok: false, error: "email_or_phone_required" };
  }

  return {
    ok: true,
    payload: {
      ...candidate,
      platformLeadId: candidate.platformLeadId,
    },
  };
}

function safeOriginalValue(record: JsonRecord): unknown {
  const original = record.values ?? record.value ?? null;
  if (typeof original === "string") return original.slice(0, 2_000);
  if (
    original === null || typeof original === "number" ||
    typeof original === "boolean"
  ) {
    return original;
  }
  if (Array.isArray(original)) {
    return original.slice(0, 20).map((value) =>
      typeof value === "string" ? value.slice(0, 2_000) : value
    );
  }
  return "[unsupported value]";
}

function sanitizeRecognizedValue(
  destination: string,
  value: unknown,
): string | null {
  if (destination === "email") return cleanEmail(value);
  if (destination === "phone_e164") return normalizePhone(value);
  return cleanText(value);
}

function inspectFieldData(body: JsonRecord): Pick<
  FacebookNormalizationInspection,
  "recognized_fields" | "unknown_fields"
> {
  const recognizedFields: RecognizedFacebookField[] = [];
  const unknownFields: UnknownFacebookField[] = [];

  for (const item of getFieldData(body)) {
    const record = asJsonRecord(item);
    if (!record) continue;
    const originalKey = cleanText(record.name, 120) ?? "unnamed_field";
    const normalizedKey = normalizeFieldKey(originalKey) ?? "unnamed_field";
    const questionLabel = cleanText(
      record.question_label ?? record.label ?? record.question ?? record.name,
      500,
    ) ?? originalKey;
    const destination = FIELD_CANONICAL_DESTINATIONS[normalizedKey];

    if (destination) {
      recognizedFields.push({
        original_key: originalKey,
        question_label: questionLabel,
        canonical_key: destination,
        sanitized_value: sanitizeRecognizedValue(
          destination,
          getFirstFieldValue(record),
        ),
      });
    } else {
      unknownFields.push({
        original_key: originalKey,
        question_label: questionLabel,
        original_value: safeOriginalValue(record),
      });
    }
  }

  return {
    recognized_fields: recognizedFields,
    unknown_fields: unknownFields,
  };
}

function toNormalizedLeadPreview(
  candidate: NormalizedLeadAdCandidate,
): JsonRecord {
  return {
    platform_lead_id: candidate.platformLeadId,
    source_platform: candidate.sourcePlatform,
    source_channel: candidate.sourceChannel,
    source_detail: candidate.sourceDetail,
    campaign_id: candidate.campaignId,
    campaign_name: candidate.campaignName,
    adset_id: candidate.adsetId,
    adset_name: candidate.adsetName,
    ad_id: candidate.adId,
    ad_name: candidate.adName,
    form_id: candidate.formId,
    platform_created_time: candidate.platformCreatedTime,
    fbclid: candidate.fbclid,
    gclid: candidate.gclid,
    fbc: candidate.fbc,
    fbp: candidate.fbp,
    utm_source: candidate.utmSource,
    utm_medium: candidate.utmMedium,
    utm_campaign: candidate.utmCampaign,
    utm_term: candidate.utmTerm,
    utm_content: candidate.utmContent,
    landing_page_url: candidate.landingPageUrl,
    first_page_path: candidate.firstPagePath,
    initial_referrer: candidate.initialReferrer,
    client_slug: candidate.clientSlug,
    first_name: candidate.firstName,
    last_name: candidate.lastName,
    full_name: candidate.fullName,
    email: candidate.email,
    phone_e164: candidate.phoneE164,
    county: candidate.county,
  };
}

export function inspectFacebookPayload(
  body: JsonRecord,
): FacebookNormalizationInspection {
  const candidate = buildNormalizedCandidate(body);
  const validationErrors: string[] = [];
  const missingRequiredFields: Array<"name" | "phone" | "email"> = [];

  if (!candidate.platformLeadId) {
    validationErrors.push("platform_lead_id_required");
  }
  if (!candidate.email && !candidate.phoneE164) {
    validationErrors.push("email_or_phone_required");
  }
  if (!candidate.firstName && !candidate.lastName && !candidate.fullName) {
    missingRequiredFields.push("name");
  }
  if (!candidate.phoneE164) missingRequiredFields.push("phone");
  if (!candidate.email) missingRequiredFields.push("email");

  return {
    ...inspectFieldData(body),
    missing_required_fields: missingRequiredFields,
    normalized_lead: toNormalizedLeadPreview(candidate),
    validation_errors: validationErrors,
    form_id: candidate.formId,
    platform_lead_id: candidate.platformLeadId,
  };
}

function hasFieldDataProperty(record: JsonRecord): boolean {
  return Object.hasOwn(record, "field_data") ||
    Object.hasOwn(record, "fieldData");
}

function fieldDataValue(record: JsonRecord): unknown {
  return Object.hasOwn(record, "field_data")
    ? record.field_data
    : record.fieldData;
}

function findNestedFieldDataRecord(
  value: unknown,
  depth = 0,
): JsonRecord | null {
  if (depth > 7) return null;
  const record = asJsonRecord(value);
  if (record) {
    if (hasFieldDataProperty(record)) return record;
    for (
      const key of ["lead", "value", "payload", "data", "changes", "entry"]
    ) {
      const found = findNestedFieldDataRecord(record[key], depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 100)) {
      const found = findNestedFieldDataRecord(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

export function prepareFacebookReplayFixture(
  fixture: unknown,
  formIdOverride?: unknown,
): { ok: true; fixture: PreparedFacebookReplayFixture } | {
  ok: false;
  error:
    | "fixture_must_be_object_or_field_data_array"
    | "missing_field_data"
    | "invalid_field_data"
    | "empty_field_data";
} {
  const formId = cleanText(formIdOverride, 255);
  if (Array.isArray(fixture)) {
    if (fixture.length === 0) {
      return { ok: false, error: "empty_field_data" };
    }
    return {
      ok: true,
      fixture: {
        body: {
          field_data: fixture,
          ...(formId ? { form_id: formId } : {}),
        },
        source_shape: "field_data_array",
      },
    };
  }

  const root = asJsonRecord(fixture);
  if (!root) {
    return { ok: false, error: "fixture_must_be_object_or_field_data_array" };
  }

  const candidate = hasFieldDataProperty(root)
    ? root
    : findNestedFieldDataRecord(root);
  if (!candidate) return { ok: false, error: "missing_field_data" };
  const fieldData = fieldDataValue(candidate);
  if (!Array.isArray(fieldData)) {
    return { ok: false, error: "invalid_field_data" };
  }
  if (fieldData.length === 0) {
    return { ok: false, error: "empty_field_data" };
  }

  return {
    ok: true,
    fixture: {
      body: {
        ...candidate,
        ...(formId ? { form_id: formId } : {}),
      },
      source_shape: candidate === root ? "direct_object" : "nested_object",
    },
  };
}

export function isFacebookCanonicalMappingKey(
  value: unknown,
): value is FacebookCanonicalMappingKey {
  return typeof value === "string" &&
    FACEBOOK_CANONICAL_MAPPING_KEY_SET.has(value);
}
