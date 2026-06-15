import { supabase } from "@/integrations/supabase/client";
import { evaluatePlatformReadiness } from "@/lib/platformReadinessMatrix";
import { fetchClientPlatformConfigs, maskConfigId } from "@/services/clientPlatformConfigs";

/** Runtime Vite env gate — default off when VITE_NEXTDOOR_CAPI_ENABLED is unset. */
export function readNextdoorShouldSendEnabled(): boolean {
  return import.meta.env.VITE_NEXTDOOR_CAPI_ENABLED === "true";
}

/** Edge canonical lead_captured gate is server-only; admin panel shows env expectation. */
export function readCanonicalLeadCapturedEnabledExpectation(): boolean {
  return false;
}

/** Set false until approved typegen after Step 2 migration apply. */
export const GENERATED_TYPES_INCLUDE_NEXTDOOR = false;

export type NextdoorOverallStatus = "blocked" | "pending_setup" | "unknown";
export type NextdoorDbEnumGateStatus = "pending" | "unknown" | "ready";
export type NextdoorConfigReadinessStatus = "ready" | "warning" | "blocked" | "missing";

export interface NextdoorDispatchCounts {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  failedWithRetryScheduled: number;
  suppressed: number;
  deadLetter: number;
  blocked: number;
  dispatched: number;
  total: number;
}

export interface NextdoorSuppressionReasonCount {
  reason: string;
  count: number;
}

export interface NextdoorLastProviderStatus {
  providerStatus: string | null;
  reason: string | null;
}

export interface NextdoorReadinessState {
  overallStatus: NextdoorOverallStatus;
  shouldSendNextdoorEnabled: boolean;
  canonicalLeadCapturedEnabled: boolean;
  generatedTypesIncludeNextdoor: boolean;
  dbEnumGateStatus: NextdoorDbEnumGateStatus;
  hasNextdoorConfig: boolean;
  activeNextdoorConfigCount: number;
  tokenPresent: boolean;
  datasetIdPresent: boolean;
  pixelIdPresent: boolean;
  dataSourceIdPresent: boolean;
  maskedDataSourceId: string | null;
  configReadinessStatus: NextdoorConfigReadinessStatus;
  dispatchCounts: NextdoorDispatchCounts;
  topSuppressionReasons: NextdoorSuppressionReasonCount[];
  lastProviderStatus: NextdoorLastProviderStatus | null;
  lastAttemptAt: string | null;
  statsAvailable: boolean;
  statsWarning: string | null;
  readOnly: true;
}

export interface NextdoorDispatchLaneStatusResponse {
  available: boolean;
  reason?: string;
  counts: NextdoorDispatchCounts;
  topSuppressionReasons: NextdoorSuppressionReasonCount[];
  lastProviderStatus: NextdoorLastProviderStatus | null;
  lastAttemptAt: string | null;
}

const ZERO_COUNTS: NextdoorDispatchCounts = {
  pending: 0,
  processing: 0,
  sent: 0,
  failed: 0,
  failedWithRetryScheduled: 0,
  suppressed: 0,
  deadLetter: 0,
  blocked: 0,
  dispatched: 0,
  total: 0,
};

const SENSITIVE_SUBSTRINGS = [
  "super-secret",
  "homeowner@",
  "+1561",
  "Bearer ",
  "Authorization:",
  "\"customer\":",
  "\"email\":",
  "\"phone\":",
  "vault-token",
] as const;

function isNextdoorPlatformName(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "nextdoor";
}

export function maskNextdoorDataSourceId(
  datasetId: string | null | undefined,
  pixelId: string | null | undefined,
): string | null {
  const primary = datasetId?.trim() || pixelId?.trim() || null;
  return primary ? maskConfigId(primary) : null;
}

export function deriveConfigReadiness(input: {
  configs: Array<{
    platform_name: unknown;
    is_active?: boolean;
    token_secret_id?: unknown;
    dataset_id?: string | null;
    pixel_id?: string | null;
  }>;
}): Pick<
  NextdoorReadinessState,
  | "hasNextdoorConfig"
  | "activeNextdoorConfigCount"
  | "tokenPresent"
  | "datasetIdPresent"
  | "pixelIdPresent"
  | "dataSourceIdPresent"
  | "maskedDataSourceId"
  | "configReadinessStatus"
> {
  const nextdoorConfigs = input.configs.filter((row) => isNextdoorPlatformName(row.platform_name));
  const activeConfigs = nextdoorConfigs.filter((row) => row.is_active === true);
  const reference = activeConfigs[0] ?? nextdoorConfigs[0];

  if (!reference) {
    return {
      hasNextdoorConfig: false,
      activeNextdoorConfigCount: 0,
      tokenPresent: false,
      datasetIdPresent: false,
      pixelIdPresent: false,
      dataSourceIdPresent: false,
      maskedDataSourceId: null,
      configReadinessStatus: "missing",
    };
  }

  const tokenPresent = Boolean(reference.token_secret_id);
  const datasetIdPresent = Boolean(reference.dataset_id?.trim());
  const pixelIdPresent = Boolean(reference.pixel_id?.trim());
  const dataSourceIdPresent = datasetIdPresent || pixelIdPresent;
  const evaluation = evaluatePlatformReadiness({
    platform_name: "nextdoor",
    is_active: reference.is_active,
    token_present: tokenPresent,
    pixel_id_present: pixelIdPresent,
    dataset_id_present: datasetIdPresent,
    conversion_id_present: false,
    conversion_label_present: false,
    endpoint_url_present: false,
  });

  let configReadinessStatus: NextdoorConfigReadinessStatus = "blocked";
  if (evaluation.ready && reference.is_active === true) {
    configReadinessStatus = "ready";
  } else if (evaluation.destinationReady || tokenPresent) {
    configReadinessStatus = "warning";
  } else if (!evaluation.exactPlatformMatch) {
    configReadinessStatus = "blocked";
  }

  return {
    hasNextdoorConfig: nextdoorConfigs.length > 0,
    activeNextdoorConfigCount: activeConfigs.length,
    tokenPresent,
    datasetIdPresent,
    pixelIdPresent,
    dataSourceIdPresent,
    maskedDataSourceId: maskNextdoorDataSourceId(reference.dataset_id, reference.pixel_id),
    configReadinessStatus,
  };
}

function extractSafeReason(
  errorMessage: string | null | undefined,
  providerBody: unknown,
): string | null {
  const direct = typeof errorMessage === "string" ? errorMessage.trim() : "";
  if (direct) return direct.slice(0, 120);

  if (providerBody && typeof providerBody === "object" && !Array.isArray(providerBody)) {
    const reason = (providerBody as Record<string, unknown>).reason;
    if (typeof reason === "string" && reason.trim()) {
      return reason.trim().slice(0, 120);
    }
  }

  return null;
}

export function aggregateDispatchLaneStatus(
  rows: Array<{
    dispatch_status?: string | null;
    error_message?: string | null;
    provider_response_code?: string | null;
    provider_response_body?: unknown;
    last_attempt_at?: string | null;
    next_attempt_at?: string | null;
  }>,
): Pick<
  NextdoorReadinessState,
  "dispatchCounts" | "topSuppressionReasons" | "lastProviderStatus" | "lastAttemptAt"
> {
  const counts: NextdoorDispatchCounts = { ...ZERO_COUNTS };
  const reasonCounts = new Map<string, number>();
  let lastAttemptAt: string | null = null;
  let lastProviderStatus: NextdoorLastProviderStatus | null = null;

  for (const row of rows) {
    counts.total += 1;
    const status = String(row.dispatch_status ?? "").trim();

    if (status === "pending") counts.pending += 1;
    else if (status === "processing") counts.processing += 1;
    else if (status === "sent") counts.sent += 1;
    else if (status === "failed") {
      counts.failed += 1;
      if (row.next_attempt_at) counts.failedWithRetryScheduled += 1;
    } else if (status === "suppressed") counts.suppressed += 1;
    else if (status === "dead_letter") counts.deadLetter += 1;
    else if (status === "blocked") counts.blocked += 1;
    else if (status === "dispatched") counts.dispatched += 1;

    if (["suppressed", "failed", "dead_letter", "blocked"].includes(status)) {
      const reason = extractSafeReason(row.error_message, row.provider_response_body);
      if (reason) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
      }
    }

    const attemptAt = row.last_attempt_at ?? null;
    if (attemptAt && (!lastAttemptAt || new Date(attemptAt).getTime() > new Date(lastAttemptAt).getTime())) {
      lastAttemptAt = attemptAt;
      lastProviderStatus = {
        providerStatus: row.provider_response_code?.trim() || null,
        reason: extractSafeReason(row.error_message, row.provider_response_body),
      };
    }
  }

  const topSuppressionReasons = [...reasonCounts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  return {
    dispatchCounts: counts,
    topSuppressionReasons,
    lastProviderStatus,
    lastAttemptAt,
  };
}

export function deriveOverallStatus(input: {
  shouldSendNextdoorEnabled: boolean;
  canonicalLeadCapturedEnabled: boolean;
  hasNextdoorConfig: boolean;
  configReadinessStatus: NextdoorConfigReadinessStatus;
}): NextdoorOverallStatus {
  if (!input.shouldSendNextdoorEnabled || !input.canonicalLeadCapturedEnabled) {
    return "blocked";
  }

  if (!input.hasNextdoorConfig || input.configReadinessStatus === "missing") {
    return "pending_setup";
  }

  return "unknown";
}

export function buildNextdoorReadinessState(input: {
  configs: Array<{
    platform_name: unknown;
    is_active?: boolean;
    token_secret_id?: unknown;
    dataset_id?: string | null;
    pixel_id?: string | null;
  }>;
  dispatchLane?: NextdoorDispatchLaneStatusResponse | null;
}): NextdoorReadinessState {
  const config = deriveConfigReadiness({ configs: input.configs });
  const lane = input.dispatchLane;

  const dispatchCounts = lane?.counts ?? { ...ZERO_COUNTS };
  const topSuppressionReasons = lane?.topSuppressionReasons ?? [];
  const lastProviderStatus = lane?.lastProviderStatus ?? null;
  const lastAttemptAt = lane?.lastAttemptAt ?? null;

  let dbEnumGateStatus: NextdoorDbEnumGateStatus = GENERATED_TYPES_INCLUDE_NEXTDOOR ? "ready" : "pending";
  let statsAvailable = Boolean(lane?.available);
  let statsWarning: string | null = null;

  if (!lane) {
    statsAvailable = false;
    statsWarning = "Dispatch lane stats unavailable (admin-data not queried).";
  } else if (!lane.available) {
    statsAvailable = false;
    statsWarning = lane.reason === "nextdoor_enum_not_applied"
      ? "DB enum gate pending: Step 2 migration not applied."
      : lane.reason === "invalid_action"
        ? "admin-data action not deployed yet; showing zero dispatch stats."
        : "Dispatch lane stats unavailable; showing zero counts.";
    dbEnumGateStatus = lane.reason === "nextdoor_enum_not_applied" ? "pending" : "unknown";
  } else {
    dbEnumGateStatus = GENERATED_TYPES_INCLUDE_NEXTDOOR ? "ready" : "pending";
  }

  const shouldSendEnabled = readNextdoorShouldSendEnabled();
  const canonicalLeadCapturedEnabled = readCanonicalLeadCapturedEnabledExpectation();

  const overallStatus = deriveOverallStatus({
    shouldSendNextdoorEnabled: shouldSendEnabled,
    canonicalLeadCapturedEnabled,
    hasNextdoorConfig: config.hasNextdoorConfig,
    configReadinessStatus: config.configReadinessStatus,
  });

  return {
    overallStatus,
    shouldSendNextdoorEnabled: shouldSendEnabled,
    canonicalLeadCapturedEnabled,
    generatedTypesIncludeNextdoor: GENERATED_TYPES_INCLUDE_NEXTDOOR,
    dbEnumGateStatus,
    ...config,
    dispatchCounts,
    topSuppressionReasons,
    lastProviderStatus,
    lastAttemptAt,
    statsAvailable,
    statsWarning,
    readOnly: true,
  };
}

export function containsSensitiveNextdoorReadinessPayload(value: unknown): boolean {
  const serialized = JSON.stringify(value).toLowerCase();
  return SENSITIVE_SUBSTRINGS.some((needle) => serialized.includes(needle.toLowerCase()));
}

async function fetchDispatchLaneStatus(): Promise<NextdoorDispatchLaneStatusResponse> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      available: false,
      reason: "auth_unavailable",
      counts: { ...ZERO_COUNTS },
      topSuppressionReasons: [],
      lastProviderStatus: null,
      lastAttemptAt: null,
    };
  }

  const invokeResult = await supabase.functions.invoke("admin-data", {
    body: { action: "get_nextdoor_dispatch_lane_status", payload: {} },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (invokeResult.error) {
    return {
      available: false,
      reason: "admin_data_invoke_failed",
      counts: { ...ZERO_COUNTS },
      topSuppressionReasons: [],
      lastProviderStatus: null,
      lastAttemptAt: null,
    };
  }

  const envelope = invokeResult.data as { data?: NextdoorDispatchLaneStatusResponse; error?: { code?: string } } | null;
  const payload = envelope?.data;

  if (!payload) {
    const code = envelope?.error?.code;
    return {
      available: false,
      reason: code === "invalid_action" ? "invalid_action" : "admin_data_empty_response",
      counts: { ...ZERO_COUNTS },
      topSuppressionReasons: [],
      lastProviderStatus: null,
      lastAttemptAt: null,
    };
  }

  return {
    available: Boolean(payload.available),
    reason: payload.reason,
    counts: { ...ZERO_COUNTS, ...(payload.counts ?? {}) },
    topSuppressionReasons: Array.isArray(payload.topSuppressionReasons) ? payload.topSuppressionReasons : [],
    lastProviderStatus: payload.lastProviderStatus ?? null,
    lastAttemptAt: payload.lastAttemptAt ?? null,
  };
}

export async function fetchNextdoorReadiness(): Promise<NextdoorReadinessState> {
  let configs: Array<{
    platform_name: unknown;
    is_active?: boolean;
    token_secret_id?: unknown;
    dataset_id?: string | null;
    pixel_id?: string | null;
  }> = [];

  try {
    const result = await fetchClientPlatformConfigs();
    configs = result.configs ?? [];
  } catch {
    configs = [];
  }

  let dispatchLane: NextdoorDispatchLaneStatusResponse | null = null;
  try {
    dispatchLane = await fetchDispatchLaneStatus();
  } catch {
    dispatchLane = {
      available: false,
      reason: "dispatch_lane_fetch_failed",
      counts: { ...ZERO_COUNTS },
      topSuppressionReasons: [],
      lastProviderStatus: null,
      lastAttemptAt: null,
    };
  }

  return buildNextdoorReadinessState({ configs, dispatchLane });
}
