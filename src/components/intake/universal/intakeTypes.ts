import type { ComponentType } from "react";

export type IntakeRoute = "/nq3" | "/nq4" | "/prophecy";
export type IntakeCampaignVariant = "nq3" | "nq4" | "prophecy";
export type IntakeIntent = "no_quote" | "dual";

/**
 * Which side of the fork a visitor picked. `IntakeIntent` describes what a
 * campaign is *capable* of capturing; this describes what one visitor chose.
 *
 * These values are also what reaches the backend as `wm_intent`, where
 * `capture-truth-gate-lead` normalizes them and uses `no_quote` to decide
 * whether to scrub project scalars — see `prophecyIntakeConfig.ts`.
 */
export type IntakeIntentChoice = "has_quote" | "no_quote";

export type IntakeEntryPoint =
  | "navigation_primary"
  | "hero_zip"
  | "footer_zip"
  | "hero_primary"
  | "footer_primary";

export type IntakeStepId =
  | "intent"
  | "location"
  | "project"
  | "product"
  | "openings"
  | "timing"
  | "priority"
  | "contact";
export type IntakeValidationRule =
  | "intent_selected"
  | "service_area_zip"
  | "project_scope"
  | "product_scope"
  | "openings_scope"
  | "timing_scope"
  | "priority_scope"
  | "contact";

export interface IntakeLocationConfig {
  marketId: string;
  inputLabel: string;
  helperText: string;
  placeholder: string;
  invalidMessage: string;
  isEligibleZip: (value: string) => boolean;
}

export type IntakeFieldName =
  | "intent"
  | "zip"
  | "projectType"
  | "openings"
  | "timing"
  | "priority"
  | "name"
  | "email"
  | "phone";

export interface IntakeValues {
  /** Empty until a dual-intent campaign's fork step is answered. */
  intent?: IntakeIntentChoice | "";
  zip: string;
  projectType: string;
  openings: string;
  timing?: string;
  /** What the visitor most wants protected. Optional; dual-intent campaigns only. */
  priority?: string;
  name: string;
  email: string;
  phone: string;
}

export interface IntakeStepConfig {
  id: IntakeStepId;
  fields: readonly IntakeFieldName[];
  validation: IntakeValidationRule;
  /**
   * Omit this step for the current answers. Branching campaigns use this to
   * drop steps that do not apply to the chosen path.
   *
   * The host owns the consequences: a skipped step is never rendered, never
   * validated on submit, and is excluded from the step counter. Keep these
   * predicates pure and cheap — they run on every navigation and render.
   */
  skipWhen?: (values: IntakeValues) => boolean;
}

/** Discrete single-choice fields eligible for atomic select-and-advance. */
export type IntakeQuickSelectField = Extract<
  IntakeFieldName,
  "intent" | "projectType" | "openings" | "timing" | "priority"
>;

/** Steps whose single answer may advance the flow without a Continue press. */
export const QUICK_SELECT_FIELD_BY_STEP = {
  intent: "intent",
  product: "projectType",
  openings: "openings",
  timing: "timing",
  priority: "priority",
} as const satisfies Partial<Record<IntakeStepId, IntakeQuickSelectField>>;

export function quickSelectFieldForStep(
  step: IntakeViewStep,
): IntakeQuickSelectField | null {
  return (
    QUICK_SELECT_FIELD_BY_STEP[
      step as keyof typeof QUICK_SELECT_FIELD_BY_STEP
    ] ?? null
  );
}

/** True when this step applies to the answers given so far. */
export function isStepActive(
  step: IntakeStepConfig,
  values: IntakeValues,
): boolean {
  return step.skipWhen?.(values) !== true;
}

/**
 * The steps a visitor with these answers will actually see, in order.
 *
 * The single source of truth for progress counters and submit-time validation,
 * so a skipped step can never be validated or counted. Linear (no `skipWhen`)
 * configs get the full list back unchanged.
 */
export function activeSteps(
  steps: readonly IntakeStepConfig[],
  values: IntakeValues,
): readonly IntakeStepConfig[] {
  return steps.filter((step) => isStepActive(step, values));
}

export interface UniversalIntakeConfig {
  route: IntakeRoute;
  campaignVariant: IntakeCampaignVariant;
  wmIntent: IntakeIntent;
  captureSource: string;
  location: IntakeLocationConfig;
  steps: readonly IntakeStepConfig[];
}

export interface IntakeOpenRequest {
  requestId: string;
  entryPoint: IntakeEntryPoint;
  zipPrefill?: string;
  startingStep?: IntakeStepId;
  /**
   * Answers already given on the page itself, seeded into the attempt so the
   * visitor is never asked the same question twice. Seeded values are validated
   * on submit exactly like typed ones — this pre-fills the flow, it does not
   * bypass it.
   */
  presetValues?: Partial<IntakeValues>;
}

export interface IntakeSubmitContext {
  captureAttemptId: string;
  landingVisitId: string;
  entryPoint: IntakeEntryPoint;
}

export type IntakeSubmitResult =
  | {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }
  | {
      ok: false;
      message: string;
    };

export type IntakePersistedSuccess = Extract<IntakeSubmitResult, { ok: true }>;

export type IntakeSubmitter = (
  values: IntakeValues,
  context: IntakeSubmitContext,
) => Promise<IntakeSubmitResult>;

export type IntakePersistedSuccessHandler = (
  values: IntakeValues,
  persisted: IntakePersistedSuccess,
) => void;

export interface IntakeValidationError {
  field?: IntakeFieldName;
  message: string;
}

export type IntakeViewStep = IntakeStepId | "success";

export interface IntakeSkinProps {
  step: IntakeViewStep;
  stepNumber: number;
  totalSteps: number;
  location: IntakeLocationConfig;
  values: IntakeValues;
  validationError: IntakeValidationError | null;
  submitError: string | null;
  isSubmitting: boolean;
  onFieldChange: (field: IntakeFieldName, value: string) => void;
  /**
   * Atomically records a discrete choice and advances one step. The host owns
   * eligibility, validation, and sequencing; skins only report the activation.
   */
  onSelectAndNext: (field: IntakeQuickSelectField, value: string) => void;
  onNext: () => void;
  onBack: () => void;
  onSubmit: () => void;
  onClose: () => void;
}

export type IntakeSkin = ComponentType<IntakeSkinProps>;
