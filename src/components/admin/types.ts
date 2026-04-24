/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Lead Sniper CRM — Shared Types
 * ═══════════════════════════════════════════════════════════════════════════
 */

// ─── CRM Lead ───────────────────────────────────────────────────────────
// Mapped from the `leads` table — only the columns the CRM actually needs.

export interface CRMLead {
  id: string;
  session_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_e164: string | null;
  county: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  grade: string | null;
  grade_score: number | null;
  window_count: number | null;
  quote_amount: number | null;
  phone_verified: boolean;
  phone_verified_at: string | null;
  latest_analysis_id: string | null;
  latest_scan_session_id: string | null;
  latest_opportunity_id: string | null;
  status: string | null;
  funnel_stage: string | null;
  flag_count: number;
  red_flag_count: number;
  amber_flag_count: number;
  critical_flag_count: number;
  confidence_score: number | null;
  lead_score: number | null;
  scan_count: number;
  created_at: string;
  updated_at: string;

  /** CRM deal workflow status */
  deal_status: string | null;
  /** Last call intent from voice followup */
  last_call_intent: string | null;

  /** Future-proofing: defaults to 'Primary Client' in the UI layer */
  assigned_partner: string;

  // ─── Project Specs ─────────────────────────────────────────────────
  project_type: string | null;
  quote_range: string | null;

  // ─── Attribution ───────────────────────────────────────────────────
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  gclid: string | null;
  fbclid: string | null;
  landing_page_url: string | null;
  initial_referrer: string | null;

  // ─── Timeline Timestamps ──────────────────────────────────────────
  report_unlocked_at: string | null;
  intro_requested_at: string | null;

  // ─── Phase 7 — Ownership / Lifecycle (all repo-real on `leads`) ─
  routed_to_contractor_at: string | null;
  appointment_booked_at: string | null;
  replacement_quote_submitted_at: string | null;
  closed_at: string | null;
  reactivation_email_sent_at: string | null;
  last_call_completed_at: string | null;
  last_call_status: string | null;
  last_call_outcome: string | null;
  last_call_summary: string | null;

  // ─── Phase 25 — Revenue (repo-real on `leads`) ─────────────────────
  deal_value: number | null;
  revenue_amount: number | null;
}

/** Derive pipeline status from raw lead data */
export type PipelineStatus =
  | "scanning"
  | "pending_otp"
  | "verified"
  | "webhook_sent"
  | "closed_won"
  | "ghost";

export function derivePipelineStatus(lead: CRMLead): PipelineStatus {
  if (lead.status === "closed_won") return "closed_won";
  if (lead.phone_verified && lead.latest_analysis_id) return "verified";
  if (lead.latest_analysis_id && !lead.phone_verified) return "ghost";
  if (lead.scan_count > 0 && !lead.latest_analysis_id) return "scanning";
  return "pending_otp";
}

// ─── Lead Event ─────────────────────────────────────────────────────────
// Mapped from the `lead_events` table.

export interface LeadEvent {
  id: string;
  lead_id: string;
  event_name: string;
  event_source: string | null;
  event_id: string | null;
  status: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  opportunity_id: string | null;
  voice_followup_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Webhook Delivery ───────────────────────────────────────────────────
// Mapped from the `webhook_deliveries` table.

export interface WebhookDelivery {
  id: string;
  lead_id: string;
  event_type: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_http_status: number | null;
  last_error: string | null;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  webhook_url: string | null;
  payload_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

// ─── KPI Summaries ──────────────────────────────────────────────────────

export interface CommandCenterKPIs {
  totalScans: number;
  verifiedLeads: number;
  ghostLeads: number;
  webhooksPending: number;
  webhooksDelivered: number;
  webhooksFailed: number;
  webhooksDeadLetter: number;
}

// ─── Analysis Data (for Dossier) ────────────────────────────────────────

export interface AnalysisFlag {
  flag: string;
  severity: string;
  pillar?: string;
  detail?: string;
}

export interface LeadAnalysisData {
  grade: string | null;
  dollar_delta: number | null;
  confidence_score: number | null;
  flags: AnalysisFlag[];
  full_json: Record<string, unknown> | null;
}

// ─── Voice Followup Summary (for CRM table) ────────────────────────────

export interface VoiceFollowupSummary {
  lead_id: string;
  status: string;
  call_outcome: string | null;
  created_at: string;
}

// ─── Phase 26 — Truth Strip Drilldown ──────────────────────────────────
// Compact lead row returned by `fetch_stage_leads` for in-place forensic
// triage from Mission Control. Mirrors the canonical timestamp predicates
// used by the shared funnelMetrics engine.

export interface StageLeadRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  city: string | null;
  county: string | null;
  grade: string | null;
  flag_count: number | null;
  red_flag_count: number | null;
  latest_analysis_id: string | null;
  latest_scan_session_id: string | null;
  latest_opportunity_id: string | null;
  deal_value: number | null;
  revenue_amount: number | null;
  deal_status: string | null;
  created_at: string;
  updated_at: string;
  phone_verified_at: string | null;
  routed_to_contractor_at: string | null;
  appointment_booked_at: string | null;
  closed_at: string | null;
  scan_count: number | null;
  /** Whichever stage timestamp matched the requested stage. */
  stage_timestamp: string | null;
}

export interface QuoteEvidence {
  signed_url: string | null;
  file_name: string | null;
  scan_session_id: string | null;
  expires_in: number;
}
