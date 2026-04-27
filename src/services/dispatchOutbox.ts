import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

export type DispatchEligibilityStatus = "eligible_not_sent" | "warning_not_sent" | "blocked" | "duplicate_protected" | "skipped" | "superseded";
export type DispatchReadinessStatus = "ready" | "warning" | "blocked";
export type MaterializationMode = "preview_selected" | "preview_filtered" | "materialize_selected" | "materialize_filtered";

export interface DispatchOutboxCandidate {
  candidateId: string;
  eventRowId: string;
  canonicalEventId: string | null;
  canonicalEventName: string;
  canonicalEventTimestamp: string | null;
  clientId: string | null;
  clientSlug: string | null;
  platformConfigId: string | null;
  platformName: string | null;
  dispatchEventName: string | null;
  mapperVersion: string | null;
  idempotencyKey: string | null;
  candidateFingerprint: string | null;
  eligibilityVersion: string;
  eligibilityStatus: DispatchEligibilityStatus;
  eligibilityReasons: string[];
  readinessStatus: DispatchReadinessStatus | null;
  outboxRowExists: boolean;
  outboxId: string | null;
  valueUsd: number | null;
  currency: string;
  valueBasis: string | null;
  trueMarginAvailable: boolean | null;
  attributionStrength: string | null;
  tokenPresent: boolean;
  destinationPresent: boolean;
  configState: string | null;
  validationStatus: string | null;
  decisionSnapshot: Record<string, unknown>;
}

export interface DispatchOutboxRow {
  id: string;
  createdAt: string;
  updatedAt: string;
  canonicalEventLogId: string;
  canonicalEventId: string | null;
  canonicalEventName: string;
  canonicalEventTimestamp: string | null;
  clientId: string | null;
  clientSlug: string;
  platformConfigId: string;
  platformName: string;
  dispatchEventName: string;
  mapperVersion: string;
  payloadVersion: string;
  idempotencyKey: string;
  payloadHash: string | null;
  redactedPayloadSnapshot: Record<string, unknown>;
  eligibilityStatus: DispatchEligibilityStatus;
  eligibilityReasons: string[];
  readinessStatus: string | null;
  dryRunOnly: boolean;
  sendEnabled: boolean;
  eligibilityVersion: string;
  candidateFingerprint: string;
  decisionSnapshot: Record<string, unknown>;
  valueUsd: number | null;
  currency: string;
  valueBasis: string | null;
  trueMarginAvailable: boolean | null;
  attributionStrength: string | null;
  tokenPresent: boolean;
  destinationPresent: boolean;
  configState: string | null;
  validationStatus: string | null;
  lifecycleStatus: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  lockedAt: string | null;
  lockedBy: string | null;
  sentAt: string | null;
  externalEventId: string | null;
  lastError: string | null;
  metadata: Record<string, unknown>;
}

export interface DispatchOutboxResult {
  candidates: DispatchOutboxCandidate[];
  outboxRows: DispatchOutboxRow[];
  kpis: {
    candidateRevenueEvents: number;
    eligibleCandidates: number;
    warningCandidates: number;
    blockedCandidates: number;
    duplicateProtectedCandidates: number;
    existingOutboxRows: number;
    activePlatformConfigs: number;
    sendEnabledRows: number;
  };
}

export interface DispatchMaterializationFilters {
  client_slug?: string;
  platform_name?: string;
  eligibility_status?: "eligible_not_sent" | "warning_not_sent" | "blocked" | "duplicate_protected";
  date_from?: string;
  date_to?: string;
}

export interface DispatchMaterializationRequest {
  mode: MaterializationMode;
  candidate_ids?: string[];
  filters?: DispatchMaterializationFilters;
  include_warnings?: boolean;
  confirmation?: string;
}

export interface DispatchMaterializationResultItem {
  candidate_id: string;
  status: string;
  outbox_id_masked?: string | null;
  idempotency_key_masked?: string | null;
  reasons?: string[];
  error?: string;
}

export interface DispatchMaterializationResult {
  mode: MaterializationMode;
  preview_only: boolean;
  dry_run_only: boolean;
  send_enabled: boolean;
  external_apis_called: boolean;
  attempts_written: boolean;
  summary: {
    candidates_considered: number;
    inserted: number;
    inserted_warnings: number;
    duplicate_protected: number;
    skipped_blocked: number;
    skipped_duplicate: number;
    skipped_invalid: number;
    errors: number;
  };
  created_outbox_row_ids_masked: string[];
  reason_code_breakdown: Record<string, number>;
  items: DispatchMaterializationResultItem[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapCandidate(row: Record<string, any>): DispatchOutboxCandidate {
  return {
    candidateId: row.candidate_id,
    eventRowId: row.event_row_id,
    canonicalEventId: row.canonical_event_id ?? null,
    canonicalEventName: row.canonical_event_name ?? "unknown",
    canonicalEventTimestamp: row.canonical_event_timestamp ?? null,
    clientId: row.client_id ?? null,
    clientSlug: row.client_slug ?? null,
    platformConfigId: row.platform_config_id ?? null,
    platformName: row.platform_name ?? null,
    dispatchEventName: row.dispatch_event_name ?? null,
    mapperVersion: row.mapper_version ?? null,
    idempotencyKey: row.idempotency_key ?? null,
    candidateFingerprint: row.candidate_fingerprint ?? null,
    eligibilityVersion: row.eligibility_version ?? "dispatch-eligibility-v1",
    eligibilityStatus: row.eligibility_status ?? "blocked",
    eligibilityReasons: Array.isArray(row.eligibility_reasons) ? row.eligibility_reasons : [],
    readinessStatus: row.readiness_status ?? null,
    outboxRowExists: Boolean(row.outbox_row_exists),
    outboxId: row.outbox_id ?? null,
    valueUsd: toNumber(row.value_usd),
    currency: row.currency ?? "USD",
    valueBasis: row.value_basis ?? null,
    trueMarginAvailable: row.true_margin_available ?? null,
    attributionStrength: row.attribution_strength ?? null,
    tokenPresent: Boolean(row.token_present),
    destinationPresent: Boolean(row.destination_present),
    configState: row.config_state ?? null,
    validationStatus: row.validation_status ?? null,
    decisionSnapshot: row.decision_snapshot ?? {},
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
    redactedPayloadSnapshot: row.redacted_payload_snapshot ?? {},
    eligibilityStatus: row.eligibility_status,
    eligibilityReasons: Array.isArray(row.eligibility_reasons) ? row.eligibility_reasons : [],
    readinessStatus: row.readiness_status ?? null,
    dryRunOnly: Boolean(row.dry_run_only),
    sendEnabled: Boolean(row.send_enabled),
    eligibilityVersion: row.eligibility_version,
    candidateFingerprint: row.candidate_fingerprint,
    decisionSnapshot: row.decision_snapshot ?? {},
    valueUsd: toNumber(row.value_usd),
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
    metadata: row.metadata ?? {},
  };
}

export function maskDispatchId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 16) return value;
  return `${value.slice(0, 10)}…${value.slice(-6)}`;
}

export function formatDispatchCurrency(value: number | null, currency = "USD"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
}

export async function fetchDispatchOutboxControl(): Promise<DispatchOutboxResult> {
  const [{ data: candidateData, error: candidateError }, { data: outboxData, error: outboxError }, { count: activeConfigCount, error: configError }] = await Promise.all([
    supabase.rpc("admin_dispatch_outbox_candidates" as never),
    supabase.from("platform_dispatch_outbox" as never).select("*" as never).order("created_at" as never, { ascending: false }).limit(500),
    supabase.from("client_platform_configs").select("id", { count: "exact", head: true }).eq("is_active", true),
  ]);

  if (candidateError) throw candidateError;
  if (outboxError) throw outboxError;
  if (configError) throw configError;

  const candidates = ((candidateData ?? []) as Record<string, any>[]).map(mapCandidate);
  const outboxRows = ((outboxData ?? []) as unknown as Record<string, any>[]).map(mapOutbox);
  const uniqueEventIds = new Set(candidates.map((row) => row.eventRowId));

  return {
    candidates,
    outboxRows,
    kpis: {
      candidateRevenueEvents: uniqueEventIds.size,
      eligibleCandidates: candidates.filter((row) => row.eligibilityStatus === "eligible_not_sent").length,
      warningCandidates: candidates.filter((row) => row.eligibilityStatus === "warning_not_sent").length,
      blockedCandidates: candidates.filter((row) => row.eligibilityStatus === "blocked").length,
      duplicateProtectedCandidates: candidates.filter((row) => row.eligibilityStatus === "duplicate_protected").length,
      existingOutboxRows: outboxRows.length,
      activePlatformConfigs: activeConfigCount ?? 0,
      sendEnabledRows: outboxRows.filter((row) => row.sendEnabled).length,
    },
  };
}

export async function runDispatchOutboxMaterialization(payload: DispatchMaterializationRequest): Promise<DispatchMaterializationResult> {
  const devSecret = peekDevSecret();
  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/admin-materialize-dispatch-outbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dev-secret": devSecret },
      body: JSON.stringify(payload),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || body.ok === false) throw new Error(body.error || "Dispatch outbox materialization failed");
    return body as DispatchMaterializationResult;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("User is not authenticated or session has expired.");

  const { data, error } = await supabase.functions.invoke("admin-materialize-dispatch-outbox", {
    body: payload,
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message || "Dispatch outbox materialization failed");
  if (!data?.ok) throw new Error(data?.error || "Dispatch outbox materialization failed");
  return data as DispatchMaterializationResult;
}
