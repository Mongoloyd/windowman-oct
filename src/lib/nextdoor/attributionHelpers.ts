import type {
  NextdoorAttributionSnapshot,
  NextdoorLeadMedium,
  NextdoorLeadPayload,
  NextdoorPrefilledFields,
  NextdoorTrafficMode,
  NextdoorWmIntent,
  QuoteReadiness,
} from "@/components/nextdoor/types";
import {
  captureUtmFromUrl,
  getUtmData,
  type WmIntent,
} from "@/lib/useUtmCapture";

const MAX_STRING_LEN = 120;

const PII_PARAM_KEYS = new Set([
  "first_name",
  "last_name",
  "email",
  "phone",
  "phone_e164",
  "zip",
]);

export const ATTRIBUTION_HANDOFF_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "wm_intent",
  "quote_readiness",
  "ndclid",
  "nd_lead_id",
  "nd_form_id",
  "nd_ad_id",
  "nd_ad_group_id",
  "nd_campaign_id",
  "client_slug",
] as const;

export type AttributionHandoffKey = (typeof ATTRIBUTION_HANDOFF_KEYS)[number];

const QUOTE_READINESS_VALUES: QuoteReadiness[] = [
  "has_estimate",
  "getting_quotes_now",
  "need_quote_soon",
  "researching",
];

function sanitizeString(raw: string | null, maxLen = MAX_STRING_LEN): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > maxLen) return null;
  return trimmed;
}

export function isValidEmail(email: string): boolean {
  if (email.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidZip(zip: string): boolean {
  return /^\d{5}$/.test(zip);
}

export function isValidFirstName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 2 && trimmed.length <= 60 && /^[\p{L}\p{M}'\-. ]+$/u.test(trimmed);
}

export function isValidLastName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 1 && trimmed.length <= 60;
}

export type NextdoorUrlPrefill = {
  identity: {
    firstName: string;
    lastName: string;
    email: string;
    zip: string;
  };
  prefilled: NextdoorPrefilledFields;
  ndLeadId: string | null;
  hasKnownLead: boolean;
  validEmailPrefill: boolean;
  quoteReadiness: QuoteReadiness | null;
};

export function parseQuoteReadinessParam(raw: string | null): QuoteReadiness | null {
  const value = sanitizeString(raw, 40);
  if (!value) return null;
  return QUOTE_READINESS_VALUES.includes(value as QuoteReadiness)
    ? (value as QuoteReadiness)
    : null;
}

/**
 * Parse safe URL prefill hints. Phone params are ignored entirely.
 */
export function parseNextdoorUrlPrefill(search?: string): NextdoorUrlPrefill {
  const params = new URLSearchParams(
    search ?? (typeof window !== "undefined" ? window.location.search : ""),
  );

  const firstRaw = sanitizeString(params.get("first_name"));
  const lastRaw = sanitizeString(params.get("last_name"));
  const emailRaw = sanitizeString(params.get("email"));
  const zipRaw = sanitizeString(params.get("zip"));

  const firstName = firstRaw && isValidFirstName(firstRaw) ? firstRaw : "";
  const lastName = lastRaw && isValidLastName(lastRaw) ? lastRaw : "";
  const email = emailRaw && isValidEmail(emailRaw) ? emailRaw.toLowerCase() : "";

  const zipDigits = zipRaw ? zipRaw.replace(/\D/g, "").slice(0, 5) : "";
  const zip = isValidZip(zipDigits) ? zipDigits : "";

  const ndLeadId = sanitizeString(params.get("nd_lead_id"));
  const validEmailPrefill = Boolean(email);
  const hasKnownLead = Boolean(ndLeadId) || validEmailPrefill;

  return {
    identity: { firstName, lastName, email, zip },
    prefilled: {
      firstName: Boolean(firstName),
      email: Boolean(email),
      zip: Boolean(zip),
    },
    ndLeadId,
    hasKnownLead,
    validEmailPrefill,
    quoteReadiness: parseQuoteReadinessParam(params.get("quote_readiness")),
  };
}

export function deriveNextdoorTrafficMode(
  ndLeadId: string | null | undefined,
  utmSource: string | null | undefined,
  ndclid: string | null | undefined,
): NextdoorTrafficMode {
  if (ndLeadId?.trim()) return "native_followup";
  const source = utmSource?.trim().toLowerCase();
  if (source === "nextdoor" || ndclid?.trim()) return "direct_nextdoor_click";
  return "unknown";
}

export function resolveNextdoorMedium(
  trafficMode: NextdoorTrafficMode,
  utmMedium: string | null | undefined,
): NextdoorLeadMedium {
  if (trafficMode === "native_followup") return "native_followup";
  if (utmMedium?.trim().toLowerCase() === "hosted_form") return "hosted_form";
  return "paid_social";
}

export function resolveWmIntentFromReadiness(
  readiness: QuoteReadiness,
  storedIntent: WmIntent,
): NextdoorWmIntent {
  if (readiness === "has_estimate") return "has_quote";
  if (
    readiness === "getting_quotes_now" ||
    readiness === "need_quote_soon" ||
    readiness === "researching"
  ) {
    return "no_quote";
  }
  if (storedIntent === "has_quote" || storedIntent === "no_quote") return storedIntent;
  return "no_quote";
}

function buildAttributionSnapshot(): NextdoorAttributionSnapshot {
  const data = getUtmData();
  const snapshot: NextdoorAttributionSnapshot = {};

  if (data.utm_source) snapshot.utm_source = data.utm_source;
  if (data.utm_medium) snapshot.utm_medium = data.utm_medium;
  if (data.utm_campaign) snapshot.utm_campaign = data.utm_campaign;
  if (data.utm_content) snapshot.utm_content = data.utm_content;
  if (data.ndclid) snapshot.ndclid = data.ndclid;
  if (data.nd_lead_id) snapshot.nd_lead_id = data.nd_lead_id;
  if (data.nd_form_id) snapshot.nd_form_id = data.nd_form_id;
  if (data.nd_ad_id) snapshot.nd_ad_id = data.nd_ad_id;
  if (data.nd_ad_group_id) snapshot.nd_ad_group_id = data.nd_ad_group_id;
  if (data.nd_campaign_id) snapshot.nd_campaign_id = data.nd_campaign_id;

  return snapshot;
}

export type BuildLocalPayloadInput = {
  firstName: string;
  lastName: string;
  email: string;
  zip: string;
  quoteReadiness: QuoteReadiness;
  trafficMode: NextdoorTrafficMode;
};

export function buildLocalNextdoorPayload(input: BuildLocalPayloadInput): NextdoorLeadPayload {
  captureUtmFromUrl();
  const stored = getUtmData();
  const attribution = buildAttributionSnapshot();
  const medium = resolveNextdoorMedium(trafficMode, stored.utm_medium);
  const wmIntent = resolveWmIntentFromReadiness(input.quoteReadiness, stored.wm_intent);

  const payload: NextdoorLeadPayload = {
    source: "nextdoor",
    campaign: stored.utm_campaign || "nextdoor",
    medium,
    first_name: input.firstName.trim(),
    email: input.email.trim().toLowerCase(),
    zip: input.zip,
    quote_readiness: input.quoteReadiness,
    wm_intent: wmIntent,
    attribution,
    submitted_locally_at: new Date().toISOString(),
  };

  const lastName = input.lastName.trim();
  if (lastName) payload.last_name = lastName;

  return payload;
}

export function buildAttributionHandoffUrl(
  basePath: string,
  overrides?: Partial<Record<AttributionHandoffKey, string>>,
): string {
  const stored = getUtmData();
  const currentParams =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : new URLSearchParams();

  const merged = new URLSearchParams();

  const setIfSafe = (key: AttributionHandoffKey, value: string | null | undefined) => {
    if (PII_PARAM_KEYS.has(key)) return;
    const trimmed = value?.trim();
    if (!trimmed) return;
    merged.set(key, trimmed);
  };

  for (const key of ATTRIBUTION_HANDOFF_KEYS) {
    setIfSafe(key, currentParams.get(key));
  }

  setIfSafe("utm_source", stored.utm_source);
  setIfSafe("utm_medium", stored.utm_medium);
  setIfSafe("utm_campaign", stored.utm_campaign);
  setIfSafe("utm_content", stored.utm_content);
  setIfSafe("utm_term", stored.utm_term);
  setIfSafe(
    "wm_intent",
    stored.wm_intent !== "unknown" ? stored.wm_intent : null,
  );
  setIfSafe("ndclid", stored.ndclid);
  setIfSafe("nd_lead_id", stored.nd_lead_id);
  setIfSafe("nd_form_id", stored.nd_form_id);
  setIfSafe("nd_ad_id", stored.nd_ad_id);
  setIfSafe("nd_ad_group_id", stored.nd_ad_group_id);
  setIfSafe("nd_campaign_id", stored.nd_campaign_id);
  setIfSafe(
    "client_slug",
    stored.client_slug && stored.client_slug !== "direct" ? stored.client_slug : null,
  );

  if (overrides) {
    for (const key of ATTRIBUTION_HANDOFF_KEYS) {
      const value = overrides[key];
      if (value === undefined) continue;
      if (PII_PARAM_KEYS.has(key)) continue;
      const trimmed = value.trim();
      if (trimmed) merged.set(key, trimmed);
      else merged.delete(key);
    }
  }

  const normalizedPath = basePath.startsWith("/") ? basePath : `/${basePath}`;
  const query = merged.toString();
  return query ? `${normalizedPath}?${query}` : normalizedPath;
}

export function redactEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.indexOf("@");
  if (at <= 0) return "***";
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}

export function redactName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "***";
  return `${trimmed.charAt(0)}***`;
}

export function redactZip(zip: string): string {
  if (zip.length < 2) return "***";
  return `${zip.slice(0, 2)}***`;
}

/** Development-only redacted summary — never logs raw PII. */
export function logLocalPayloadDevSummary(payload: NextdoorLeadPayload): void {
  if (!import.meta.env.DEV) return;

  console.info("[nextdoor] local payload captured", {
    source: payload.source,
    campaign: payload.campaign,
    medium: payload.medium,
    first_name: redactName(payload.first_name),
    last_name: payload.last_name ? redactName(payload.last_name) : undefined,
    email: redactEmail(payload.email),
    zip: redactZip(payload.zip),
    quote_readiness: payload.quote_readiness,
    wm_intent: payload.wm_intent,
    attribution: payload.attribution,
    submitted_locally_at: payload.submitted_locally_at,
  });
}

/** Call once on /nextdoor mount to seed global attribution storage. */
export function captureNextdoorAttributionOnMount(): ReturnType<typeof captureUtmFromUrl> {
  return captureUtmFromUrl();
}
