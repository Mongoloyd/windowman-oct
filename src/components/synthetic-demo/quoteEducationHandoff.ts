import type {
  IntakeSubmitResult,
  IntakeSubmitter,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import {
  FIRST_QUOTE_SAFE_ERROR,
  OPENINGS_BUCKET_OPTIONS,
  PRODUCT_SCOPE_OPTIONS,
  TIMING_OPTIONS,
} from "@/components/landing/firstQuoteIntakeTypes";
import { captureQuoteEducationDemoLead } from "@/lib/captureQuoteEducationDemoLead";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import { buildFirstQuoteIntakeConsentRequest } from "@/services/windowmanFirstQuoteLeadCapture";
import { trustedDemoLead } from "./captureValidation";
import type { SyntheticDemoHandoffContext } from "./types";

const SOURCE = "quote-education-demo" as const;
const HANDOFF_VERSION = "quote_education_handoff_v1";
const EXPECTED_VARIANT = { "/nq3": "lens", "/nq4": "challenge" } as const;
const EMAIL_RE = /^\S+@\S+\.\S+$/;
type HandoffPath = keyof typeof EXPECTED_VARIANT;

export interface PreparedQuoteEducationHandoff {
  presetValues: Pick<IntakeValues, "name" | "email">;
  submitter: IntakeSubmitter;
}

export function selectQuoteEducationHandoffSubmitter(
  savedDemoSubmitter: IntakeSubmitter | null,
  injectedSubmitter: IntakeSubmitter | undefined,
  defaultSubmitter: IntakeSubmitter,
): IntakeSubmitter {
  return savedDemoSubmitter ?? injectedSubmitter ?? defaultSubmitter;
}

const failure = (): IntakeSubmitResult => ({
  ok: false,
  message: FIRST_QUOTE_SAFE_ERROR,
});

function isAllowed(
  options: readonly string[],
  value: string | undefined,
): value is string {
  return typeof value === "string" && options.includes(value);
}

/**
 * Returns null only for the intentional pre-capture escape. Any partial or
 * mismatched saved identity fails closed so the campaign submitter cannot
 * create a second lead behind an existing SyntheticDemo capture.
 */
export function prepareQuoteEducationHandoff(
  context: SyntheticDemoHandoffContext,
  sourcePath: HandoffPath,
): PreparedQuoteEducationHandoff | null {
  const hasSavedField = Boolean(
    context.contact || context.demoLeadId || context.demoSessionId,
  );
  if (!hasSavedField) return null;

  const firstName = context.contact?.firstName.trim() ?? "";
  const email = context.contact?.email.trim().toLowerCase() ?? "";
  const leadId = context.demoLeadId ?? "";
  const sessionId = context.demoSessionId ?? "";
  const validContext =
    context.variant === EXPECTED_VARIANT[sourcePath] &&
    context.attribution.sourcePath === sourcePath &&
    firstName.length >= 2 &&
    EMAIL_RE.test(email) &&
    isValidLeadSessionUuid(leadId) &&
    isValidLeadSessionUuid(sessionId);

  if (!validContext) {
    return {
      presetValues: { name: firstName, email },
      submitter: async () => failure(),
    };
  }

  let inFlight: Promise<IntakeSubmitResult> | null = null;
  const submitter: IntakeSubmitter = (values, submitContext) => {
    if (inFlight) return inFlight;
    inFlight = (async () => {
      const hasQuote = values.intent === "has_quote";
      if (
        !hasQuote &&
        (!isAllowed(PRODUCT_SCOPE_OPTIONS, values.projectType) ||
          !isAllowed(OPENINGS_BUCKET_OPTIONS, values.openings) ||
          !isAllowed(TIMING_OPTIONS, values.timing))
      ) {
        return failure();
      }

      const base = {
        source: SOURCE,
        session_id: sessionId,
        lead_id: leadId,
      };
      const requests = [
        { ...base, action: "update_zip", zip_code: values.zip },
        { ...base, action: "update_phone", phone: values.phone },
        {
          ...base,
          action: "update_intake",
          first_name: values.name.trim(),
          email: values.email.trim().toLowerCase(),
          intake_status: hasQuote
            ? "Already have a quote to check"
            : "Ready to get estimates soon",
          quote_holder_shortcut: hasQuote,
          consent: buildFirstQuoteIntakeConsentRequest({
            submissionId: submitContext.captureAttemptId,
            serviceCommunicationsGranted: true,
            marketingConsentPresented: false,
            marketingCommunicationsGranted: false,
          }, SOURCE),
          intake_answers_json: {
            handoff_version: HANDOFF_VERSION,
            source_path: sourcePath,
            wm_intent: hasQuote ? "has_quote" : "no_quote",
            ...(!hasQuote
              ? {
                  product_scope: values.projectType,
                  openings_bucket: values.openings,
                  campaign_timing: values.timing,
                }
              : {}),
          },
        },
      ] as const;

      for (const request of requests) {
        const result = await captureQuoteEducationDemoLead(request);
        const trusted = trustedDemoLead(result, sessionId);
        if (!trusted || trusted.leadId !== leadId) return failure();
      }

      return {
        ok: true,
        leadId,
        sessionId,
        reused: true,
      };
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  return {
    presetValues: { name: firstName, email },
    submitter,
  };
}
