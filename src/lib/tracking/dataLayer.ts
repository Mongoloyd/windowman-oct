/**
 * dataLayer.ts — Canonical browser-side dataLayer helpers.
 *
 * All business/funnel events must route through these helpers (never vendor SDKs).
 * Forbidden PII keys are stripped before push.
 */

import { trackGtmEvent } from "@/lib/trackConversion";
import { captureUtmFromUrl, getUtmData, type WmIntent } from "@/lib/useUtmCapture";
import { buildCanonicalEventId } from "@/lib/tracking/canonicalEventId";

const FORBIDDEN_DATALAYER_KEYS = new Set([
  "email",
  "phone",
  "phone_e164",
  "first_name",
  "last_name",
  "name",
  "full_name",
  "visitor_id",
  "lead_id",
  "session_id",
  "scan_session_id",
  "quote_id",
  "report_id",
  "full_json",
  "preview_json",
]);

export const HANDOFF_SOURCE_ROUTE_KEY = "wm_last_handoff_source_route";

const truthGateFiredKeys = new Set<string>();

export type AttributionDataLayerFields = {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  utm_id: string | null;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  ttclid: string | null;
  ndclid: string | null;
  msclkid: string | null;
  wm_intent: WmIntent | null;
  client_slug: string | null;
};

const V3_BUSINESS_EVENT_NAMES = [
  "lead_captured",
  "quote_uploaded",
  "phone_verified",
  "report_revealed",
] as const;

const V3_DIAGNOSTIC_EVENT_NAMES = [
  "wmchat_started",
  "wmchat_step_completed",
  "powerdemo_started",
  "powerdemo_location_submitted",
  "powerdemo_project_selected",
] as const;

const V3_PARAMETER_KEYS = new Set([
  "source_tool",
  "flow_variant",
  "project_type",
  "project_scope",
  "project_stage",
  "service_area_status",
  "window_count_bucket",
  "journey_type",
  "measurement_source",
  "wm_intent",
  "capture_source",
  "handoff_source",
  "step_name",
  "step_index",
  "file_type",
  "cta_location",
]);

const V3_BUSINESS_EVENT_NAME_SET = new Set<string>(V3_BUSINESS_EVENT_NAMES);
const V3_DIAGNOSTIC_EVENT_NAME_SET = new Set<string>(V3_DIAGNOSTIC_EVENT_NAMES);

export type V3BusinessEventName = (typeof V3_BUSINESS_EVENT_NAMES)[number];
export type V3DiagnosticEventName = (typeof V3_DIAGNOSTIC_EVENT_NAMES)[number];

export interface V3DataLayerParameters {
  source_tool?: string | null;
  flow_variant?: string | null;
  project_type?: string | null;
  project_scope?: string | null;
  project_stage?: string | null;
  service_area_status?: string | null;
  window_count_bucket?: string | null;
  journey_type?: string | null;
  measurement_source?: "native" | null;
  wm_intent?: string | null;
  capture_source?: string | null;
  handoff_source?: string | null;
  step_name?: string | null;
  step_index?: number | null;
  file_type?: string | null;
  cta_location?: string | null;
}

export interface V3BusinessEventArgs {
  eventId: string;
  parameters: V3DataLayerParameters;
}

function normalizeWmIntentForDataLayer(intent: WmIntent): WmIntent | null {
  return intent === "unknown" ? null : intent;
}

function readUtmId(queryParams: Record<string, string | string[]>): string | null {
  const raw = queryParams.utm_id;
  if (typeof raw === "string" && raw.trim()) return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].trim()) {
    return raw[0].trim();
  }
  return null;
}

/** Fresh attribution snapshot for dataLayer payloads (no PII). */
export function buildAttributionDataLayerPayload(): AttributionDataLayerFields {
  const data = captureUtmFromUrl();

  return {
    utm_source: data.utm_source,
    utm_medium: data.utm_medium,
    utm_campaign: data.utm_campaign,
    utm_content: data.utm_content,
    utm_term: data.utm_term,
    utm_id: readUtmId(data.query_params),
    gclid: data.gclid,
    gbraid: data.gbraid,
    wbraid: data.wbraid,
    fbclid: data.fbclid,
    ttclid: data.ttclid,
    ndclid: data.ndclid,
    msclkid: data.msclkid,
    wm_intent: normalizeWmIntentForDataLayer(data.wm_intent),
    client_slug: data.client_slug || "direct",
  };
}

function stripForbiddenKeys(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (FORBIDDEN_DATALAYER_KEYS.has(key)) continue;
    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

/** Push a sanitized event object to window.dataLayer via trackGtmEvent. */
export function pushDataLayerEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
): void {
  trackGtmEvent(eventName, stripForbiddenKeys(payload));
}

function sanitizeV3Parameters(
  parameters: V3DataLayerParameters,
): Record<string, string | number | null> {
  if (!parameters || typeof parameters !== "object" || Array.isArray(parameters)) {
    return {};
  }

  const safeParameters: Record<string, string | number | null> = {};

  for (const [key, value] of Object.entries(parameters)) {
    if (!V3_PARAMETER_KEYS.has(key) || value === undefined) continue;

    if (value === null) {
      safeParameters[key] = null;
      continue;
    }

    if (key === "step_index") {
      if (typeof value === "number" && Number.isFinite(value)) {
        safeParameters[key] = value;
      }
      continue;
    }

    if (typeof value !== "string") continue;

    const trimmedValue = value.trim();
    if (!trimmedValue) continue;
    if (key === "measurement_source" && trimmedValue !== "native") continue;

    safeParameters[key] = trimmedValue;
  }

  return safeParameters;
}

/** Push an allowlisted V3 business event with a caller-owned event ID. */
export function pushV3BusinessEvent(
  eventName: V3BusinessEventName,
  args: V3BusinessEventArgs,
): void {
  if (!V3_BUSINESS_EVENT_NAME_SET.has(eventName)) return;
  if (!args || typeof args.eventId !== "string") return;

  const eventId = args.eventId.trim();
  if (!eventId) return;

  pushDataLayerEvent(eventName, {
    ...sanitizeV3Parameters(args.parameters),
    event_id: eventId,
  });
}

/** Push an allowlisted V3 diagnostic event without manufacturing an event ID. */
export function pushV3DiagnosticEvent(
  eventName: V3DiagnosticEventName,
  parameters: V3DataLayerParameters,
): void {
  if (!V3_DIAGNOSTIC_EVENT_NAME_SET.has(eventName)) return;
  pushDataLayerEvent(eventName, sanitizeV3Parameters(parameters));
}

/** Enriched SPA page-view signal for GTM. */
export function pushVirtualPageView(args: {
  page_path: string;
  page_search: string;
}): void {
  if (typeof window === "undefined") return;

  const attribution = buildAttributionDataLayerPayload();

  pushDataLayerEvent("virtual_page_view", {
    page_path: args.page_path,
    page_search: args.page_search,
    page_location: `${window.location.origin}${args.page_path}${args.page_search}`,
    page_title: document.title || null,
    ...attribution,
  });
}

/** Low-intent funnel events (not conversions). */
export function pushLowIntentEvent(
  eventName: string,
  payload: Record<string, unknown> = {},
): void {
  const attribution = buildAttributionDataLayerPayload();
  pushDataLayerEvent(eventName, {
    ...attribution,
    ...payload,
  });
}

/** Read stored handoff source route (set before quote-ready navigation). */
export function readHandoffSourceRoute(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(HANDOFF_SOURCE_ROUTE_KEY);
  } catch {
    return null;
  }
}

/** Fire truth_gate_viewed once per pathname+search+hash session key. */
export function pushTruthGateViewedOnce(args: {
  page_path: string;
  page_search: string;
  page_hash: string;
}): void {
  if (typeof window === "undefined") return;
  if (args.page_hash !== "#truth-gate") return;

  const dedupeKey = `wm_truth_gate_viewed:${args.page_path}${args.page_search}${args.page_hash}`;
  if (truthGateFiredKeys.has(dedupeKey)) return;

  try {
    if (sessionStorage.getItem(dedupeKey) === "1") {
      truthGateFiredKeys.add(dedupeKey);
      return;
    }
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // sessionStorage blocked; in-memory fallback still dedupes this runtime.
  }

  truthGateFiredKeys.add(dedupeKey);

  const attribution = buildAttributionDataLayerPayload();
  const wmIntent =
    attribution.wm_intent ??
    normalizeWmIntentForDataLayer(getUtmData().wm_intent) ??
    null;

  pushDataLayerEvent("truth_gate_viewed", {
    ...attribution,
    page_path: args.page_path,
    page_search: args.page_search,
    page_hash: args.page_hash,
    wm_intent: wmIntent,
    source_route: readHandoffSourceRoute(),
  });
}

// ── Paid lead-magnet funnel events (B2) ─────────────────────────────────────
//
// lead_magnet_captured and lead_magnet_upload_cta_clicked cover the gap
// between a magnet capture (window-price-audit, ai-demo, truth-report,
// window-prices, quote-check) and the existing quote_uploaded event owned by
// UploadZone.tsx. Both fire browser dataLayer only — no CAPI, no vendor SDK
// calls — and must only fire after the backing API call succeeds.

export interface LeadMagnetCapturedArgs {
  /** DB lead id returned by capture-truth-gate-lead (not the anonymous visitor id). */
  leadId: string;
  sessionId: string;
  /** `leads.source` value at capture time (e.g. window_price_audit, google_window_prices). */
  captureSource: string;
  capturePagePath?: string | null;
  capturePageUrl?: string | null;
  clientSlug?: string | null;
}

const leadMagnetCapturedFiredKeys = new Set<string>();

/**
 * Fire lead_magnet_captured once per lead/session, after the capture API
 * returns success with a lead_id. Do not call this on submit start or on a
 * failed/errored response — a failed submit must remain retryable without
 * being treated as already-fired.
 */
export function pushLeadMagnetCaptured(args: LeadMagnetCapturedArgs): void {
  if (typeof window === "undefined") return;

  const dedupeKey = `wm_lmc:${args.leadId}:${args.sessionId}`;
  if (leadMagnetCapturedFiredKeys.has(dedupeKey)) return;

  try {
    if (sessionStorage.getItem(dedupeKey) === "1") {
      leadMagnetCapturedFiredKeys.add(dedupeKey);
      return;
    }
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // sessionStorage blocked; in-memory fallback still dedupes this runtime.
  }

  leadMagnetCapturedFiredKeys.add(dedupeKey);

  const attribution = buildAttributionDataLayerPayload();
  const eventId = buildCanonicalEventId({
    eventName: "lead_magnet_captured",
  });

  pushDataLayerEvent("lead_magnet_captured", {
    ...attribution,
    event_id: eventId,
    capture_source: args.captureSource,
    capture_page_path: args.capturePagePath ?? null,
    capture_page_url: args.capturePageUrl ?? null,
    client_slug: args.clientSlug ?? attribution.client_slug,
  });
}

export interface LeadMagnetUploadCtaClickedArgs {
  leadId: string;
  sessionId: string;
  /** Funnel step this CTA hands off to (e.g. window_prices, quote-check). */
  handoffSource: string;
  captureSource?: string | null;
  destinationUrl: string;
}

const leadMagnetUploadCtaFiredKeys = new Set<string>();

/**
 * Fire lead_magnet_upload_cta_clicked once per lead/session, immediately
 * before the upload-handoff navigation. Also persists handoff_source to
 * sessionStorage as a UI hint for later pages — this is display/analytics
 * context only, never an authorization signal.
 */
export function pushLeadMagnetUploadCtaClicked(
  args: LeadMagnetUploadCtaClickedArgs,
): void {
  if (typeof window === "undefined") return;

  try {
    sessionStorage.setItem(HANDOFF_SOURCE_ROUTE_KEY, args.handoffSource);
  } catch {
    // Best-effort UI hint only; navigation proceeds regardless.
  }

  const dedupeKey = `wm_lmcta:${args.leadId}:${args.sessionId}`;
  if (leadMagnetUploadCtaFiredKeys.has(dedupeKey)) return;

  try {
    if (sessionStorage.getItem(dedupeKey) === "1") {
      leadMagnetUploadCtaFiredKeys.add(dedupeKey);
      return;
    }
    sessionStorage.setItem(dedupeKey, "1");
  } catch {
    // sessionStorage blocked; in-memory fallback still dedupes this runtime.
  }

  leadMagnetUploadCtaFiredKeys.add(dedupeKey);

  const attribution = buildAttributionDataLayerPayload();
  const eventId = buildCanonicalEventId({
    eventName: "lead_magnet_upload_cta_clicked",
  });

  pushDataLayerEvent("lead_magnet_upload_cta_clicked", {
    ...attribution,
    event_id: eventId,
    handoff_source: args.handoffSource,
    capture_source: args.captureSource ?? null,
    destination_url: args.destinationUrl,
  });
}
