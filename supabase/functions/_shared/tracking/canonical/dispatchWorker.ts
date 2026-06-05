import { mapToGoogle } from "./mapToGoogle.ts";
import { mapToMeta } from "./mapToMeta.ts";
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
  sendToMeta: (payload: Record<string, unknown>) => Promise<VendorSendResult>;
  sendToGoogle: (payload: Record<string, unknown>) => Promise<VendorSendResult>;
  batchSize?: number;
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
    payload: row.event_payload,
    rawPayload: row.event_raw_payload,
  };
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

  const { error: upsertError } = await db.from("wm_platform_dispatch_log").upsert(
    {
      id: row.dispatch_id,
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
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    throw new Error(
      `Failed to upsert ownership-gated dispatch row: ${upsertError.message ?? "unknown"}`,
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

  const { error: upsertError } = await db.from("wm_event_log").upsert(
    {
      id: eventLogId,
      dispatch_status: nextStatus,
      dispatch_attempted_at: nowIso,
    },
    { onConflict: "id" },
  );

  if (upsertError) {
    throw new Error(`Failed to upsert wm_event_log dispatch status: ${upsertError.message ?? "unknown"}`);
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
        };
        sendResult = await deps.sendToMeta(metaPayload);
      }
    } else if (row.platform_name === "google_ads") {
      const mapped = mapToGoogle(canonical);
      if (mapped.suppressed || !mapped.payload) {
        suppressedReason = mapped.reason ?? "google_suppressed";
      } else {
        sendResult = await deps.sendToGoogle(mapped.payload as Record<string, unknown>);
      }
    } else {
      suppressedReason = `unsupported_platform:${row.platform_name}`;
    }

    if (suppressedReason) {
      const { error: upsertError } = await deps.db.from("wm_platform_dispatch_log").upsert(
        {
          id: row.dispatch_id,
          dispatch_status: "suppressed",
          last_attempt_at: currentNowIso,
          next_attempt_at: null,
          provider_response_code: "suppressed",
          provider_response_body: { reason: suppressedReason },
          error_message: suppressedReason,
          attempt_count: row.attempt_count,
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        throw new Error(`Failed to upsert suppressed dispatch row: ${upsertError.message ?? "unknown"}`);
      }

      dirtyEventLogIds.add(row.event_log_id);
      continue;
    }

    if (!sendResult) {
      throw new Error("Dispatch send result missing");
    }

    if (sendResult.ok) {
      const { error: upsertError } = await deps.db.from("wm_platform_dispatch_log").upsert(
        {
          id: row.dispatch_id,
          dispatch_status: "sent",
          last_attempt_at: currentNowIso,
          next_attempt_at: null,
          provider_response_code: sendResult.statusCode ? String(sendResult.statusCode) : "200",
          provider_response_body: {
            response: sendResult.responseBody ?? {},
            request_payload: sendResult.requestPayload ?? {},
          },
          error_message: null,
          attempt_count: row.attempt_count,
        },
        { onConflict: "id" },
      );

      if (upsertError) {
        throw new Error(`Failed to upsert sent dispatch row: ${upsertError.message ?? "unknown"}`);
      }

      dirtyEventLogIds.add(row.event_log_id);
      continue;
    }

    const failure = classifyFailure(sendResult, row.attempt_count, currentNow);

    const { error: failureUpsertError } = await deps.db.from("wm_platform_dispatch_log").upsert(
      {
        id: row.dispatch_id,
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
      },
      { onConflict: "id" },
    );

    if (failureUpsertError) {
      throw new Error(`Failed to upsert failed dispatch row: ${failureUpsertError.message ?? "unknown"}`);
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
