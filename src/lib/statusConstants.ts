/**
 * statusConstants.ts — Centralized lifecycle status strings for the WindowMan marketplace.
 * Prevents magic strings across codebase.
 */

// ── Route statuses ──
export const ROUTE_STATUS = {
  SUGGESTED: 'suggested',
  ASSIGNED: 'assigned',
  SENT: 'sent',
  VIEWED: 'viewed',
  INTERESTED: 'interested',
  DECLINED: 'declined',
  EXPIRED: 'expired',
} as const;

// ── Release statuses (on route) ──
export const RELEASE_STATUS = {
  NONE: 'none',
  PENDING_REVIEW: 'pending_review',
  APPROVED: 'approved',
  DENIED: 'denied',
  RELEASED: 'released',
} as const;

// ── Opportunity statuses ──
export const OPP_STATUS = {
  INTRO_REQUESTED: 'intro_requested',
  BRIEF_GENERATING: 'brief_generating',
  BRIEF_READY: 'brief_ready',
  QUEUED: 'queued',
  ASSIGNED_INTERNAL: 'assigned_internal',
  SENT_TO_CONTRACTOR: 'sent_to_contractor',
  CONTRACTOR_INTERESTED: 'contractor_interested',
  CONTRACTOR_DECLINED: 'contractor_declined',
  HOMEOWNER_CONTACT_RELEASED: 'homeowner_contact_released',
  INTRO_COMPLETED: 'intro_completed',
  CLOSED_WON: 'closed_won',
  CLOSED_LOST: 'closed_lost',
  DEAD: 'dead',
} as const;

// ── Billing statuses ──
export const BILLING_STATUS = {
  PENDING: 'pending',
  BILLABLE: 'billable',
  INVOICED: 'invoiced',
  PAID: 'paid',
  WAIVED: 'waived',
  REFUNDED: 'refunded',
  DISPUTED: 'disputed',
  VOID: 'void',
} as const;

// ── Billing models ──
export const BILLING_MODEL = {
  FLAT_FEE: 'flat_fee',
  REFERRAL_FEE: 'referral_fee',
  PILOT: 'pilot',
  INTERNAL: 'internal',
  WAIVED: 'waived',
} as const;

// ── Appointment statuses ──
export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  BOOKED: 'booked',
  NO_SHOW: 'no_show',
  CANCELED: 'canceled',
} as const;

// ── Quote statuses ──
export const QUOTE_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  NOT_SUBMITTED: 'not_submitted',
} as const;

// ── Deal statuses ──
export const DEAL_STATUS = {
  OPEN: 'open',
  WON: 'won',
  LOST: 'lost',
  DEAD: 'dead',
} as const;

// ── Event names ──
export const EVENTS = {
  // Economic funnel
  CONTRACTOR_INTEREST_SUBMITTED: 'contractor_interest_submitted',
  CONTACT_RELEASE_REVIEW_STARTED: 'contact_release_review_started',
  CONTACT_RELEASE_APPROVED: 'contact_release_approved',
  CONTACT_RELEASE_DENIED: 'contact_release_denied',
  HOMEOWNER_CONTACT_RELEASED: 'homeowner_contact_released',
  BILLABLE_INTRO_CREATED: 'billable_intro_created',
  CONTRACTOR_OUTCOME_INITIALIZED: 'contractor_outcome_record_initialized',
  // Billing
  BILLABLE_INTRO_MARKED_INVOICED: 'billable_intro_marked_invoiced',
  BILLABLE_INTRO_MARKED_PAID: 'billable_intro_marked_paid',
  BILLABLE_INTRO_MARKED_WAIVED: 'billable_intro_marked_waived',
  BILLABLE_INTRO_MARKED_REFUNDED: 'billable_intro_marked_refunded',
  BILLABLE_INTRO_MARKED_DISPUTED: 'billable_intro_marked_disputed',
  // Outcomes
  APPOINTMENT_BOOKED: 'appointment_booked',
  REPLACEMENT_QUOTE_SUBMITTED: 'replacement_quote_submitted',
  DEAL_OUTCOME_UPDATED: 'deal_outcome_updated',
  // Phase 3.4A — Match + Call Momentum
  SUGGESTED_MATCH_GENERATED: 'suggested_match_generated',
  SUGGESTED_MATCH_SHOWN: 'suggested_match_shown_to_homeowner',
  SUGGESTED_MATCH_UNAVAILABLE: 'suggested_match_unavailable',
  SUGGESTED_MATCH_VIEWED_ADMIN: 'suggested_match_viewed_in_admin',
  SUGGESTED_MATCH_CONFIRMED: 'suggested_match_confirmed',
  SUGGESTED_MATCH_OVERRIDDEN: 'suggested_match_overridden',
  INTRO_CALL_REQUESTED: 'intro_call_requested',
  REPORT_HELP_CALL_REQUESTED: 'report_help_call_requested',
  VOICE_FOLLOWUP_QUEUED: 'voice_followup_queued',
  VOICE_FOLLOWUP_SENT: 'voice_followup_webhook_sent',
  VOICE_FOLLOWUP_FAILED: 'voice_followup_failed',
  MANIFESTO_SECTION_VIEWED: 'manifesto_section_viewed',
  MANIFESTO_PAGE_OPENED: 'manifesto_page_opened',
} as const;

// ── Disposition states (partner CRM workflow) ──
export const DISPOSITION_STATE = {
  NEW: 'new',
  ATTEMPTING_CONTACT: 'attempting_contact',
  MEETING_SCHEDULED: 'meeting_scheduled',
  QUOTE_DELIVERED: 'quote_delivered',
  SOLD_CLOSED: 'sold_closed',
  LOST_DEAD: 'lost_dead',
} as const;

export type DispositionState = typeof DISPOSITION_STATE[keyof typeof DISPOSITION_STATE];

// ── Disposition reason codes (required when lost_dead) ──
export const DISPOSITION_REASON_CODE = {
  PRICE_TOO_HIGH: 'price_too_high',
  CHOSE_COMPETITOR: 'chose_competitor',
  NO_LONGER_INTERESTED: 'no_longer_interested',
  UNRESPONSIVE: 'unresponsive',
  PROJECT_CANCELED: 'project_canceled',
  OUT_OF_SERVICE_AREA: 'out_of_service_area',
  OTHER: 'other',
} as const;

export type DispositionReasonCode = typeof DISPOSITION_REASON_CODE[keyof typeof DISPOSITION_REASON_CODE];

// ── Legal disposition state transitions ──
export const DISPOSITION_TRANSITIONS: Record<DispositionState, DispositionState[]> = {
  new: ['attempting_contact', 'lost_dead'],
  attempting_contact: ['meeting_scheduled', 'lost_dead'],
  meeting_scheduled: ['quote_delivered', 'lost_dead'],
  quote_delivered: ['sold_closed', 'lost_dead'],
  sold_closed: [],
  lost_dead: [],
};
