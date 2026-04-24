/**
 * Contractor CRM Service
 * CRUD operations for contractor_leads, contractor_activity_log, contractor_followups
 */

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type {
  ContractorActivityLog,
  ContractorActivityType,
  ContractorFollowup,
  ContractorFollowupType,
  ContractorLead,
  ContractorLeadInsert,
  ContractorLeadUpdate,
  ContractorActivityLogInsert,
  ContractorFollowupInsert,
  ContractorFollowupUpdate,
  ContractorQualificationStatus,
  ContractorBookingStatus,
  ContractorPipelineStage,
  ContractorFollowupStatus,
} from "@/types/contractorLead";

type ContractorFollowupDbUpdate = Database["public"]["Tables"]["contractor_followups"]["Update"];

type JsonObject = Record<string, unknown>;

// ============================================================
// CONSTANTS
// ============================================================

/** Default source value for leads created from the contractors2 funnel */
export const DEFAULT_LEAD_SOURCE = "contractors2_page";

/** Default limit for paginated queries */
const DEFAULT_PAGE_LIMIT = 50;

// ============================================================
// INPUT TYPES
// ============================================================

export interface CreateContractorLeadInput {
  email: string;
  first_name?: string;
  last_name?: string;
  company_name?: string;
  phone?: string;
  service_area?: string;
  territory_requested?: string;
  average_job_size_band?: string;
  monthly_lead_volume_band?: string;
  close_rate_band?: string;
  installs_regularly?: string;
  response_speed?: string;
  follow_up_consistency?: string;
  wants_quality_over_volume?: string;
  source?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
}

export interface UpdateBookingStatusInput {
  leadId: string;
  bookingStatus: ContractorBookingStatus;
  calendlyEventUri?: string;
  calendlyInviteeUri?: string;
  calendlyEventStart?: string;
  calendlyEventEnd?: string;
}

export interface UpdatePipelineStageInput {
  leadId: string;
  pipelineStage: ContractorPipelineStage;
}

export interface ListContractorLeadsFilters {
  qualificationStatus?: ContractorQualificationStatus;
  bookingStatus?: ContractorBookingStatus;
  pipelineStage?: ContractorPipelineStage;
  serviceArea?: string;
  limit?: number;
  offset?: number;
}

// ============================================================
// ERROR HANDLING
// ============================================================

export class ContractorServiceError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "ContractorServiceError";
    this.code = code;
    this.status = status;
  }
}

// ============================================================
// CONTRACTOR LEADS
// ============================================================

/**
 * Create a new contractor lead
 */
export async function createContractorLead(
  input: CreateContractorLeadInput
): Promise<ContractorLead> {
  const insertData: ContractorLeadInsert = {
    email: input.email,
    first_name: input.first_name ?? null,
    last_name: input.last_name ?? null,
    company_name: input.company_name ?? null,
    phone: input.phone ?? null,
    service_area: input.service_area ?? null,
    territory_requested: input.territory_requested ?? null,
    average_job_size_band: input.average_job_size_band ?? null,
    monthly_lead_volume_band: input.monthly_lead_volume_band ?? null,
    close_rate_band: input.close_rate_band ?? null,
    installs_regularly: input.installs_regularly ?? null,
    response_speed: input.response_speed ?? null,
    follow_up_consistency: input.follow_up_consistency ?? null,
    wants_quality_over_volume: input.wants_quality_over_volume ?? null,
    qualification_status: "new",
    qualification_score: 0,
    booking_status: "not_started",
    calendly_event_uri: null,
    calendly_invitee_uri: null,
    calendly_event_start: null,
    calendly_event_end: null,
    pipeline_stage: "new",
    source: input.source ?? DEFAULT_LEAD_SOURCE,
    utm_source: input.utm_source ?? null,
    utm_medium: input.utm_medium ?? null,
    utm_campaign: input.utm_campaign ?? null,
    utm_content: input.utm_content ?? null,
    utm_term: input.utm_term ?? null,
    owner_name: null,
    notes: null,
  };

  const { data, error } = await supabase
    .from("contractor_leads")
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    throw new ContractorServiceError(
      "create_lead_failed",
      error.message,
      400
    );
  }

  return data as ContractorLead;
}

/**
 * Get a contractor lead by ID
 */
export async function getContractorLead(
  leadId: string
): Promise<ContractorLead | null> {
  const { data, error } = await supabase
    .from("contractor_leads")
    .select("*")
    .eq("id", leadId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new ContractorServiceError(
      "get_lead_failed",
      error.message,
      400
    );
  }

  return data as ContractorLead;
}

/**
 * Get a contractor lead by email
 */
export async function getContractorLeadByEmail(
  email: string
): Promise<ContractorLead | null> {
  const { data, error } = await supabase
    .from("contractor_leads")
    .select("*")
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null; // Not found
    }
    throw new ContractorServiceError(
      "get_lead_by_email_failed",
      error.message,
      400
    );
  }

  return data as ContractorLead;
}

/**
 * List contractor leads with optional filters
 */
export async function listContractorLeads(
  filters: ListContractorLeadsFilters = {}
): Promise<ContractorLead[]> {
  let query = supabase
    .from("contractor_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.qualificationStatus) {
    query = query.eq("qualification_status", filters.qualificationStatus);
  }
  if (filters.bookingStatus) {
    query = query.eq("booking_status", filters.bookingStatus);
  }
  if (filters.pipelineStage) {
    query = query.eq("pipeline_stage", filters.pipelineStage);
  }
  if (filters.serviceArea) {
    query = query.eq("service_area", filters.serviceArea);
  }

  // Handle pagination: use range() which covers both offset and limit
  const limit = filters.limit ?? DEFAULT_PAGE_LIMIT;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;

  if (error) {
    throw new ContractorServiceError(
      "list_leads_failed",
      error.message,
      400
    );
  }

  return (data ?? []) as ContractorLead[];
}

/**
 * Update a contractor lead
 */
export async function updateContractorLead(
  leadId: string,
  updates: ContractorLeadUpdate
): Promise<ContractorLead> {
  const { data, error } = await supabase
    .from("contractor_leads")
    .update(updates)
    .eq("id", leadId)
    .select()
    .single();

  if (error) {
    throw new ContractorServiceError(
      "update_lead_failed",
      error.message,
      400
    );
  }

  return data as ContractorLead;
}

/**
 * Update booking status with Calendly info
 */
export async function updateBookingStatus(
  input: UpdateBookingStatusInput
): Promise<ContractorLead> {
  const updates: ContractorLeadUpdate = {
    booking_status: input.bookingStatus,
  };

  if (input.calendlyEventUri !== undefined) {
    updates.calendly_event_uri = input.calendlyEventUri;
  }
  if (input.calendlyInviteeUri !== undefined) {
    updates.calendly_invitee_uri = input.calendlyInviteeUri;
  }
  if (input.calendlyEventStart !== undefined) {
    updates.calendly_event_start = input.calendlyEventStart;
  }
  if (input.calendlyEventEnd !== undefined) {
    updates.calendly_event_end = input.calendlyEventEnd;
  }

  return updateContractorLead(input.leadId, updates);
}

/**
 * Update pipeline stage
 * Note: This will trigger the log_contractor_pipeline_change trigger
 */
export async function updatePipelineStage(
  input: UpdatePipelineStageInput
): Promise<ContractorLead> {
  return updateContractorLead(input.leadId, {
    pipeline_stage: input.pipelineStage,
  });
}

/**
 * Update qualification status and score
 */
export async function updateQualificationStatus(
  leadId: string,
  status: ContractorQualificationStatus,
  score: number
): Promise<ContractorLead> {
  return updateContractorLead(leadId, {
    qualification_status: status,
    qualification_score: score,
  });
}

// ============================================================
// ACTIVITY LOG
// ============================================================

/**
 * Log an activity for a contractor lead
 */
export async function logContractorActivity(
  leadId: string,
  activityType: ContractorActivityType,
  activityData: JsonObject = {}
): Promise<ContractorActivityLog> {
  const insertData: ContractorActivityLogInsert = {
    contractor_lead_id: leadId,
    activity_type: activityType,
    activity_data: activityData,
  };

  const { data, error } = await supabase
    .from("contractor_activity_log")
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    throw new ContractorServiceError(
      "log_activity_failed",
      error.message,
      400
    );
  }

  return data as ContractorActivityLog;
}

/**
 * Get activity log for a contractor lead
 */
export async function getContractorActivityLog(
  leadId: string,
  limit = 50
): Promise<ContractorActivityLog[]> {
  const { data, error } = await supabase
    .from("contractor_activity_log")
    .select("*")
    .eq("contractor_lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new ContractorServiceError(
      "get_activity_log_failed",
      error.message,
      400
    );
  }

  return (data ?? []) as ContractorActivityLog[];
}

// ============================================================
// FOLLOWUPS
// ============================================================

/**
 * Schedule a followup for a contractor lead
 */
export async function scheduleFollowup(
  leadId: string,
  followupType: ContractorFollowupType,
  scheduledFor: string | Date,
  payload: JsonObject = {}
): Promise<ContractorFollowup> {
  const insertData: ContractorFollowupInsert = {
    contractor_lead_id: leadId,
    followup_type: followupType,
    scheduled_for: typeof scheduledFor === "string" 
      ? scheduledFor 
      : scheduledFor.toISOString(),
    status: "pending",
    sent_at: null,
    payload,
  };

  const { data, error } = await supabase
    .from("contractor_followups")
    .insert(insertData as any)
    .select()
    .single();

  if (error) {
    throw new ContractorServiceError(
      "schedule_followup_failed",
      error.message,
      400
    );
  }

  return data as ContractorFollowup;
}

/**
 * Get followups for a contractor lead
 */
export async function getContractorFollowups(
  leadId: string,
  status?: ContractorFollowupStatus
): Promise<ContractorFollowup[]> {
  let query = supabase
    .from("contractor_followups")
    .select("*")
    .eq("contractor_lead_id", leadId)
    .order("scheduled_for", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    throw new ContractorServiceError(
      "get_followups_failed",
      error.message,
      400
    );
  }

  return (data ?? []) as ContractorFollowup[];
}

/**
 * Update a followup status
 */
export async function updateFollowupStatus(
  followupId: string,
  status: ContractorFollowupStatus,
  sentAt?: string
): Promise<ContractorFollowup> {
  const updates: ContractorFollowupUpdate = { status };
  
  if (sentAt) {
    updates.sent_at = sentAt;
  } else if (status === "sent") {
    updates.sent_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("contractor_followups")
    .update(updates as ContractorFollowupDbUpdate)
    .eq("id", followupId)
    .select()
    .single();

  if (error) {
    throw new ContractorServiceError(
      "update_followup_status_failed",
      error.message,
      400
    );
  }

  return data as ContractorFollowup;
}

/**
 * Cancel pending followups for a lead
 */
export async function cancelPendingFollowups(
  leadId: string,
  followupType?: ContractorFollowupType
): Promise<number> {
  let query = supabase
    .from("contractor_followups")
    .update({ status: "canceled" } as ContractorFollowupDbUpdate)
    .eq("contractor_lead_id", leadId)
    .eq("status", "pending");

  if (followupType) {
    query = query.eq("followup_type", followupType);
  }

  const { data, error } = await query.select();

  if (error) {
    throw new ContractorServiceError(
      "cancel_followups_failed",
      error.message,
      400
    );
  }

  return data?.length ?? 0;
}

/**
 * Get pending followups due for processing
 */
export async function getPendingFollowupsDue(
  asOf?: Date
): Promise<ContractorFollowup[]> {
  const now = asOf ?? new Date();

  const { data, error } = await supabase
    .from("contractor_followups")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true });

  if (error) {
    throw new ContractorServiceError(
      "get_pending_followups_failed",
      error.message,
      400
    );
  }

  return (data ?? []) as ContractorFollowup[];
}

// ============================================================
// RE-EXPORTS
// ============================================================

export type {
  ContractorActivityLog,
  ContractorActivityType,
  ContractorFollowup,
  ContractorFollowupType,
  ContractorFollowupStatus,
  ContractorLead,
  ContractorLeadInsert,
  ContractorLeadUpdate,
  ContractorQualificationStatus,
  ContractorBookingStatus,
  ContractorPipelineStage,
} from "@/types/contractorLead";
