import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "capture-arbitrage-lead";
const GENERIC_ERROR = "We could not save that yet. Please try again.";

export type ArbitrageCaptureAction =
  | "create"
  | "update_identity"
  | "update_call_intent"
  | "update_timeframe";

export interface ArbitrageCreatePayload {
  action: "create";
  session_id: string;
  event_id: string;
  source: "arbitrage-engine";
  client_slug?: string | null;
  external_id?: string | null;
  zip: string;
  phone_e164: string;
  hasConsent: true;
  route?: string;
  attribution?: Record<string, unknown>;
  intake?: {
    scope?: string;
    installerPreference?: string;
    hasEstimate?: string;
    numEstimates?: string;
    dealBreaker?: string;
  };
}

export interface ArbitrageUpdateIdentityPayload {
  action: "update_identity";
  session_id: string;
  source: "arbitrage-engine";
  lead_id?: string | null;
  client_slug?: string | null;
  name: string;
  email: string;
}

export interface ArbitrageUpdateCallIntentPayload {
  action: "update_call_intent";
  session_id: string;
  source: "arbitrage-engine";
  lead_id?: string | null;
  client_slug?: string | null;
  call_intent: "Yes" | "No";
}

export interface ArbitrageUpdateTimeframePayload {
  action: "update_timeframe";
  session_id: string;
  source: "arbitrage-engine";
  lead_id?: string | null;
  client_slug?: string | null;
  timeframe: "1 Month" | "2-3 Months" | "Just Researching";
}

export type ArbitrageCapturePayload =
  | ArbitrageCreatePayload
  | ArbitrageUpdateIdentityPayload
  | ArbitrageUpdateCallIntentPayload
  | ArbitrageUpdateTimeframePayload;

export type CaptureArbitrageLeadResult =
  | {
      ok: true;
      leadId: string;
      sessionId: string;
      stage: string;
      reused: boolean;
    }
  | {
      ok: false;
      code: string;
      message: string;
    };

type EdgeResponse = {
  success?: boolean;
  lead_id?: string;
  session_id?: string;
  source?: string;
  stage?: string;
  reused?: boolean;
  code?: string;
  message?: string;
};

/**
 * Typed transport for the isolated `capture-arbitrage-lead` Edge Function.
 *
 * Mirrors the style of `capturePowerToolDemoLead`. Never writes to `leads`
 * directly and never logs PII. The distinct `feature_disabled` code is
 * surfaced verbatim so the caller can keep the funnel on its current step.
 */
export async function captureArbitrageLead(
  payload: ArbitrageCapturePayload,
): Promise<CaptureArbitrageLeadResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: payload,
  });

  if (error) {
    return { ok: false, code: "invoke_failed", message: GENERIC_ERROR };
  }

  const body = (data ?? {}) as EdgeResponse;

  if (!body.success) {
    return {
      ok: false,
      code: body.code || "request_failed",
      message: GENERIC_ERROR,
    };
  }

  if (!body.lead_id || !body.session_id) {
    return { ok: false, code: "invalid_response", message: GENERIC_ERROR };
  }

  return {
    ok: true,
    leadId: body.lead_id,
    sessionId: body.session_id,
    stage: body.stage ?? "",
    reused: body.reused ?? false,
  };
}
