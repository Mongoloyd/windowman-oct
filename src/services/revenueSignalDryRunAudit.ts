import { supabase } from "@/integrations/supabase/client";

export interface RevenueSignalDryRunClientBreakdown {
  candidateCount: number;
  wouldInsert: number;
  blocked: number;
  duplicateProtected: number;
  weakLifecycleKey: number;
  lifecycleDuplicateClaim: number;
  duplicateRevenueSignalKey: number;
}

export interface RevenueSignalDryRunBasisBreakdown extends RevenueSignalDryRunClientBreakdown {}

export interface RevenueSignalDryRunReport {
  ok: true;
  dryRun: true;
  runId: string;
  operatorId: string | null;
  startedAt: string;
  candidateCount: number;
  wouldInsert: number;
  inserted: number;
  blocked: number;
  duplicateProtected: number;
  weakLifecycleKey: number;
  lifecycleDuplicateClaim: number;
  duplicateRevenueSignalKey: number;
  byClientSlug: Record<string, RevenueSignalDryRunClientBreakdown>;
  byReasonCode: Record<string, number>;
  byKeyBasis: Record<string, RevenueSignalDryRunBasisBreakdown>;
  sampleCandidateIds: string[];
  externalDispatch: false;
  dispatchCreated: false;
}

export interface RevenueSignalDryRunOptions {
  limit?: number;
  dryRun?: true;
}

export class RevenueSignalDryRunError extends Error {
  readonly code: string;

  constructor(message: string, code = "revenue_signal_dry_run_failed") {
    super(message);
    this.name = "RevenueSignalDryRunError";
    this.code = code;
  }
}

const DEFAULT_LIMIT = 100;
const MIN_LIMIT = 1;
const MAX_LIMIT = 500;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.trunc(value));
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : 0;
  }
  return 0;
}

function normalizeString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function clampLimit(limit: unknown): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.min(Math.max(Math.trunc(limit), MIN_LIMIT), MAX_LIMIT);
}

function normalizeBreakdown(value: unknown): RevenueSignalDryRunClientBreakdown {
  const record = isRecord(value) ? value : {};
  return {
    candidateCount: normalizeCount(record.candidate_count),
    wouldInsert: normalizeCount(record.would_insert),
    blocked: normalizeCount(record.blocked),
    duplicateProtected: normalizeCount(record.duplicate_protected),
    weakLifecycleKey: normalizeCount(record.weak_lifecycle_key),
    lifecycleDuplicateClaim: normalizeCount(record.lifecycle_duplicate_claim),
    duplicateRevenueSignalKey: normalizeCount(record.duplicate_revenue_signal_key),
  };
}

function normalizeBreakdownMap(value: unknown): Record<string, RevenueSignalDryRunClientBreakdown> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, item]) => [key, normalizeBreakdown(item)])
  );
}

function normalizeReasonMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key.trim().length > 0)
      .map(([key, item]) => [key, normalizeCount(item)])
  );
}

function maskCandidateId(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

function normalizeSampleCandidateIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(maskCandidateId)
    .filter((item): item is string => item !== null)
    .slice(0, 25);
}

export function assertNoExternalDispatch(report: RevenueSignalDryRunReport): void {
  if (report.externalDispatch !== false) {
    throw new RevenueSignalDryRunError(
      "Unsafe dry-run response: external dispatch flag was not false.",
      "unsafe_external_dispatch_flag"
    );
  }
  if (report.dispatchCreated !== false) {
    throw new RevenueSignalDryRunError(
      "Unsafe dry-run response: dispatch created flag was not false.",
      "unsafe_dispatch_created_flag"
    );
  }
}

export function normalizeRevenueSignalDryRunReport(raw: unknown): RevenueSignalDryRunReport {
  if (!isRecord(raw)) {
    throw new RevenueSignalDryRunError("Revenue signal dry-run response was malformed.", "malformed_response");
  }
  if (raw.ok !== true) {
    throw new RevenueSignalDryRunError("Revenue signal dry-run did not complete successfully.", "dry_run_not_ok");
  }
  if (raw.dry_run !== true) {
    throw new RevenueSignalDryRunError("Revenue signal response was not a dry run.", "not_dry_run_response");
  }
  if (raw.external_dispatch !== false) {
    throw new RevenueSignalDryRunError(
      "Unsafe dry-run response: external dispatch flag was not false.",
      "unsafe_external_dispatch_flag"
    );
  }
  if (raw.dispatch_created !== false) {
    throw new RevenueSignalDryRunError(
      "Unsafe dry-run response: dispatch created flag was not false.",
      "unsafe_dispatch_created_flag"
    );
  }

  const runId = normalizeString(raw.run_id);
  const startedAt = normalizeString(raw.started_at);
  if (!runId || !startedAt) {
    throw new RevenueSignalDryRunError("Revenue signal dry-run response was missing required audit identifiers.", "missing_audit_identity");
  }

  const report: RevenueSignalDryRunReport = {
    ok: true,
    dryRun: true,
    runId,
    operatorId: normalizeString(raw.operator_id),
    startedAt,
    candidateCount: normalizeCount(raw.candidate_count),
    wouldInsert: normalizeCount(raw.would_insert),
    inserted: normalizeCount(raw.inserted),
    blocked: normalizeCount(raw.blocked),
    duplicateProtected: normalizeCount(raw.duplicate_protected),
    weakLifecycleKey: normalizeCount(raw.weak_lifecycle_key),
    lifecycleDuplicateClaim: normalizeCount(raw.lifecycle_duplicate_claim),
    duplicateRevenueSignalKey: normalizeCount(raw.duplicate_revenue_signal_key),
    byClientSlug: normalizeBreakdownMap(raw.by_client_slug),
    byReasonCode: normalizeReasonMap(raw.by_reason_code),
    byKeyBasis: normalizeBreakdownMap(raw.by_key_basis),
    sampleCandidateIds: normalizeSampleCandidateIds(raw.sample_candidate_ids),
    externalDispatch: false,
    dispatchCreated: false,
  };

  assertNoExternalDispatch(report);
  return report;
}

export async function runRevenueSignalDryRun(options: RevenueSignalDryRunOptions = {}): Promise<RevenueSignalDryRunReport> {
  if ((options as { dryRun?: unknown }).dryRun === false) {
    throw new RevenueSignalDryRunError("Live revenue signal sync is not exposed by the dry-run audit service.", "live_sync_not_available");
  }

  const { data, error } = await supabase.functions.invoke("admin-sync-revenue-signals", {
    body: {
      limit: clampLimit(options.limit),
      dry_run: true,
    },
  });

  if (error) {
    throw new RevenueSignalDryRunError(error.message || "Revenue signal dry-run request failed.", "edge_function_error");
  }

  return normalizeRevenueSignalDryRunReport(data);
}

export function formatDryRunReason(code: string): string {
  const labels: Record<string, string> = {
    missing_client_slug: "Missing client slug",
    missing_lifecycle_key: "Missing lifecycle key",
    weak_lifecycle_key: "Weak lifecycle key",
    duplicate_sold_lifecycle_claim: "Duplicate sold lifecycle claim",
    duplicate_active_sold_signal: "Duplicate active sold signal",
    sold_missing_or_invalid_value: "Sold value missing or invalid",
    sold_missing_value_basis: "Sold value basis missing",
    outcome_integrity_not_valid: "Outcome integrity not valid",
    outcome_integrity_blocked: "Outcome integrity blocked",
    blocked_unknown_reason: "Blocked for an unknown reason",
  };
  return labels[code] ?? `Unmapped reason: ${code.replace(/_/g, " ")}`;
}

export function formatDryRunBasis(basis: string): string {
  const labels: Record<string, string> = {
    lead_assignment_id: "Lead assignment",
    opportunity_id: "Opportunity",
    lead_id: "Lead",
    scan_session_id: "Scan session",
    analysis_id: "Analysis",
    contractor_outcome_id: "Contractor outcome",
    missing_key_basis: "Missing key basis",
  };
  return labels[basis] ?? `Unmapped basis: ${basis.replace(/_/g, " ")}`;
}

export function formatDryRunError(error: unknown): string {
  if (error instanceof RevenueSignalDryRunError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Revenue signal dry-run failed safely. No dispatch was attempted.";
}
