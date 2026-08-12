import {
  FIRST_QUOTE_SAFE_ERROR,
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  TIMING_OPTIONS,
  type OpeningsBucket,
  type ProductScope,
  type Timing,
} from "@/components/landing/firstQuoteIntakeTypes";
import type { IntakeSubmitter } from "@/components/intake/universal/intakeTypes";
import {
  getOrCreateFirstQuoteSessionId,
  submitWindowmanFirstQuoteLead,
} from "@/services/windowmanFirstQuoteLeadCapture";

function isProductScope(value: string): value is ProductScope {
  return PRODUCT_SCOPE_OPTIONS.some((option) => option === value);
}

function isOpeningsBucket(value: string): value is OpeningsBucket {
  return OPENINGS_BUCKET_OPTIONS.some((option) => option === value);
}

function isTiming(value: string | undefined): value is Timing {
  return TIMING_OPTIONS.some((option) => option === value);
}

export function createCampaignNq3LeadSubmitter(): IntakeSubmitter {
  const sessionId = getOrCreateFirstQuoteSessionId();

  return async (values, context) => {
    if (
      !isProductScope(values.projectType) ||
      !isOpeningsBucket(values.openings) ||
      !isTiming(values.timing)
    ) {
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    const result = await submitWindowmanFirstQuoteLead({
      sessionId,
      submissionId: context.captureAttemptId,
      sourcePath: "/nq3",
      firstName: values.name,
      email: values.email,
      phoneE164: values.phone,
      projectBasics: {
        zipOrCity: values.zip,
        homeownerRole: "",
        propertyType: "",
        openingsBucket: values.openings,
        productScope: values.projectType,
        timing: values.timing,
      },
      helpNeeded: "I want help requesting my first estimate.",
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });

    if (!result.ok) {
      return {
        ok: false,
        message: result.message || FIRST_QUOTE_SAFE_ERROR,
      };
    }

    if (!result.leadId?.trim()) {
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    return {
      ok: true,
      leadId: result.leadId,
      sessionId,
      reused: result.reused === true,
    };
  };
}
