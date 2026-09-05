import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeValues } from "@/components/intake/universal/intakeTypes";
import { createCampaignProphecyLeadSubmitter } from "./campaignProphecyLeadCapture";

const { firstQuoteSubmitMock } = vi.hoisted(() => ({
  firstQuoteSubmitMock: vi.fn(),
}));

vi.mock("@/services/windowmanFirstQuoteLeadCapture", () => ({
  getOrCreateFirstQuoteSessionId: () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  submitWindowmanFirstQuoteLead: (...args: unknown[]) =>
    firstQuoteSubmitMock(...args),
}));

const TEST_SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ATTEMPT_ID = "11111111-1111-4111-8111-111111111111";

const context = {
  captureAttemptId: ATTEMPT_ID,
  landingVisitId: "22222222-2222-4222-8222-222222222222",
  entryPoint: "hero_primary" as const,
};

const contact = {
  name: "Sam",
  email: "sam@example.com",
  phone: "+13055550142",
};

function hasQuoteValues(overrides: Partial<IntakeValues> = {}): IntakeValues {
  return {
    intent: "has_quote",
    zip: "34997",
    projectType: "",
    openings: "",
    ...contact,
    ...overrides,
  };
}

function noQuoteValues(overrides: Partial<IntakeValues> = {}): IntakeValues {
  return {
    intent: "no_quote",
    zip: "33139",
    projectType: "",
    openings: "11–15",
    priority: "Not overpaying",
    ...contact,
    ...overrides,
  };
}

describe("Prophecy lead persistence adapter", () => {
  beforeEach(() => {
    firstQuoteSubmitMock.mockReset();
    firstQuoteSubmitMock.mockResolvedValue({
      ok: true,
      leadId: "lead-123",
      reused: false,
    });
  });

  it("preserves the estimate-in-hand intent without inventing project scope", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    const result = await submit(hasQuoteValues(), context);

    expect(result).toEqual({
      ok: true,
      leadId: "lead-123",
      sessionId: TEST_SESSION_ID,
      reused: false,
    });

    const sent = firstQuoteSubmitMock.mock.calls[0][0];
    expect(sent.wmIntent).toBe("has_quote");
    expect(sent.sourcePath).toBe("/prophecy");
    expect(sent.projectBasics.openingsBucket).toBe("");
    expect(sent.extraQueryParams).toEqual({ prophecy_intent: "has_quote" });
    expect(Object.keys(sent)).not.toContain(["has", "Estimate"].join(""));
    expect(Object.keys(sent)).not.toContain(["window", "Count"].join(""));
  });

  it("preserves the openings bucket for the no-estimate branch", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    await submit(noQuoteValues(), context);

    const sent = firstQuoteSubmitMock.mock.calls[0][0];
    expect(sent.wmIntent).toBe("no_quote");
    expect(sent.projectBasics.openingsBucket).toBe("11–15");
    expect(sent.extraQueryParams).toEqual({
      prophecy_intent: "no_quote",
      prophecy_priority: "Not overpaying",
    });
  });

  it("preserves an unknown openings bucket without inventing a count", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    await submit(noQuoteValues({ openings: "Not sure" }), context);

    const sent = firstQuoteSubmitMock.mock.calls[0][0];
    expect(sent.projectBasics.openingsBucket).toBe("Not sure");
    expect(Object.keys(sent)).not.toContain(["window", "Count"].join(""));
  });

  it("refuses to submit when the fork was never answered", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    const result = await submit(hasQuoteValues({ intent: "" }), context);

    expect(result.ok).toBe(false);
    expect(firstQuoteSubmitMock).not.toHaveBeenCalled();
  });

  it("refuses an openings value outside the known buckets", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    const result = await submit(
      noQuoteValues({ openings: "6-10" }), // ASCII hyphen, not the en-dash
      context,
    );

    expect(result.ok).toBe(false);
    expect(firstQuoteSubmitMock).not.toHaveBeenCalled();
  });

  it("refuses a priority outside the offered options", async () => {
    const submit = createCampaignProphecyLeadSubmitter();
    const result = await submit(
      noQuoteValues({ priority: "whatever I typed" }),
      context,
    );

    expect(result.ok).toBe(false);
    expect(firstQuoteSubmitMock).not.toHaveBeenCalled();
  });

  it("reports failure when persistence succeeds without a lead id", async () => {
    firstQuoteSubmitMock.mockResolvedValue({ ok: true, leadId: "  " });

    const submit = createCampaignProphecyLeadSubmitter();
    const result = await submit(hasQuoteValues(), context);

    expect(result.ok).toBe(false);
  });
});
