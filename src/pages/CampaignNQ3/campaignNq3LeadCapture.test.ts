import { beforeEach, describe, expect, it, vi } from "vitest";
import { createCampaignNq3LeadSubmitter } from "./campaignNq3LeadCapture";

const { firstQuoteSubmitMock, rotateSessionMock } = vi.hoisted(() => ({
  firstQuoteSubmitMock: vi.fn(),
  rotateSessionMock: vi.fn(),
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () =>
    "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  rotateFirstQuoteSessionId: () => rotateSessionMock(),
  submitWindowmanFirstQuoteLead: (...args: unknown[]) =>
    firstQuoteSubmitMock(...args),
}));

const TEST_SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NEXT_SESSION_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";
const REUSED_LEAD_ID = "55555555-5555-4555-8555-555555555555";
const FIRST_ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";

const payload = {
  zip: "34997",
  projectType: "Both windows and doors",
  openings: "11–15",
  timing: "1–3 months",
  name: "Sam",
  email: "sam@example.com",
  phone: "+13055550142",
};

const hasQuotePayload = {
  intent: "has_quote" as const,
  zip: "34997",
  projectType: "",
  openings: "",
  name: "Sam",
  email: "sam@example.com",
  phone: "+13055550142",
};

const context = {
  captureAttemptId: FIRST_ATTEMPT_ID,
  landingVisitId: "22222222-2222-4222-8222-222222222222",
  entryPoint: "hero_zip" as const,
};

describe("CampaignNQ3 lead persistence adapter", () => {
  beforeEach(() => {
    firstQuoteSubmitMock.mockReset();
    rotateSessionMock.mockReset();
    rotateSessionMock.mockReturnValue(NEXT_SESSION_ID);
  });

  it("maps NQ3 fields into the canonical first-quote persistence boundary", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });

    const submit = createCampaignNq3LeadSubmitter();
    const result = await submit(payload, context);

    expect(result).toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: TEST_SESSION_ID,
      reused: false,
    });
    expect(firstQuoteSubmitMock).toHaveBeenCalledWith({
      sessionId: TEST_SESSION_ID,
      submissionId: FIRST_ATTEMPT_ID,
      sourcePath: "/nq3",
      firstName: "Sam",
      email: "sam@example.com",
      phoneE164: "+13055550142",
      wmIntent: "no_quote",
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
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("maps has_quote to the NQ3 upload boundary with empty project fields", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });

    const result = await createCampaignNq3LeadSubmitter()(
      hasQuotePayload,
      { ...context, entryPoint: "hero_primary" },
    );

    expect(result).toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: TEST_SESSION_ID,
      reused: false,
    });
    expect(firstQuoteSubmitMock).toHaveBeenCalledWith({
      sessionId: TEST_SESSION_ID,
      submissionId: FIRST_ATTEMPT_ID,
      sourcePath: "/nq3",
      firstName: "Sam",
      email: "sam@example.com",
      phoneE164: "+13055550142",
      wmIntent: "has_quote",
      projectBasics: {
        zipOrCity: "34997",
        homeownerRole: "",
        propertyType: "",
        openingsBucket: "",
        productScope: "",
        timing: "",
      },
      helpNeeded: "I have a written estimate and want it reviewed.",
      preferredContact: "Text",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    });
  });

  it("fails closed for noncanonical product, openings, or timing values", async () => {
    const submit = createCampaignNq3LeadSubmitter();

    await expect(
      submit({ ...payload, projectType: "Windows" }, context),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      submit({ ...payload, openings: "10-ish" }, context),
    ).resolves.toMatchObject({ ok: false });
    await expect(
      submit({ ...payload, timing: "Someday" }, context),
    ).resolves.toMatchObject({ ok: false });

    expect(firstQuoteSubmitMock).not.toHaveBeenCalled();
  });

  it("does not report success when canonical persistence fails", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });

    const result = await createCampaignNq3LeadSubmitter()({
      zip: "34997",
      projectType: "Impact windows",
      openings: "6–10",
      timing: "ASAP",
      name: "Sam",
      email: "sam@example.com",
      phone: "+13055550142",
    }, context);

    expect(result).toEqual({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(TEST_SESSION_ID);
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("fails closed when canonical success omits leadId", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      reused: false,
    });

    const result = await createCampaignNq3LeadSubmitter()(payload, context);

    expect(result).toEqual({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("fails closed when canonical success returns a malformed leadId", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "not-a-uuid",
      reused: false,
    });

    const result = await createCampaignNq3LeadSubmitter()(payload, context);

    expect(result).toEqual({
      ok: false,
      message: "We couldn't save your plan yet. Check your details and try again.",
    });
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("returns persisted identifiers for reused success", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: REUSED_LEAD_ID,
      reused: true,
    });

    const result = await createCampaignNq3LeadSubmitter()(payload, context);

    expect(result).toEqual({
      ok: true,
      leadId: REUSED_LEAD_ID,
      sessionId: TEST_SESSION_ID,
      reused: true,
    });
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("retains session and consent IDs across failure, then rotates only after success", async () => {
    firstQuoteSubmitMock
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({
        ok: true,
        leadId: LEAD_ID,
        reused: false,
      });
    const submit = createCampaignNq3LeadSubmitter();

    const failed = await submit(payload, context);
    const succeeded = await submit(payload, context);

    expect(failed).toEqual({ ok: false, message: "Try again." });
    expect(succeeded).toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: TEST_SESSION_ID,
      reused: false,
    });
    expect(firstQuoteSubmitMock.mock.calls[0][0].submissionId).toBe(
      FIRST_ATTEMPT_ID,
    );
    expect(firstQuoteSubmitMock.mock.calls[1][0].submissionId).toBe(
      FIRST_ATTEMPT_ID,
    );
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(TEST_SESSION_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].sessionId).toBe(TEST_SESSION_ID);
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("uses the rotated session and new consent ID for the next capture", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });
    const submit = createCampaignNq3LeadSubmitter();

    await submit(payload, context);
    await submit(payload, {
      ...context,
      captureAttemptId: "33333333-3333-4333-8333-333333333333",
    });

    expect(firstQuoteSubmitMock.mock.calls[0][0].submissionId).not.toBe(
      firstQuoteSubmitMock.mock.calls[1][0].submissionId,
    );
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(TEST_SESSION_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].sessionId).toBe(NEXT_SESSION_ID);
    expect(rotateSessionMock).toHaveBeenCalledTimes(2);
  });
});
