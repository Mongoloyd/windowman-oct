import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";

export type SignalPlatform = "Meta CAPI" | "Google Ads" | "GTM Server" | "CRM Webhook" | "Internal Lead Event" | "Other";
export type SignalStatus = "success" | "failed" | "pending" | "skipped" | "retryable";

export type CapiDiagnosticCode =
  | "CAPI_ENVELOPE_NOT_OBJECT"
  | "CAPI_DATA_MISSING"
  | "CAPI_DATA_NOT_ARRAY"
  | "CAPI_DATA_EMPTY"
  | "CAPI_EVENT_NOT_OBJECT"
  | "CAPI_USER_DATA_MISSING"
  | "CAPI_USER_DATA_NOT_OBJECT"
  | "CAPI_EMAIL_MISSING"
  | "CAPI_EMAIL_NOT_SHA256"
  | "CAPI_EMAIL_MALFORMED"
  | "CAPI_PHONE_MISSING"
  | "CAPI_PHONE_NOT_SHA256"
  | "CAPI_PHONE_MALFORMED"
  | "CAPI_CLIENT_IP_MISSING"
  | "CAPI_CLIENT_IP_FALLBACK"
  | "CAPI_CLIENT_IP_MALFORMED"
  | "CAPI_CLIENT_UA_MISSING"
  | "CAPI_CLIENT_UA_MALFORMED"
  | "CAPI_FBP_MISSING"
  | "CAPI_FBP_HASHED"
  | "CAPI_FBP_MALFORMED"
  | "CAPI_FBC_MISSING"
  | "CAPI_FBC_HASHED"
  | "CAPI_FBC_MALFORMED"
  | "CAPI_EXTERNAL_ID_MISSING"
  | "CAPI_EXTERNAL_ID_NOT_SHA256"
  | "CAPI_EXTERNAL_ID_MALFORMED"
  | "CAPI_TIME_MISSING"
  | "CAPI_TIME_WRONG_TYPE"
  | "CAPI_TIME_UNSAFE_INTEGER"
  | "CAPI_TIME_WRONG_UNIT"
  | "CAPI_TIME_OUT_OF_RANGE"
  | "CAPI_TIME_REFERENCE_UNAVAILABLE"
  | "CAPI_TIME_STALE"
  | "CAPI_TIME_FUTURE"
  | "CAPI_EVENT_ID_MISSING"
  | "CAPI_EVENT_ID_WRONG_TYPE"
  | "CAPI_EVENT_NAME_MISSING"
  | "CAPI_EVENT_NAME_WRONG_TYPE"
  | "CAPI_EVENT_NAME_LOG_MISMATCH"
  | "CAPI_ACTION_SOURCE_MISSING"
  | "CAPI_ACTION_SOURCE_WRONG_TYPE"
  | "CAPI_ACTION_SOURCE_UNEXPECTED";

export type CapiIdentityStatus = "valid" | "missing" | "not_sha256" | "malformed" | "unavailable";
export type CapiCookieStatus = "valid" | "missing" | "hashed" | "malformed" | "unavailable";
export type CapiPresenceStatus = "valid" | "missing" | "malformed" | "fallback" | "unavailable";

export interface CapiMatchDiagnostics {
  emailHash: CapiIdentityStatus;
  phoneHash: CapiIdentityStatus;
  clientIp: CapiPresenceStatus;
  clientUserAgent: Exclude<CapiPresenceStatus, "fallback">;
  fbp: CapiCookieStatus;
  fbc: CapiCookieStatus;
  externalId: CapiIdentityStatus;
}

export interface CapiDispatchDiagnostics {
  envelope:
    | "valid"
    | "not_object"
    | "data_missing"
    | "data_not_array"
    | "data_empty"
    | "event_not_object"
    | "user_data_missing"
    | "user_data_not_object";
  eventTimeFormat: "valid" | "missing" | "wrong_type" | "unsafe_integer" | "wrong_unit" | "out_of_range" | "unavailable";
  eventTimeDrift: "valid" | "stale" | "future" | "reference_unavailable" | "not_evaluated";
  eventId: "valid" | "missing" | "wrong_type" | "unavailable";
  eventName: "valid" | "missing" | "wrong_type" | "log_mismatch" | "unavailable";
  actionSource: "valid" | "missing" | "wrong_type" | "unexpected" | "unavailable";
}

export interface CapiDiagnostics {
  scorable: boolean;
  reasonCodes: CapiDiagnosticCode[];
  match: CapiMatchDiagnostics;
  dispatch: CapiDispatchDiagnostics;
}

export interface SignalSourceAudit {
  conversionLogs: "available" | "missing" | "empty";
  capiSignalLogs: "available" | "missing" | "empty";
  webhookDeliveries: "available" | "missing" | "empty";
  webhookDeliveryAttempts: "available" | "missing" | "empty";
  leadEvents: "available" | "missing" | "empty";
  notes: string[];
}

export interface SignalEventRow {
  id: string;
  sourceTable: "conversion_logs" | "capi_signal_logs" | "webhook_deliveries" | "webhook_delivery_attempts" | "lead_events";
  timestamp: string;
  platform: SignalPlatform;
  eventType: string;
  leadId: string | null;
  sourceCampaign: string | null;
  eventId: string | null;
  dedupKey: string | null;
  matchKeys: {
    emailHash: boolean;
    phoneHash: boolean;
    fbc: boolean;
    fbp: boolean;
    gclid: boolean;
    externalId: boolean;
    leadId: boolean;
    clientIpPresent: boolean;
    clientUserAgentPresent: boolean;
  };
  capiDiagnostics: CapiDiagnostics | null;
  httpStatus: number | null;
  status: SignalStatus;
  retryStatus: string;
  payloadHash: string | null;
  payloadVersion: string | null;
  payloadSize: number | null;
  responseCode: string | null;
  errorMessage: string | null;
  responseExcerpt: string | null;
  related: {
    deliveryId?: string | null;
    leadEventId?: string | null;
    conversionLogId?: string | null;
    webhookAttemptId?: string | null;
  };
}

interface JsonObject { [key: string]: unknown }

type RawSourceResult<T> = { rows: T[]; state: "available" | "missing" | "empty"; error?: string };

const CapiPayloadEnvelopeSchema = z.object({
  data: z.array(z.unknown()),
}).passthrough();

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;
const MIN_MILLISECOND_LIKE_TIME = 1_000_000_000_000;
const MAX_MILLISECOND_LIKE_TIME = 9_999_999_999_999;

const UNAVAILABLE_MATCH_DIAGNOSTICS: CapiMatchDiagnostics = {
  emailHash: "unavailable",
  phoneHash: "unavailable",
  clientIp: "unavailable",
  clientUserAgent: "unavailable",
  fbp: "unavailable",
  fbc: "unavailable",
  externalId: "unavailable",
};

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getPath(obj: unknown, path: string[]): unknown {
  let current = obj;
  for (const key of path) {
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
}

function hasNonEmptyString(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  return Array.isArray(value) && value.some((item) => typeof item === "string" && item.trim().length > 0);
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value.trim());
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function hasOwn(value: JsonObject, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function pushReason(reasons: CapiDiagnosticCode[], code: CapiDiagnosticCode | null): void {
  if (code && !reasons.includes(code)) reasons.push(code);
}

function classifyHashedIdentity(value: unknown, allowArray: boolean): CapiIdentityStatus {
  if (value == null || value === "") return "missing";

  if (typeof value === "string") {
    if (!value.trim()) return "missing";
    return isSha256Hex(value) ? "valid" : "not_sha256";
  }

  if (Array.isArray(value)) {
    if (!allowArray) return "malformed";
    if (value.length === 0) return "missing";
    if (value.some((entry) => typeof entry !== "string" || !entry.trim())) return "malformed";
    return value.every(isSha256Hex) ? "valid" : "not_sha256";
  }

  return "malformed";
}

function classifyCookieIdentifier(value: unknown): CapiCookieStatus {
  if (value == null) return "missing";
  if (typeof value !== "string") return "malformed";

  const candidate = value.trim();
  if (!candidate) return "missing";
  if (isSha256Hex(candidate)) return "hashed";
  if (candidate.length > 2_048) return "malformed";

  const segments = candidate.split(".");
  if (segments.length < 4 || segments[0] !== "fb" || !/^\d+$/.test(segments[1])) return "malformed";
  if (!/^\d{10,13}$/.test(segments[2])) return "malformed";

  const creationTime = Number(segments[2]);
  if (!Number.isSafeInteger(creationTime) || creationTime < 1_000_000_000) return "malformed";
  return segments.slice(3).join(".").trim().length > 0 ? "valid" : "malformed";
}

function classifyClientIp(value: unknown): CapiPresenceStatus {
  if (value == null || value === "") return "missing";
  if (typeof value !== "string") return "malformed";
  const candidate = value.trim();
  if (!candidate) return "missing";
  return candidate === "0.0.0.0" ? "fallback" : "valid";
}

function classifyUserAgent(value: unknown): Exclude<CapiPresenceStatus, "fallback"> {
  if (value == null || value === "") return "missing";
  if (typeof value !== "string") return "malformed";
  return value.trim() ? "valid" : "missing";
}

function identityReason(
  status: CapiIdentityStatus,
  missing: CapiDiagnosticCode,
  notSha256: CapiDiagnosticCode,
  malformed: CapiDiagnosticCode,
): CapiDiagnosticCode | null {
  if (status === "missing") return missing;
  if (status === "not_sha256") return notSha256;
  if (status === "malformed") return malformed;
  return null;
}

function cookieReason(
  status: CapiCookieStatus,
  missing: CapiDiagnosticCode,
  hashed: CapiDiagnosticCode,
  malformed: CapiDiagnosticCode,
): CapiDiagnosticCode | null {
  if (status === "missing") return missing;
  if (status === "hashed") return hashed;
  if (status === "malformed") return malformed;
  return null;
}

function inspectEnvelope(payload: unknown): {
  envelope: CapiDispatchDiagnostics["envelope"];
  reason: CapiDiagnosticCode | null;
  event: JsonObject | null;
  userData: JsonObject | null;
} {
  if (!isObject(payload)) return { envelope: "not_object", reason: "CAPI_ENVELOPE_NOT_OBJECT", event: null, userData: null };
  if (!hasOwn(payload, "data")) return { envelope: "data_missing", reason: "CAPI_DATA_MISSING", event: null, userData: null };
  if (!Array.isArray(payload.data)) return { envelope: "data_not_array", reason: "CAPI_DATA_NOT_ARRAY", event: null, userData: null };

  const parsed = CapiPayloadEnvelopeSchema.safeParse(payload);
  if (!parsed.success) return { envelope: "data_not_array", reason: "CAPI_DATA_NOT_ARRAY", event: null, userData: null };
  if (parsed.data.data.length === 0) return { envelope: "data_empty", reason: "CAPI_DATA_EMPTY", event: null, userData: null };

  const event = parsed.data.data[0];
  if (!isObject(event)) return { envelope: "event_not_object", reason: "CAPI_EVENT_NOT_OBJECT", event: null, userData: null };
  if (!hasOwn(event, "user_data")) return { envelope: "user_data_missing", reason: "CAPI_USER_DATA_MISSING", event, userData: null };
  if (!isObject(event.user_data)) return { envelope: "user_data_not_object", reason: "CAPI_USER_DATA_NOT_OBJECT", event, userData: null };

  return { envelope: "valid", reason: null, event, userData: event.user_data };
}

function classifyEventTime(value: unknown, firedAt: string): {
  format: CapiDispatchDiagnostics["eventTimeFormat"];
  drift: CapiDispatchDiagnostics["eventTimeDrift"];
  reason: CapiDiagnosticCode | null;
} {
  if (value == null) return { format: "missing", drift: "not_evaluated", reason: "CAPI_TIME_MISSING" };
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { format: "wrong_type", drift: "not_evaluated", reason: "CAPI_TIME_WRONG_TYPE" };
  }
  if (!Number.isInteger(value) || !Number.isSafeInteger(value)) {
    return { format: "unsafe_integer", drift: "not_evaluated", reason: "CAPI_TIME_UNSAFE_INTEGER" };
  }
  if (value < 0) return { format: "out_of_range", drift: "not_evaluated", reason: "CAPI_TIME_OUT_OF_RANGE" };
  if (value >= MIN_MILLISECOND_LIKE_TIME && value <= MAX_MILLISECOND_LIKE_TIME) {
    return { format: "wrong_unit", drift: "not_evaluated", reason: "CAPI_TIME_WRONG_UNIT" };
  }
  if (value > 9_999_999_999) {
    return { format: "out_of_range", drift: "not_evaluated", reason: "CAPI_TIME_OUT_OF_RANGE" };
  }

  const firedAtMilliseconds = Date.parse(firedAt);
  if (!Number.isFinite(firedAtMilliseconds)) {
    return { format: "valid", drift: "reference_unavailable", reason: "CAPI_TIME_REFERENCE_UNAVAILABLE" };
  }

  const firedAtSeconds = Math.floor(firedAtMilliseconds / 1_000);
  if (value > firedAtSeconds) return { format: "valid", drift: "future", reason: "CAPI_TIME_FUTURE" };
  if (firedAtSeconds - value > SEVEN_DAYS_SECONDS) return { format: "valid", drift: "stale", reason: "CAPI_TIME_STALE" };
  return { format: "valid", drift: "valid", reason: null };
}

function classifyRequiredString(value: unknown): "valid" | "missing" | "wrong_type" {
  if (value == null || value === "") return "missing";
  if (typeof value !== "string") return "wrong_type";
  return value.trim() ? "valid" : "missing";
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableFingerprint(value: unknown): string | null {
  if (value == null) return null;
  const text = JSON.stringify(value, Object.keys(flattenForSort(value)).sort());
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ui-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function flattenForSort(value: unknown, out: Record<string, unknown> = {}, prefix = ""): Record<string, unknown> {
  if (!isObject(value)) return out;
  for (const [key, val] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    out[next] = val;
    if (isObject(val)) flattenForSort(val, out, next);
  }
  return out;
}

function payloadSize(value: unknown): number | null {
  if (value == null) return null;
  try {
    return new Blob([JSON.stringify(value)]).size;
  } catch {
    return null;
  }
}

export function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function sanitizeExcerpt(value: unknown): string | null {
  if (value == null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!text) return null;
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b\+?1?[-.\s(]*\d{3}[-.\s)]*\d{3}[-.\s]*\d{4}\b/g, "[redacted-phone]")
    .replace(/(access_token|token|authorization|bearer)\s*[:=]\s*["']?[^\s"'}]+/gi, "$1=[redacted-token]")
    .slice(0, 900);
}

function classifyHttpStatus(status: number | null, fallback: string | null): SignalStatus {
  if (status == null) {
    if (fallback === "pending" || fallback === "processing") return "pending";
    if (fallback === "skipped" || fallback === "unroutable") return "skipped";
    if (fallback === "failed" || fallback === "dead_letter") return fallback === "failed" ? "retryable" : "failed";
    return "pending";
  }
  if (status >= 200 && status < 300) return "success";
  if (status === 429 || status >= 500) return "retryable";
  return "failed";
}

function eventKind(eventName: string | null): string {
  const value = (eventName ?? "custom").toLowerCase();
  if (value.includes("sold") || value.includes("purchase")) return value.includes("sold") ? "Sold Closed" : "Purchase";
  if (value.includes("verified")) return "Verified Lead";
  if (value.includes("lead")) return "Lead";
  return eventName ?? "Custom";
}

function retryText(status: SignalStatus, nextRetryAt?: string | null, attempts?: number | null, maxAttempts?: number | null): string {
  if (status === "retryable") return nextRetryAt ? `Scheduled ${new Date(nextRetryAt).toLocaleString()}` : "Retryable by queue";
  if (status === "pending") return "Queued";
  if (status === "success") return "Complete";
  if (attempts != null && maxAttempts != null && attempts >= maxAttempts) return "Max attempts reached";
  return "Retry unavailable";
}

async function safeSelect<T>(table: string, columns: string, orderColumn: string, limit = 250): Promise<RawSourceResult<T>> {
  const { data, error } = await supabase
    .from(table as never)
    .select(columns)
    .order(orderColumn, { ascending: false })
    .limit(limit);

  if (error) {
    const message = error.message || "Unknown Supabase error";
    const state = /does not exist|Could not find|schema cache/i.test(message) ? "missing" : "missing";
    return { rows: [], state, error: message };
  }

  const rows = (data ?? []) as T[];
  return { rows, state: rows.length > 0 ? "available" : "empty" };
}

export type CapiSignalLogRow = { id: string; fired_at: string; client_slug: string | null; pixel_id: string | null; event_name: string | null; status_code: number | null; payload: unknown; response: unknown };
type WebhookRow = { id: string; created_at: string; updated_at: string; lead_id: string; event_type: string; status: string; attempt_count: number; max_attempts: number; last_http_status: number | null; last_error: string | null; last_attempt_at: string | null; next_retry_at: string | null; client_slug: string | null; payload_json: unknown; webhook_url: string | null; dispatch_method: string | null; no_route_reason: string | null };
type AttemptRow = { id: string; delivery_id: string; lead_id: string; client_slug: string | null; dispatch_method: string; attempt_number: number; request_started_at: string; request_completed_at: string | null; response_status_code: number | null; response_body_snippet: string | null; success: boolean; outcome: string; error_class: string | null; error_message: string | null; destination_snapshot: unknown };
type LeadEventRow = { id: string; created_at: string; lead_id: string; event_name: string; event_id: string | null; event_source: string | null; status: string | null; metadata: unknown };
type ConversionLogRow = { id: string; created_at?: string; fired_at?: string; lead_id?: string | null; event_name?: string | null; event_type?: string | null; event_id?: string | null; platform?: string | null; status?: string | null; status_code?: number | null; http_status?: number | null; payload?: unknown; response?: unknown; metadata?: unknown };

export function rowFromCapi(row: CapiSignalLogRow): SignalEventRow {
  const payload = row.payload;
  const envelope = inspectEnvelope(payload);
  const reasonCodes: CapiDiagnosticCode[] = [];
  pushReason(reasonCodes, envelope.reason);

  const match = envelope.userData ? {
    emailHash: classifyHashedIdentity(envelope.userData.em, true),
    phoneHash: classifyHashedIdentity(envelope.userData.ph, true),
    clientIp: classifyClientIp(envelope.userData.client_ip_address),
    clientUserAgent: classifyUserAgent(envelope.userData.client_user_agent),
    fbp: classifyCookieIdentifier(envelope.userData.fbp),
    fbc: classifyCookieIdentifier(envelope.userData.fbc),
    externalId: classifyHashedIdentity(envelope.userData.external_id, false),
  } satisfies CapiMatchDiagnostics : { ...UNAVAILABLE_MATCH_DIAGNOSTICS };

  if (envelope.userData) {
    pushReason(reasonCodes, identityReason(match.emailHash, "CAPI_EMAIL_MISSING", "CAPI_EMAIL_NOT_SHA256", "CAPI_EMAIL_MALFORMED"));
    pushReason(reasonCodes, identityReason(match.phoneHash, "CAPI_PHONE_MISSING", "CAPI_PHONE_NOT_SHA256", "CAPI_PHONE_MALFORMED"));
    pushReason(reasonCodes, match.clientIp === "missing" ? "CAPI_CLIENT_IP_MISSING" : match.clientIp === "fallback" ? "CAPI_CLIENT_IP_FALLBACK" : match.clientIp === "malformed" ? "CAPI_CLIENT_IP_MALFORMED" : null);
    pushReason(reasonCodes, match.clientUserAgent === "missing" ? "CAPI_CLIENT_UA_MISSING" : match.clientUserAgent === "malformed" ? "CAPI_CLIENT_UA_MALFORMED" : null);
    pushReason(reasonCodes, cookieReason(match.fbp, "CAPI_FBP_MISSING", "CAPI_FBP_HASHED", "CAPI_FBP_MALFORMED"));
    pushReason(reasonCodes, cookieReason(match.fbc, "CAPI_FBC_MISSING", "CAPI_FBC_HASHED", "CAPI_FBC_MALFORMED"));
    pushReason(reasonCodes, identityReason(match.externalId, "CAPI_EXTERNAL_ID_MISSING", "CAPI_EXTERNAL_ID_NOT_SHA256", "CAPI_EXTERNAL_ID_MALFORMED"));
  }

  const eventTime = envelope.event
    ? classifyEventTime(envelope.event.event_time, row.fired_at)
    : { format: "unavailable", drift: "not_evaluated", reason: null } as const;
  pushReason(reasonCodes, eventTime.reason);

  const eventIdValue = envelope.event?.event_id ?? getPath(payload, ["event_id"]);
  const eventIdStatus = envelope.event ? classifyRequiredString(eventIdValue) : "unavailable";
  pushReason(reasonCodes, eventIdStatus === "missing" ? "CAPI_EVENT_ID_MISSING" : eventIdStatus === "wrong_type" ? "CAPI_EVENT_ID_WRONG_TYPE" : null);

  const payloadEventName = envelope.event?.event_name;
  let eventNameStatus: CapiDispatchDiagnostics["eventName"] = "unavailable";
  if (envelope.event) {
    const requiredStatus = classifyRequiredString(payloadEventName);
    eventNameStatus = requiredStatus;
    if (requiredStatus === "valid" && asString(row.event_name) && payloadEventName !== row.event_name) eventNameStatus = "log_mismatch";
  }
  pushReason(reasonCodes, eventNameStatus === "missing" ? "CAPI_EVENT_NAME_MISSING" : eventNameStatus === "wrong_type" ? "CAPI_EVENT_NAME_WRONG_TYPE" : eventNameStatus === "log_mismatch" ? "CAPI_EVENT_NAME_LOG_MISMATCH" : null);

  const actionSourceValue = envelope.event?.action_source;
  let actionSourceStatus: CapiDispatchDiagnostics["actionSource"] = "unavailable";
  if (envelope.event) {
    const requiredStatus = classifyRequiredString(actionSourceValue);
    actionSourceStatus = requiredStatus === "valid" && actionSourceValue !== "website" ? "unexpected" : requiredStatus;
  }
  pushReason(reasonCodes, actionSourceStatus === "missing" ? "CAPI_ACTION_SOURCE_MISSING" : actionSourceStatus === "wrong_type" ? "CAPI_ACTION_SOURCE_WRONG_TYPE" : actionSourceStatus === "unexpected" ? "CAPI_ACTION_SOURCE_UNEXPECTED" : null);

  const eventId = asString(eventIdValue);
  const status = classifyHttpStatus(row.status_code, null);
  return {
    id: `capi:${row.id}`,
    sourceTable: "capi_signal_logs",
    timestamp: row.fired_at,
    platform: "Meta CAPI",
    eventType: eventKind(row.event_name),
    leadId: null,
    sourceCampaign: row.client_slug ?? row.pixel_id ? `client ${row.client_slug ?? "default"} · pixel ${maskId(row.pixel_id)}` : null,
    eventId,
    dedupKey: eventId,
    matchKeys: {
      emailHash: match.emailHash === "valid",
      phoneHash: match.phoneHash === "valid",
      fbc: match.fbc === "valid",
      fbp: match.fbp === "valid",
      gclid: envelope.userData ? hasNonEmptyString(envelope.userData.gclid) : false,
      externalId: match.externalId === "valid",
      leadId: false,
      clientIpPresent: match.clientIp === "valid",
      clientUserAgentPresent: match.clientUserAgent === "valid",
    },
    capiDiagnostics: {
      scorable: envelope.userData !== null,
      reasonCodes,
      match,
      dispatch: {
        envelope: envelope.envelope,
        eventTimeFormat: eventTime.format,
        eventTimeDrift: eventTime.drift,
        eventId: eventIdStatus,
        eventName: eventNameStatus,
        actionSource: actionSourceStatus,
      },
    },
    httpStatus: row.status_code,
    status,
    retryStatus: retryText(status),
    payloadHash: stableFingerprint(payload),
    payloadVersion: asString(getPath(payload, ["version"])) ?? "Meta CAPI payload",
    payloadSize: payloadSize(payload),
    responseCode: asString(getPath(row.response, ["error", "code"])) ?? asString(getPath(row.response, ["code"])),
    errorMessage: asString(getPath(row.response, ["error", "message"])) ?? asString(getPath(row.response, ["message"])),
    responseExcerpt: sanitizeExcerpt(row.response),
    related: { conversionLogId: row.id },
  };
}

function rowFromWebhookDelivery(row: WebhookRow): SignalEventRow {
  const status = classifyHttpStatus(row.last_http_status, row.status);
  const payload = row.payload_json;
  const eventId = asString(getPath(payload, ["event_id"])) ?? asString(getPath(payload, ["eventId"]));
  return {
    id: `webhook:${row.id}`,
    sourceTable: "webhook_deliveries",
    timestamp: row.last_attempt_at ?? row.updated_at ?? row.created_at,
    platform: "CRM Webhook",
    eventType: eventKind(row.event_type),
    leadId: row.lead_id,
    sourceCampaign: row.client_slug,
    eventId,
    dedupKey: eventId ?? `${row.lead_id}:${row.event_type}`,
    matchKeys: {
      emailHash: Boolean(getPath(payload, ["email_hash"]) ?? getPath(payload, ["em"])),
      phoneHash: Boolean(getPath(payload, ["phone_hash"]) ?? getPath(payload, ["ph"])),
      fbc: Boolean(getPath(payload, ["fbc"])),
      fbp: Boolean(getPath(payload, ["fbp"])),
      gclid: Boolean(getPath(payload, ["gclid"])),
      externalId: Boolean(getPath(payload, ["external_id"])),
      leadId: Boolean(row.lead_id),
      clientIpPresent: false,
      clientUserAgentPresent: false,
    },
    capiDiagnostics: null,
    httpStatus: row.last_http_status,
    status,
    retryStatus: retryText(status, row.next_retry_at, row.attempt_count, row.max_attempts),
    payloadHash: stableFingerprint(payload),
    payloadVersion: asString(getPath(payload, ["version"])) ?? row.dispatch_method ?? "CRM payload",
    payloadSize: payloadSize(payload),
    responseCode: row.no_route_reason,
    errorMessage: row.last_error,
    responseExcerpt: sanitizeExcerpt(row.last_error),
    related: { deliveryId: row.id },
  };
}

function rowFromAttempt(row: AttemptRow): SignalEventRow {
  const status = row.success ? "success" : classifyHttpStatus(row.response_status_code, row.outcome);
  return {
    id: `attempt:${row.id}`,
    sourceTable: "webhook_delivery_attempts",
    timestamp: row.request_completed_at ?? row.request_started_at,
    platform: row.dispatch_method === "webhook" ? "CRM Webhook" : "Other",
    eventType: `Attempt #${row.attempt_number}`,
    leadId: row.lead_id,
    sourceCampaign: row.client_slug,
    eventId: null,
    dedupKey: row.delivery_id,
    matchKeys: { emailHash: false, phoneHash: false, fbc: false, fbp: false, gclid: false, externalId: false, leadId: Boolean(row.lead_id), clientIpPresent: false, clientUserAgentPresent: false },
    capiDiagnostics: null,
    httpStatus: row.response_status_code,
    status,
    retryStatus: row.success ? "Complete" : row.outcome === "http_5xx" || row.outcome === "timeout" || row.outcome === "network_error" ? "Retryable by queue" : "Retry unavailable",
    payloadHash: stableFingerprint(row.destination_snapshot),
    payloadVersion: row.dispatch_method,
    payloadSize: payloadSize(row.destination_snapshot),
    responseCode: row.error_class ?? row.outcome,
    errorMessage: row.error_message,
    responseExcerpt: sanitizeExcerpt(row.response_body_snippet),
    related: { deliveryId: row.delivery_id, webhookAttemptId: row.id },
  };
}

function rowFromLeadEvent(row: LeadEventRow): SignalEventRow {
  const metadata = row.metadata;
  const status = row.status === "failed" ? "failed" : row.status === "pending" ? "pending" : "success";
  const statusCode = asNumber(getPath(metadata, ["status_code"]));
  return {
    id: `lead-event:${row.id}`,
    sourceTable: "lead_events",
    timestamp: row.created_at,
    platform: "Internal Lead Event",
    eventType: eventKind(row.event_name),
    leadId: row.lead_id,
    sourceCampaign: asString(getPath(metadata, ["client_slug"])) ?? asString(getPath(metadata, ["utm_campaign"])),
    eventId: row.event_id ?? asString(getPath(metadata, ["event_id"])),
    dedupKey: row.event_id ?? asString(getPath(metadata, ["event_id"])),
    matchKeys: {
      emailHash: Boolean(getPath(metadata, ["email_hash_present"])),
      phoneHash: Boolean(getPath(metadata, ["phone_hash_present"])),
      fbc: Boolean(getPath(metadata, ["fbc"])),
      fbp: Boolean(getPath(metadata, ["fbp"])),
      gclid: Boolean(getPath(metadata, ["gclid"])),
      externalId: Boolean(getPath(metadata, ["external_id"])),
      leadId: Boolean(row.lead_id),
      clientIpPresent: false,
      clientUserAgentPresent: false,
    },
    capiDiagnostics: null,
    httpStatus: statusCode,
    status,
    retryStatus: status === "success" ? "Recorded" : "Retry unavailable",
    payloadHash: stableFingerprint(metadata),
    payloadVersion: row.event_source ?? "lead_events",
    payloadSize: payloadSize(metadata),
    responseCode: asString(getPath(metadata, ["delivery_status"])) ?? row.status,
    errorMessage: asString(getPath(metadata, ["error"])) ?? asString(getPath(metadata, ["last_error"])),
    responseExcerpt: sanitizeExcerpt(metadata),
    related: { leadEventId: row.id },
  };
}

function rowFromConversionLog(row: ConversionLogRow): SignalEventRow {
  const timestamp = row.fired_at ?? row.created_at ?? new Date().toISOString();
  const httpStatus = row.status_code ?? row.http_status ?? null;
  const platform = row.platform === "google" ? "Google Ads" : row.platform === "gtm" ? "GTM Server" : row.platform === "meta" ? "Meta CAPI" : "Other";
  const payload = row.payload ?? row.metadata;
  const status = classifyHttpStatus(httpStatus, row.status ?? null);
  return {
    id: `conversion:${row.id}`,
    sourceTable: "conversion_logs",
    timestamp,
    platform,
    eventType: eventKind(row.event_name ?? row.event_type ?? null),
    leadId: row.lead_id ?? asString(getPath(payload, ["lead_id"])) ?? asString(getPath(payload, ["external_id"])),
    sourceCampaign: asString(getPath(payload, ["campaign_name"])) ?? asString(getPath(payload, ["utm_campaign"])),
    eventId: row.event_id ?? asString(getPath(payload, ["event_id"])),
    dedupKey: row.event_id ?? asString(getPath(payload, ["dedup_key"])),
    matchKeys: {
      emailHash: Boolean(getPath(payload, ["email_hash"]) ?? getPath(payload, ["em"])),
      phoneHash: Boolean(getPath(payload, ["phone_hash"]) ?? getPath(payload, ["ph"])),
      fbc: Boolean(getPath(payload, ["fbc"])),
      fbp: Boolean(getPath(payload, ["fbp"])),
      gclid: Boolean(getPath(payload, ["gclid"])),
      externalId: Boolean(getPath(payload, ["external_id"])),
      leadId: Boolean(row.lead_id),
      clientIpPresent: false,
      clientUserAgentPresent: false,
    },
    capiDiagnostics: null,
    httpStatus,
    status,
    retryStatus: retryText(status),
    payloadHash: stableFingerprint(payload),
    payloadVersion: asString(getPath(payload, ["version"])),
    payloadSize: payloadSize(payload),
    responseCode: asString(getPath(row.response, ["code"])),
    errorMessage: asString(getPath(row.response, ["error", "message"])) ?? asString(getPath(row.response, ["message"])),
    responseExcerpt: sanitizeExcerpt(row.response),
    related: { conversionLogId: row.id },
  };
}

export async function fetchSignalDispatchRows(): Promise<{ rows: SignalEventRow[]; audit: SignalSourceAudit }> {
  const [conversionLogs, capiLogs, webhookDeliveries, webhookAttempts, leadEvents] = await Promise.all([
    safeSelect<ConversionLogRow>("conversion_logs", "*", "created_at", 250),
    safeSelect<CapiSignalLogRow>("capi_signal_logs", "id, fired_at, client_slug, pixel_id, event_name, status_code, payload, response", "fired_at", 250),
    safeSelect<WebhookRow>("webhook_deliveries", "id, created_at, updated_at, lead_id, event_type, status, attempt_count, max_attempts, last_http_status, last_error, last_attempt_at, next_retry_at, client_slug, payload_json, webhook_url, dispatch_method, no_route_reason", "created_at", 250),
    safeSelect<AttemptRow>("webhook_delivery_attempts", "id, delivery_id, lead_id, client_slug, dispatch_method, attempt_number, request_started_at, request_completed_at, response_status_code, response_body_snippet, success, outcome, error_class, error_message, destination_snapshot", "request_started_at", 250),
    safeSelect<LeadEventRow>("lead_events", "id, created_at, lead_id, event_name, event_id, event_source, status, metadata", "created_at", 250),
  ]);

  const notes: string[] = [];
  if (conversionLogs.state === "missing") notes.push("conversion_logs table not found; using capi_signal_logs for Meta CAPI dispatch evidence.");
  if (capiLogs.state !== "available") notes.push("No Meta CAPI signal rows found in capi_signal_logs.");
  if (webhookDeliveries.state !== "available") notes.push("No webhook delivery queue rows found.");
  if (webhookAttempts.state !== "available") notes.push("No immutable webhook attempt rows found; HTTP response bodies may be unavailable.");
  if (leadEvents.state !== "available") notes.push("No lead_events audit rows found.");
  notes.push("No Google Ads or GTM Server dispatch log table was detected in the current schema.");

  const rows = [
    ...conversionLogs.rows.map(rowFromConversionLog),
    ...capiLogs.rows.map(rowFromCapi),
    ...webhookDeliveries.rows.map(rowFromWebhookDelivery),
    ...webhookAttempts.rows.map(rowFromAttempt),
    ...leadEvents.rows.map(rowFromLeadEvent),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return {
    rows,
    audit: {
      conversionLogs: conversionLogs.state,
      capiSignalLogs: capiLogs.state,
      webhookDeliveries: webhookDeliveries.state,
      webhookDeliveryAttempts: webhookAttempts.state,
      leadEvents: leadEvents.state,
      notes,
    },
  };
}
