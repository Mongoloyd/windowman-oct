/**
 * Nextdoor CAPI routing — config resolution, payload validation, provider dispatch.
 * Internal-only; no Deno.serve() entrypoint.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export const DEFAULT_NEXTDOOR_CAPI_ENDPOINT =
  "https://ads.nextdoor.com/v2/api/conversions/track";
export const DEFAULT_TIMEOUT_MS = 7000;

export interface NextdoorCapiPayload {
  event_name: string;
  event_id: string;
  event_time_epoch: number;
  action_source: "website";
  action_source_url: string;
  data_source_id: string;
  delivery_optimization: boolean;
  customer: Record<string, unknown>;
  custom?: Record<string, unknown>;
}

export interface NextdoorCapiRequest {
  payload: NextdoorCapiPayload;
  client_slug: string;
  verified_client_slug?: string;
  event_id?: string;
  dry_run?: boolean;
}

export interface NextdoorCapiResponse {
  success: boolean;
  degraded?: boolean;
  retryable?: boolean;
  reason?: string;
  provider_status?: number;
  provider_response?: Record<string, unknown>;
  masked_data_source_id?: string | null;
  dry_run?: boolean;
}

export interface NextdoorPlatformConfigRow {
  id: string;
  client_id: string;
  platform_name: string;
  pixel_id: string | null;
  dataset_id: string | null;
  token_secret_id: string | null;
  is_active: boolean;
}

export interface ResolvedNextdoorConfig {
  dataSourceId: string;
  token: string;
  maskedDataSourceId: string;
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

export function resolveTrustedClientSlug(request: NextdoorCapiRequest): string {
  return (request.verified_client_slug ?? request.client_slug).trim();
}

export function validateNextdoorRequestBody(
  body: unknown,
):
  | { ok: true; request: NextdoorCapiRequest }
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
  const eventName = nonEmptyString(payload.event_name);
  const eventId = nonEmptyString(payload.event_id);
  const actionSourceUrl = nonEmptyString(payload.action_source_url);
  const dataSourceId = nonEmptyString(payload.data_source_id);

  if (
    !eventName ||
    !eventId ||
    !actionSourceUrl ||
    !dataSourceId ||
    payload.action_source !== "website" ||
    typeof payload.event_time_epoch !== "number" ||
    !Number.isFinite(payload.event_time_epoch) ||
    typeof payload.delivery_optimization !== "boolean" ||
    !isRecord(payload.customer)
  ) {
    return { ok: false, reason: "invalid_payload" };
  }

  if (payload.custom !== undefined && !isRecord(payload.custom)) {
    return { ok: false, reason: "invalid_payload" };
  }

  const verifiedClientSlug = nonEmptyString(body.verified_client_slug) ?? undefined;
  const auditEventId = nonEmptyString(body.event_id) ?? undefined;

  return {
    ok: true,
    request: {
      payload: {
        event_name: eventName,
        event_id: eventId,
        event_time_epoch: payload.event_time_epoch,
        action_source: "website",
        action_source_url: actionSourceUrl,
        data_source_id: dataSourceId,
        delivery_optimization: payload.delivery_optimization,
        customer: payload.customer,
        ...(payload.custom ? { custom: payload.custom } : {}),
      },
      client_slug: clientSlug,
      verified_client_slug: verifiedClientSlug,
      event_id: auditEventId,
      dry_run: body.dry_run === true,
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
    message.includes("nextdoor") ||
    code === "22p02"
  );
}

function resolveDataSourceIdFromConfig(
  config: Pick<NextdoorPlatformConfigRow, "dataset_id" | "pixel_id">,
): string | null {
  return nonEmptyString(config.dataset_id) ?? nonEmptyString(config.pixel_id);
}

function readEnvFallbackConfig(): ResolvedNextdoorConfig | null {
  const token = nonEmptyString(Deno.env.get("NEXTDOOR_CAPI_TOKEN"));
  const dataSourceId = nonEmptyString(Deno.env.get("NEXTDOOR_DATA_SOURCE_ID"));
  if (!token || !dataSourceId) return null;

  return {
    dataSourceId,
    token,
    maskedDataSourceId: maskSensitiveId(dataSourceId) ?? "…****",
    source: "env_fallback",
  };
}

export async function resolveNextdoorPlatformConfig(
  supabase: SupabaseLike,
  clientSlug: string,
): Promise<
  | { ok: true; config: ResolvedNextdoorConfig }
  | { ok: false; reason: "missing_platform_config" | "missing_token" | "missing_data_source_id" }
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
    .eq("platform_name", "nextdoor")
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

  const typedConfig = platformConfig as unknown as NextdoorPlatformConfigRow;
  const dataSourceId = resolveDataSourceIdFromConfig(typedConfig);
  if (!dataSourceId) {
    return { ok: false, reason: "missing_data_source_id" };
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
      dataSourceId,
      token: token.trim(),
      maskedDataSourceId: maskSensitiveId(dataSourceId) ?? "…****",
      source: "client_platform_config",
    },
  };
}

export function sanitizeProviderResponse(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) {
    return { error: "non_object_provider_response" };
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key.toLowerCase().includes("token")) continue;
    if (key.toLowerCase().includes("customer")) continue;
    if (key.toLowerCase().includes("email")) continue;
    if (key.toLowerCase().includes("phone")) continue;

    if (typeof value === "string") {
      sanitized[key] = value.length > 500 ? `${value.slice(0, 500)}…` : value;
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

export function classifyNextdoorProviderResult(
  status: number,
  providerResponse: Record<string, unknown>,
): NextdoorCapiResponse {
  if (status >= 200 && status < 300) {
    return {
      success: true,
      retryable: false,
      provider_status: status,
      provider_response: providerResponse,
    };
  }

  if (status === 429) {
    return {
      success: false,
      reason: "provider_429",
      retryable: true,
      provider_status: status,
      provider_response: providerResponse,
    };
  }

  if (status >= 500) {
    return {
      success: false,
      reason: "provider_5xx",
      retryable: true,
      provider_status: status,
      provider_response: providerResponse,
    };
  }

  if (status === 400 || status === 401 || status === 403) {
    return {
      success: false,
      reason: "provider_4xx",
      retryable: false,
      provider_status: status,
      provider_response: providerResponse,
    };
  }

  if (status >= 400 && status < 500) {
    return {
      success: false,
      reason: "provider_4xx",
      retryable: false,
      provider_status: status,
      provider_response: providerResponse,
    };
  }

  return {
    success: false,
    reason: "unexpected_error",
    retryable: true,
    provider_status: status,
    provider_response: providerResponse,
  };
}

export function buildOutboundNextdoorPayload(
  payload: NextdoorCapiPayload,
  resolvedDataSourceId: string,
): NextdoorCapiPayload {
  return {
    ...payload,
    data_source_id: resolvedDataSourceId,
  };
}

export function resolveNextdoorEndpointUrl(): string {
  return nonEmptyString(Deno.env.get("NEXTDOOR_CAPI_ENDPOINT_URL")) ??
    DEFAULT_NEXTDOOR_CAPI_ENDPOINT;
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

export function logNextdoorDispatchSafe(fields: Record<string, unknown>): void {
  const allowedKeys = new Set([
    "event_id",
    "event_name",
    "provider_status",
    "masked_data_source_id",
    "reason",
    "dry_run",
    "source",
  ]);

  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (allowedKeys.has(key)) {
      safe[key] = value;
    }
  }

  console.log("[NEXTDOOR:CAPI]", JSON.stringify(safe));
}

export interface ProcessNextdoorRequestDeps {
  supabase: SupabaseLike;
  fetchImpl?: typeof fetch;
  endpointUrl?: string;
  timeoutMs?: number;
}

export async function processAuthorizedNextdoorRequest(
  body: unknown,
  deps: ProcessNextdoorRequestDeps,
): Promise<{ status: number; body: NextdoorCapiResponse }> {
  const validated = validateNextdoorRequestBody(body);
  if (!validated.ok) {
    return {
      status: 400,
      body: { success: false, reason: validated.reason },
    };
  }

  const request = validated.request;
  const clientSlug = resolveTrustedClientSlug(request);
  const auditEventId = request.event_id ?? request.payload.event_id;

  const resolved = await resolveNextdoorPlatformConfig(deps.supabase, clientSlug);
  if (!resolved.ok) {
    logNextdoorDispatchSafe({
      event_id: auditEventId,
      event_name: request.payload.event_name,
      reason: resolved.reason,
    });
    return {
      status: 202,
      body: {
        success: false,
        degraded: true,
        reason: resolved.reason,
      },
    };
  }

  const outboundPayload = buildOutboundNextdoorPayload(
    request.payload,
    resolved.config.dataSourceId,
  );

  if (request.dry_run) {
    logNextdoorDispatchSafe({
      event_id: auditEventId,
      event_name: outboundPayload.event_name,
      masked_data_source_id: resolved.config.maskedDataSourceId,
      dry_run: true,
      source: resolved.config.source,
    });

    return {
      status: 200,
      body: {
        success: true,
        dry_run: true,
        retryable: false,
        masked_data_source_id: resolved.config.maskedDataSourceId,
      },
    };
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const endpointUrl = deps.endpointUrl ?? resolveNextdoorEndpointUrl();

  try {
    const response = await fetchWithTimeout(
      endpointUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resolved.config.token}`,
        },
        body: JSON.stringify(outboundPayload),
      },
      deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      fetchImpl,
    );

    const rawBody = await response.json().catch(() => ({}));
    const providerResponse = sanitizeProviderResponse(rawBody);
    const classified = classifyNextdoorProviderResult(response.status, providerResponse);

    logNextdoorDispatchSafe({
      event_id: auditEventId,
      event_name: outboundPayload.event_name,
      provider_status: response.status,
      masked_data_source_id: resolved.config.maskedDataSourceId,
      reason: classified.reason,
      source: resolved.config.source,
    });

    return {
      status: 200,
      body: {
        ...classified,
        masked_data_source_id: resolved.config.maskedDataSourceId,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "network_error";
    logNextdoorDispatchSafe({
      event_id: auditEventId,
      event_name: outboundPayload.event_name,
      masked_data_source_id: resolved.config.maskedDataSourceId,
      reason: "network_error",
    });

    return {
      status: 200,
      body: {
        success: false,
        reason: "network_error",
        retryable: true,
        masked_data_source_id: resolved.config.maskedDataSourceId,
        provider_response: { error: message.slice(0, 200) },
      },
    };
  }
}

export function createNextdoorServiceClient(): SupabaseLike {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  ) as unknown as SupabaseLike;
}
