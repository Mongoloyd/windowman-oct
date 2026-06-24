import type { IntakeFormState, IntakeStep } from "./intakeTypes";

/** Ordered Signature V1 screen sequence */
export const INTAKE_STEP_ORDER: IntakeStep[] = [
  "intent",
  "threat",
  "projectSize",
  "interstitial",
  "contact",
  "identity",
  "callIntent",
  "timeline",
  "handoff",
];

/** Steps that count toward visible progress (excludes interstitial) */
export const PROGRESS_STEPS: IntakeStep[] = INTAKE_STEP_ORDER.filter(
  (step) => step !== "interstitial",
);

export function getStepIndex(step: IntakeStep): number {
  return INTAKE_STEP_ORDER.indexOf(step);
}

export function getProgressIndex(step: IntakeStep): number {
  if (step === "interstitial") {
    return PROGRESS_STEPS.indexOf("projectSize") + 1;
  }
  const idx = PROGRESS_STEPS.indexOf(step);
  return idx >= 0 ? idx : 0;
}

export function getProgressPercent(step: IntakeStep): number {
  const idx = getProgressIndex(step);
  const total = PROGRESS_STEPS.length - 1;
  if (total <= 0) return 0;
  return Math.round((idx / total) * 100);
}

/** User-facing steps before handoff (excludes interstitial + handoff from the "of N" count). */
export const HUMAN_PROGRESS_TOTAL = 7;

export function getHumanProgress(step: IntakeStep): {
  current: number;
  total: number;
  labelKey: IntakeStep;
} {
  if (step === "handoff") {
    return { current: HUMAN_PROGRESS_TOTAL, total: HUMAN_PROGRESS_TOTAL, labelKey: "handoff" };
  }
  if (step === "interstitial") {
    return { current: 3, total: HUMAN_PROGRESS_TOTAL, labelKey: "interstitial" };
  }

  const order: IntakeStep[] = [
    "intent",
    "threat",
    "projectSize",
    "contact",
    "identity",
    "callIntent",
    "timeline",
  ];
  const idx = order.indexOf(step);
  return {
    current: idx >= 0 ? idx + 1 : 1,
    total: HUMAN_PROGRESS_TOTAL,
    labelKey: step,
  };
}

export function getNextStep(step: IntakeStep): IntakeStep | null {
  const idx = getStepIndex(step);
  if (idx < 0 || idx >= INTAKE_STEP_ORDER.length - 1) return null;
  return INTAKE_STEP_ORDER[idx + 1];
}

export function getPreviousStep(step: IntakeStep): IntakeStep | null {
  const idx = getStepIndex(step);
  if (idx <= 0) return null;
  return INTAKE_STEP_ORDER[idx - 1];
}

export function canAdvanceFromStep(
  step: IntakeStep,
  form: IntakeFormState,
): boolean {
  switch (step) {
    case "intent":
      return form.bucket !== null;
    case "threat":
      return form.threat !== null;
    case "projectSize":
      return form.projectSize !== null;
    case "interstitial":
      return true;
    case "contact":
      return false;
    case "identity":
      return false;
    case "callIntent":
      return form.callIntent !== null;
    case "timeline":
      return form.timeline !== null;
    case "handoff":
      return false;
    default:
      return false;
  }
}

/**
 * Sprint D capture contract (local notes only — do not import captureArbitrageLead here).
 *
 * intent bucket → intake.hasEstimate
 *   quote_ready      → "Yes"
 *   quote_not_handy  → "Yes, but not handy"
 *   no_quote_yet     → "No"
 *   researching      → "Just researching"
 *
 * threat concern → intake.dealBreaker
 * project size   → intake.scope
 *
 * contact step (ZIP + phone + consent) → action: "create"
 * identity step (first name + email)   → action: "update_identity"
 * call intent                          → action: "update_call_intent" (Yes | No)
 * timeline                             → action: "update_timeframe"
 *   this_week / this_month → map to closest supported value in Sprint D review
 *   2-3_months             → "2-3 Months"
 *   just_researching       → "Just Researching"
 *
 * TODO Sprint D: wire each step to captureArbitrageLead after visual/state approval.
 */
