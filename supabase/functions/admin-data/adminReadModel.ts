/**
 * Canonical admin CRM read model — derives scan / quote / analysis evidence
 * without denormalized `leads` columns that may be absent on LIVE_ACTIVE.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Columns that exist on `public.leads` per generated types (no denormalized scan/grade). */
export const LEAD_EVIDENCE_LEAD_SELECT =
  "id, created_at, updated_at, first_name, last_name, email, phone_e164, city, county, zip, latest_analysis_id, status";

export const NEEDS_REVIEW_LEAD_SELECT =
  "id, first_name, last_name, email, phone_e164, city, created_at, latest_analysis_id, manually_reviewed, manual_entry_data";

export const STAGE_LEAD_BASE_SELECT =
  "id, first_name, last_name, city, county, latest_analysis_id, latest_opportunity_id, deal_status, created_at, phone_verified_at, updated_at";

export const ANALYSIS_ADMIN_SUMMARY_SELECT =
  "id, lead_id, scan_session_id, grade, analysis_status, confidence_score, flags, dollar_delta, created_at, updated_at";

/** Browser-safe dossier fetch — includes preview_json / proof_of_read, never full_json. */
export const ANALYSIS_FETCH_LEAD_ANALYSIS_SELECT =
  "id, scan_session_id, analysis_status, grade, dollar_delta, confidence_score, flags, preview_json, proof_of_read, document_type, rubric_version";

/** Lead columns that must not appear in stage / evidence SQL selects (absent on LIVE_ACTIVE). */
export const ABSENT_LEAD_DENORM_COLUMNS = [
  "latest_scan_session_id",
  "routed_to_contractor_at",
  "appointment_booked_at",
  "closed_at",
  "flag_count",
  "red_flag_count",
  "scan_count",
  "grade",
  "state",
] as const;

export const CLOSED_OUTCOME_DEAL_STATUSES = [
  "won",
  "sold",
  "sold_closed",
  "closed_won",
  "closed",
] as const;

export const ANALYSIS_EVIDENCE_LIST_SELECT = `
  id, lead_id, scan_session_id, grade, analysis_status, confidence_score,
  rubric_version, document_type, document_is_window_door_related,
  dollar_delta, flags, preview_json, proof_of_read, created_at, updated_at
`;

export const SCAN_SESSION_CORE_SELECT =
  "id, lead_id, quote_file_id, status, created_at, updated_at";

export const QUOTE_FILE_CORE_SELECT =
  "id, lead_id, storage_path, status, created_at";

export type ScanSessionRow = {
  id: string;
  lead_id: string | null;
  quote_file_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type QuoteFileRow = {
  id: string;
  lead_id: string | null;
  storage_path: string;
  status: string | null;
  created_at: string;
};

export type AnalysisSummaryRow = {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  grade: string | null;
  analysis_status: string;
  confidence_score: number | null;
  flags: unknown;
  dollar_delta: number | null;
  created_at: string;
  updated_at: string;
};

export type LeadEvidenceLeadView = {
  id: string;
  created_at: string;
  updated_at: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  city: string | null;
  county: string | null;
  zip: string | null;
  latest_analysis_id: string | null;
  status: string | null;
  /** Derived — not selected from `leads`. */
  latest_scan_session_id: string | null;
  grade: string | null;
  state: null;
};

export function pickLatestByCreatedAt<T extends { created_at: string }>(
  rows: T[],
): T | null {
  if (rows.length === 0) return null;
  return [...rows].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )[0];
}

export function pickLatestScanForLead(
  sessions: ScanSessionRow[],
  leadId: string,
): ScanSessionRow | null {
  const owned = sessions.filter((s) => s.lead_id === leadId);
  return pickLatestByCreatedAt(owned);
}

/** Latest scan attempt that has a quote_file_id (quote-evidence semantic). */
export function pickLatestScanWithQuoteFileForLead(
  sessions: ScanSessionRow[],
  leadId: string,
): ScanSessionRow | null {
  const owned = sessions
    .filter((s) => s.lead_id === leadId && s.quote_file_id)
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return owned[0] ?? null;
}

/** Latest analysis row for a lead (any status) — default admin list semantic. */
export function pickLatestAnalysisAttemptForLead(
  analyses: AnalysisSummaryRow[],
  leadId: string,
): AnalysisSummaryRow | null {
  return pickLatestAnalysisForLead(analyses, leadId);
}

const COMPLETED_ANALYSIS_STATUSES = new Set([
  "complete",
  "completed",
  "success",
]);

/** Latest analysis with a completed/success status, else null. */
export function pickLatestCompletedAnalysisForLead(
  analyses: AnalysisSummaryRow[],
  leadId: string,
): AnalysisSummaryRow | null {
  const owned = analyses
    .filter((a) => a.lead_id === leadId && COMPLETED_ANALYSIS_STATUSES.has(a.analysis_status))
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  return owned[0] ?? null;
}

export function pickLatestAnalysisForLead(
  analyses: AnalysisSummaryRow[],
  leadId: string,
): AnalysisSummaryRow | null {
  const owned = analyses.filter((a) => a.lead_id === leadId);
  return pickLatestByCreatedAt(owned);
}

export function summarizeFlagCounts(flags: unknown): {
  flag_count: number;
  red_flag_count: number;
} {
  const list = Array.isArray(flags) ? flags : [];
  let red_flag_count = 0;
  for (const flag of list) {
    if (!flag || typeof flag !== "object") continue;
    const sev = (flag as Record<string, unknown>).severity;
    if (typeof sev === "string" && sev.toLowerCase() === "red") {
      red_flag_count += 1;
    }
  }
  return { flag_count: list.length, red_flag_count };
}

export function enrichLeadForEvidenceView(
  lead: Record<string, unknown>,
  latestScan: ScanSessionRow | null,
  latestAnalysis: AnalysisSummaryRow | null,
): LeadEvidenceLeadView {
  return {
    id: String(lead.id),
    created_at: String(lead.created_at),
    updated_at: (lead.updated_at as string | null) ?? null,
    first_name: (lead.first_name as string | null) ?? null,
    last_name: (lead.last_name as string | null) ?? null,
    email: (lead.email as string | null) ?? null,
    phone_e164: (lead.phone_e164 as string | null) ?? null,
    city: (lead.city as string | null) ?? null,
    county: (lead.county as string | null) ?? null,
    zip: (lead.zip as string | null) ?? null,
    latest_analysis_id: (lead.latest_analysis_id as string | null) ?? null,
    status: (lead.status as string | null) ?? null,
    latest_scan_session_id: latestScan?.id ?? null,
    grade: latestAnalysis?.grade ?? null,
    state: null,
  };
}

export async function fetchLatestScanSessionForLead(
  supabaseAdmin: SupabaseClient,
  leadId: string,
): Promise<ScanSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select(SCAN_SESSION_CORE_SELECT)
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as ScanSessionRow | null;
}

/** fetch_quote_evidence / needs-review URL: newest scan with quote_file_id. */
export async function fetchLatestScanWithQuoteFileForLead(
  supabaseAdmin: SupabaseClient,
  leadId: string,
): Promise<ScanSessionRow | null> {
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select(SCAN_SESSION_CORE_SELECT)
    .eq("lead_id", leadId)
    .not("quote_file_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw error;
  const rows = (data ?? []) as ScanSessionRow[];
  return pickLatestScanWithQuoteFileForLead(rows, leadId);
}

export async function resolveQuoteFileForLeadViaLatestScan(
  supabaseAdmin: SupabaseClient,
  leadId: string,
): Promise<{
  scan_session_id: string | null;
  quoteFile: QuoteFileRow | null;
}> {
  const session = await fetchLatestScanWithQuoteFileForLead(
    supabaseAdmin,
    leadId,
  );
  if (!session?.quote_file_id) {
    const latestAttempt = await fetchLatestScanSessionForLead(
      supabaseAdmin,
      leadId,
    );
    return { scan_session_id: latestAttempt?.id ?? null, quoteFile: null };
  }
  const { data: file, error } = await supabaseAdmin
    .from("quote_files")
    .select(QUOTE_FILE_CORE_SELECT)
    .eq("id", session.quote_file_id)
    .maybeSingle();
  if (error) throw error;
  if (!file) {
    return { scan_session_id: session.id, quoteFile: null };
  }
  const qf = file as QuoteFileRow;
  if (qf.lead_id && qf.lead_id !== leadId) {
    return { scan_session_id: session.id, quoteFile: null };
  }
  return { scan_session_id: session.id, quoteFile: qf };
}

export async function batchLatestScansForLeadIds(
  supabaseAdmin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, ScanSessionRow>> {
  const map = new Map<string, ScanSessionRow>();
  if (leadIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select(SCAN_SESSION_CORE_SELECT)
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const row of (data ?? []) as ScanSessionRow[]) {
    if (!row.lead_id) continue;
    if (!map.has(row.lead_id)) map.set(row.lead_id, row);
  }
  return map;
}

export async function batchScanCountsForLeadIds(
  supabaseAdmin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (leadIds.length === 0) return counts;
  const { data, error } = await supabaseAdmin
    .from("scan_sessions")
    .select("lead_id")
    .in("lead_id", leadIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.lead_id as string | null;
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

export async function batchLatestAnalysesForLeadIds(
  supabaseAdmin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, AnalysisSummaryRow>> {
  const map = new Map<string, AnalysisSummaryRow>();
  if (leadIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("analyses")
    .select(ANALYSIS_ADMIN_SUMMARY_SELECT)
    .in("lead_id", leadIds)
    .order("created_at", { ascending: false });
  if (error) throw error;
  for (const row of (data ?? []) as AnalysisSummaryRow[]) {
    if (!row.lead_id) continue;
    if (!map.has(row.lead_id)) map.set(row.lead_id, row);
  }
  return map;
}

export async function fetchLeadIdsWithScansSince(
  supabaseAdmin: SupabaseClient,
  sinceIso: string | null,
): Promise<string[]> {
  let q = supabaseAdmin.from("scan_sessions").select("lead_id");
  if (sinceIso) q = q.gte("created_at", sinceIso);
  const { data, error } = await q;
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.lead_id) ids.add(row.lead_id as string);
  }
  return [...ids];
}

/** fetch_stage_leads routed — contractor_opportunities.routed_at (not leads.*). */
export async function fetchLeadIdsWithRoutedOpportunitySince(
  supabaseAdmin: SupabaseClient,
  sinceIso: string | null,
): Promise<string[]> {
  let q = supabaseAdmin
    .from("contractor_opportunities")
    .select("lead_id, routed_at")
    .not("routed_at", "is", null);
  if (sinceIso) q = q.gte("routed_at", sinceIso);
  const { data, error } = await q;
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of data ?? []) {
    if (row.lead_id) ids.add(row.lead_id as string);
  }
  return [...ids];
}

type OutcomeLeadRow = {
  appointment_booked_at: string | null;
  closed_at: string | null;
  deal_status: string | null;
  opportunity_id: string;
  contractor_opportunities: { lead_id: string } | { lead_id: string }[] | null;
};

function leadIdFromOutcomeJoin(
  joined: OutcomeLeadRow["contractor_opportunities"],
): string | null {
  if (!joined) return null;
  const row = Array.isArray(joined) ? joined[0] : joined;
  return row?.lead_id ?? null;
}

/** fetch_stage_leads booked — contractor_outcomes.appointment_booked_at. */
export async function fetchLeadIdsWithBookedOutcomeSince(
  supabaseAdmin: SupabaseClient,
  sinceIso: string | null,
): Promise<string[]> {
  let q = supabaseAdmin
    .from("contractor_outcomes")
    .select(
      "appointment_booked_at, opportunity_id, contractor_opportunities!inner(lead_id)",
    )
    .not("appointment_booked_at", "is", null);
  if (sinceIso) q = q.gte("appointment_booked_at", sinceIso);
  const { data, error } = await q;
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as OutcomeLeadRow[]) {
    const leadId = leadIdFromOutcomeJoin(row.contractor_opportunities);
    if (leadId) ids.add(leadId);
  }
  return [...ids];
}

/** fetch_stage_leads closed — contractor_outcomes.closed_at + deal_status. */
export async function fetchLeadIdsWithClosedOutcomeSince(
  supabaseAdmin: SupabaseClient,
  sinceIso: string | null,
): Promise<string[]> {
  let q = supabaseAdmin
    .from("contractor_outcomes")
    .select(
      "closed_at, deal_status, opportunity_id, contractor_opportunities!inner(lead_id)",
    )
    .not("closed_at", "is", null)
    .in("deal_status", [...CLOSED_OUTCOME_DEAL_STATUSES]);
  if (sinceIso) q = q.gte("closed_at", sinceIso);
  const { data, error } = await q;
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as OutcomeLeadRow[]) {
    const leadId = leadIdFromOutcomeJoin(row.contractor_opportunities);
    if (leadId) ids.add(leadId);
  }
  return [...ids];
}

export type StageOutcomeSnapshot = {
  appointment_booked_at: string | null;
  closed_at: string | null;
  deal_value: number | null;
  deal_status: string | null;
};

export async function batchLatestRoutedAtForLeadIds(
  supabaseAdmin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (leadIds.length === 0) return map;
  const { data, error } = await supabaseAdmin
    .from("contractor_opportunities")
    .select("lead_id, routed_at")
    .in("lead_id", leadIds)
    .not("routed_at", "is", null)
    .order("routed_at", { ascending: false });
  if (error) throw error;
  for (const row of data ?? []) {
    const id = row.lead_id as string | null;
    const at = row.routed_at as string | null;
    if (id && at && !map.has(id)) map.set(id, at);
  }
  return map;
}

export async function batchLatestOutcomeSnapshotForLeadIds(
  supabaseAdmin: SupabaseClient,
  leadIds: string[],
): Promise<Map<string, StageOutcomeSnapshot>> {
  const map = new Map<string, StageOutcomeSnapshot>();
  if (leadIds.length === 0) return map;

  const { data: opps, error: oppErr } = await supabaseAdmin
    .from("contractor_opportunities")
    .select("id, lead_id")
    .in("lead_id", leadIds);
  if (oppErr) throw oppErr;

  const oppToLead = new Map<string, string>();
  for (const o of opps ?? []) {
    if (o.id && o.lead_id) oppToLead.set(o.id as string, o.lead_id as string);
  }
  const oppIds = [...oppToLead.keys()];
  if (oppIds.length === 0) return map;

  const { data: outcomes, error } = await supabaseAdmin
    .from("contractor_outcomes")
    .select(
      "opportunity_id, appointment_booked_at, closed_at, deal_value, deal_status, updated_at",
    )
    .in("opportunity_id", oppIds)
    .order("updated_at", { ascending: false });
  if (error) throw error;

  for (const row of outcomes ?? []) {
    const leadId = oppToLead.get(row.opportunity_id as string);
    if (!leadId || map.has(leadId)) continue;
    map.set(leadId, {
      appointment_booked_at: (row.appointment_booked_at as string | null) ??
        null,
      closed_at: (row.closed_at as string | null) ?? null,
      deal_value: typeof row.deal_value === "number" ? row.deal_value : null,
      deal_status: (row.deal_status as string | null) ?? null,
    });
  }
  return map;
}

const FORBIDDEN_BROWSER_KEYS = new Set(["full_json"]);

export class AdminForbiddenPayloadError extends Error {
  constructor(public readonly key: string) {
    super(`Forbidden admin browser payload key: ${key}`);
    this.name = "AdminForbiddenPayloadError";
  }
}

export function findForbiddenBrowserKey(
  value: unknown,
  seen = new WeakSet<object>(),
): string | null {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findForbiddenBrowserKey(item, seen);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === "object") {
    if (seen.has(value)) return null;
    seen.add(value);
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (FORBIDDEN_BROWSER_KEYS.has(k)) return k;
      const nested = findForbiddenBrowserKey(v, seen);
      if (nested) return nested;
    }
  }
  return null;
}

export function assertBrowserSafeAdminPayload(value: unknown): void {
  const key = findForbiddenBrowserKey(value);
  if (key) throw new AdminForbiddenPayloadError(key);
}
