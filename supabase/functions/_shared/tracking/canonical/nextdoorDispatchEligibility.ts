import type {
  WMCanonicalEventPayload,
  WMEventName,
  WMIdentityQuality,
} from "./types.ts";

/** Production queue allowlist — virtual_page_view excluded by policy. */
export const NEXTDOOR_DISPATCH_EVENT_ALLOWLIST = new Set<WMEventName>([
  "lead_captured",
  "lead_identified",
  "lead_qualified",
  "phone_verified",
  "quote_uploaded",
  "quote_upload_completed",
  "quote_validation_passed",
  "report_revealed",
  "contractor_match_requested",
  "appointment_booked",
  "sold",
  "sale_confirmed",
]);

function pickNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function utmSourceIndicatesNextdoor(value: string): boolean {
  return value.toLowerCase().includes("nextdoor");
}

function recordHasNextdoorAttribution(record: Record<string, unknown> | undefined): boolean {
  if (!record) return false;

  const utmSource = pickNonEmptyString(record.utm_source) ??
    pickNonEmptyString(record.utmSource);
  if (utmSource && utmSourceIndicatesNextdoor(utmSource)) {
    return true;
  }

  if (pickNonEmptyString(record.ndclid)) return true;
  if (pickNonEmptyString(record.nd_lead_id)) return true;
  if (pickNonEmptyString(record.nd_form_id)) return true;
  if (pickNonEmptyString(record.nd_ad_id)) return true;
  if (pickNonEmptyString(record.nd_ad_group_id)) return true;
  if (pickNonEmptyString(record.nd_campaign_id)) return true;

  return false;
}

/**
 * Path-independent Nextdoor attribution detection.
 * Landing path (including /nextdoor) is never used as an eligibility signal.
 */
export function hasNextdoorAttribution(payload: WMCanonicalEventPayload): boolean {
  if (recordHasNextdoorAttribution(payload.metadata)) {
    return true;
  }

  if (recordHasNextdoorAttribution(payload.source as Record<string, unknown> | undefined)) {
    return true;
  }

  const metadata = payload.metadata;
  if (metadata && typeof metadata.attribution === "object" && metadata.attribution !== null) {
    if (recordHasNextdoorAttribution(metadata.attribution as Record<string, unknown>)) {
      return true;
    }
  }

  if (metadata && typeof metadata.query_params === "object" && metadata.query_params !== null) {
    const queryParams = metadata.query_params as Record<string, unknown>;
    const queryUtm = pickNonEmptyString(queryParams.utm_source);
    if (queryUtm && utmSourceIndicatesNextdoor(queryUtm)) {
      return true;
    }
    if (pickNonEmptyString(queryParams.ndclid)) return true;
    if (pickNonEmptyString(queryParams.nd_lead_id)) return true;
  }

  return false;
}

export function isNextdoorDispatchEventAllowed(eventName: WMEventName): boolean {
  return NEXTDOOR_DISPATCH_EVENT_ALLOWLIST.has(eventName);
}

export function isDenoNextdoorCapiEnabled(
  envValue: string | null | undefined = Deno.env.get("NEXTDOOR_CAPI_ENABLED"),
): boolean {
  return envValue === "true";
}

export function resolveShouldSendNextdoor(args: {
  envEnabled: boolean;
  eventName: WMEventName;
  identityQuality: WMIdentityQuality;
  quoteSafe: boolean;
  payload: WMCanonicalEventPayload;
}): boolean {
  if (!args.envEnabled) return false;
  if (args.eventName === "virtual_page_view") return false;
  if (!isNextdoorDispatchEventAllowed(args.eventName)) return false;
  if (args.identityQuality === "low" || args.identityQuality === "unknown") return false;
  if (!args.quoteSafe) return false;
  if (!hasNextdoorAttribution(args.payload)) return false;
  return true;
}
