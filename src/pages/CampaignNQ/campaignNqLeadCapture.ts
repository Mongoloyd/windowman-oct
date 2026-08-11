import {
  submitTruthGateLead,
  type SubmitTruthGateLeadInput,
} from "@/services/truthGateLeadCapture";

export const CAMPAIGN_NQ_SAFE_ERROR =
  "We couldn't save your request yet. Check your details and try again.";

export type SubmitCampaignNqLeadInput = Omit<
  SubmitTruthGateLeadInput,
  "phone"
> & {
  phoneE164: string;
};

export type SubmitCampaignNqLeadResult =
  | {
      ok: true;
      leadId: string;
      sessionId: string;
      reused: boolean;
    }
  | {
      ok: false;
      message: string;
    };

function runWithNoQuoteIntent<T>(run: () => T): T {
  if (typeof window === "undefined") return run();

  const originalPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const intentUrl = new URL(window.location.href);
  intentUrl.searchParams.set("wm_intent", "no_quote");

  window.history.replaceState(
    window.history.state,
    "",
    `${intentUrl.pathname}${intentUrl.search}${intentUrl.hash}`,
  );

  try {
    // The canonical service builds its payload synchronously before its first
    // await, so it captures this intent without permanently changing the URL.
    return run();
  } finally {
    window.history.replaceState(window.history.state, "", originalPath);
  }
}

export async function submitCampaignNqLead(
  input: SubmitCampaignNqLeadInput,
): Promise<SubmitCampaignNqLeadResult> {
  const request = runWithNoQuoteIntent(() =>
    submitTruthGateLead({
      sessionId: input.sessionId,
      submissionId: input.submissionId,
      firstName: input.firstName,
      phone: input.phoneE164,
      email: input.email,
      funnelClientSlug: input.funnelClientSlug,
      marketingCommunicationsGranted: input.marketingCommunicationsGranted,
    }),
  );

  const result = await request;
  if (!result.ok) {
    return { ok: false, message: CAMPAIGN_NQ_SAFE_ERROR };
  }

  return {
    ok: true,
    leadId: result.leadId,
    sessionId: result.sessionId,
    reused: result.reused === true,
  };
}
