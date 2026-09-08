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
import { isUuid } from "@/lib/routeIdGuards";
import {
  getOrCreateFirstQuoteSessionId,
  rotateFirstQuoteSessionId,
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

export function createCampaignNq4LeadSubmitter(): IntakeSubmitter {
  let sessionId = getOrCreateFirstQuoteSessionId();

  return async (values, context) => {
    const hasQuote = values.intent === "has_quote";

    if (!hasQuote && (
      !isProductScope(values.projectType) ||
      !isOpeningsBucket(values.openings) ||
      !isTiming(values.timing)
    )) {
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    const productScope: ProductScope | "" =
      !hasQuote && isProductScope(values.projectType) ? values.projectType : "";
    const openingsBucket: OpeningsBucket | "" =
      !hasQuote && isOpeningsBucket(values.openings) ? values.openings : "";
    const timing: Timing | "" =
      !hasQuote && isTiming(values.timing) ? values.timing : "";

    const result = await submitWindowmanFirstQuoteLead({
      sessionId,
      submissionId: context.captureAttemptId,
      sourcePath: "/nq4",
      firstName: values.name,
      email: values.email,
      phoneE164: values.phone,
      ...(hasQuote ? { wmIntent: "has_quote" as const } : {}),
      projectBasics: {
        zipOrCity: values.zip,
        homeownerRole: "",
        propertyType: "",
        openingsBucket,
        productScope,
        timing,
      },
      helpNeeded: hasQuote
        ? "I have a written estimate and want it reviewed."
        : "I want help requesting my first estimate.",
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });

    if (result.ok === false) {
      return {
        ok: false,
        message: result.message || FIRST_QUOTE_SAFE_ERROR,
      };
    }

    if (!isUuid(result.leadId)) {
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    const persistedSessionId = sessionId;
    sessionId = rotateFirstQuoteSessionId();

    return {
      ok: true,
      leadId: result.leadId,
      sessionId: persistedSessionId,
      reused: result.reused === true,
    };
  };
}
