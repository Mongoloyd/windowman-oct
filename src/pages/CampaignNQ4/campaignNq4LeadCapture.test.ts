import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  IntakeSubmitContext,
  IntakeValues,
} from "@/components/intake/universal/intakeTypes";
import { createCampaignNq4LeadSubmitter } from "./campaignNq4LeadCapture";

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

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const NEXT_SESSION_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";
const LEAD_ID = "44444444-4444-4444-8444-444444444444";
const REUSED_LEAD_ID = "55555555-5555-4555-8555-555555555555";
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

const hasQuoteValues: IntakeValues = {
  intent: "has_quote",
  zip: "34997",
  projectType: "",
  openings: "",
  name: "Sam",
  email: "sam@example.com",
  phone: "+13055550142",
};

const context: IntakeSubmitContext = {
  captureAttemptId: ATTEMPT_ID,
  landingVisitId: "22222222-2222-4222-8222-222222222222",
  entryPoint: "hero_zip",
};

describe("CampaignNQ4 lead persistence adapter", () => {
  beforeEach(() => {
    firstQuoteSubmitMock.mockReset();
    rotateSessionMock.mockReset();
    rotateSessionMock.mockReturnValue(NEXT_SESSION_ID);
  });

  it("keeps the existing no_quote payload and exact NQ4 attribution", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });

    const result = await createCampaignNq4LeadSubmitter()(values, context);

    expect(result).toEqual({
      ok: true,
      leadId: LEAD_ID,
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
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("maps has_quote to the NQ4 upload boundary with empty project fields", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });

    const result = await createCampaignNq4LeadSubmitter()(
      hasQuoteValues,
      { ...context, entryPoint: "hero_primary" },
    );

    expect(result).toEqual({
      ok: true,
      leadId: LEAD_ID,
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

  it("fails closed before persistence for invalid no_quote project values", async () => {
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

  it("retains the session when canonical persistence fails", async () => {
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
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(SESSION_ID);
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("fails closed when canonical success omits the lead ID", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      reused: false,
    });

    await expect(
      createCampaignNq4LeadSubmitter()(values, context),
    ).resolves.toMatchObject({ ok: false });
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("fails closed when canonical success returns a malformed lead ID", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "not-a-uuid",
      reused: false,
    });

    await expect(
      createCampaignNq4LeadSubmitter()(values, context),
    ).resolves.toMatchObject({ ok: false });
    expect(rotateSessionMock).not.toHaveBeenCalled();
  });

  it("returns exact persisted identifiers for reused success", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: REUSED_LEAD_ID,
      reused: true,
    });

    await expect(
      createCampaignNq4LeadSubmitter()(values, context),
    ).resolves.toEqual({
      ok: true,
      leadId: REUSED_LEAD_ID,
      sessionId: SESSION_ID,
      reused: true,
    });
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("retries with the same session and rotates only after success", async () => {
    firstQuoteSubmitMock
      .mockResolvedValueOnce({ ok: false, message: "Try again." })
      .mockResolvedValueOnce({
        ok: true,
        leadId: LEAD_ID,
        reused: false,
      });
    const submit = createCampaignNq4LeadSubmitter();

    const failed = await submit(values, context);
    const succeeded = await submit(values, context);

    expect(failed).toEqual({ ok: false, message: "Try again." });
    expect(succeeded).toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    expect(firstQuoteSubmitMock.mock.calls[0][0].submissionId).toBe(ATTEMPT_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].submissionId).toBe(ATTEMPT_ID);
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(SESSION_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].sessionId).toBe(SESSION_ID);
    expect(rotateSessionMock).toHaveBeenCalledTimes(1);
  });

  it("uses the rotated session and next capture attempt after success", async () => {
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: LEAD_ID,
      reused: false,
    });
    const submit = createCampaignNq4LeadSubmitter();
    const nextAttemptId = "33333333-3333-4333-8333-333333333333";

    await submit(values, context);
    await submit(values, { ...context, captureAttemptId: nextAttemptId });

    expect(firstQuoteSubmitMock.mock.calls[0][0].submissionId).toBe(ATTEMPT_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].submissionId).toBe(nextAttemptId);
    expect(firstQuoteSubmitMock.mock.calls[0][0].sessionId).toBe(SESSION_ID);
    expect(firstQuoteSubmitMock.mock.calls[1][0].sessionId).toBe(NEXT_SESSION_ID);
    expect(rotateSessionMock).toHaveBeenCalledTimes(2);
  });
});
