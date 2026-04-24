/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Phase 10 — Human Context Layer (deterministic helpers)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Pure functions only. No network, no React, no AI.
 * Consumed by:
 *   - src/components/admin/lead-workspace/LeadHumanContextPanel.tsx
 *   - src/components/admin/RoutingDesk.tsx (badges)
 *
 * Every value is derived from canonical repo-real fields:
 *   - leads.timeline_bucket
 *   - leads.property_type_detail        (Phase 10 column)
 *   - leads.hoa_or_condo_complexity     (Phase 10 column)
 *   - leads.handoff_consent_status      (Phase 10 column)
 *   - leads.first_name
 *   - leads.county
 *   - diagnosis_intakes.primary_diagnosis
 *   - diagnosis_intakes.secondary_clarifiers
 *   - contractor_opportunity_routes.contractor_id (→ contractors.company_name)
 *   - analyses.flags[0]   (top forensic flag)
 */

// ─────────────────────────────────────────────────────────────────────────────
// Enum vocabularies (kept in sync with the Phase 10 migration column comments
// and validated server-side in update-homeowner-context).
// ─────────────────────────────────────────────────────────────────────────────

export const PROPERTY_TYPE_VALUES = [
  "single_family",
  "condo",
  "townhouse_villa",
  "high_rise",
  "multifamily_investment",
] as const;
export type PropertyTypeDetail = (typeof PROPERTY_TYPE_VALUES)[number];

export const HOA_COMPLEXITY_VALUES = [
  "none",
  "hoa_simple",
  "hoa_complex",
  "high_rise_engineering",
  "unknown",
] as const;
export type HoaComplexity = (typeof HOA_COMPLEXITY_VALUES)[number];

export const HANDOFF_CONSENT_VALUES = [
  "accepted_today",
  "accepted_tomorrow",
  "text_or_email_first",
  "report_only",
  "unknown",
] as const;
export type HandoffConsentStatus = (typeof HANDOFF_CONSENT_VALUES)[number];

export const TIMELINE_BUCKETS = [
  "asap",
  "this_month",
  "one_to_three_months",
  "three_to_six_months",
  "researching",
] as const;
export type TimelineBucket = (typeof TIMELINE_BUCKETS)[number];

// Reused from src/pages/diagnosis (homeowner intake) — do not invent new codes.
export type PrimaryDiagnosis =
  | "price_shock"
  | "trust_breakdown"
  | "financial"
  | "timing"
  | "scope_mismatch"
  | "other";

// ─────────────────────────────────────────────────────────────────────────────
// Display helpers
// ─────────────────────────────────────────────────────────────────────────────

export function propertyTypeLabel(v: string | null | undefined): string | null {
  switch (v) {
    case "single_family": return "Single-family home";
    case "condo": return "Condo";
    case "townhouse_villa": return "Townhouse / villa";
    case "high_rise": return "High-rise unit";
    case "multifamily_investment": return "Multi-family / investment";
    default: return null;
  }
}

export function hoaComplexityLabel(v: string | null | undefined): string | null {
  switch (v) {
    case "none": return "No HOA";
    case "hoa_simple": return "HOA — simple approval";
    case "hoa_complex": return "HOA — complex approval";
    case "high_rise_engineering": return "High-rise — engineering review";
    case "unknown": return "HOA unknown";
    default: return null;
  }
}

export function timelineLabel(v: string | null | undefined): string | null {
  switch (v) {
    case "asap": return "Wants to move forward ASAP";
    case "this_month": return "Wants to move forward this month";
    case "one_to_three_months": return "1–3 months";
    case "three_to_six_months": return "3–6 months";
    case "researching": return "Just researching";
    default: return null;
  }
}

export function timelineShortChip(v: string | null | undefined): string | null {
  switch (v) {
    case "asap": return "ASAP";
    case "this_month": return "This month";
    case "one_to_three_months": return "1–3 mo";
    case "three_to_six_months": return "3–6 mo";
    case "researching": return "Researching";
    default: return null;
  }
}

export function handoffConsentLabel(v: string | null | undefined): {
  short: string;
  full: string;
  homeownerToldCopy: string | null;
} | null {
  switch (v) {
    case "accepted_today":
      return {
        short: "Warm: today",
        full: "Warm handoff accepted — call today",
        homeownerToldCopy:
          "A WindowMan-vetted contractor may call today to review a same-scope option.",
      };
    case "accepted_tomorrow":
      return {
        short: "Warm: tomorrow",
        full: "Warm handoff accepted — call tomorrow",
        homeownerToldCopy:
          "A WindowMan-vetted contractor will reach out tomorrow to review a same-scope option.",
      };
    case "text_or_email_first":
      return {
        short: "Text first",
        full: "Text or email first — no cold call",
        homeownerToldCopy:
          "We'll text or email you first before any contractor calls.",
      };
    case "report_only":
      return {
        short: "Report only",
        full: "Report only — do NOT cold call",
        homeownerToldCopy: null,
      };
    case "unknown":
      return {
        short: "Consent unknown",
        full: "No explicit contractor handoff captured",
        homeownerToldCopy: null,
      };
    default:
      return null;
  }
}

export function motivationLabelFromDiagnosis(
  v: string | null | undefined,
): { short: string; long: string } | null {
  switch (v) {
    case "price_shock":
      return { short: "Price felt high", long: "Homeowner uploaded because the price felt too high or unclear." };
    case "trust_breakdown":
      return { short: "Trust", long: "Homeowner uploaded because they didn't trust the salesperson." };
    case "financial":
      return { short: "Financing", long: "Homeowner uploaded because the price structure / financing didn't work." };
    case "timing":
      return { short: "Timing", long: "Homeowner uploaded because the timing felt off." };
    case "scope_mismatch":
      return { short: "Scope", long: "Homeowner uploaded because the scope didn't match what they wanted." };
    case "other":
      return { short: "Other", long: "Homeowner uploaded for a custom reason — see free-text notes." };
    default:
      return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lead Fit Warnings
// ─────────────────────────────────────────────────────────────────────────────

export interface LeadFitWarning {
  code: string;
  severity: "info" | "warn" | "block";
  message: string;
}

export interface DeriveWarningsInput {
  property_type_detail: string | null | undefined;
  hoa_or_condo_complexity: string | null | undefined;
  handoff_consent_status: string | null | undefined;
  timeline_bucket: string | null | undefined;
  primary_diagnosis: string | null | undefined;
  secondary_clarifier_count?: number;
}

export function deriveLeadFitWarnings(
  input: DeriveWarningsInput,
): LeadFitWarning[] {
  const warnings: LeadFitWarning[] = [];

  // Block-tier — operator must see this first.
  if (input.handoff_consent_status === "report_only") {
    warnings.push({
      code: "report_only",
      severity: "block",
      message: "Do not call as warm lead. Homeowner requested report only.",
    });
  }

  // Complex approval path.
  if (
    input.property_type_detail === "condo" ||
    input.property_type_detail === "high_rise" ||
    input.hoa_or_condo_complexity === "hoa_complex" ||
    input.hoa_or_condo_complexity === "high_rise_engineering"
  ) {
    warnings.push({
      code: "complex_approval",
      severity: "warn",
      message:
        "Complex approval path — confirm HOA / engineering requirements before quoting.",
    });
  }

  // Property type missing.
  if (!input.property_type_detail) {
    warnings.push({
      code: "property_unknown",
      severity: "info",
      message: "Property type unknown — ask early before discussing price.",
    });
  }

  // Low immediate urgency.
  if (input.timeline_bucket === "researching") {
    warnings.push({
      code: "low_urgency",
      severity: "info",
      message:
        "Low immediate urgency — nurture before dispatching senior sales rep.",
    });
  }

  // Possible price shopper — price_shock with no scope nuance.
  if (
    input.primary_diagnosis === "price_shock" &&
    (input.secondary_clarifier_count ?? 0) === 0
  ) {
    warnings.push({
      code: "possible_price_shopper",
      severity: "info",
      message:
        "Possible price shopper — lead with scope/value comparison, not discounting.",
    });
  }

  return warnings;
}

// ─────────────────────────────────────────────────────────────────────────────
// Recommended Opening Script (deterministic, no AI)
// ─────────────────────────────────────────────────────────────────────────────

export interface OpeningScriptInput {
  homeownerFirstName: string | null | undefined;
  contractorName: string | null | undefined;
  topFlag: string | null | undefined;
  primary_diagnosis: string | null | undefined;
  property_type_detail: string | null | undefined;
  hoa_or_condo_complexity: string | null | undefined;
  timeline_bucket: string | null | undefined;
  handoff_consent_status: string | null | undefined;
}

export interface OpeningScriptOutput {
  script: string;
  isUrgent: boolean;
  isReportOnly: boolean;
}

function focusLineFor(diagnosis: string | null | undefined): string {
  switch (diagnosis) {
    case "price_shock":
      return "so I want to walk you through an apples-to-apples comparison before you sign anything.";
    case "trust_breakdown":
      return "and I'll keep this clear and pressure-free — just facts.";
    case "financial":
      return "and I'll show you payment paths that actually fit your budget.";
    case "scope_mismatch":
      return "so we get the scope right before any pricing conversation.";
    case "timing":
      return "no pressure on timing — I just want you informed when you're ready.";
    default:
      return "so you can compare on facts, not pressure.";
  }
}

export function buildOpeningScript(
  input: OpeningScriptInput,
): OpeningScriptOutput {
  const isReportOnly = input.handoff_consent_status === "report_only";
  const isUrgent =
    input.timeline_bucket === "asap" || input.timeline_bucket === "this_month";

  const firstName = input.homeownerFirstName?.trim() || "there";
  const contractorName = input.contractorName?.trim() || "your assigned contractor";

  const greeting = `Hi ${firstName}, this is ${contractorName}.`;

  const preamble = isReportOnly
    ? "I'm following up on the report you requested from WindowMan."
    : "WindowMan asked me to follow up on the quote you scanned.";

  const hookSentence = input.topFlag
    ? `The main thing I noticed is that ${input.topFlag.trim().replace(/\.$/, "")}, ${focusLineFor(input.primary_diagnosis)}`
    : focusLineFor(input.primary_diagnosis).replace(/^so /, "I just want to make sure ");

  const condoLine =
    input.property_type_detail === "condo" ||
    input.property_type_detail === "high_rise" ||
    input.hoa_or_condo_complexity === "hoa_complex" ||
    input.hoa_or_condo_complexity === "high_rise_engineering"
      ? " Before we talk price, I want to confirm the HOA / engineering requirements for your building."
      : "";

  const script = `${greeting} ${preamble} ${hookSentence}${condoLine}`.replace(/\s+/g, " ").trim();

  return { script, isUrgent, isReportOnly };
}
