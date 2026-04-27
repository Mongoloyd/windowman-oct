import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";
import { maskDispatchId, type DispatchOutboxRow } from "@/services/dispatchOutbox";

export type AttemptSimulationMode = "preview_attempt" | "simulate_attempt" | "simulate_selected";
export type DispatchAttemptStatus = "simulated" | "failed_preflight" | "blocked_by_gate";

export interface DispatchAttemptRow {
  id: string;
  outboxId: string;
  createdAt: string;
  attemptNumber: number;
  dryRun: boolean;
  status: DispatchAttemptStatus | string;
  requestPayloadHash: string | null;
  redactedRequestSnapshot: Record<string, unknown>;
  responseStatusCode: number | null;
  responseExcerpt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  metadata: Record<string, unknown>;
  outbox?: Pick<DispatchOutboxRow, "id" | "clientSlug" | "platformName" | "idempotencyKey" | "dryRunOnly" | "sendEnabled" | "lifecycleStatus" | "eligibilityStatus" | "attemptCount"> | null;
}

export interface AttemptSimulationRequest {
  mode: AttemptSimulationMode;
  outbox_id?: string;
  outbox_ids?: string[];
  confirmation?: string;
}

export interface AttemptSimulationResultItem {
  outbox_id: string;
  outbox_id_masked: string | null;
  platform_name: string | null;
  client_slug: string | null;
  attempt_number: number | null;
  status: DispatchAttemptStatus;
  request_payload_hash: string | null;
  request_payload_hash_short: string | null;
  redacted_request_snapshot: Record<string, unknown> | null;
  response_status_code: null;
  response_excerpt: null;
  error_code: string | null;
  error_message: string | null;
  reasons: string[];
  dry_run: true;
  external_apis_called: false;
  attempts_written: boolean;
}

export interface AttemptSimulationResult {
  ok: boolean;
  mode: AttemptSimulationMode;
  preview_only: boolean;
  dry_run_only: true;
  external_apis_called: false;
  response_status_codes_written: false;
  outbox_rows_updated: false;
  attempts_written: boolean;
  summary: {
    outbox_rows_considered: number;
    simulated: number;
    failed_preflight: number;
    blocked_by_gate: number;
    attempts_written: number;
    response_status_codes_written: number;
    external_apis_called: number;
    outbox_rows_updated: number;
  };
  items: AttemptSimulationResultItem[];
}

export interface DispatchAttemptReconciliationResult {
  outboxRows: DispatchOutboxRow[];
  attempts: DispatchAttemptRow[];
  kpis: {
    outboxRows: number;
    simulatedAttempts: number;
    failedPreflight: number;
    blockedByGate: number;
    attemptsWithResponseStatus: number;
    externalCallsMade: number;
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function mapAttempt(row: Record<string, any>): DispatchAttemptRow {
  const outbox = row.platform_dispatch_outbox ? toRecord(row.platform_dispatch_outbox) : null;
  return {
    id: row.id,
    outboxId: row.outbox_id,
    createdAt: row.created_at,
    attemptNumber: row.attempt_number ?? 0,
    dryRun: Boolean(row.dry_run),
    status: row.status,
    requestPayloadHash: row.request_payload_hash ?? null,
    redactedRequestSnapshot: toRecord(row.redacted_request_snapshot),
    responseStatusCode: row.response_status_code ?? null,
    responseExcerpt: row.response_excerpt ?? null,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
    metadata: toRecord(row.metadata),
    outbox: outbox ? {
      id: String(outbox.id),
      clientSlug: String(outbox.client_slug ?? ""),
      platformName: String(outbox.platform_name ?? ""),
      idempotencyKey: String(outbox.idempotency_key ?? ""),
      dryRunOnly: Boolean(outbox.dry_run_only),
      sendEnabled: Boolean(outbox.send_enabled),
      lifecycleStatus: String(outbox.lifecycle_status ?? ""),
      eligibilityStatus: String(outbox.eligibility_status ?? "") as DispatchOutboxRow["eligibilityStatus"],
      attemptCount: Number(outbox.attempt_count ?? 0),
    } : null,
  };
}

function mapOutbox(row: Record<string, any>): DispatchOutboxRow {
  return {
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canonicalEventLogId: row.canonical_event_log_id,
    canonicalEventId: row.canonical_event_id ?? null,
    canonicalEventName: row.canonical_event_name,
    canonicalEventTimestamp: row.canonical_event_timestamp ?? null,
    clientId: row.client_id ?? null,
    clientSlug: row.client_slug,
    platformConfigId: row.platform_config_id,
    platformName: row.platform_name,
    dispatchEventName: row.dispatch_event_name,
    mapperVersion: row.mapper_version,
    payloadVersion: row.payload_version,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash ?? null,
    redactedPayloadSnapshot: toRecord(row.redacted_payload_snapshot),
    eligibilityStatus: row.eligibility_status,
    eligibilityReasons: Array.isArray(row.eligibility_reasons) ? row.eligibility_reasons : [],
    readinessStatus: row.readiness_status ?? null,
    dryRunOnly: Boolean(row.dry_run_only),
    sendEnabled: Boolean(row.send_enabled),
    eligibilityVersion: row.eligibility_version,
    candidateFingerprint: row.candidate_fingerprint,
    decisionSnapshot: toRecord(row.decision_snapshot),
    valueUsd: row.value_usd == null ? null : Number(row.value_usd),
    currency: row.currency ?? "USD",
    valueBasis: row.value_basis ?? null,
    trueMarginAvailable: row.true_margin_available ?? null,
    attributionStrength: row.attribution_strength ?? null,
    tokenPresent: Boolean(row.token_present),
    destinationPresent: Boolean(row.destination_present),
    configState: row.config_state ?? null,
    validationStatus: row.validation_status ?? null,
    lifecycleStatus: row.lifecycle_status,
    attemptCount: row.attempt_count ?? 0,
    maxAttempts: row.max_attempts ?? 0,
    nextAttemptAt: row.next_attempt_at ?? null,
    lockedAt: row.locked_at ?? null,
    lockedBy: row.locked_by ?? null,
    sentAt: row.sent_at ?? null,
    externalEventId: row.external_event_id ?? null,
    lastError: row.last_error ?? null,
    metadata: toRecord(row.metadata),
  };
}

export function shortHash(value: string | null | undefined): string {
  if (!value) return "—";
  return value.length > 24 ? `${value.slice(0, 12)}…${value.slice(-8)}` : value;
}

export async function fetchDispatchAttemptReconciliation(): Promise<DispatchAttemptReconciliationResult> {
  const [{ data: outboxData, error: outboxError }, { data: attemptData, error: attemptError }] = await Promise.all([
    supabase.from("platform_dispatch_outbox" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(500),
    supabase
      .from("platform_dispatch_attempts" as never)
      .select("*, platform_dispatch_outbox(id, client_slug, platform_name, idempotency_key, dry_run_only, send_enabled, lifecycle_status, eligibility_status, attempt_count)" as never)
      .order("created_at" as never, { ascending: false })
      .limit(500),
  ]);

  if (outboxError) throw outboxError;
  if (attemptError) throw attemptError;

  const outboxRows = ((outboxData ?? []) as unknown as Record<string, any>[]).map(mapOutbox);
  const attempts = ((attemptData ?? []) as unknown as Record<string, any>[]).map(mapAttempt);

  return {
    outboxRows,
    attempts,
    kpis: {
      outboxRows: outboxRows.length,
      simulatedAttempts: attempts.filter((row) => row.status === "simulated").length,
      failedPreflight: attempts.filter((row) => row.status === "failed_preflight").length,
      blockedByGate: attempts.filter((row) => row.status === "blocked_by_gate").length,
      attemptsWithResponseStatus: attempts.filter((row) => row.responseStatusCode != null).length,
      externalCallsMade: 0,
    },
  };
}

export async function runDispatchAttemptSimulation(payload: AttemptSimulationRequest): Promise<AttemptSimulationResult> {
  const devSecret = peekDevSecret();
  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/admin-simulate-dispatch-attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dev-secret": devSecret },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || body.ok === false) throw new Error(body.error || "Dispatch attempt simulation failed");
    return body as AttemptSimulationResult;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("User is not authenticated or session has expired.");

  const { data, error } = await supabase.functions.invoke("admin-simulate-dispatch-attempt", {
    body: payload,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message || "Dispatch attempt simulation failed");
  if (!data?.ok) throw new Error(data?.error || "Dispatch attempt simulation failed");
  return data as AttemptSimulationResult;
}

export { maskDispatchId };
