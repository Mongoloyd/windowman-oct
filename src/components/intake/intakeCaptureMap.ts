/**
 * intakeCaptureMap.ts — deterministic, typed mappers from the local intake
 * vocabulary to the EXACT enum values the `capture-arbitrage-lead` Edge
 * Function accepts.
 *
 * The backend validates these strictly (see
 * supabase/functions/capture-arbitrage-lead/index.ts):
 *   - scope     ∈ { "1-5", "6-10", "11-15", "15+" }            (required on create)
 *   - hasEstimate ∈ { "Yes", "No" }
 *   - dealBreaker ∈ { "Price", "Company Reputation", "Timing", "Financing", "Other" }
 *   - call_intent ∈ { "Yes", "No" }
 *   - timeframe   ∈ { "1 Month", "2-3 Months", "Just Researching" }
 *
 * This module has NO side effects and imports NO supabase / tracking code.
 */
import type {
  CallIntentChoice,
  IntakeBucket,
  ProjectSize,
  ThreatConcern,
  Timeline,
} from "./intakeTypes";

export type BackendScope = "1-5" | "6-10" | "11-15" | "15+";
export type BackendHasEstimate = "Yes" | "No";
export type BackendDealBreaker =
  | "Price"
  | "Company Reputation"
  | "Timing"
  | "Financing"
  | "Other";
export type BackendCallIntent = "Yes" | "No";
export type BackendTimeframe = "1 Month" | "2-3 Months" | "Just Researching";

/** Quote-in-hand buckets are treated as "have an estimate" for benchmarking. */
export function mapBucketToHasEstimate(
  bucket: IntakeBucket,
): BackendHasEstimate {
  switch (bucket) {
    case "quote_ready":
    case "quote_not_handy":
      return "Yes";
    case "no_quote_yet":
    case "researching":
      return "No";
  }
}

export function mapThreatToDealBreaker(
  threat: ThreatConcern,
): BackendDealBreaker {
  switch (threat) {
    case "overpaying":
      return "Price";
    case "wrong_contractor":
      return "Company Reputation";
    case "financing_or_payment":
      return "Financing";
    case "missing_scope_or_permits":
    case "not_sure":
      return "Other";
  }
}

/**
 * Map opening-count buckets to the backend scope enum. The intake "11-20" and
 * "whole house / not sure" buckets have no exact backend twin, so both resolve
 * to "15+" (the largest supported band) to avoid under-counting scope.
 */
export function mapProjectSizeToScope(size: ProjectSize): BackendScope {
  switch (size) {
    case "1-5":
      return "1-5";
    case "6-10":
      return "6-10";
    case "11-20":
    case "whole_house_or_not_sure":
      return "15+";
  }
}

export function mapTimelineToTimeframe(timeline: Timeline): BackendTimeframe {
  switch (timeline) {
    case "this_week":
    case "this_month":
      return "1 Month";
    case "2-3_months":
      return "2-3 Months";
    case "just_researching":
      return "Just Researching";
  }
}

export function mapCallIntent(choice: CallIntentChoice): BackendCallIntent {
  return choice === "yes" ? "Yes" : "No";
}

const GENERIC_SUBMIT_ERROR = "Something went wrong. Please try again.";

/**
 * User-safe error copy for backend capture failure codes. Mirrors the matrix
 * used by the existing ArbitrageEngine so messaging stays consistent.
 */
const USER_SAFE_ARB_ERRORS: Record<string, string> = {
  invalid_zip: "Please enter a valid 5-digit ZIP code.",
  invalid_phone: "Please enter a valid 10-digit US phone number.",
  consent_required: "Please agree to be contacted to continue.",
  invalid_intake_option: GENERIC_SUBMIT_ERROR,
  invalid_first_name: "Please enter your first name.",
  invalid_email: "Please enter a valid email address.",
  lead_not_found: GENERIC_SUBMIT_ERROR,
  feature_disabled: "This setup is temporarily unavailable. Please try again later.",
};

export function safeArbError(code: string): string {
  return USER_SAFE_ARB_ERRORS[code] ?? GENERIC_SUBMIT_ERROR;
}

/** Codes that indicate the capture session/token is no longer valid. */
export const CAPTURE_SESSION_ERROR_CODES: ReadonlySet<string> = new Set([
  "capture_token_required",
  "invalid_capture_token",
  "capture_token_expired",
  "invalid_funnel_stage",
]);
