/**
 * Contractor Opportunity Signals — Sprint 1
 *
 * Pure, deterministic, frontend-only helpers for the Contractor Opportunity
 * Command Center. NO Supabase calls. NO React hooks. NO side effects.
 * NO AI. All inputs are optional and null-safe — the page must continue
 * working when live backend data does not include the new signal fields.
 */

/* ── Frontend-only signal contract ───────────────────────────────── */

export interface OpportunitySignalFields {
  // Existing required fields the helpers may read (kept loose on purpose
  // so this module can accept either the page's local `Opportunity` shape
  // or any superset, without circular imports).
  priority_score?: number;
  grade?: string | null;
  red_flag_count?: number;
  amber_flag_count?: number;
  window_count?: number | null;
  quote_range?: string | null;
  has_document?: boolean;
  created_at?: string;
  credit_balance?: number;

  // Sprint 1 optional signal fields (all nullable-safe)
  buyer_seriousness_score?: number | null;
  buyer_seriousness_band?: "A" | "B" | "C" | "D" | null;
  property_type_detail?: string | null;
  hoa_or_condo_complexity?: string | null;
  timeline_bucket?: string | null;
  motivation_reason?: string | null;
  handoff_consent_status?: string | null;
  last_activity_at?: string | null;
  phone_verified_at?: string | null;
  report_viewed_at?: string | null;
  best_sales_angle?: string | null;
  recommended_action?: string | null;
  exclusive_status?: string | null;
  contractor_view_count?: number | null;
  unlocked_by_other_count?: number | null;
  credit_cost?: number | null;
}

export interface MetaShape {
  credit_balance?: number;
}

/* ── 1. formatRelativeTime ───────────────────────────────────────── */

export function formatRelativeTime(date: string | null | undefined): string | null {
  if (!date) return null;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return null;

  const diffMs = Date.now() - t;
  if (diffMs < 0) return "Uploaded just now";

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Uploaded just now";
  if (minutes < 60) return `Uploaded ${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Uploaded ${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `Uploaded ${days}d ago`;

  const months = Math.floor(days / 30);
  return `Uploaded ${months}mo ago`;
}

/* ── 2. getBuyerSeriousness ──────────────────────────────────────── */

export function getBuyerSeriousness(opp: OpportunitySignalFields): {
  score: number | null;
  band: "A" | "B" | "C" | "D" | null;
  label: string | null;
} {
  let score: number | null = null;
  if (typeof opp.buyer_seriousness_score === "number") {
    score = opp.buyer_seriousness_score;
  } else if (typeof opp.priority_score === "number") {
    score = opp.priority_score;
  }

  if (score == null) return { score: null, band: null, label: null };

  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  let band: "A" | "B" | "C" | "D";
  if (clamped >= 90) band = "A";
  else if (clamped >= 75) band = "B";
  else if (clamped >= 55) band = "C";
  else band = "D";

  return { score: clamped, band, label: `BSS ${clamped} · ${band}` };
}

/* ── 3. getPropertyBadge ─────────────────────────────────────────── */

export function getPropertyBadge(opp: OpportunitySignalFields): string {
  switch (opp.property_type_detail) {
    case "single_family":
      return "Single-Family";
    case "condo":
      return "Condo";
    case "high_rise":
      return "High-Rise";
    case "townhouse_villa":
      return "Townhouse/Villa";
    case "multifamily_investment":
      return "Multi-Family";
    default:
      return "Property Unknown";
  }
}

/* ── 4. getTimelineBadge ─────────────────────────────────────────── */

export function getTimelineBadge(opp: OpportunitySignalFields): string {
  switch (opp.timeline_bucket) {
    case "asap":
      return "ASAP";
    case "this_month":
      return "Ready This Month";
    case "one_to_three_months":
      return "1–3 Months";
    case "three_to_six_months":
      return "3–6 Months";
    case "researching":
      return "Just Researching";
    default:
      return "Timeline Unknown";
  }
}

/* ── 5. getMotivationBadge ───────────────────────────────────────── */

export function getMotivationBadge(opp: OpportunitySignalFields): string {
  switch (opp.motivation_reason) {
    case "price_felt_high":
    case "price_shock":
      return "Price Check";
    case "contractor_bad_vibe":
    case "trust_breakdown":
      return "Trust Issue";
    case "unclear_scope":
    case "scope_mismatch":
      return "Scope Issue";
    case "insurance_or_inspection_pressure":
      return "Insurance/Code";
    case "comparing_before_signing":
      return "Comparing";
    case "wants_better_price":
      return "Better Price";
    default:
      return "Motivation Unknown";
  }
}

/* ── 6. getHandoffSignal ─────────────────────────────────────────── */

export type HandoffTone = "hot" | "warm" | "caution" | "muted";

export function getHandoffSignal(opp: OpportunitySignalFields): {
  label: string;
  tone: HandoffTone;
  isCallReady: boolean;
} {
  switch (opp.handoff_consent_status) {
    case "accepted_today":
      return { label: "Warm Handoff · Today", tone: "hot", isCallReady: true };
    case "accepted_tomorrow":
      return { label: "Warm Handoff · Tomorrow", tone: "warm", isCallReady: true };
    case "text_or_email_first":
      return { label: "Text First", tone: "caution", isCallReady: false };
    case "report_only":
      return { label: "Report Only", tone: "muted", isCallReady: false };
    default:
      return { label: "No Call Consent Yet", tone: "muted", isCallReady: false };
  }
}

/* ── 7. getBestSalesAngle ────────────────────────────────────────── */

export function getBestSalesAngle(opp: OpportunitySignalFields): string {
  if (opp.best_sales_angle && opp.best_sales_angle.trim().length > 0) {
    return opp.best_sales_angle;
  }

  const m = opp.motivation_reason;
  if (m === "price_felt_high" || m === "price_shock") return "Angle: Price Confidence";
  if (m === "trust_breakdown" || m === "contractor_bad_vibe") return "Angle: Trust Repair";
  if (m === "scope_mismatch" || m === "unclear_scope") return "Angle: Scope Clarity";
  if (m === "insurance_or_inspection_pressure") return "Angle: Code/Insurance Proof";

  const grade = opp.grade ?? null;
  const reds = opp.red_flag_count ?? 0;
  if ((grade === "D" || grade === "F") && reds >= 3) return "Angle: Rescue Quote";
  if ((grade === "A" || grade === "B") && reds <= 1 && (opp.amber_flag_count ?? 0) <= 1) {
    return "Angle: Validation / Premium Option";
  }

  return "Angle: Same-Scope Review";
}

/* ── 8. getRecommendedAction ─────────────────────────────────────── */

export function getRecommendedAction(opp: OpportunitySignalFields): string {
  if (opp.recommended_action && opp.recommended_action.trim().length > 0) {
    return opp.recommended_action;
  }

  const handoff = opp.handoff_consent_status;
  const bss = getBuyerSeriousness(opp).score ?? 0;

  if (handoff === "accepted_today" && bss >= 85) return "Call within 30 minutes";
  if (handoff === "accepted_tomorrow") return "Call tomorrow as requested";
  if (handoff === "text_or_email_first") return "Text first, then call";
  if (handoff === "report_only") return "Nurture only — no warm call yet";

  if (opp.timeline_bucket === "researching") return "Nurture — not urgent";
  if (opp.property_type_detail === "condo" || opp.property_type_detail === "high_rise") {
    return "Confirm HOA/engineering constraints first";
  }

  return "Review sales brief before calling";
}

/* ── 9. getCreditCost ────────────────────────────────────────────── */

export function getCreditCost(opp: OpportunitySignalFields): number {
  if (typeof opp.credit_cost === "number" && opp.credit_cost > 0) return opp.credit_cost;
  return 1;
}

/* ── 10. getCreditCostLine ───────────────────────────────────────── */

export function getCreditCostLine(
  opp: OpportunitySignalFields,
  meta: MetaShape | null,
): string {
  const cost = getCreditCost(opp);
  const balance =
    typeof opp.credit_balance === "number"
      ? opp.credit_balance
      : typeof meta?.credit_balance === "number"
        ? meta.credit_balance
        : 0;
  const remaining = Math.max(0, balance - cost);
  return `Spend ${cost} credit${cost === 1 ? "" : "s"} · You'll have ${remaining} left`;
}

/* ── 11. getUnlockIncludes ───────────────────────────────────────── */

export function getUnlockIncludes(): string[] {
  return ["Homeowner contact", "Quote weakness summary", "Opening script", "Sales angle"];
}

/* ── 12. getBestUnlockScore ──────────────────────────────────────── */

export function getBestUnlockScore(opp: OpportunitySignalFields): number {
  let base = 0;
  if (typeof opp.buyer_seriousness_score === "number") base = opp.buyer_seriousness_score;
  else if (typeof opp.priority_score === "number") base = opp.priority_score;

  let score = base;

  if (opp.handoff_consent_status === "accepted_today") score += 15;
  else if (opp.handoff_consent_status === "accepted_tomorrow") score += 10;
  else if (opp.handoff_consent_status === "report_only") score -= 25;

  if (opp.timeline_bucket === "asap") score += 10;
  else if (opp.timeline_bucket === "this_month") score += 8;
  else if (opp.timeline_bucket === "researching") score -= 10;

  if (opp.has_document === true) score += 8;

  if (opp.created_at) {
    const t = Date.parse(opp.created_at);
    if (!Number.isNaN(t) && Date.now() - t <= 24 * 60 * 60 * 1000) score += 5;
  }

  if (opp.phone_verified_at) score += 5;

  if (!opp.property_type_detail) score -= 8;

  return Math.max(0, Math.min(130, score));
}

/* ── 13. getCompetitionSignal — anti-fake-scarcity guardrail ─────── */
/**
 * Returns a competition/exclusivity label ONLY when:
 *  - We are in preview mode and the mock opportunity carries explicit fields, OR
 *  - We are in live mode AND the opportunity actually carries explicit
 *    backend fields (`exclusive_status`, `contractor_view_count`,
 *    `unlocked_by_other_count`).
 *
 * Hard rule: missing fields render NOTHING. Never infer scarcity from
 * absence. No fake timers. No fake first-look windows. No fake competition.
 */
export type CompetitionTone = "exclusive" | "warm" | "competitive" | "muted";

export function getCompetitionSignal(
  opp: OpportunitySignalFields & {
    exclusive_status?: string | null;
    contractor_view_count?: number | null;
    unlocked_by_other_count?: number | null;
  },
  isPreview: boolean,
): { label: string; tone: CompetitionTone } | null {
  const hasExplicit =
    opp.exclusive_status != null ||
    typeof opp.contractor_view_count === "number" ||
    typeof opp.unlocked_by_other_count === "number";

  // In live mode, render NOTHING unless explicit fields exist.
  if (!isPreview && !hasExplicit) return null;
  // In preview mode without any explicit field, also render nothing —
  // we never invent scarcity even for mocks.
  if (isPreview && !hasExplicit) return null;

  const unlockedByOthers = opp.unlocked_by_other_count ?? 0;
  if (unlockedByOthers > 0) {
    return {
      label: `${unlockedByOthers} contractor${unlockedByOthers === 1 ? "" : "s"} unlocked`,
      tone: "competitive",
    };
  }

  switch (opp.exclusive_status) {
    case "first_look":
      return { label: "First Look", tone: "exclusive" };
    case "exclusive_preview":
      return { label: "Exclusive Preview", tone: "exclusive" };
    case "no_contractor_unlocked":
      return { label: "No contractor unlocked yet", tone: "warm" };
    default:
      break;
  }

  const views = opp.contractor_view_count ?? 0;
  if (views > 0) {
    return { label: `${views} contractor${views === 1 ? "" : "s"} viewed`, tone: "muted" };
  }

  return null;
}
