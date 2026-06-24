export type IntakeStep =
  | "intent"
  | "threat"
  | "projectSize"
  | "interstitial"
  | "contact"
  | "identity"
  | "callIntent"
  | "timeline"
  | "handoff";

export type IntakeBucket =
  | "quote_ready"
  | "quote_not_handy"
  | "no_quote_yet"
  | "researching";

export type ThreatConcern =
  | "overpaying"
  | "wrong_contractor"
  | "missing_scope_or_permits"
  | "financing_or_payment"
  | "not_sure";

export type ProjectSize =
  | "1-5"
  | "6-10"
  | "11-20"
  | "whole_house_or_not_sure";

export type Timeline =
  | "this_week"
  | "this_month"
  | "2-3_months"
  | "just_researching";

export type CallIntentChoice = "yes" | "no";

export interface IntakeContactFields {
  zip: string;
  phone: string;
  consent: boolean;
}

export interface IntakeIdentityFields {
  firstName: string;
  email: string;
}

export interface IntakeFormState {
  bucket: IntakeBucket | null;
  threat: ThreatConcern | null;
  projectSize: ProjectSize | null;
  contact: IntakeContactFields;
  identity: IntakeIdentityFields;
  callIntent: CallIntentChoice | null;
  wantsCall: boolean;
  timeline: Timeline | null;
}

export const INITIAL_INTAKE_FORM_STATE: IntakeFormState = {
  bucket: null,
  threat: null,
  projectSize: null,
  contact: { zip: "", phone: "", consent: false },
  identity: { firstName: "", email: "" },
  callIntent: null,
  wantsCall: false,
  timeline: null,
};

export interface IntakeValidationErrors {
  zip?: string;
  phone?: string;
  consent?: string;
  firstName?: string;
  email?: string;
}
