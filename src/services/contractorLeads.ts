import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  fetchContractorAccountContext,
  isContractorAccessAllowed,
  type ContractorAccessResult,
} from "@/services/contractorAccess";
import { fetchContractorLeadRelease, type ContractorLeadReleaseState } from "@/services/contractorLeadRelease";

export type ContractorLeadVisibility =
  | "redacted"
  | "contact_released"
  | "blocked"
  | "manual_review";

export type ContractorAssignedLeadStatus =
  | "assigned"
  | "accepted"
  | "released"
  | "recycled"
  | "pending"
  | "unknown";

export interface ContractorAssignedLeadSummary {
  assignmentId: string;
  assignmentIdMasked: string;
  assignedAt: string;
  assignmentStatus: ContractorAssignedLeadStatus;
  clientSlug: string;
  projectType: string | null;
  county: string | null;
  region: string | null;
  windowCountRange: string | null;
  quoteRange: string | null;
  safeScoreBand: string | null;
  releaseStatus: ContractorLeadVisibility;
  hasReleasedContact: boolean;
  hasSafeSummary: boolean;
  warnings: string[];
}

export interface ContractorAssignedLeadDetail extends ContractorAssignedLeadSummary {
  safeProjectSummary: string;
  safeFindings: string[];
  safeNextStep: string;
  routingStatus: string;
  contactReleaseMessage: string;
  contactRelease: ContractorLeadReleaseState;
  quoteExposureMessage: string;
  timeline: Array<{ label: string; timestamp: string }>;
}

export interface ContractorLeadListResult {
  state:
    | "allowed"
    | "empty"
    | "not_linked"
    | "pending"
    | "suspended"
    | "revoked"
    | "forbidden"
    | "error";
  leads: ContractorAssignedLeadSummary[];
  message: string;
}

export interface ContractorLeadDetailResult {
  state:
    | "allowed"
    | "empty"
    | "not_linked"
    | "pending"
    | "suspended"
    | "revoked"
    | "not_found"
    | "forbidden"
    | "error";
  lead: ContractorAssignedLeadDetail | null;
  message: string;
}

type AssignmentRow = {
  id: string;
  assigned_at: string;
  accepted_at: string | null;
  released_at: string | null;
  recycled_at: string | null;
  status: string;
  client_slug: string;
  contractor_account_id: string | null;
  reason_code: string;
  is_current: boolean;
  metadata: Json;
  created_at: string;
  updated_at: string;
};

type ReleaseRow = {
  lead_assignment_id: string;
  release_status: "not_released" | "held" | "approved" | "revoked" | "blocked" | "manual_review";
  allowed_contact_fields: string[] | null;
};

const CONTACT_RELEASE_MESSAGE =
  "Contact details have not been released yet. WindowMan will release contact information only after internal routing approval.";
const QUOTE_EXPOSURE_MESSAGE = "Quote files are not exposed in this contractor view.";

function maskId(id: string): string {
  return id.length <= 12 ? id : `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function isObject(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getString(metadata: Json, keys: string[]): string | null {
  if (!isObject(metadata)) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

function getNumber(metadata: Json, keys: string[]): number | null {
  if (!isObject(metadata)) return null;
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function getStringArray(metadata: Json, keys: string[]): string[] {
  if (!isObject(metadata)) return [];
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) {
      return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim()).slice(0, 5);
    }
  }
  return [];
}

function normalizeStatus(row: AssignmentRow): ContractorAssignedLeadStatus {
  if (row.recycled_at) return "recycled";
  if (row.released_at) return "released";
  if (row.accepted_at) return "accepted";
  if (row.status === "assigned") return "assigned";
  if (row.status === "pending") return "pending";
  return row.status ? "unknown" : "pending";
}

function toAccessState(access: ContractorAccessResult): ContractorLeadListResult["state"] {
  if (access.state === "not_linked" || access.state === "unauthenticated") return "not_linked";
  if (access.state === "pending") return "pending";
  if (access.state === "suspended") return "suspended";
  if (access.state === "revoked") return "revoked";
  if (access.state === "error") return "error";
  return "forbidden";
}

function scoreBand(metadata: Json): string | null {
  const band = getString(metadata, ["safe_score_band", "score_band", "grade_band"]);
  const grade = getString(metadata, ["grade"]);
  return band ?? (grade ? `${grade} band` : null);
}

function windowRange(metadata: Json): string | null {
  const explicit = getString(metadata, ["window_count_range", "scope_range", "project_scope"]);
  if (explicit) return explicit;
  const count = getNumber(metadata, ["window_count"]);
  if (count == null) return null;
  if (count <= 3) return "1–3 openings";
  if (count <= 8) return "4–8 openings";
  if (count <= 15) return "9–15 openings";
  return "16+ openings";
}

function visibilityFromRelease(release?: ReleaseRow | null): ContractorLeadVisibility {
  if (!release) return "redacted";
  if (release.release_status === "approved") return "contact_released";
  if (release.release_status === "blocked" || release.release_status === "revoked") return "blocked";
  if (release.release_status === "manual_review") return "manual_review";
  return "redacted";
}

function rowToSummary(row: AssignmentRow, accountClientSlug: string, release?: ReleaseRow | null): ContractorAssignedLeadSummary {
  const warnings: string[] = [];
  if (row.client_slug !== accountClientSlug) warnings.push("client_slug_mismatch_review");
  if (!row.is_current) warnings.push("assignment_not_current");

  const safeProjectSummary = getString(row.metadata, ["safe_project_summary", "project_summary"]);

  return {
    assignmentId: row.id,
    assignmentIdMasked: maskId(row.id),
    assignedAt: row.assigned_at,
    assignmentStatus: normalizeStatus(row),
    clientSlug: row.client_slug,
    projectType: getString(row.metadata, ["project_type", "projectType"]),
    county: getString(row.metadata, ["county"]),
    region: getString(row.metadata, ["region", "service_region"]),
    windowCountRange: windowRange(row.metadata),
    quoteRange: getString(row.metadata, ["quote_range", "quoteRange"]),
    safeScoreBand: scoreBand(row.metadata),
    releaseStatus: visibilityFromRelease(release),
    hasReleasedContact: release?.release_status === "approved" && Array.isArray(release.allowed_contact_fields) && release.allowed_contact_fields.length > 0,
    hasSafeSummary: Boolean(safeProjectSummary),
    warnings,
  };
}

function rowToDetail(row: AssignmentRow, accountClientSlug: string, contactRelease: ContractorLeadReleaseState): ContractorAssignedLeadDetail {
  const summary = rowToSummary(row, accountClientSlug, {
    lead_assignment_id: row.id,
    release_status: contactRelease.status,
    allowed_contact_fields: contactRelease.allowedContactFields,
  });
  const timeline = [
    { label: "Assigned", timestamp: row.assigned_at },
    row.accepted_at ? { label: "Accepted", timestamp: row.accepted_at } : null,
    row.released_at ? { label: "Assignment released", timestamp: row.released_at } : null,
    row.recycled_at ? { label: "Recycled", timestamp: row.recycled_at } : null,
    { label: "Last updated", timestamp: row.updated_at },
  ].filter((item): item is { label: string; timestamp: string } => Boolean(item));

  return {
    ...summary,
    safeProjectSummary:
      getString(row.metadata, ["safe_project_summary", "project_summary"]) ??
      "WindowMan has assigned this opportunity for internal-pilot contractor review. Detailed homeowner contact and quote files remain withheld.",
    safeFindings: getStringArray(row.metadata, ["safe_findings", "project_highlights", "summary_points"]),
    safeNextStep: "Review the redacted project context. Contact release and outcome updates are handled in later controlled workflow phases.",
    routingStatus: formatContractorLeadStatus(row.status),
    contactReleaseMessage: contactRelease.message || CONTACT_RELEASE_MESSAGE,
    contactRelease,
    quoteExposureMessage: QUOTE_EXPOSURE_MESSAGE,
    timeline,
  };
}

export function formatContractorLeadStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function isContractorLeadAccessible(result: ContractorLeadDetailResult): boolean {
  return result.state === "allowed" && Boolean(result.lead);
}

export async function fetchContractorAssignedLeads(): Promise<ContractorLeadListResult> {
  const access = await fetchContractorAccountContext();
  if (!isContractorAccessAllowed(access) || !access.account) {
    return { state: toAccessState(access), leads: [], message: access.message };
  }

  const { data, error } = await supabase
    .from("lead_assignments")
    .select("id, assigned_at, accepted_at, released_at, recycled_at, status, client_slug, contractor_account_id, reason_code, is_current, metadata, created_at, updated_at")
    .eq("contractor_account_id", access.account.contractorAccountId)
    .eq("client_slug", access.account.clientSlug)
    .order("assigned_at", { ascending: false });

  if (error) {
    console.error("[contractorLeads] assigned lead lookup failed", error.message);
    return { state: "error", leads: [], message: "Assigned opportunities could not be loaded safely." };
  }

  const rows = (data ?? []) as AssignmentRow[];
  const releaseResult = rows.length > 0
    ? await supabase.from("lead_contact_releases").select("lead_assignment_id, release_status, allowed_contact_fields").in("lead_assignment_id", rows.map((row) => row.id))
    : { data: [], error: null };
  if (releaseResult.error) console.warn("[contractorLeads] contact release summary lookup failed", releaseResult.error.message);
  const releases = new Map(((releaseResult.data ?? []) as unknown as ReleaseRow[]).map((release) => [release.lead_assignment_id, release]));
  const leads = rows.map((row) => rowToSummary(row, access.account!.clientSlug, releases.get(row.id) ?? null));
  return {
    state: leads.length > 0 ? "allowed" : "empty",
    leads,
    message: leads.length > 0 ? "Assigned opportunities loaded." : "No assigned opportunities are visible for this contractor account.",
  };
}

export async function fetchContractorAssignedLeadDetail(assignmentId: string): Promise<ContractorLeadDetailResult> {
  const access = await fetchContractorAccountContext();
  if (!isContractorAccessAllowed(access) || !access.account) {
    return { state: toAccessState(access), lead: null, message: access.message };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(assignmentId)) {
    return { state: "not_found", lead: null, message: "Assigned opportunity was not found." };
  }

  const { data, error } = await supabase
    .from("lead_assignments")
    .select("id, assigned_at, accepted_at, released_at, recycled_at, status, client_slug, contractor_account_id, reason_code, is_current, metadata, created_at, updated_at")
    .eq("id", assignmentId)
    .eq("contractor_account_id", access.account.contractorAccountId)
    .eq("client_slug", access.account.clientSlug)
    .maybeSingle();

  if (error) {
    console.error("[contractorLeads] assigned lead detail lookup failed", error.message);
    return { state: "error", lead: null, message: "Assigned opportunity detail could not be loaded safely." };
  }

  if (!data) {
    return { state: "not_found", lead: null, message: "Assigned opportunity was not found." };
  }

  const contactRelease = await fetchContractorLeadRelease(assignmentId);

  return {
    state: "allowed",
    lead: rowToDetail(data as AssignmentRow, access.account.clientSlug, contactRelease),
    message: "Assigned opportunity detail loaded.",
  };
}
