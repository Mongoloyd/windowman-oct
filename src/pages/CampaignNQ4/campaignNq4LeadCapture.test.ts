import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IntakeSubmitContext,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import { createCampaignNq4LeadSubmitter } from "./campaignNq4LeadCapture";

const { firstQuoteSubmitMock } = vi.hoisted(() => ({
  firstQuoteSubmitMock: vi.fn(),
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () =>
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  submitWindowmanFirstQuoteLead: (...args: unknown[]) =>
    firstQuoteSubmitMock(...args),
}));

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";

const values: IntakeValues = {
  zip: "34997",
  projectType: "Both windows and doors",
  openings: "11–15",
  timing: "1–3 months",
  name: "Sam",
  email: "sam@example.com",
  phone: "+13055550142",
};

const context: IntakeSubmitContext = {
  captureAttemptId: ATTEMPT_ID,
  landingVisitId: "22222222-2222-4222-8222-222222222222",
  entryPoint: "hero_primary",
};

describe("CampaignNQ4 lead persistence adapter", () => {
  beforeEach(() => {
    firstQuoteSubmitMock.mockReset();
  });

  it("maps canonical NQ4 enums through the existing first-quote boundary", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      reused: false,
    });

    const result = await createCampaignNq4LeadSubmitter()(values, context);

    expect(result).toEqual({
      ok: true,
      leadId: "lead-123",
      sessionId: SESSION_ID,
      reused: false,
    });
    expect(firstQuoteSubmitMock).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      submissionId: ATTEMPT_ID,
      sourcePath: "/nq4",
      firstName: "Sam",
      email: "sam@example.com",
      phoneE164: "+13055550142",
      projectBasics: {
        zipOrCity: "34997",
        homeownerRole: "",
        propertyType: "",
        openingsBucket: "11–15",
        productScope: "Both windows and doors",
        timing: "1–3 months",
      },
      helpNeeded: "I want help requesting my first estimate.",
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });
  });

  it("fails closed before persistence for a non-canonical product, openings, or timing value", async () => {
    const submit = createCampaignNq4LeadSubmitter();

    await expect(
      submit({ ...values, projectType: "Windows" }, context),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      submit({ ...values, openings: "10-ish" }, context),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      submit({ ...values, timing: "Someday" }, context),
    ).resolves.toMatchObject({ ok: false });

    expect(firstQuoteSubmitMock).not.toHaveBeenCalled();
  });

  it("does not report success when canonical persistence fails", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: false,
      message: "We could not save this request.",
    });

    await expect(
      createCampaignNq4LeadSubmitter()(values, context),
    ).resolves.toEqual({
      ok: false,
      message: "We could not save this request.",
    });
  });

  it("fails closed when canonical success omits the lead ID", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      reused: false,
    });

    await expect(
      createCampaignNq4LeadSubmitter()(values, context),
    ).resolves.toMatchObject({ ok: false });
  });
});
