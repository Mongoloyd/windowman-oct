import {
  FIRST_QUOTE_SAFE_ERROR,
  type OpeningsBucket,
  type ProductScope,
} from "@/components/landing/firstQuoteIntakeTypes";
import {
  getOrCreateFirstQuoteSessionId,
  submitWindowmanFirstQuoteLead,
} from "@/services/windowmanFirstQuoteLeadCapture";
import type {
  Nq3LeadPayload,
  Nq3LeadSubmitResult,
  Nq3OpeningRange,
  Nq3ProjectType,
  OnSubmitLead,
} from "./types";

const PRODUCT_SCOPE_BY_PROJECT: Record<Nq3ProjectType, ProductScope> = {
  Windows: "Impact windows",
  Doors: "Impact doors",
  Both: "Both windows and doors",
  "Not sure yet": "Not sure yet",
};

const OPENINGS_BUCKET_BY_RANGE: Record<Nq3OpeningRange, OpeningsBucket> = {
  "1–5": "1–5",
  "6–10": "6–10",
  "11–15": "11–15",
  "16+": "16+",
  "Not sure": "Not sure",
};

async function submitCampaignNq3Lead(
  payload: Nq3LeadPayload,
  sessionId: string,
  submissionId: string,
): Promise<Nq3LeadSubmitResult> {
  const result = await submitWindowmanFirstQuoteLead({
    sessionId,
    submissionId,
    firstName: payload.name,
    email: payload.email,
    phoneE164: payload.phone,
    projectBasics: {
      zipOrCity: payload.zip,
      homeownerRole: "",
      propertyType: "",
      openingsBucket: OPENINGS_BUCKET_BY_RANGE[payload.openings],
      productScope: PRODUCT_SCOPE_BY_PROJECT[payload.projectType],
      timing: "Not sure",
    },
    helpNeeded: "I want help requesting my first estimate.",
    preferredContact: "Text",
    serviceCommunicationsGranted: true,
    marketingConsentPresented: false,
    marketingCommunicationsGranted: false,
  });

  return result.ok
    ? { ok: true }
    : { ok: false, message: result.message || FIRST_QUOTE_SAFE_ERROR };
}

export function createCampaignNq3LeadSubmitter(): OnSubmitLead {
  const sessionId = getOrCreateFirstQuoteSessionId();
  const submissionId = crypto.randomUUID();

  return (payload) => submitCampaignNq3Lead(payload, sessionId, submissionId);
}
