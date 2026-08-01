/**
 * OpenAI Ads Conversions API adapter for server-confirmed TruthGate leads.
 *
 * This module is server-only. It never accepts an event name from the browser,
 * never exposes credentials, and never sends raw email, phone, or external IDs.
 */

import { isAllowedOrigin } from "./cors.ts";

export const OPENAI_ADS_CAPI_ENDPOINT = "https://bzr.openai.com/v1/events";
export const OPENAI_ADS_CAPI_TIMEOUT_MS = 2500;

const MAX_OPAQUE_REFERENCE_LENGTH = 2048;
const MAX_SOURCE_URL_LENGTH = 2048;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface OpenAiAdsClientContext {
  measurementConsent: true;
  sourceUrl: string | null;
  oppref?: string;
  obref?: string;
}

export interface OpenAiAdsLeadCreatedInput {
  eventId: string;
  timestampMs: number;
  email: string;
  context: OpenAiAdsClientContext;
  requestOrigin: string | null;
  canonicalSiteOrigin: string | null;
  ipAddress: string | null;
  userAgent: string | null;
}

export interface OpenAiAdsLeadCreatedEvent {
  id: string;
  type: "lead_created";
  timestamp_ms: number;
  source_url: string;
  action_source: "web";
  oppref?: string;
  user: {
    email_sha256: string;
    obref?: string;
    ip_address?: string;
    user_agent?: string;
  };
  data: {
    type: "customer_action";
  };
}

export interface OpenAiAdsConversionsRequest {
  validate_only: false;
  events: [OpenAiAdsLeadCreatedEvent];
}

export interface OpenAiAdsRuntimeConfig {
  pixelId: string | null;
  apiKey: string | null;
  canonicalSiteOrigin: string | null;
}

export type OpenAiAdsDispatchResult =
  | { ok: true; providerStatus: number }
  | {
    ok: false;
    reason:
      | "not_configured"
      | "invalid_event"
      | "invalid_source_url"
      | "provider_error"
      | "network_error";
    providerStatus?: number;
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || value.length > maxLength) return null;
  return value;
}

function opaqueReference(value: unknown): string | undefined {
  return boundedString(value, MAX_OPAQUE_REFERENCE_LENGTH) ?? undefined;
}

/** Keep every server-only OpenAI Ads env lookup inside the CAPI adapter. */
export function readOpenAiAdsRuntimeConfig(
  getEnv: (name: string) => string | undefined,
): OpenAiAdsRuntimeConfig {
  return {
    pixelId: getEnv("OPENAI_ADS_PIXEL_ID") ?? null,
    apiKey: getEnv("OPENAI_ADS_CONVERSIONS_API_KEY") ?? null,
    canonicalSiteOrigin: getEnv("OPENAI_ADS_SITE_ORIGIN") ?? null,
  };
}

/** Parse only the optional, consent-gated OpenAI context from a lead request. */
export function parseOpenAiAdsClientContext(
  requestBody: unknown,
): OpenAiAdsClientContext | null {
  if (!isRecord(requestBody) || !isRecord(requestBody.openai_ads)) return null;
  const input = requestBody.openai_ads;
  if (input.measurementConsent !== true) return null;
  const oppref = opaqueReference(input.oppref);
  const obref = opaqueReference(input.obref);

  return {
    measurementConsent: true,
    sourceUrl: boundedString(input.sourceUrl, MAX_SOURCE_URL_LENGTH),
    ...(oppref ? { oppref } : {}),
    ...(obref ? { obref } : {}),
  };
}

/** Stable server authority for the paired Pixel+CAPI lead conversion ID. */
export function buildOpenAiAdsLeadEventId(leadId: string): string {
  if (!UUID_RE.test(leadId)) {
    throw new Error(
      "OpenAI Ads lead event requires a valid persisted lead ID.",
    );
  }
  return `wm_openai_lead_created_${leadId}`;
}

function parseHttpUrl(value: string | null | undefined): URL | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/**
 * Use the browser page only when its origin is trusted. The final value always
 * contains HTTP(S) origin + pathname, never query parameters or a fragment.
 */
export function resolveOpenAiAdsSourceUrl(input: {
  browserSourceUrl: string | null;
  requestOrigin: string | null;
  canonicalSiteOrigin: string | null;
}): string | null {
  const canonical = parseHttpUrl(input.canonicalSiteOrigin);
  const request = isAllowedOrigin(input.requestOrigin)
    ? parseHttpUrl(input.requestOrigin)
    : null;
  const trustedOrigins = new Set(
    [canonical?.origin, request?.origin].filter(
      (origin): origin is string => typeof origin === "string",
    ),
  );

  const browser = parseHttpUrl(input.browserSourceUrl);
  if (browser && trustedOrigins.has(browser.origin)) {
    return `${browser.origin}${browser.pathname || "/"}`;
  }

  if (canonical) return `${canonical.origin}/`;
  if (request) return `${request.origin}/`;
  return null;
}

export function extractOpenAiAdsClientIp(headers: Headers): string | null {
  const direct = headers.get("cf-connecting-ip")?.trim();
  if (direct) return direct.slice(0, 128);

  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded.slice(0, 128);

  const realIp = headers.get("x-real-ip")?.trim();
  return realIp ? realIp.slice(0, 128) : null;
}

export async function hashOpenAiAdsEmail(email: string): Promise<string> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("OpenAI Ads email hash requires a value.");

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(normalized),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildOpenAiAdsLeadCreatedRequest(
  input: OpenAiAdsLeadCreatedInput,
): Promise<OpenAiAdsConversionsRequest | null> {
  if (!input.context.measurementConsent) return null;
  if (!Number.isInteger(input.timestampMs) || input.timestampMs <= 0) {
    return null;
  }
  if (!input.eventId.trim()) return null;

  const sourceUrl = resolveOpenAiAdsSourceUrl({
    browserSourceUrl: input.context.sourceUrl,
    requestOrigin: input.requestOrigin,
    canonicalSiteOrigin: input.canonicalSiteOrigin,
  });
  if (!sourceUrl) return null;

  const emailSha256 = await hashOpenAiAdsEmail(input.email);
  const userAgent = boundedString(input.userAgent, 1024);
  const ipAddress = boundedString(input.ipAddress, 128);

  const event: OpenAiAdsLeadCreatedEvent = {
    id: input.eventId,
    type: "lead_created",
    timestamp_ms: input.timestampMs,
    source_url: sourceUrl,
    action_source: "web",
    ...(input.context.oppref ? { oppref: input.context.oppref } : {}),
    user: {
      email_sha256: emailSha256,
      ...(input.context.obref ? { obref: input.context.obref } : {}),
      ...(ipAddress ? { ip_address: ipAddress } : {}),
      ...(userAgent ? { user_agent: userAgent } : {}),
    },
    data: { type: "customer_action" },
  };

  return { validate_only: false, events: [event] };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(`OpenAI Ads request exceeded ${timeoutMs}ms`),
    timeoutMs,
  );

  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function sendOpenAiAdsLeadCreated(
  input: OpenAiAdsLeadCreatedInput & {
    pixelId: string | null;
    apiKey: string | null;
  },
  deps: {
    fetchImpl?: typeof fetch;
    timeoutMs?: number;
  } = {},
): Promise<OpenAiAdsDispatchResult> {
  try {
    const pixelId = boundedString(input.pixelId, 500)?.trim() ?? null;
    const apiKey = boundedString(input.apiKey, 4096)?.trim() ?? null;
    if (!pixelId || !apiKey) return { ok: false, reason: "not_configured" };

    const requestBody = await buildOpenAiAdsLeadCreatedRequest(input);
    if (!requestBody) {
      const sourceUrl = resolveOpenAiAdsSourceUrl({
        browserSourceUrl: input.context.sourceUrl,
        requestOrigin: input.requestOrigin,
        canonicalSiteOrigin: input.canonicalSiteOrigin,
      });
      return {
        ok: false,
        reason: sourceUrl ? "invalid_event" : "invalid_source_url",
      };
    }

    const response = await fetchWithTimeout(
      `${OPENAI_ADS_CAPI_ENDPOINT}?pid=${encodeURIComponent(pixelId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      deps.timeoutMs ?? OPENAI_ADS_CAPI_TIMEOUT_MS,
      deps.fetchImpl ?? fetch,
    );

    if (!response.ok) {
      return {
        ok: false,
        reason: "provider_error",
        providerStatus: response.status,
      };
    }

    return { ok: true, providerStatus: response.status };
  } catch {
    return { ok: false, reason: "network_error" };
  }
}

/** Keep CAPI outside the lead response latency and contain all failures. */
export function scheduleOpenAiAdsConversion(
  eventId: string,
  task: Promise<OpenAiAdsDispatchResult>,
): void {
  const guarded = task
    .then((result) => {
      if (!result.ok) {
        console.warn("[openAiAdsConversions] lead_created dispatch skipped", {
          event_id: eventId,
          reason: result.reason,
          provider_status: result.providerStatus ?? null,
        });
      }
    })
    .catch(() => {
      console.warn("[openAiAdsConversions] lead_created dispatch failed", {
        event_id: eventId,
      });
    });

  const runtime = (
    globalThis as typeof globalThis & {
      EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
    }
  ).EdgeRuntime;

  if (runtime?.waitUntil) {
    runtime.waitUntil(guarded);
  } else {
    void guarded;
  }
}
