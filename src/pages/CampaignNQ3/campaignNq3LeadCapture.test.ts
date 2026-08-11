import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCampaignNq3LeadSubmitter } from "./campaignNq3LeadCapture";

const { firstQuoteSubmitMock } = vi.hoisted(() => ({
  firstQuoteSubmitMock: vi.fn(),
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () =>
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  submitWindowmanFirstQuoteLead: (...args: unknown[]) =>
    firstQuoteSubmitMock(...args),
}));

describe("CampaignNQ3 lead persistence adapter", () => {
  beforeEach(() => {
    firstQuoteSubmitMock.mockReset();
  });

  it("maps NQ3 fields into the canonical first-quote persistence boundary", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      reused: false,
    });

    const submit = createCampaignNq3LeadSubmitter();
    const result = await submit({
      zip: "34997",
      projectType: "Both",
      openings: "11–15",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    });

    expect(result).toEqual({ ok: true });
    expect(firstQuoteSubmitMock).toHaveBeenCalledWith({
      sessionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      submissionId: expect.stringMatching(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      ),
      firstName: "Sam",
      email: "sam@example.com",
      phoneE164: "+13055550142",
      projectBasics: {
        zipOrCity: "34997",
        homeownerRole: "",
        propertyType: "",
        openingsBucket: "11–15",
        productScope: "Both windows and doors",
        timing: "Not sure",
      },
      helpNeeded: "I want help requesting my first estimate.",
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });
  });

  it("does not report success when canonical persistence fails", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });

    const result = await createCampaignNq3LeadSubmitter()({
      zip: "34997",
      projectType: "Windows",
      openings: "6–10",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    });

    expect(result).toEqual({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });
  });
});
