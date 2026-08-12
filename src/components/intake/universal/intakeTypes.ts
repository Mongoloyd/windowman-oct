import type { ComponentType } from "react";

export type IntakeRoute = "/nq3" | "/nq4";
export type IntakeCampaignVariant = "nq3" | "nq4";
export type IntakeIntent = "no_quote";

export type IntakeEntryPoint =
  | "navigation_primary"
  | "hero_zip"
  | "footer_zip"
  | "hero_primary"
  | "footer_primary";

export type IntakeStepId =
  | "location"
  | "project"
  | "product"
  | "openings"
  | "timing"
  | "contact";
export type IntakeValidationRule =
  | "service_area_zip"
  | "project_scope"
  | "product_scope"
  | "openings_scope"
  | "timing_scope"
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
  | "zip"
  | "projectType"
  | "openings"
  | "timing"
  | "name"
  | "email"
  | "phone";

export interface IntakeValues {
  zip: string;
  projectType: string;
  openings: string;
  timing?: string;
  name: string;
  email: string;
  phone: string;
}

export interface IntakeStepConfig {
  id: IntakeStepId;
  fields: readonly IntakeFieldName[];
  validation: IntakeValidationRule;
}

/** Discrete single-choice fields eligible for atomic select-and-advance. */
export type IntakeQuickSelectField = Extract<
  IntakeFieldName,
  "projectType" | "openings" | "timing"
>;

/** Steps whose single answer may advance the flow without a Continue press. */
export const QUICK_SELECT_FIELD_BY_STEP = {
  product: "projectType",
  openings: "openings",
  timing: "timing",
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

export type IntakeSubmitter = (
  values: IntakeValues,
  context: IntakeSubmitContext,
) => Promise<IntakeSubmitResult>;

export type IntakePersistedSuccessHandler = (
  values: IntakeValues,
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
