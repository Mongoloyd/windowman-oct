import { supabase } from "@/integrations/supabase/client";

export type ContractorAccessStatus =
  | "pending"
  | "invited"
  | "active"
  | "suspended"
  | "revoked";

export type ContractorPortalRole =
  | "contractor_owner"
  | "contractor_admin"
  | "contractor_member";

export type ContractorAccessResultState =
  | "loading"
  | "allowed"
  | "pending"
  | "suspended"
  | "revoked"
  | "not_linked"
  | "unauthenticated"
  | "error";

export interface ContractorAccountContext {
  contractorAccountId: string;
  contractorAccountIdMasked: string;
  clientSlug: string;
  displayName: string;
  accessStatus: ContractorAccessStatus;
  portalRole: ContractorPortalRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastPortalLoginAt: string | null;
  warnings: string[];
}

export interface ContractorAccessResult {
  state: ContractorAccessResultState;
  account: ContractorAccountContext | null;
  accounts: ContractorAccountContext[];
  message: string;
}

type ContractorAccountRow = {
  id: string;
  client_slug: string;
  display_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  access_status?: unknown;
  portal_role?: unknown;
  last_portal_login_at?: unknown;
};

const ACCESS_STATUSES: ContractorAccessStatus[] = [
  "pending",
  "invited",
  "active",
  "suspended",
  "revoked",
];

const PORTAL_ROLES: ContractorPortalRole[] = [
  "contractor_owner",
  "contractor_admin",
  "contractor_member",
];

function maskAccountId(id: string): string {
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

function normalizeAccessStatus(value: unknown, isActive: boolean): ContractorAccessStatus {
  if (typeof value === "string" && ACCESS_STATUSES.includes(value as ContractorAccessStatus)) {
    return value as ContractorAccessStatus;
  }
  return isActive ? "active" : "pending";
}

function normalizePortalRole(value: unknown): ContractorPortalRole {
  if (typeof value === "string" && PORTAL_ROLES.includes(value as ContractorPortalRole)) {
    return value as ContractorPortalRole;
  }
  return "contractor_member";
}

function normalizeTimestamp(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function toContext(row: ContractorAccountRow, warnings: string[] = []): ContractorAccountContext {
  const accessStatus = normalizeAccessStatus(row.access_status, row.is_active);

  return {
    contractorAccountId: row.id,
    contractorAccountIdMasked: maskAccountId(row.id),
    clientSlug: row.client_slug,
    displayName: row.display_name,
    accessStatus,
    portalRole: normalizePortalRole(row.portal_role),
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastPortalLoginAt: normalizeTimestamp(row.last_portal_login_at),
    warnings,
  };
}

function stateForContext(context: ContractorAccountContext): ContractorAccessResultState {
  if (context.accessStatus === "suspended") return "suspended";
  if (context.accessStatus === "revoked") return "revoked";
  if (context.accessStatus === "pending" || context.accessStatus === "invited") return "pending";
  return context.isActive ? "allowed" : "pending";
}

export function formatContractorAccessStatus(status: ContractorAccessStatus): string {
  const labels: Record<ContractorAccessStatus, string> = {
    pending: "Pending",
    invited: "Invited",
    active: "Active",
    suspended: "Suspended",
    revoked: "Revoked",
  };
  return labels[status];
}

export function isContractorAccessAllowed(result: ContractorAccessResult): boolean {
  return result.state === "allowed" && result.account?.accessStatus === "active" && result.account.isActive;
}

export async function fetchContractorAccountContext(): Promise<ContractorAccessResult> {
  const { data: userResult, error: userError } = await supabase.auth.getUser();

  if (userError || !userResult.user) {
    return {
      state: "unauthenticated",
      account: null,
      accounts: [],
      message: "Sign in with an invited contractor account to continue.",
    };
  }

  const { data, error } = await supabase
    .from("contractor_accounts")
    .select("id, client_slug, display_name, is_active, created_at, updated_at, access_status, portal_role, last_portal_login_at")
    .eq("auth_user_id", userResult.user.id)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[contractorAccess] context lookup failed", error.message);
    return {
      state: "error",
      account: null,
      accounts: [],
      message: "Contractor access could not be verified right now.",
    };
  }

  const rows = (data ?? []) as ContractorAccountRow[];
  if (rows.length === 0) {
    return {
      state: "not_linked",
      account: null,
      accounts: [],
      message: "This login is not linked to a contractor account.",
    };
  }

  const sharedWarnings = rows.length > 1 ? ["multiple_accounts_manual_review"] : [];
  const accounts = rows.map((row) => toContext(row, sharedWarnings));
  const account = accounts[0];

  return {
    state: stateForContext(account),
    account,
    accounts,
    message: "Contractor account context resolved.",
  };
}