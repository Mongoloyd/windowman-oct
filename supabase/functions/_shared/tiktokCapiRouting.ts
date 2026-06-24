/**
 * TikTok Events API routing — config resolution, payload validation, provider dispatch.
 * Internal-only; no Deno.serve() entrypoint.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const DEFAULT_TIKTOK_EVENTS_API_ENDPOINT =
  "https://business-api.tiktok.com/open_api/v1.3/event/track/";
export const DEFAULT_TIMEOUT_MS = 7000;

export interface TikTokEventDataRow {
  event: string;
  event_time: number;
  event_id: string;
  user: Record<string, string>;
  properties?: Record<string, unknown>;
  page?: { url?: string; referrer?: string };
}

export interface TikTokEventsApiPayload {
  event_source: "web";
  event_source_id: string;
  test_event_code?: string;
  data: TikTokEventDataRow[];
}

export interface TikTokCapiRequest {
  payload: TikTokEventsApiPayload;
  client_slug: string;
  verified_client_slug?: string;
  event_id?: string;
  dry_run?: boolean;
  test_event_code?: string | null;
}

export interface TikTokCapiResponse {
  success: boolean;
  degraded?: boolean;
  dry_run?: boolean;
  retryable?: boolean;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  provider_status?: number;
  providerStatus?: number;
  provider_response?: Record<string, unknown>;
  providerResponse?: Record<string, unknown>;
  masked_event_source_id?: string | null;
}

export interface TikTokPlatformConfigRow {
  id: string;
  client_id: string;
  platform_name: string;
  pixel_id: string | null;
  dataset_id: string | null;
  token_secret_id: string | null;
  is_active: boolean;
}

export interface ResolvedTikTokConfig {
  eventSourceId: string;
  token: string;
  maskedEventSourceId: string;
  source: "client_platform_config" | "env_fallback";
}

type SupabaseQueryBuilder = {
  eq(column: string, value: unknown): SupabaseQueryBuilder;
  maybeSingle(): Promise<{
    data: Record<string, unknown> | null;
    error: { message?: string; code?: string } | null;
  }>;
};

export interface SupabaseLike {
  from(table: string): {
    select(columns: string): SupabaseQueryBuilder;
  };
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message?: string; code?: string } | null }>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function maskSensitiveId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 4) return "…****";
  return `…${trimmed.slice(-4)}`;
}

export function maskEventId(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 8) return "…****";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

export function resolveTrustedClientSlug(request: TikTokCapiRequest): string {
  return (request.verified_client_slug ?? request.client_slug).trim();
}

function validateEventDataRow(row: unknown): TikTokEventDataRow | null {
  if (!isRecord(row)) return null;

  const event = nonEmptyString(row.event);
  const eventId = nonEmptyString(row.event_id);
  const eventTime = row.event_time;

  if (
    !event ||
    !eventId ||
    typeof eventTime !== "number" ||
    !Number.isFinite(eventTime) ||
    !isRecord(row.user)
  ) {
    return null;
  }

  const user: Record<string, string> = {};
  for (const [key, value] of Object.entries(row.user)) {
    if (typeof value === "string" && value.trim()) {
      user[key] = value.trim();
    }
  }

  const validated: TikTokEventDataRow = {
    event,
    event_time: eventTime,
    event_id: eventId,
    user,
  };

  if (row.properties !== undefined) {
    if (!isRecord(row.properties)) return null;
    validated.properties = row.properties;
  }

  if (row.page !== undefined) {
    if (!isRecord(row.page)) return null;
    validated.page = {
      ...(nonEmptyString(row.page.url) ? { url: nonEmptyString(row.page.url)! } : {}),
      ...(nonEmptyString(row.page.referrer)
        ? { referrer: nonEmptyString(row.page.referrer)! }
        : {}),
    };
  }

  return validated;
}

export function validateTikTokRequestBody(
  body: unknown,
):
  | { ok: true; request: TikTokCapiRequest }
  | { ok: false; reason: "invalid_payload" } {
  if (!isRecord(body)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const clientSlug = nonEmptyString(body.client_slug);
  if (!clientSlug) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (!isRecord(body.payload)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const payload = body.payload;
  if (payload.event_source !== "web") {
    return { ok: false, reason: "invalid_payload" };
  }

  const eventSourceId = nonEmptyString(payload.event_source_id);
  if (!eventSourceId) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (!Array.isArray(payload.data) || payload.data.length === 0) {
    return { ok: false, reason: "invalid_payload" };
  }

  const data: TikTokEventDataRow[] = [];
  for (const row of payload.data) {
    const validatedRow = validateEventDataRow(row);
    if (!validatedRow) {
      return { ok: false, reason: "invalid_payload" };
    }
    data.push(validatedRow);
  }

  const verifiedClientSlug = nonEmptyString(body.verified_client_slug) ?? undefined;
  const auditEventId = nonEmptyString(body.event_id) ??
    nonEmptyString(data[0]?.event_id) ??
    undefined;
  const requestTestCode = nonEmptyString(body.test_event_code) ??
    nonEmptyString(payload.test_event_code) ??
    undefined;

  return {
    ok: true,
    request: {
      payload: {
        event_source: "web",
        event_source_id: eventSourceId,
        data,
        ...(requestTestCode ? { test_event_code: requestTestCode } : {}),
      },
      client_slug: clientSlug,
      verified_client_slug: verifiedClientSlug,
      event_id: auditEventId,
      dry_run: body.dry_run === true,
      test_event_code: requestTestCode ?? null,
    },
  };
}

function isEnumOrPlatformConfigError(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  const code = (error.code ?? "").toLowerCase();
  return (
    message.includes("invalid input value for enum") ||
    message.includes("wm_platform_name") ||
    message.includes("tiktok") ||
    code === "22p02"
  );
}

function resolveEventSourceIdFromConfig(
  config: Pick<TikTokPlatformConfigRow, "pixel_id" | "dataset_id">,
): string | null {
  return nonEmptyString(config.pixel_id) ?? nonEmptyString(config.dataset_id);
}

function readEnvFallbackConfig(): ResolvedTikTokConfig | null {
  const token = nonEmptyString(Deno.env.get("TIKTOK_ACCESS_TOKEN"));
  const eventSourceId = nonEmptyString(Deno.env.get("TIKTOK_PIXEL_ID")) ??
    nonEmptyString(Deno.env.get("TIKTOK_EVENT_SOURCE_ID"));
  if (!token || !eventSourceId) return null;

  return {
    eventSourceId,
    token,
    maskedEventSourceId: maskSensitiveId(eventSourceId) ?? "…****",
    source: "env_fallback",
  };
}

export async function resolveTikTokPlatformConfig(
  supabase: SupabaseLike,
  clientSlug: string,
): Promise<
  | { ok: true; config: ResolvedTikTokConfig }
  | { ok: false; reason: "missing_platform_config" | "missing_token" | "missing_event_source_id" }
> {
  const { data: client, error: clientError } = await supabase
    .from("clients")
    .select("id")
    .eq("slug", clientSlug)
    .eq("is_active", true)
    .maybeSingle();

  if (clientError || !client?.id) {
    const envFallback = readEnvFallbackConfig();
    if (envFallback) {
      return { ok: true, config: envFallback };
    }
    return { ok: false, reason: "missing_platform_config" };
  }

  const { data: platformConfig, error: configError } = await supabase
    .from("client_platform_configs")
    .select("id, client_id, platform_name, pixel_id, dataset_id, token_secret_id, is_active")
    .eq("client_id", client.id)
    .eq("platform_name", "tiktok")
    .eq("is_active", true)
    .maybeSingle();

  if (configError) {
    if (isEnumOrPlatformConfigError(configError)) {
      const envFallback = readEnvFallbackConfig();
      if (envFallback) {
        return { ok: true, config: envFallback };
      }
      return { ok: false, reason: "missing_platform_config" };
    }
    const envFallback = readEnvFallbackConfig();
    if (envFallback) {
      return { ok: true, config: envFallback };
    }
    return { ok: false, reason: "missing_platform_config" };
  }

  if (!platformConfig) {
    const envFallback = readEnvFallbackConfig();
    if (envFallback) {
      return { ok: true, config: envFallback };
    }
    return { ok: false, reason: "missing_platform_config" };
  }

  const typedConfig = platformConfig as unknown as TikTokPlatformConfigRow;
  const eventSourceId = resolveEventSourceIdFromConfig(typedConfig);
  if (!eventSourceId) {
    return { ok: false, reason: "missing_event_source_id" };
  }

  const secretId = typedConfig.token_secret_id;
  if (!secretId) {
    return { ok: false, reason: "missing_token" };
  }

  const { data: token, error: tokenError } = await supabase.rpc(
    "get_client_capi_token_by_secret_id",
    { p_secret_id: secretId },
  );

  if (tokenError || typeof token !== "string" || !token.trim()) {
    return { ok: false, reason: "missing_token" };
  }

  return {
    ok: true,
    config: {
      eventSourceId,
      token: token.trim(),
      maskedEventSourceId: maskSensitiveId(eventSourceId) ?? "…****",
      source: "client_platform_config",
    },
  };
}

function sanitizeStringValue(value: string): string {
  const lower = value.toLowerCase();
  if (
    lower.includes("token") ||
    lower.includes("secret") ||
    lower.includes("bearer")
  ) {
    return "[redacted]";
  }
  return value.length > 500 ? `${value.slice(0, 500)}…` : value;
}

export function sanitizeProviderResponse(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    return { error: "non_object_provider_response" };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes("token")) continue;
    if (lowerKey.includes("email")) continue;
    if (lowerKey.includes("phone")) continue;
    if (lowerKey === "user" || lowerKey.includes("user_data")) continue;

    if (typeof value === "string") {
      sanitized[key] = sanitizeStringValue(value);
      continue;
    }

    if (typeof value === "number" || typeof value === "boolean" || value === null) {
      sanitized[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      sanitized[key] = value.slice(0, 10);
      continue;
    }

    if (isRecord(value)) {
      sanitized[key] = sanitizeProviderResponse(value);
    }
  }

  return sanitized;
}

export function classifyTikTokProviderResult(
  status: number,
  providerResponse: Record<string, unknown>,
): TikTokCapiResponse {
  const base = {
    provider_status: status,
    providerStatus: status,
    provider_response: providerResponse,
    providerResponse,
  };

  if (status >= 200 && status < 300) {
    return {
      success: true,
      retryable: false,
      ...base,
    };
  }

  if (status === 429) {
    return {
      success: false,
      reason: "provider_429",
      errorCode: "provider_429",
      errorMessage: "provider_429",
      retryable: true,
      ...base,
    };
  }

  if (status >= 500) {
    return {
      success: false,
      reason: "provider_5xx",
      errorCode: "provider_5xx",
      errorMessage: "provider_5xx",
      retryable: true,
      ...base,
    };
  }

  if (status === 400 || status === 401 || status === 403) {
    return {
      success: false,
      reason: "provider_4xx",
      errorCode: "provider_4xx",
      errorMessage: "provider_4xx",
      retryable: false,
      ...base,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      success: false,
      reason: "provider_4xx",
      errorCode: "provider_4xx",
      errorMessage: "provider_4xx",
      retryable: false,
      ...base,
    };
  }

  return {
    success: false,
    reason: "unexpected_error",
    errorCode: "unexpected_error",
    errorMessage: "unexpected_error",
    retryable: true,
    ...base,
  };
}

export function buildOutboundTikTokPayload(
  payload: TikTokEventsApiPayload,
  resolvedEventSourceId: string,
  testEventCode?: string | null,
): TikTokEventsApiPayload {
  const envTestCode = nonEmptyString(Deno.env.get("TIKTOK_TEST_EVENT_CODE"));
  const effectiveTestCode = nonEmptyString(testEventCode) ?? envTestCode ?? undefined;

  return {
    ...payload,
    event_source_id: resolvedEventSourceId,
    ...(effectiveTestCode ? { test_event_code: effectiveTestCode } : {}),
  };
}

export function resolveTikTokEndpointUrl(): string {
  return nonEmptyString(Deno.env.get("TIKTOK_EVENTS_API_ENDPOINT_URL")) ??
    DEFAULT_TIKTOK_EVENTS_API_ENDPOINT;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(`Request exceeded ${timeoutMs}ms timeout`),
    timeoutMs,
  );

  try {
    return await fetchImpl(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export function logTikTokDispatchSafe(fields: Record<string, unknown>): void {
  const allowedKeys = new Set([
    "event_id",
    "event_name",
    "client_slug",
    "provider_status",
    "masked_event_source_id",
    "reason",
    "dry_run",
    "source",
    "request_id",
  ]);

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowedKeys.has(key)) {
      if (key === "event_id" && typeof value === "string") {
        safe[key] = maskEventId(value);
        continue;
      }
      safe[key] = value;
    }
  }

  console.log("[TIKTOK:CAPI]", JSON.stringify(safe));
}

export interface ProcessTikTokRequestDeps {
  supabase: SupabaseLike;
  fetchImpl?: typeof fetch;
  endpointUrl?: string;
  timeoutMs?: number;
}

export async function processAuthorizedTikTokRequest(
  body: unknown,
  deps: ProcessTikTokRequestDeps,
): Promise<{ status: number; body: TikTokCapiResponse }> {
  const validated = validateTikTokRequestBody(body);
  if (!validated.ok) {
    return {
      status: 400,
      body: {
        success: false,
        reason: validated.reason,
        errorCode: validated.reason,
        errorMessage: validated.reason,
      },
    };
  }

  const request = validated.request;
  const clientSlug = resolveTrustedClientSlug(request);
  const auditEventId = request.event_id ?? request.payload.data[0]?.event_id;
  const auditEventName = request.payload.data[0]?.event;

  const resolved = await resolveTikTokPlatformConfig(deps.supabase, clientSlug);
  if (!resolved.ok) {
    logTikTokDispatchSafe({
      event_id: auditEventId,
      event_name: auditEventName,
      client_slug: clientSlug,
      reason: resolved.reason,
    });
    return {
      status: 202,
      body: {
        success: false,
        degraded: true,
        reason: resolved.reason,
        errorCode: resolved.reason,
        errorMessage: resolved.reason,
      },
    };
  }

  const outboundPayload = buildOutboundTikTokPayload(
    request.payload,
    resolved.config.eventSourceId,
    request.test_event_code,
  );

  if (request.dry_run) {
    logTikTokDispatchSafe({
      event_id: auditEventId,
      event_name: auditEventName,
      client_slug: clientSlug,
      masked_event_source_id: resolved.config.maskedEventSourceId,
      dry_run: true,
      source: resolved.config.source,
    });

    return {
      status: 200,
      body: {
        success: true,
        dry_run: true,
        retryable: false,
        masked_event_source_id: resolved.config.maskedEventSourceId,
      },
    };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const endpointUrl = deps.endpointUrl ?? resolveTikTokEndpointUrl();

  try {
    const response = await fetchWithTimeout(
      endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Access-Token": resolved.config.token,
        },
        body: JSON.stringify(outboundPayload),
      },
      deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetchImpl,
    );

    const rawBody = await response.json().catch(() => ({}));
    const providerResponse = sanitizeProviderResponse(rawBody);
    const classified = classifyTikTokProviderResult(response.status, providerResponse);
    const requestId = nonEmptyString(providerResponse.request_id);

    logTikTokDispatchSafe({
      event_id: auditEventId,
      event_name: auditEventName,
      client_slug: clientSlug,
      provider_status: response.status,
      masked_event_source_id: resolved.config.maskedEventSourceId,
      reason: classified.reason,
      source: resolved.config.source,
      ...(requestId ? { request_id: requestId } : {}),
    });

    return {
      status: 200,
      body: {
        ...classified,
        masked_event_source_id: resolved.config.maskedEventSourceId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network_error";
    logTikTokDispatchSafe({
      event_id: auditEventId,
      event_name: auditEventName,
      client_slug: clientSlug,
      masked_event_source_id: resolved.config.maskedEventSourceId,
      reason: "network_error",
    });

    return {
      status: 200,
      body: {
        success: false,
        reason: "network_error",
        errorCode: "network_error",
        errorMessage: message.slice(0, 200),
        retryable: true,
        masked_event_source_id: resolved.config.maskedEventSourceId,
        provider_response: { error: message.slice(0, 200) },
        providerResponse: { error: message.slice(0, 200) },
      },
    };
  }
}

export function createTikTokServiceClient(): SupabaseLike {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  ) as unknown as SupabaseLike;
}
