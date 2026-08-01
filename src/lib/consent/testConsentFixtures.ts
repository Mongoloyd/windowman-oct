import { buildLeadCaptureConsentRequest } from "@/lib/consent/buildConsentRequest";

export const TEST_CONSENT_SUBMISSION_ID =
  "22222222-2222-4222-8222-222222222222";

export function testLeadCaptureConsent(source: string, marketingGranted = false) {
  return buildLeadCaptureConsentRequest({
    submissionId: TEST_CONSENT_SUBMISSION_ID,
    source,
    serviceCommunicationsGranted: true,
    marketingConsentPresented: true,
    marketingCommunicationsGranted: marketingGranted,
  });
}
