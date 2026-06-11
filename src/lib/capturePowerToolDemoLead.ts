import { supabase } from "@/integrations/supabase/client";

const FUNCTION_NAME = "capture-power-tool-demo-lead";
const GENERIC_ERROR = "We could not save that yet. Please try again.";

export type PowerToolDemoCaptureAction =
  | "create"
  | "update_zip"
  | "update_phone"
  | "update_intake";

export type CapturePowerToolDemoLeadResult =
  | {
      ok: true;
      leadId?: string;
      sessionId?: string;
      stage?: string;
      reused?: boolean;
      source?: "power-tool-demo";
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
  message?: string;
};

export async function capturePowerToolDemoLead(
  payload: Record<string, unknown>,
): Promise<CapturePowerToolDemoLeadResult> {
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

  return {
    ok: true,
    leadId: body.lead_id,
    sessionId: body.session_id,
    stage: body.stage,
    reused: body.reused,
    source: body.source === "power-tool-demo" ? "power-tool-demo" : undefined,
  };
}
