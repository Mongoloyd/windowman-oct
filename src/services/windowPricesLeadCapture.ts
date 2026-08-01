// src/services/windowPricesLeadCapture.ts

import { supabase } from "@/integrations/supabase/client";
import { buildLeadCaptureConsentRequest } from "@/lib/consent/buildConsentRequest";
import { pushLeadMagnetCaptured } from "@/lib/tracking/dataLayer";
import { normalizeTruthGatePhoneToE164 } from "@/lib/validation/truthGateContact";
import {
  buildTruthGateLeadPayload,
  TRUTH_GATE_SOURCE,
} from "@/services/truthGateLeadCapture";

const SAFE_CAPTURE_MESSAGE =
  "We couldn't save your details yet. Check them and try again.";

export type WindowPricesSource =
  | "google_window_prices"
  | "nextdoor_truth_report"
  | "window_price_audit"
  | "truth_report_demo"
  | "ai_demo"
  | "google_quote_check";

export type SubmitWindowPricesLeadInput = {
  sessionId: string;
  submissionId: string;
  firstName: string;
  email: string;
  phone?: string;
  zip?: string;
  source: WindowPricesSource;
  /** Service authorization is recorded on successful submit when true. */
  serviceCommunicationsGranted: boolean;
  marketingConsentPresented: boolean;
  marketingCommunicationsGranted?: boolean;
};

export type WindowPricesLeadResult =
  | {
      ok: true;
      leadId: string;
      sessionId: string;
      reused?: boolean;
      phoneE164: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      sessionId?: string;
    };

export async function submitWindowPricesLead(
  input: SubmitWindowPricesLeadInput,
): Promise<WindowPricesLeadResult> {
  const phoneE164 = normalizeTruthGatePhoneToE164(input.phone ?? "");

  try {
    const consent = buildLeadCaptureConsentRequest({
      submissionId: input.submissionId,
      source: input.source,
      serviceCommunicationsGranted: input.serviceCommunicationsGranted,
      marketingConsentPresented: input.marketingConsentPresented,
      marketingCommunicationsGranted: input.marketingCommunicationsGranted,
    });

    const base = buildTruthGateLeadPayload({
      sessionId: input.sessionId,
      firstName: input.firstName,
      email: input.email,
      phoneE164,
      consent,
    });

    const baseQueryParams =
      (base.query_params as Record<string, string | string[]>) ?? {};

    const zip = (input.zip ?? "").trim();

    const body: Record<string, unknown> = {
      ...base,
      source: input.source,
      query_params: {
        ...baseQueryParams,
        ...(zip ? { zip } : {}),
      },
    };

    const { data: captureData, error: captureError } =
      await supabase.functions.invoke("capture-truth-gate-lead", { body });

    if (captureError || !captureData?.success) {
      const errBody = (captureData ?? {}) as {
        code?: string;
        message?: string;
      };
      const code =
        errBody.code || captureError?.name || "lead_capture_failed";
      const message =
        errBody.message || captureError?.message || SAFE_CAPTURE_MESSAGE;

      if (import.meta.env.DEV) {
        console.error("[windowPricesLeadCapture] capture failed", {
          code,
          message,
          session_id: input.sessionId,
          source: input.source,
        });
      }

      return { ok: false, code, message, sessionId: input.sessionId };
    }

    const resolvedSessionId =
      (typeof captureData.session_id === "string" && captureData.session_id) ||
      input.sessionId;

    if (!captureData.lead_id) {
      return {
        ok: false,
        code: "lead_capture_failed",
        message: SAFE_CAPTURE_MESSAGE,
        sessionId: resolvedSessionId,
      };
    }

    if (import.meta.env.DEV) {
      console.info("[windowPricesLeadCapture] capture success", {
        sessionId: resolvedSessionId,
        leadId: (captureData.lead_id as string | null) ?? null,
        source: input.source,
        hasZip: Boolean(zip),
        phoneStatus: phoneE164 ? "screened_valid" : "none",
      });
    }

    const attribution = base.attribution as Record<string, unknown> | undefined;
    pushLeadMagnetCaptured({
      leadId: captureData.lead_id as string,
      sessionId: resolvedSessionId,
      captureSource: input.source,
      capturePagePath: (attribution?.capture_page_path as string | null) ?? null,
      capturePageUrl: (attribution?.capture_page_url as string | null) ?? null,
      clientSlug: (base.client_slug as string | null | undefined) ?? null,
    });

    return {
      ok: true,
      leadId: captureData.lead_id as string,
      sessionId: resolvedSessionId,
      reused: captureData.reused === true,
      phoneE164,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[windowPricesLeadCapture] unexpected error", {
        err,
        session_id: input.sessionId,
      });
    }
    return {
      ok: false,
      code: "lead_capture_unexpected",
      message: SAFE_CAPTURE_MESSAGE,
      sessionId: input.sessionId,
    };
  }
}

/** @deprecated unused — kept so imports of TRUTH_GATE_SOURCE from this path still typecheck in tests */
export { TRUTH_GATE_SOURCE };
