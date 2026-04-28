import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchContractorAccountContext, isContractorAccessAllowed } from "@/services/contractorAccess";
import type { AllowedContactField, LeadReleaseStatus } from "@/services/leadReleaseQueue";

export interface ContractorReleasedContact {
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  city?: string;
  county?: string;
}

export interface ContractorLeadReleaseState {
  status: LeadReleaseStatus;
  allowedContactFields: AllowedContactField[];
  contact: ContractorReleasedContact | null;
  message: string;
}

type ReleaseRow = {
  release_status: LeadReleaseStatus;
  allowed_contact_fields: string[] | null;
};

type ReleasedContactRpcRow = {
  release_status: LeadReleaseStatus;
  allowed_contact_fields: string[] | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  county: string | null;
};

const db = supabase as unknown as SupabaseClient;
const RELEASE_TABLE = "lead_contact_releases";
const ALLOWED_FIELDS: AllowedContactField[] = ["first_name", "last_name", "phone", "email", "city", "county"];

export const CONTACT_NOT_RELEASED_COPY = "Contact details have not been released yet. WindowMan will release contact information after internal routing approval.";
export const CONTACT_REVOKED_COPY = "Contact access has been revoked. Contact WindowMan for next steps.";
export const CONTACT_BLOCKED_COPY = "This opportunity is not available for contact release.";

function normalizeFields(fields: unknown): AllowedContactField[] {
  if (!Array.isArray(fields)) return [];
  return fields.filter((field): field is AllowedContactField => ALLOWED_FIELDS.includes(field as AllowedContactField));
}

function emptyState(status: LeadReleaseStatus, message: string): ContractorLeadReleaseState {
  return { status, allowedContactFields: [], contact: null, message };
}

function statusMessage(status: LeadReleaseStatus): string {
  if (status === "revoked") return CONTACT_REVOKED_COPY;
  if (status === "blocked") return CONTACT_BLOCKED_COPY;
  if (status === "held") return "Contact release is currently on hold while WindowMan reviews routing fit.";
  if (status === "manual_review") return "Contact release is in manual review.";
  return CONTACT_NOT_RELEASED_COPY;
}

export async function fetchContractorLeadRelease(assignmentId: string): Promise<ContractorLeadReleaseState> {
  const access = await fetchContractorAccountContext();
  if (!isContractorAccessAllowed(access) || !access.account) return emptyState("not_released", CONTACT_NOT_RELEASED_COPY);

  const { data: releaseData, error: releaseError } = await db
    .from(RELEASE_TABLE)
    .select("release_status, allowed_contact_fields")
    .eq("lead_assignment_id", assignmentId)
    .eq("contractor_account_id", access.account.contractorAccountId)
    .eq("client_slug", access.account.clientSlug)
    .maybeSingle();
  if (releaseError || !releaseData) return emptyState("not_released", CONTACT_NOT_RELEASED_COPY);

  const release = releaseData as ReleaseRow;
  const fields = normalizeFields(release.allowed_contact_fields);
  if (release.release_status !== "approved") return emptyState(release.release_status, statusMessage(release.release_status));
  if (fields.length === 0) {
    return { status: "approved", allowedContactFields: [], contact: null, message: "Contact release is approved, but no contact fields are currently available." };
  }

  const { data: rpcData, error: rpcError } = await db.rpc("get_contractor_released_contact", { _lead_assignment_id: assignmentId });
  if (rpcError || !Array.isArray(rpcData) || rpcData.length === 0) {
    return { status: "approved", allowedContactFields: fields, contact: null, message: "Contact release is approved, but contact details are not currently available." };
  }

  const row = rpcData[0] as ReleasedContactRpcRow;
  const rpcFields = normalizeFields(row.allowed_contact_fields);
  const contact: ContractorReleasedContact = {};
  if (rpcFields.includes("first_name") && row.first_name) contact.firstName = row.first_name;
  if (rpcFields.includes("last_name") && row.last_name) contact.lastName = row.last_name;
  if (rpcFields.includes("phone") && row.phone) contact.phone = row.phone;
  if (rpcFields.includes("email") && row.email) contact.email = row.email;
  if (rpcFields.includes("city") && row.city) contact.city = row.city;
  if (rpcFields.includes("county") && row.county) contact.county = row.county;

  return { status: "approved", allowedContactFields: rpcFields, contact, message: "Contact details released for this assignment." };
}
