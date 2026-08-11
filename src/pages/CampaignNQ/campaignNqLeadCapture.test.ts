import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAMPAIGN_NQ_SAFE_ERROR,
  submitCampaignNqLead,
  type SubmitCampaignNqLeadInput,
} from "./campaignNqLeadCapture";

const submitTruthGateLeadMock = vi.fn();

vi.mock("@/services/truthGateLeadCapture", () => ({
  submitTruthGateLead: (...args: unknown[]) =>
    submitTruthGateLeadMock(...args),
}));

const input: SubmitCampaignNqLeadInput = {
  sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  submissionId: "11111111-2222-4333-8444-555555555555",
  firstName: "Maria",
  phoneE164: "+13055551234",
  email: "maria@example.com",
  marketingCommunicationsGranted: false,
};

describe("campaignNqLeadCapture", () => {
  beforeEach(() => {
    submitTruthGateLeadMock.mockReset();
    window.history.replaceState(
      {},
      "",
      "/nq?utm_source=facebook&utm_medium=paid_social&utm_campaign=meta_nq&fbclid=click-123",
    );
  });

  it("uses the canonical Truth Gate service with the validated contact values", async () => {
    submitTruthGateLeadMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      sessionId: input.sessionId,
      reused: false,
      phoneE164: input.phoneE164,
      clientSlug: "direct",
    });

    await expect(submitCampaignNqLead(input)).resolves.toEqual({
      ok: true,
      leadId: "lead-123",
      sessionId: input.sessionId,
      reused: false,
    });

    expect(submitTruthGateLeadMock).toHaveBeenCalledTimes(1);
    expect(submitTruthGateLeadMock).toHaveBeenCalledWith({
      sessionId: input.sessionId,
      submissionId: input.submissionId,
      firstName: "Maria",
      phone: "+13055551234",
      email: "maria@example.com",
      funnelClientSlug: undefined,
      marketingCommunicationsGranted: false,
    });
  });

  it("adds no-quote intent while preserving supported attribution", async () => {
    let searchDuringCapture = "";
    submitTruthGateLeadMock.mockImplementation(() => {
      searchDuringCapture = window.location.search;
      return Promise.resolve({
        ok: true,
        leadId: "lead-123",
        sessionId: input.sessionId,
        reused: false,
        phoneE164: input.phoneE164,
        clientSlug: "direct",
      });
    });

    const originalSearch = window.location.search;
    await submitCampaignNqLead(input);

    const params = new URLSearchParams(searchDuringCapture);
    expect(params.get("wm_intent")).toBe("no_quote");
    expect(params.get("utm_source")).toBe("facebook");
    expect(params.get("utm_medium")).toBe("paid_social");
    expect(params.get("utm_campaign")).toBe("meta_nq");
    expect(params.get("fbclid")).toBe("click-123");
    expect(window.location.search).toBe(originalSearch);
  });

  it("restores the original URL when the canonical submitter throws", async () => {
    let searchDuringCapture = "";
    submitTruthGateLeadMock.mockImplementation(() => {
      searchDuringCapture = window.location.search;
      throw new Error("capture failed");
    });

    const originalSearch = window.location.search;
    await expect(submitCampaignNqLead(input)).rejects.toThrow("capture failed");

    expect(new URLSearchParams(searchDuringCapture).get("wm_intent")).toBe(
      "no_quote",
    );
    expect(window.location.search).toBe(originalSearch);
  });

  it("maps canonical service details to a visitor-safe recoverable error", async () => {
    submitTruthGateLeadMock.mockResolvedValue({
      ok: false,
      code: "insert_failed",
      message: "private database detail",
      sessionId: input.sessionId,
    });

    await expect(submitCampaignNqLead(input)).resolves.toEqual({
      ok: false,
      message: CAMPAIGN_NQ_SAFE_ERROR,
    });
  });
});
