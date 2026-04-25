import { supabase } from "@/integrations/supabase/client";

export type SignalPlatform = "Meta CAPI" | "Google Ads" | "GTM Server" | "CRM Webhook" | "Internal Lead Event" | "Other";
export type SignalStatus = "success" | "failed" | "pending" | "skipped" | "retryable";

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
  };
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

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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
    .replace(/(access_token|token|authorization|bearer)\s*[:=]\s*[\"']?[^\s\"'}]+/gi, "$1=[redacted-token]")
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

type CapiRow = { id: string; fired_at: string; client_slug: string | null; pixel_id: string | null; event_name: string | null; status_code: number | null; payload: unknown; response: unknown };
type WebhookRow = { id: string; created_at: string; updated_at: string; lead_id: string; event_type: string; status: string; attempt_count: number; max_attempts: number; last_http_status: number | null; last_error: string | null; last_attempt_at: string | null; next_retry_at: string | null; client_slug: string | null; payload_json: unknown; webhook_url: string | null; dispatch_method: string | null; no_route_reason: string | null };
type AttemptRow = { id: string; delivery_id: string; lead_id: string; client_slug: string | null; dispatch_method: string; attempt_number: number; request_started_at: string; request_completed_at: string | null; response_status_code: number | null; response_body_snippet: string | null; success: boolean; outcome: string; error_class: string | null; error_message: string | null; destination_snapshot: unknown };
type LeadEventRow = { id: string; created_at: string; lead_id: string; event_name: string; event_id: string | null; event_source: string | null; status: string | null; metadata: unknown };
type ConversionLogRow = { id: string; created_at?: string; fired_at?: string; lead_id?: string | null; event_name?: string | null; event_type?: string | null; event_id?: string | null; platform?: string | null; status?: string | null; status_code?: number | null; http_status?: number | null; payload?: unknown; response?: unknown; metadata?: unknown };

function rowFromCapi(row: CapiRow): SignalEventRow {
  const payload = row.payload;
  const firstEvent = getPath(payload, ["data", "0"]);
  const userData = getPath(firstEvent, ["user_data"]);
  const eventId = asString(getPath(firstEvent, ["event_id"])) ?? asString(getPath(payload, ["event_id"]));
  const externalId = asString(getPath(userData, ["external_id"]));
  const status = classifyHttpStatus(row.status_code, null);
  return {
    id: `capi:${row.id}`,
    sourceTable: "capi_signal_logs",
    timestamp: row.fired_at,
    platform: "Meta CAPI",
    eventType: eventKind(row.event_name),
    leadId: externalId,
    sourceCampaign: row.client_slug ?? row.pixel_id ? `client ${row.client_slug ?? "default"} · pixel ${maskId(row.pixel_id)}` : null,
    eventId,
    dedupKey: eventId,
    matchKeys: {
      emailHash: Boolean(getPath(userData, ["em"])),
      phoneHash: Boolean(getPath(userData, ["ph"])),
      fbc: Boolean(getPath(userData, ["fbc"])),
      fbp: Boolean(getPath(userData, ["fbp"])),
      gclid: Boolean(getPath(userData, ["gclid"])),
      externalId: Boolean(externalId),
      leadId: Boolean(externalId),
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
    },
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
    matchKeys: { emailHash: false, phoneHash: false, fbc: false, fbp: false, gclid: false, externalId: false, leadId: Boolean(row.lead_id) },
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
    },
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
    },
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
    safeSelect<CapiRow>("capi_signal_logs", "id, fired_at, client_slug, pixel_id, event_name, status_code, payload, response", "fired_at", 250),
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
