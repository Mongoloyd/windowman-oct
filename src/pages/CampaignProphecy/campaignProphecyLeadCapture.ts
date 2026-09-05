import {
  FIRST_QUOTE_SAFE_ERROR,
  OPENINGS_BUCKET_OPTIONS,
  type OpeningsBucket,
} from "@/components/landing/firstQuoteIntakeTypes";
import type {
  IntakeIntentChoice,
  IntakeSubmitter,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import {
  getOrCreateFirstQuoteSessionId,
  submitWindowmanFirstQuoteLead,
} from "@/services/windowmanFirstQuoteLeadCapture";
import { isProphecyPriority } from "./prophecyIntakeConfig";

function isOpeningsBucket(value: string): value is OpeningsBucket {
  return OPENINGS_BUCKET_OPTIONS.some((option) => option === value);
}

function isIntentChoice(
  value: IntakeValues["intent"],
): value is IntakeIntentChoice {
  return value === "has_quote" || value === "no_quote";
}

/**
 * Builds the Prophecy submitter.
 *
 * The host hands over free-form strings; this module is the boundary where they
 * become the exact typed values the backend accepts. Anything that fails a
 * guard is refused here rather than sent and silently coerced server-side.
 *
 * The estimate-in-hand branch leaves project scope to the uploaded document.
 * The no-estimate branch preserves the openings bucket and priority in
 * query_params without fabricating an exact opening count.
 */
export function createCampaignProphecyLeadSubmitter(): IntakeSubmitter {
  const sessionId = getOrCreateFirstQuoteSessionId();

  return async (values, context) => {
    if (!isIntentChoice(values.intent)) {
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    const intent = values.intent;
    const hasQuote = intent === "has_quote";

    // The no-estimate branch answered two extra questions; both must survive
    // the round trip as typed values or the lead is not worth routing.
    if (!hasQuote) {
      if (!isOpeningsBucket(values.openings)) {
        return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
      }
      if (!isProphecyPriority(values.priority)) {
        return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
      }
    }

    const openingsBucket: OpeningsBucket | "" =
      !hasQuote && isOpeningsBucket(values.openings) ? values.openings : "";

    const result = await submitWindowmanFirstQuoteLead({
      sessionId,
      submissionId: context.captureAttemptId,
      sourcePath: "/prophecy",
      firstName: values.name,
      email: values.email,
      phoneE164: values.phone,
      wmIntent: intent,
      projectBasics: {
        zipOrCity: values.zip,
        homeownerRole: "",
        propertyType: "",
        openingsBucket,
        productScope: "",
        timing: "",
      },
      helpNeeded: hasQuote
        ? "I have a written estimate and want it reviewed."
        : "I want help requesting my first estimate.",
      extraQueryParams: {
        prophecy_intent: intent,
        ...(hasQuote ? {} : { prophecy_priority: values.priority ?? "" }),
      },
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });

    if (!result.ok) {
      return { ok: false, message: result.message || FIRST_QUOTE_SAFE_ERROR };
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
