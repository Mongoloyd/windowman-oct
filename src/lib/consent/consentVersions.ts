export const CONSENT_SCHEMA_VERSION = "1";
export const PRIVACY_POLICY_VERSION = "2026-08-01";
export const TERMS_VERSION = "2026-04-14";
export const CONSENT_DISCLOSURE_VERSION = "2026-08-01";

export type ConsentPurpose =
  | "service_communications"
  | "advertising_measurement"
  | "marketing_communications"
  | "contractor_sharing";

export type ConsentDecision = "granted" | "declined" | "withdrawn";

export type ConsentRequestEvent = {
  purpose: ConsentPurpose;
  decision: ConsentDecision;
  disclosureVersion: string;
};

export type ConsentRequest = {
  schemaVersion: "1";
  submissionId: string;
  privacyPolicyVersion: string;
  termsVersion: string;
  source: string;
  events: ConsentRequestEvent[];
};
