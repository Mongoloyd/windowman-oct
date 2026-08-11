import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_NQ2_SAFE_ERROR,
  submitCampaignNq2Lead,
  type SubmitCampaignNq2LeadInput,
} from "./campaignNq2LeadCapture";

const submitTruthGateLeadMock = vi.fn();

vi.mock("@/services/truthGateLeadCapture", () => ({
  submitTruthGateLead: (...args: unknown[]) =>
    submitTruthGateLeadMock(...args),
}));

const input: SubmitCampaignNq2LeadInput = {
  sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  submissionId: "11111111-2222-4333-8444-555555555555",
  firstName: "Maria",
  phone: "(305) 555-1234",
  email: "maria@example.com",
  marketingCommunicationsGranted: false,
};

describe("campaignNq2LeadCapture", () => {
  beforeEach(() => {
    submitTruthGateLeadMock.mockReset();
    window.history.replaceState(
      {},
      "",
      "/nq2?utm_source=facebook&utm_medium=paid_social&utm_campaign=meta_nq2&fbclid=click-123",
    );
  });

  it("uses the canonical Truth Gate service with the exact three contact values", async () => {
    submitTruthGateLeadMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      sessionId: input.sessionId,
      reused: false,
      phoneE164: "+13055551234",
      clientSlug: "direct",
    });

    await expect(submitCampaignNq2Lead(input)).resolves.toEqual({
      ok: true,
      leadId: "lead-123",
      sessionId: input.sessionId,
      reused: false,
    });

    expect(submitTruthGateLeadMock).toHaveBeenCalledWith({
      sessionId: input.sessionId,
      submissionId: input.submissionId,
      firstName: "Maria",
      phone: "(305) 555-1234",
      email: "maria@example.com",
      funnelClientSlug: undefined,
      marketingCommunicationsGranted: input.marketingCommunicationsGranted,
    });
  });

  it("adds the proven no_quote intent while preserving supported attribution", async () => {
    let searchDuringCapture = "";
    submitTruthGateLeadMock.mockImplementation(() => {
      searchDuringCapture = window.location.search;
      return Promise.resolve({
        ok: true,
        leadId: "lead-123",
        sessionId: input.sessionId,
        reused: false,
        phoneE164: "+13055551234",
        clientSlug: "direct",
      });
    });

    const originalSearch = window.location.search;
    await submitCampaignNq2Lead(input);

    const params = new URLSearchParams(searchDuringCapture);
    expect(params.get("wm_intent")).toBe("no_quote");
    expect(params.get("utm_source")).toBe("facebook");
    expect(params.get("utm_medium")).toBe("paid_social");
    expect(params.get("utm_campaign")).toBe("meta_nq2");
    expect(params.get("fbclid")).toBe("click-123");
    expect(window.location.search).toBe(originalSearch);
  });

  it("maps canonical service details to a visitor-safe recoverable error", async () => {
    submitTruthGateLeadMock.mockResolvedValue({
      ok: false,
      code: "insert_failed",
      message: "private database detail",
      sessionId: input.sessionId,
    });

    await expect(submitCampaignNq2Lead(input)).resolves.toEqual({
      ok: false,
      message: CAMPAIGN_NQ2_SAFE_ERROR,
    });
  });
});
