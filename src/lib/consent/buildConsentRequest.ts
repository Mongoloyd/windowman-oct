import {
  CONSENT_DISCLOSURE_VERSION,
  CONSENT_SCHEMA_VERSION,
  PRIVACY_POLICY_VERSION,
  TERMS_VERSION,
  type ConsentRequest,
  type ConsentRequestEvent,
} from "@/lib/consent/consentVersions";

export type BuildLeadCaptureConsentInput = {
  submissionId: string;
  source: string;
  /** User completed a service-request submit with visible service disclosure. */
  serviceCommunicationsGranted: boolean;
  /** When false, no marketing_communications event is sent (not presented). */
  marketingConsentPresented: boolean;
  marketingCommunicationsGranted?: boolean;
  /** Additional events (e.g. contractor handoff). */
  extraEvents?: ConsentRequestEvent[];
};

export function buildLeadCaptureConsentRequest(
  input: BuildLeadCaptureConsentInput,
): ConsentRequest {
  const events: ConsentRequestEvent[] = [];

  if (input.serviceCommunicationsGranted) {
    events.push({
      purpose: "service_communications",
      decision: "granted",
      disclosureVersion: CONSENT_DISCLOSURE_VERSION,
    });
  }

  if (input.marketingConsentPresented) {
    events.push({
      purpose: "marketing_communications",
      decision: input.marketingCommunicationsGranted
        ? "granted"
        : "declined",
      disclosureVersion: CONSENT_DISCLOSURE_VERSION,
    });
  }

  if (input.extraEvents?.length) {
    events.push(...input.extraEvents);
  }

  return {
    schemaVersion: CONSENT_SCHEMA_VERSION,
    submissionId: input.submissionId,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    source: input.source,
    events,
  };
}

export function buildContractorSharingConsentRequest(input: {
  submissionId: string;
  granted: boolean;
}): ConsentRequest {
  return {
    schemaVersion: CONSENT_SCHEMA_VERSION,
    submissionId: input.submissionId,
    privacyPolicyVersion: PRIVACY_POLICY_VERSION,
    termsVersion: TERMS_VERSION,
    source: "homeowner-context",
    events: [
      {
        purpose: "contractor_sharing",
        decision: input.granted ? "granted" : "declined",
        disclosureVersion: CONSENT_DISCLOSURE_VERSION,
      },
    ],
  };
}
