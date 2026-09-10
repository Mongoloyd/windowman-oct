import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "capture-quote-education-demo-lead";
const GENERIC_ERROR = "We could not save that yet. Please try again.";

export type QuoteEducationDemoCaptureAction =
  | "create"
  | "update_zip"
  | "update_phone"
  | "update_intake";

export type CaptureQuoteEducationDemoLeadResult =
  | {
      ok: true;
      leadId?: string;
      sessionId?: string;
      stage?: string;
      reused?: boolean;
      source?: "quote-education-demo";
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
  stage?: string;
  reused?: boolean;
  source?: string;
  code?: string;
};

export async function captureQuoteEducationDemoLead(
  payload: Record<string, unknown>,
): Promise<CaptureQuoteEducationDemoLeadResult> {
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, {
    body: payload,
  });

  if (error) {
    return { ok: false, code: "invoke_failed", message: GENERIC_ERROR };
  }

  const body = (data ?? {}) as EdgeResponse;
  if (!body.success || body.source !== "quote-education-demo") {
    return {
      ok: false,
      code: body.success ? "invalid_response_source" : body.code || "request_failed",
      message: GENERIC_ERROR,
    };
  }

  return {
    ok: true,
    leadId: body.lead_id,
    sessionId: body.session_id,
    stage: body.stage,
    reused: body.reused,
    source: "quote-education-demo",
  };
}
