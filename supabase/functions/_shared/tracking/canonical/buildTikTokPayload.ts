/**
 * buildTikTokPayload — Pure canonical + attribution → TikTok Events API payload.
 *
 * SCOPE (Sprint 3A): Payload assembly only. No fetch, no secrets, no dispatch.
 *
 * LOCKSTEP: Duplicated verbatim at `src/lib/tracking/canonical/buildTikTokPayload.ts`.
 * Keep both copies byte-identical (Supabase edge bundler cannot import arbitrary
 * `src/` paths).
 *
 * Uses `mapToTikTok` for event-name resolution. Never generates random event IDs.
 */

import { mapToTikTok } from "./mapToTikTok.ts";
import type { WMCanonicalEvent } from "./types.ts";

export interface BuildTikTokPayloadInput {
  canonical: WMCanonicalEvent;
  attribution?: Record<string, unknown> | null;
  queryParams?: Record<string, unknown> | null;
  eventSourceId: string;
  eventSourceUrl?: string | null;
  testEventCode?: string | null;
}

export interface TikTokEventsApiPayload {
  event_source: "web";
  event_source_id: string;
  test_event_code?: string;
  data: Array<{
    event: string;
    event_time: number;
    event_id: string;
    user: Record<string, string>;
    properties: Record<string, unknown>;
    page?: { url: string };
  }>;
}

export type BuildTikTokPayloadResult =
  | {
    suppressed: false;
    eventName: string;
    payload: TikTokEventsApiPayload;
  }
  | {
    suppressed: true;
    reason: string;
    eventName?: string | null;
    payload?: null;
  };

const FORBIDDEN_PAYLOAD_KEYS = new Set([
  "full_json",
  "ocr_text",
  "raw_payload",
  "signed_url",
  "signedUrl",
  "storage_path",
  "quote_file",
]);

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function pickAttributionValue(
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, unknown> | null | undefined,
  key: string,
): string | undefined {
  const fromAttribution = nonEmptyString(attribution?.[key]);
  if (fromAttribution) return fromAttribution;

  const queryValue = queryParams?.[key];
  if (typeof queryValue === "string") {
    return nonEmptyString(queryValue);
  }
  if (Array.isArray(queryValue)) {
    for (const item of queryValue) {
      const candidate = nonEmptyString(item);
      if (candidate) return candidate;
    }
  }

  return undefined;
}

function resolveTtp(
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, unknown> | null | undefined,
): string | undefined {
  return pickAttributionValue(attribution, queryParams, "ttp") ??
    pickAttributionValue(attribution, queryParams, "_ttp");
}

function toUnixSeconds(timestamp: string): number | null {
  const parsed = Date.parse(timestamp);
  if (Number.isNaN(parsed)) return null;
  return Math.floor(parsed / 1000);
}

function buildUserData(
  canonical: WMCanonicalEvent,
  attribution: Record<string, unknown> | null | undefined,
  queryParams: Record<string, unknown> | null | undefined,
): Record<string, string> {
  const identity = canonical.payload.identity;
  const user: Record<string, string> = {};

  if (identity.emailHash) user.email = identity.emailHash;
  if (identity.phoneHash) user.phone = identity.phoneHash;
  if (identity.leadId) user.external_id = identity.leadId;
  if (identity.clientIp) user.ip = identity.clientIp;
  if (identity.userAgent) user.user_agent = identity.userAgent;

  const ttclid = pickAttributionValue(attribution, queryParams, "ttclid");
  const ttp = resolveTtp(attribution, queryParams);
  if (ttclid) user.ttclid = ttclid;
  if (ttp) user.ttp = ttp;

  return user;
}

function buildProperties(
  canonical: WMCanonicalEvent,
  mappedEventName: string,
  includeValue: boolean,
): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    content_type: "product",
    event_name_internal: canonical.eventName,
    tiktok_event_name: mappedEventName,
  };

  if (includeValue) {
    const valueUsd = canonical.payload.optimization?.valueUsd;
    if (typeof valueUsd === "number" && Number.isFinite(valueUsd) && valueUsd > 0) {
      properties.value = valueUsd;
      properties.currency = "USD";
    }
  }

  return properties;
}

function containsForbiddenMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenMetadata(item));
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_PAYLOAD_KEYS.has(key)) return true;
    if (containsForbiddenMetadata(nested)) return true;
  }

  return false;
}

export function buildTikTokPayload(
  input: BuildTikTokPayloadInput,
): BuildTikTokPayloadResult {
  const { canonical } = input;
  const eventSourceId = nonEmptyString(input.eventSourceId);

  if (!nonEmptyString(canonical.eventId)) {
    return { suppressed: true, reason: "missing_event_id", payload: null };
  }

  if (!eventSourceId) {
    return { suppressed: true, reason: "missing_event_source_id", payload: null };
  }

  const mapped = mapToTikTok(canonical.eventName);
  if (!mapped) {
    return {
      suppressed: true,
      reason: "no_tiktok_mapping",
      eventName: null,
      payload: null,
    };
  }

  const eventTime = toUnixSeconds(canonical.eventTimestamp);
  if (eventTime === null) {
    return {
      suppressed: true,
      reason: "invalid_event_timestamp",
      eventName: mapped.tiktokEventName,
      payload: null,
    };
  }

  const isRevenueEvent = mapped.recommendedOptimizationTier === "revenue";
  if (isRevenueEvent) {
    const valueUsd = canonical.payload.optimization?.valueUsd;
    if (
      typeof valueUsd !== "number" || !Number.isFinite(valueUsd) || valueUsd <= 0
    ) {
      return {
        suppressed: true,
        reason: "missing_revenue_value",
        eventName: mapped.tiktokEventName,
        payload: null,
      };
    }
  }

  const user = buildUserData(
    canonical,
    input.attribution,
    input.queryParams,
  );

  const payload: TikTokEventsApiPayload = {
    event_source: "web",
    event_source_id: eventSourceId,
    data: [
      {
        event: mapped.tiktokEventName,
        event_time: eventTime,
        event_id: canonical.eventId,
        user,
        properties: buildProperties(
          canonical,
          mapped.tiktokEventName,
          isRevenueEvent,
        ),
      },
    ],
  };

  const eventSourceUrl = nonEmptyString(input.eventSourceUrl);
  if (eventSourceUrl) {
    payload.data[0].page = { url: eventSourceUrl };
  }

  const testEventCode = nonEmptyString(input.testEventCode);
  if (testEventCode) {
    payload.test_event_code = testEventCode;
  }

  if (containsForbiddenMetadata(payload)) {
    return {
      suppressed: true,
      reason: "forbidden_metadata",
      eventName: mapped.tiktokEventName,
      payload: null,
    };
  }

  const serialized = JSON.stringify(payload);
  const identity = canonical.payload.identity;
  if (identity.email && serialized.includes(identity.email)) {
    return {
      suppressed: true,
      reason: "raw_pii_detected",
      eventName: mapped.tiktokEventName,
      payload: null,
    };
  }
  if (identity.phone && serialized.includes(identity.phone.replace(/\D/g, ""))) {
    const phoneDigits = identity.phone.replace(/\D/g, "");
    if (phoneDigits.length >= 10 && serialized.includes(phoneDigits)) {
      return {
        suppressed: true,
        reason: "raw_pii_detected",
        eventName: mapped.tiktokEventName,
        payload: null,
      };
    }
  }

  return {
    suppressed: false,
    eventName: mapped.tiktokEventName,
    payload,
  };
}
