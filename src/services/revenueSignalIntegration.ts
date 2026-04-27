import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

export type RevenueSignalIntegrityStatus = "valid" | "warning" | "blocked" | "needs_review";

export interface RevenueSignalEligibilityRow {
  outcomeId: string;
  leadId: string | null;
  scanSessionId: string | null;
  analysisId: string | null;
  leadAssignmentId: string | null;
  clientSlug: string | null;
  contractorAccountId: string | null;
  contractorId: string | null;
  opportunityId: string | null;
  dispositionState: string | null;
  finalValueCents: number | null;
  finalValueUsd: number | null;
  soldCurrency: string;
  valueBasis: string | null;
  outcomeIntegrityStatus: RevenueSignalIntegrityStatus;
  outcomeIntegrityReasons: string[];
  eligibleForRevenueSignal: boolean;
  existingSignalId: string | null;
  existingEventId: string | null;
  duplicateProtected: boolean;
  externalDispatch: false;
}

export interface RevenueSignalEligibilityResult {
  rows: RevenueSignalEligibilityRow[];
  kpis: {
    totalSoldOutcomes: number;
    eligible: number;
    blocked: number;
    duplicateProtected: number;
    warning: number;
    needsReview: number;
  };
}

export interface RevenueSignalSyncRequest {
  dryRun?: boolean;
  limit?: number;
}

export interface RevenueSignalSyncResult {
  ok: boolean;
  dry_run: boolean;
  external_dispatch: false;
  dispatch_created: false;
  inserted: number;
  duplicate_protected: number;
  blocked: number;
  error?: string;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toReasons(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function toIntegrityStatus(value: unknown): RevenueSignalIntegrityStatus {
  return ["valid", "warning", "blocked", "needs_review"].includes(String(value))
    ? (String(value) as RevenueSignalIntegrityStatus)
    : "needs_review";
}

function mapEligibilityRow(row: Record<string, unknown>): RevenueSignalEligibilityRow {
  return {
    outcomeId: String(row.outcome_id),
    leadId: typeof row.lead_id === "string" ? row.lead_id : null,
    scanSessionId: typeof row.scan_session_id === "string" ? row.scan_session_id : null,
    analysisId: typeof row.analysis_id === "string" ? row.analysis_id : null,
    leadAssignmentId: typeof row.lead_assignment_id === "string" ? row.lead_assignment_id : null,
    clientSlug: typeof row.client_slug === "string" ? row.client_slug : null,
    contractorAccountId: typeof row.contractor_account_id === "string" ? row.contractor_account_id : null,
    contractorId: typeof row.contractor_id === "string" ? row.contractor_id : null,
    opportunityId: typeof row.opportunity_id === "string" ? row.opportunity_id : null,
    dispositionState: typeof row.disposition_state === "string" ? row.disposition_state : null,
    finalValueCents: toNumber(row.final_value_cents),
    finalValueUsd: toNumber(row.final_value_usd),
    soldCurrency: typeof row.sold_currency === "string" ? row.sold_currency : "USD",
    valueBasis: typeof row.value_basis === "string" ? row.value_basis : null,
    outcomeIntegrityStatus: toIntegrityStatus(row.outcome_integrity_status),
    outcomeIntegrityReasons: toReasons(row.outcome_integrity_reasons),
    eligibleForRevenueSignal: Boolean(row.eligible_for_revenue_signal),
    existingSignalId: typeof row.existing_signal_id === "string" ? row.existing_signal_id : null,
    existingEventId: typeof row.existing_event_id === "string" ? row.existing_event_id : null,
    duplicateProtected: Boolean(row.duplicate_protected),
    externalDispatch: false,
  };
}

export async function fetchRevenueSignalEligibility(): Promise<RevenueSignalEligibilityResult> {
  const { data, error } = await supabase.rpc("admin_revenue_signal_eligibility");
  if (error) throw error;

  const rows = ((data ?? []) as Record<string, unknown>[]).map(mapEligibilityRow);
  return {
    rows,
    kpis: {
      totalSoldOutcomes: rows.length,
      eligible: rows.filter((row) => row.eligibleForRevenueSignal && !row.duplicateProtected).length,
      blocked: rows.filter((row) => row.outcomeIntegrityStatus === "blocked" || !row.eligibleForRevenueSignal).length,
      duplicateProtected: rows.filter((row) => row.duplicateProtected).length,
      warning: rows.filter((row) => row.outcomeIntegrityStatus === "warning").length,
      needsReview: rows.filter((row) => row.outcomeIntegrityStatus === "needs_review").length,
    },
  };
}

export async function syncRevenueSignals({ dryRun = true, limit = 100 }: RevenueSignalSyncRequest = {}): Promise<RevenueSignalSyncResult> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const devSecret = peekDevSecret();

  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/admin-sync-revenue-signals`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dev-secret": devSecret },
      body: JSON.stringify({ dry_run: dryRun, limit: safeLimit }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok || body.ok === false) throw new Error(body.error || "Revenue signal sync failed");
    return body as RevenueSignalSyncResult;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("User is not authenticated or session has expired.");

  const { data, error } = await supabase.functions.invoke("admin-sync-revenue-signals", {
    body: { dry_run: dryRun, limit: safeLimit },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message || "Revenue signal sync failed");
  if (!data?.ok) throw new Error(data?.error || "Revenue signal sync failed");
  return data as RevenueSignalSyncResult;
}
