import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntakeValues } from "@/components/intake/universal/intakeTypes";
import { captureQuoteEducationDemoLead } from "@/lib/captureQuoteEducationDemoLead";
import {
  prepareQuoteEducationHandoff,
  selectQuoteEducationHandoffSubmitter,
} from "./quoteEducationHandoff";
import type { SyntheticDemoHandoffContext } from "./types";

vi.mock("@/lib/captureQuoteEducationDemoLead", () => ({
  captureQuoteEducationDemoLead: vi.fn(),
}));

const capture = vi.mocked(captureQuoteEducationDemoLead);
const leadId = "11111111-1111-4111-8111-111111111111";
const sessionId = "22222222-2222-4222-8222-222222222222";
const captureAttemptId = "33333333-3333-4333-8333-333333333333";
const context: SyntheticDemoHandoffContext = {
  variant: "lens",
  attribution: { sourcePath: "/nq3", entryPoint: "nq3_hero_quote_lens" },
  contact: { firstName: "Taylor", email: "Taylor@Example.test" },
  demoLeadId: leadId,
  demoSessionId: sessionId,
};
const values: IntakeValues = {
  intent: "no_quote",
  zip: "33301",
  projectType: "Impact windows",
  openings: "6–10",
  timing: "1–3 months",
  name: "Taylor",
  email: "taylor@example.test",
  phone: "+13055550100",
};

beforeEach(() => {
  vi.clearAllMocks();
  capture.mockResolvedValue({
    ok: true,
    leadId,
    sessionId,
    source: "quote-education-demo",
  });
});

describe("quote education saved-lead handoff", () => {
  it("updates the original identity without issuing a create", async () => {
    const prepared = prepareQuoteEducationHandoff(context, "/nq3");
    expect(prepared?.presetValues).toEqual({
      name: "Taylor",
      email: "taylor@example.test",
    });

    await expect(prepared?.submitter(values, {
      captureAttemptId,
      landingVisitId: "visit",
      entryPoint: "hero_primary",
    })).resolves.toEqual({ ok: true, leadId, sessionId, reused: true });

    expect(capture.mock.calls.map(([request]) => request.action)).toEqual([
      "update_zip",
      "update_phone",
      "update_intake",
    ]);
    expect(capture.mock.calls.some(([request]) => request.action === "create")).toBe(false);
    for (const [request] of capture.mock.calls) {
      expect(request).toMatchObject({
        source: "quote-education-demo",
        lead_id: leadId,
        session_id: sessionId,
      });
    }
    expect(capture.mock.calls[2][0]).toMatchObject({
      first_name: "Taylor",
      email: "taylor@example.test",
      quote_holder_shortcut: false,
      consent: {
        schemaVersion: "1",
        submissionId: captureAttemptId,
        source: "quote-education-demo",
        events: expect.arrayContaining([
          expect.objectContaining({
            purpose: "service_communications",
            decision: "granted",
          }),
        ]),
      },
      intake_answers_json: {
        handoff_version: "quote_education_handoff_v1",
        source_path: "/nq3",
        wm_intent: "no_quote",
        product_scope: "Impact windows",
        openings_bucket: "6–10",
        campaign_timing: "1–3 months",
      },
    });
  });

  it("uses the quote-holder shortcut without invented project answers", async () => {
    const prepared = prepareQuoteEducationHandoff(context, "/nq3");
    await prepared?.submitter({
      ...values,
      intent: "has_quote",
      projectType: "",
      openings: "",
      timing: "",
    }, {
      captureAttemptId,
      landingVisitId: "visit",
      entryPoint: "hero_primary",
    });

    expect(capture.mock.calls[2][0]).toMatchObject({
      intake_status: "Already have a quote to check",
      quote_holder_shortcut: true,
      intake_answers_json: {
        source_path: "/nq3",
        wm_intent: "has_quote",
      },
    });
    expect(capture.mock.calls[2][0].intake_answers_json).not.toHaveProperty("product_scope");
  });

  it("stops on the first failed update and preserves the existing identity", async () => {
    capture.mockResolvedValueOnce({
      ok: false,
      code: "request_failed",
      message: "generic",
    });
    const prepared = prepareQuoteEducationHandoff(context, "/nq3");

    await expect(prepared?.submitter(values, {
      captureAttemptId,
      landingVisitId: "visit",
      entryPoint: "hero_primary",
    })).resolves.toMatchObject({ ok: false });
    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.calls[0][0].action).toBe("update_zip");
  });

  it("falls back only for an intentional pre-capture escape", async () => {
    expect(prepareQuoteEducationHandoff({
      variant: "lens",
      attribution: context.attribution,
    }, "/nq3")).toBeNull();

    const partial = prepareQuoteEducationHandoff({
      ...context,
      demoSessionId: undefined,
    }, "/nq3");
    await expect(partial?.submitter(values, {
      captureAttemptId,
      landingVisitId: "visit",
      entryPoint: "hero_primary",
    })).resolves.toMatchObject({ ok: false });
    expect(capture).not.toHaveBeenCalled();
  });

  it("keeps a full NQ3 saved-demo handoff on exactly one lead", async () => {
    const injectedSubmitter = vi.fn();
    const defaultSubmitter = vi.fn();
    const prepared = prepareQuoteEducationHandoff(context, "/nq3");
    const selected = selectQuoteEducationHandoffSubmitter(
      prepared?.submitter ?? null,
      injectedSubmitter,
      defaultSubmitter,
    );

    await expect(selected(values, {
      captureAttemptId,
      landingVisitId: "visit",
      entryPoint: "hero_primary",
    })).resolves.toEqual({ ok: true, leadId, sessionId, reused: true });

    expect(injectedSubmitter).not.toHaveBeenCalled();
    expect(defaultSubmitter).not.toHaveBeenCalled();
    expect(capture).toHaveBeenCalledTimes(3);
    expect(capture.mock.calls.some(([request]) => request.action === "create"))
      .toBe(false);
    expect(new Set(capture.mock.calls.map(([request]) => request.lead_id)))
      .toEqual(new Set([leadId]));
  });
});
