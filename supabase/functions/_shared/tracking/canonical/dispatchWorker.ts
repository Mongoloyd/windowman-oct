import { buildTikTokPayload } from "./buildTikTokPayload.ts";
import { mapToGoogle } from "./mapToGoogle.ts";
import { mapToMeta } from "./mapToMeta.ts";
import { mapToNextdoor } from "./mapToNextdoor.ts";
import {
  classifyRouteOwnership,
  resolveVerifiedClientSlug,
  type RouteOwnershipResult,
} from "./routeOwnership.ts";
import type { WMCanonicalEvent, WMDispatchStatus, WMPlatformName } from "./types.ts";

const RETRY_DELAYS_MINUTES = [5, 30, 120, 720] as const;
const MAX_ATTEMPTS = RETRY_DELAYS_MINUTES.length + 1;
const LOCK_STALE_MINUTES = 10;
const DEFAULT_VENDOR_TIMEOUT_MS = 7000;

/** Sprint 3C-3: TikTok worker lane is dry-run only until a later live-enable sprint. */
export const TIKTOK_DISPATCH_DRY_RUN_ONLY = true;
export const TIKTOK_DRY_RUN_EVENT_SOURCE_ID = "dry-run-placeholder";

/** Sprint 4E: Google Ads worker lane is dry-run only until a later live-enable sprint. */
export const GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY = true;

export function buildGoogleDryRunDispatchEnvelope(
  payload: Record<string, unknown>,
): { dry_run: true; payload: Record<string, unknown> } {
  if (!GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY) {
    throw new Error("google_live_dispatch_disabled");
  }

  return { dry_run: true, payload };
}

export function buildGoogleDispatchAuthHeaders(
  serviceRoleKey: string,
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${serviceRoleKey}`,
  };
}

export function buildMissingGoogleDispatchUrlResult(
  payload: Record<string, unknown>,
): VendorSendResult {
  return {
    ok: false,
    retryable: false,
    statusCode: 400,
    errorMessage: "GOOGLE_ADS_DISPATCH_URL is not configured",
    responseBody: {
      error: "GOOGLE_ADS_DISPATCH_URL is not configured",
    },
    requestPayload: payload,
  };
}

export function evaluateGoogleDispatchHttpResponse(
  response: { ok: boolean; status: number },
  body: Record<string, unknown>,
  requestPayload: Record<string, unknown>,
): VendorSendResult {
  const ok = response.ok && body?.success === true;

  return {
    ok,
    retryable: !ok && (response.status === 429 || response.status >= 500),
    statusCode: response.status,
    responseBody: body,
    errorMessage: ok ? undefined : JSON.stringify(body),
    requestPayload,
  };
}

export interface EventLogAttributionSnapshot {
  attribution: Record<string, unknown>;
  queryParams: Record<string, unknown>;
}

export interface DispatchRowWithEvent {
  dispatch_id: string;
  event_log_id: string;
  platform_name: WMPlatformName;
  dispatch_status: WMDispatchStatus;
  attempt_count: number;
  event_id: string;
  event_name: string;
  event_timestamp: string;
  event_payload: WMCanonicalEvent["payload"];
  event_raw_payload: Record<string, unknown>;
  event_schema_version: string;
  event_model_version: string | null;
  event_rubric_version: string | null;
  event_identity_quality: WMCanonicalEvent["identityQuality"];
  should_send_meta: boolean;
  should_send_google: boolean;
  event_client_slug?: string | null;
  event_lead_id?: string | null;
  event_scan_session_id?: string | null;
  event_analysis_id?: string | null;
  event_quote_file_id?: string | null;
}

export interface DBLike {
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<{ data: T | null; error: { message?: string } | null }>;
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: string): {
        in(column: string, value: string[]): {
          order(column: string, options?: { ascending?: boolean }): Promise<{
            data: Array<Record<string, unknown>> | null;
            error: { message?: string } | null;
          }>;
        };
        maybeSingle(): Promise<{ data: Record<string, unknown> | null; error: { message?: string } | null }>;
      };
      in(column: string, values: string[]): {
        order(column: string, options?: { ascending?: boolean }): Promise<{
          data: Array<Record<string, unknown>> | null;
          error: { message?: string } | null;
        }>;
      };
    };
    update(payload: Record<string, unknown>): {
      eq(column: string, value: string): Promise<{
        data: unknown;
        error: { message?: string } | null;
      }>;
    };
    upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string }): Promise<{
      data: unknown;
      error: { message?: string } | null;
    }>;
  };
}

export interface VendorSendResult {
  ok: boolean;
  statusCode?: number;
  responseBody?: unknown;
  errorMessage?: string;
  retryable?: boolean;
  requestPayload?: Record<string, unknown>;
}

interface WorkerDeps {
  db: DBLike;
  now?: () => Date;
  metaEventSourceUrl: string;
  nextdoorEventSourceUrl?: string;
  sendToMeta: (payload: Record<string, unknown>) => Promise<VendorSendResult>;
  sendToGoogle: (payload: Record<string, unknown>) => Promise<VendorSendResult>;
  sendToNextdoor?: (request: {
    payload: Record<string, unknown>;
    clientSlug: string;
    verifiedClientSlug?: string;
    eventId: string;
  }) => Promise<VendorSendResult>;
  sendToTikTok?: (request: {
    payload: Record<string, unknown>;
    clientSlug: string;
    verifiedClientSlug?: string;
    eventId: string;
    dry_run: true;
  }) => Promise<VendorSendResult>;
  tiktokEventSourceUrl?: string;
  batchSize?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function fetchAttributionSnapshotsForEventLogs(
  db: DBLike,
  eventLogIds: string[],
): Promise<Map<string, EventLogAttributionSnapshot>> {
  const snapshots = new Map<string, EventLogAttributionSnapshot>();
  const uniqueIds = [...new Set(eventLogIds)];
  if (uniqueIds.length === 0) {
    return snapshots;
  }

  const { data, error } = await db
    .from("wm_event_log")
    .select("id, attribution, query_params")
    .in("id", uniqueIds)
    .order("id", { ascending: true });

  if (error) {
    throw new Error(
      `Failed to load wm_event_log attribution snapshots: ${error.message ?? "unknown"}`,
    );
  }

  for (const row of data ?? []) {
    const id = typeof row.id === "string" ? row.id : null;
    if (!id) continue;

    snapshots.set(id, {
      attribution: isRecord(row.attribution) ? row.attribution : {},
      queryParams: isRecord(row.query_params) ? row.query_params : {},
    });
  }

  return snapshots;
}

function toCanonicalEvent(row: DispatchRowWithEvent): WMCanonicalEvent {
  return {
    eventId: row.event_id,
    eventName: row.event_name as WMCanonicalEvent["eventName"],
    eventTimestamp: row.event_timestamp,
    schemaVersion: row.event_schema_version,
    modelVersion: row.event_model_version ?? undefined,
    rubricVersion: row.event_rubric_version ?? undefined,
    dispatchStatus: row.dispatch_status,
    identityQuality: row.event_identity_quality,
    shouldSendMeta: row.should_send_meta,
    shouldSendGoogle: row.should_send_google,
    shouldSendNextdoor: false,
    payload: row.event_payload,
    rawPayload: row.event_raw_payload,
  };
}

/**
 * Resolve Nextdoor action_source_url from event context before env fallback.
 * Future shouldSendNextdoor enablement must key off attribution signals
 * (utm_source, ndclid, nd_lead_id), not landing path === "/nextdoor".
 */
export function resolveNextdoorActionSourceUrl(
  canonical: WMCanonicalEvent,
  fallbackUrl?: string,
): string | null {
  const metadata = canonical.payload.metadata ?? {};
  const source = canonical.payload.source ?? {};
  const journey = canonical.payload.journey;

  const pick = (value: unknown): string | null => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const current =
    pick(metadata.current_page_url) ??
    pick((source as Record<string, unknown>).current_page_url);
  if (current) return current;

  const landing =
    pick(metadata.landing_page_url) ??
    pick((source as Record<string, unknown>).landing_page_url);
  if (landing) return landing;

  const journeyRoute = pick(journey?.route);
  if (
    journeyRoute &&
    (journeyRoute.startsWith("http://") || journeyRoute.startsWith("https://"))
  ) {
    return journeyRoute;
  }

  return pick(fallbackUrl);
}

function getRetryDelayMs(attemptCount: number): number | null {
  const retryIndex = attemptCount - 1;
  const minutes = RETRY_DELAYS_MINUTES[retryIndex] as number | undefined;
  if (!minutes) return null;
  return minutes * 60 * 1000;
}

function isRetryableStatus(statusCode?: number): boolean {
  if (!statusCode) return false;
  return statusCode === 429 || statusCode >= 500;
}

function classifyFailure(result: VendorSendResult, attemptCount: number, now: Date): {
  nextStatus: WMDispatchStatus;
  nextRetryAt: string | null;
  errorMessage: string;
} {
  const errorMessage = result.errorMessage ?? "Dispatch failed";
  const retryable = result.retryable ?? isRetryableStatus(result.statusCode);

  if (!retryable) {
    return { nextStatus: "dead_letter", nextRetryAt: null, errorMessage };
  }

  const delayMs = getRetryDelayMs(attemptCount);
  if (!delayMs || attemptCount >= MAX_ATTEMPTS) {
    return { nextStatus: "dead_letter", nextRetryAt: null, errorMessage };
  }

  return {
    nextStatus: "failed",
    nextRetryAt: new Date(now.getTime() + delayMs).toISOString(),
    errorMessage,
  };
}

function classifyOwnershipFailure(
  classification: RouteOwnershipResult,
  attemptCount: number,
  now: Date,
): {
  nextStatus: WMDispatchStatus;
  nextRetryAt: string | null;
  errorMessage: string;
} {
  if (classification.reason === "platform_default_not_allowed") {
    return {
      nextStatus: "blocked",
      nextRetryAt: null,
      errorMessage: "platform_default_not_allowed",
    };
  }

  if (attemptCount < 4) {
    const delayMs = getRetryDelayMs(attemptCount);
    const nextRetryAt = delayMs
      ? new Date(now.getTime() + delayMs).toISOString()
      : new Date(now.getTime() + 15 * 60_000).toISOString();

    return {
      nextStatus: "failed",
      nextRetryAt,
      errorMessage: "route_resolution_deferred",
    };
  }

  return {
    nextStatus: "blocked",
    nextRetryAt: null,
    errorMessage: "legacy_ambiguous_owner",
  };
}

function shouldBlockMetaDispatch(classification: RouteOwnershipResult): boolean {
  if (classification.routeClass === "tenant_required" && classification.verifiedClientSlug) {
    return false;
  }

  if (classification.routeClass === "platform_owned") {
    return false;
  }

  return true;
}

async function upsertOwnershipGate(
  db: DBLike,
  row: DispatchRowWithEvent,
  classification: RouteOwnershipResult,
  currentNowIso: string,
  now: Date,
): Promise<void> {
  const failure = classifyOwnershipFailure(classification, row.attempt_count, now);

  const { error: updateError } = await db.from("wm_platform_dispatch_log").update({
    dispatch_status: failure.nextStatus,
    last_attempt_at: currentNowIso,
    next_attempt_at: failure.nextRetryAt,
    provider_response_code: "ownership_gate",
    provider_response_body: {
      reason: failure.errorMessage,
      route_class: classification.routeClass,
      event_name: row.event_name,
      event_log_id: row.event_log_id,
      verified_client_slug: classification.verifiedClientSlug,
    },
    error_message: failure.errorMessage,
    attempt_count: row.attempt_count,
  }).eq("id", row.dispatch_id);

  if (updateError) {
    throw new Error(
      `Failed to update ownership-gated dispatch row: ${updateError.message ?? "unknown"}`,
    );
  }
}

async function syncEventDispatchStatus(db: DBLike, eventLogId: string, nowIso: string): Promise<void> {
  const { data: rows, error } = await db
    .from("wm_platform_dispatch_log")
    .select("dispatch_status")
    .eq("event_log_id", eventLogId)
    .in("dispatch_status", ["pending", "processing", "failed", "sent", "suppressed", "dead_letter", "dispatched", "blocked"])
    .order("dispatch_status", { ascending: true });

  if (error) {
    throw new Error(`Failed to load dispatch statuses: ${error.message ?? "unknown"}`);
  }

  const statuses = (rows ?? [])
    .map((row) => (typeof row.dispatch_status === "string" ? row.dispatch_status : ""))
    .filter(Boolean);

  let nextStatus: WMDispatchStatus = "not_applicable";
  if (statuses.some((status) => status === "dead_letter")) {
    nextStatus = "dead_letter";
  } else if (statuses.some((status) => status === "failed")) {
    nextStatus = "failed";
  } else if (statuses.some((status) => status === "processing")) {
    nextStatus = "processing";
  } else if (statuses.some((status) => status === "pending")) {
    nextStatus = "pending";
  } else if (statuses.length > 0 && statuses.every((status) => status === "suppressed" || status === "blocked")) {
    nextStatus = "suppressed";
  } else if (statuses.length > 0 && statuses.every((status) => status === "sent" || status === "dispatched" || status === "suppressed" || status === "blocked")) {
    nextStatus = "sent";
  }

  const { error: updateError } = await db.from("wm_event_log").update({
    dispatch_status: nextStatus,
    dispatch_attempted_at: nowIso,
  }).eq("id", eventLogId);

  if (updateError) {
    throw new Error(`Failed to update wm_event_log dispatch status: ${updateError.message ?? "unknown"}`);
  }
}

export async function runDispatchWorker(deps: WorkerDeps): Promise<{ processed: number }> {
  const batchSize = deps.batchSize ?? 25;

  const { data: claimedRows, error: claimError } = await deps.db.rpc<DispatchRowWithEvent[]>("wm_claim_dispatch_rows", {
    p_limit: batchSize,
    p_lock_stale_minutes: LOCK_STALE_MINUTES,
  });

  if (claimError) {
    throw new Error(`Failed to claim dispatch rows: ${claimError.message ?? "unknown"}`);
  }

  const rows = claimedRows ?? [];

  const tiktokEventLogIds = rows
    .filter((row) => row.platform_name === "tiktok")
    .map((row) => row.event_log_id);
  const attributionByEventLogId = await fetchAttributionSnapshotsForEventLogs(
    deps.db,
    tiktokEventLogIds,
  );

  // Collect unique event_log_ids that need status sync at the end of the batch.
  const dirtyEventLogIds = new Set<string>();

  for (const row of rows) {
    const currentNow = deps.now?.() ?? new Date();
    const currentNowIso = currentNow.toISOString();
    const canonical = toCanonicalEvent(row);

    if (row.dispatch_status === "sent" || row.dispatch_status === "dispatched") {
      continue;
    }

    let sendResult: VendorSendResult | null = null;
    let suppressedReason: string | null = null;
    let tiktokDryRunDispatch = false;
    let googleDryRunDispatch = false;

    if (row.platform_name === "meta") {
      const resolution = await resolveVerifiedClientSlug(deps.db, {
        eventLogId: row.event_log_id,
        eventClientSlug: row.event_client_slug,
        eventLeadId: row.event_lead_id,
        eventScanSessionId: row.event_scan_session_id,
        eventAnalysisId: row.event_analysis_id,
        eventQuoteFileId: row.event_quote_file_id,
      });

      const classification = classifyRouteOwnership({
        eventName: row.event_name,
        eventClientSlug: resolution.slug,
        eventLeadId: resolution.leadId,
        eventScanSessionId: resolution.scanSessionId,
        eventAnalysisId: resolution.analysisId,
        eventQuoteFileId: resolution.quoteFileId,
        attemptCount: row.attempt_count,
      });

      if (shouldBlockMetaDispatch(classification)) {
        await upsertOwnershipGate(deps.db, row, classification, currentNowIso, currentNow);
        dirtyEventLogIds.add(row.event_log_id);
        continue;
      }

      const mapped = mapToMeta(canonical, deps.metaEventSourceUrl);
      if (mapped.suppressed || !mapped.payload) {
        suppressedReason = mapped.reason ?? "meta_suppressed";
      } else {
        const metaPayload = {
          ...(mapped.payload as Record<string, unknown>),
          client_slug: classification.verifiedClientSlug ?? undefined,
          verified_client_slug: classification.verifiedClientSlug ?? undefined,
          route_class: "tenant_required",
          route_reason: classification.reason,
        };
        sendResult = await deps.sendToMeta(metaPayload);
      }
    } else if (row.platform_name === "google_ads") {
      if (!GOOGLE_ADS_DISPATCH_DRY_RUN_ONLY) {
        suppressedReason = "google_live_dispatch_disabled";
      } else {
        const mapped = mapToGoogle(canonical);
        if (mapped.suppressed || !mapped.payload) {
          suppressedReason = mapped.reason ?? "google_suppressed";
        } else {
          googleDryRunDispatch = true;
          sendResult = await deps.sendToGoogle(mapped.payload as Record<string, unknown>);
        }
      }
    } else if (row.platform_name === "nextdoor") {
      if (!deps.sendToNextdoor) {
        suppressedReason = "nextdoor_sender_not_configured";
      } else {
        const actionSourceUrl = resolveNextdoorActionSourceUrl(
          canonical,
          deps.nextdoorEventSourceUrl,
        );
        if (!actionSourceUrl) {
          suppressedReason = "nextdoor_missing_action_source_url";
        } else {
          const resolution = await resolveVerifiedClientSlug(deps.db, {
            eventLogId: row.event_log_id,
            eventClientSlug: row.event_client_slug,
            eventLeadId: row.event_lead_id,
            eventScanSessionId: row.event_scan_session_id,
            eventAnalysisId: row.event_analysis_id,
            eventQuoteFileId: row.event_quote_file_id,
          });

          if (!resolution.slug) {
            suppressedReason = "nextdoor_missing_client_slug";
          } else {
            const nextdoorCanonical = {
              ...canonical,
              shouldSendNextdoor: true,
            };
            const mapped = mapToNextdoor(
              nextdoorCanonical,
              actionSourceUrl,
              "server_resolved_by_nextdoor_capi_event",
            );

            if (mapped.suppressed || !mapped.payload) {
              suppressedReason = mapped.reason ?? "nextdoor_suppressed";
            } else {
              sendResult = await deps.sendToNextdoor({
                payload: mapped.payload as Record<string, unknown>,
                clientSlug: resolution.slug,
                verifiedClientSlug: resolution.slug,
                eventId: canonical.eventId,
              });
            }
          }
        }
      }
    } else if (row.platform_name === "tiktok") {
      if (!deps.sendToTikTok) {
        suppressedReason = "tiktok_sender_not_configured";
      } else if (!TIKTOK_DISPATCH_DRY_RUN_ONLY) {
        suppressedReason = "tiktok_live_dispatch_disabled";
      } else {
        const resolution = await resolveVerifiedClientSlug(deps.db, {
          eventLogId: row.event_log_id,
          eventClientSlug: row.event_client_slug,
          eventLeadId: row.event_lead_id,
          eventScanSessionId: row.event_scan_session_id,
          eventAnalysisId: row.event_analysis_id,
          eventQuoteFileId: row.event_quote_file_id,
        });

        if (!resolution.slug) {
          suppressedReason = "tiktok_missing_client_slug";
        } else {
          const snapshot = attributionByEventLogId.get(row.event_log_id) ?? {
            attribution: {},
            queryParams: {},
          };
          const mapped = buildTikTokPayload({
            canonical,
            attribution: snapshot.attribution,
            queryParams: snapshot.queryParams,
            eventSourceId: TIKTOK_DRY_RUN_EVENT_SOURCE_ID,
            eventSourceUrl: deps.tiktokEventSourceUrl ?? deps.metaEventSourceUrl,
          });

          if (mapped.suppressed || !mapped.payload) {
            suppressedReason = mapped.reason ?? "tiktok_suppressed";
          } else {
            tiktokDryRunDispatch = true;
            sendResult = await deps.sendToTikTok({
              payload: mapped.payload as Record<string, unknown>,
              clientSlug: resolution.slug,
              verifiedClientSlug: resolution.slug,
              eventId: canonical.eventId,
              dry_run: true,
            });
          }
        }
      }
    } else {
      suppressedReason = `unsupported_platform:${row.platform_name}`;
    }

    if (suppressedReason) {
      const { error: updateError } = await deps.db.from("wm_platform_dispatch_log").update({
        dispatch_status: "suppressed",
        last_attempt_at: currentNowIso,
        next_attempt_at: null,
        provider_response_code: "suppressed",
        provider_response_body: { reason: suppressedReason },
        error_message: suppressedReason,
        attempt_count: row.attempt_count,
      }).eq("id", row.dispatch_id);

      if (updateError) {
        throw new Error(`Failed to update suppressed dispatch row: ${updateError.message ?? "unknown"}`);
      }

      dirtyEventLogIds.add(row.event_log_id);
      continue;
    }

    if (!sendResult) {
      throw new Error("Dispatch send result missing");
    }

    if (sendResult.ok) {
      const { error: updateError } = await deps.db.from("wm_platform_dispatch_log").update({
        dispatch_status: "sent",
        last_attempt_at: currentNowIso,
        next_attempt_at: null,
        provider_response_code: sendResult.statusCode ? String(sendResult.statusCode) : "200",
        provider_response_body: {
          ...(tiktokDryRunDispatch || googleDryRunDispatch ? { dry_run: true } : {}),
          response: sendResult.responseBody ?? {},
          request_payload: sendResult.requestPayload ?? {},
        },
        error_message: null,
        attempt_count: row.attempt_count,
      }).eq("id", row.dispatch_id);

      if (updateError) {
        throw new Error(`Failed to update sent dispatch row: ${updateError.message ?? "unknown"}`);
      }

      dirtyEventLogIds.add(row.event_log_id);
      continue;
    }

    const failure = classifyFailure(sendResult, row.attempt_count, currentNow);

    const { error: failureUpdateError } = await deps.db.from("wm_platform_dispatch_log").update({
      dispatch_status: failure.nextStatus,
      last_attempt_at: currentNowIso,
      next_attempt_at: failure.nextRetryAt,
      provider_response_code: sendResult.statusCode ? String(sendResult.statusCode) : "error",
      provider_response_body: {
        response: sendResult.responseBody ?? {},
        request_payload: sendResult.requestPayload ?? {},
      },
      error_message: failure.errorMessage,
      attempt_count: row.attempt_count,
    }).eq("id", row.dispatch_id);

    if (failureUpdateError) {
      throw new Error(`Failed to update failed dispatch row: ${failureUpdateError.message ?? "unknown"}`);
    }

    dirtyEventLogIds.add(row.event_log_id);
  }

  // Sync parent event status once per unique event_log_id after the batch is done.
  const syncNowIso = (deps.now?.() ?? new Date()).toISOString();
  for (const eventLogId of dirtyEventLogIds) {
    await syncEventDispatchStatus(deps.db, eventLogId, syncNowIso);
  }

  return { processed: rows.length };
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  timeoutMs = DEFAULT_VENDOR_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(`Request exceeded ${timeoutMs}ms timeout`), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}
