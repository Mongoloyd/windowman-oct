import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getAttributionPayload } from "@/lib/useUtmCapture";
import type {
  WmChatIntakeV1,
  WmChatSubmitInput,
} from "@/pages/WmChat/wmChatTypes";
import {
  WM_CHAT_SESSION_STORAGE_KEY,
  WM_CHAT_SOURCE,
  WM_CHAT_SOURCE_PATH,
  WM_CHAT_SUBMISSION_STORAGE_KEY,
  buildWmChatQueryParams,
  buildWmChatLeadPayload,
  getOrCreateWmChatSessionId,
  getOrCreateWmChatSubmissionId,
  isValidWmChatIntake,
  submitWmChatLead,
} from "./wmchatLeadCapture";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
  },
}));

vi.mock("@/lib/useUtmCapture", () => ({
  getUtmData: vi.fn(() => ({
    utm_source: "meta",
    utm_medium: "paid_social",
    utm_campaign: "wmchat_test",
    utm_term: null,
    utm_content: "hero_a",
    fbclid: "fb-click",
    gclid: null,
    fbp: null,
    fbc: null,
    client_slug: "direct",
    landing_page: "/wmchat",
    landing_page_url: "/wmchat?utm_source=meta",
  })),
  getAttributionPayload: vi.fn(() => ({
    utm_source: "meta",
    utm_medium: "paid_social",
    wm_intent: "unknown",
    query_params: { utm_source: "meta", campaign_id: "campaign-1" },
  })),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: vi.fn(() => ({ fbp: "fbp-cookie", fbc: "fbc-cookie" })),
}));

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SUBMISSION_ID = "11111111-2222-4333-8444-555555555555";
const LEAD_ID = "99999999-8888-4777-8666-555555555555";

const needQuoteIntake: WmChatIntakeV1 = {
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "need_quote",
  answer_path: [
    "entry:entry_need_quote",
    "need_reason:need_planning",
    "need_detail_planning:planning_price_baseline",
    "priorities:priority_price_baseline",
    "stakes:stakes_later_cost",
    "trust:trust_pressure",
    "recap:recap_confirm",
    "project_scope:scope_windows",
    "openings:openings_6_10",
    "budget:budget_baseline",
    "timing:timing_1_3_months",
  ],
  answers: {
    entry_intent: "need_quote",
    need_reason: "need_planning",
    need_detail: "planning_price_baseline",
    priorities: ["priority_price_baseline"],
    stakes: "stakes_later_cost",
    trust_concern: "trust_pressure",
    zip: "33301",
    project_scope: "scope_windows",
    openings: "openings_6_10",
    budget_posture: "budget_baseline",
    timing: "timing_1_3_months",
  },
  continuation: "sms_then_voice",
};

const quoteIntake: WmChatIntakeV1 = {
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "have_quote",
  answer_path: [
    "entry:entry_have_quote",
    "have_concern:have_price",
    "have_detail_price:price_total",
  ],
  answers: {
    entry_intent: "have_quote",
    have_concern: "have_price",
    have_detail: "price_total",
  },
  continuation: "sms_then_voice",
};

const demoIntake: WmChatIntakeV1 = {
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "learn_powers",
  answer_path: [
    "entry:entry_learn_powers",
    "power_1:power_next_2",
    "power_2:power_next_3",
    "power_3:power_next_4",
    "power_4:power_next_5",
    "power_5:power_not_ready",
    "not_ready:not_ready_demo",
  ],
  answers: {
    entry_intent: "learn_powers",
    powers: "power_not_ready",
    hesitation_action: "not_ready_demo",
  },
  continuation: "sms_then_voice",
};

const sampleInput: WmChatSubmitInput = {
  sessionId: SESSION_ID,
  submissionId: SUBMISSION_ID,
  firstName: null,
  phoneE164: "+15615550123",
  serviceCommunicationsGranted: true,
  marketingConsentPresented: false,
  marketingCommunicationsGranted: false,
  wmchatIntake: needQuoteIntake,
};

describe("wmchatLeadCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("builds the exact wmchat source/path with mobile-only contact", () => {
    const payload = buildWmChatLeadPayload(sampleInput);
    expect(payload.source).toBe(WM_CHAT_SOURCE);
    expect(payload.first_name).toBeNull();
    expect(payload.email).toBeNull();
    expect(payload.phone_e164).toBe("+15615550123");
    expect(payload.wmchat_intake).toEqual(needQuoteIntake);

    const query = payload.query_params as Record<string, string>;
    expect(query.source_path).toBe(WM_CHAT_SOURCE_PATH);
    expect(query.wm_intent).toBe("no_quote");
    expect(query.intake_version).toBe("wmchat_v1");
    expect(query.campaign_id).toBe("campaign-1");
    expect((payload.attribution as Record<string, unknown>).wm_intent).toBe(
      "no_quote",
    );
  });

  it("reserves required markers ahead of noisy or conflicting attribution", () => {
    const noisyQuery = Object.fromEntries(
      Array.from({ length: 60 }, (_, index) => [
        `noise_${index}`,
        `value-${index}`,
      ]),
    );
    const query = buildWmChatQueryParams(
      {
        ...noisyQuery,
        " source_path ": "/forged",
        intake_version: "wmchat_v0",
      },
      {
        wm_intent: "no_quote",
        source_path: WM_CHAT_SOURCE_PATH,
        intake_version: "wmchat_v1",
      },
    );

    expect(Object.keys(query)).toHaveLength(50);
    expect(query).toEqual(
      expect.objectContaining({
        wm_intent: "no_quote",
        source_path: WM_CHAT_SOURCE_PATH,
        intake_version: "wmchat_v1",
      }),
    );
    expect(query.noise_46).toBe("value-46");
    expect(query.noise_47).toBeUndefined();
  });

  it("keeps the mobile payload contract valid with more than 50 landing parameters", () => {
    vi.mocked(getAttributionPayload).mockReturnValueOnce({
      query_params: Object.fromEntries(
        Array.from({ length: 60 }, (_, index) => [
          `key_${index}`,
          `value-${index}`,
        ]),
      ),
    });

    const query = buildWmChatLeadPayload(sampleInput).query_params as Record<
      string,
      string
    >;
    expect(Object.keys(query)).toHaveLength(50);
    expect(query.source_path).toBe(WM_CHAT_SOURCE_PATH);
    expect(query.intake_version).toBe("wmchat_v1");
    expect(query.wm_intent).toBe("no_quote");
  });

  it("maps quote holders to has_quote without putting contact PII in wmchat_v1", () => {
    const payload = buildWmChatLeadPayload({
      ...sampleInput,
      firstName: "  Maria  ",
      wmchatIntake: quoteIntake,
    });
    expect(payload.first_name).toBe("Maria");
    expect((payload.query_params as Record<string, string>).wm_intent).toBe(
      "has_quote",
    );
    expect(JSON.stringify(payload.wmchat_intake)).not.toContain("Maria");
    expect(JSON.stringify(payload.wmchat_intake)).not.toContain("5615550123");
  });

  it("records service authorization and does not present marketing consent", () => {
    const payload = buildWmChatLeadPayload(sampleInput);
    const consent = payload.consent as {
      source: string;
      submissionId: string;
      events: Array<{ purpose: string; decision: string }>;
    };
    expect(consent.source).toBe(WM_CHAT_SOURCE);
    expect(consent.submissionId).toBe(SUBMISSION_ID);
    expect(consent.events).toEqual([
      {
        purpose: "service_communications",
        decision: "granted",
        disclosureVersion: expect.any(String),
      },
    ]);
  });

  it("rejects unknown IDs, PII keys, multiline Other, and mismatched entry intent", () => {
    expect(isValidWmChatIntake(needQuoteIntake)).toBe(true);
    expect(isValidWmChatIntake(demoIntake)).toBe(true);
    expect(
      isValidWmChatIntake({
        ...needQuoteIntake,
        answer_path: [
          ...needQuoteIntake.answer_path,
          "unknown:priority_price_baseline",
        ],
      }),
    ).toBe(false);
    expect(
      isValidWmChatIntake({
        ...needQuoteIntake,
        answers: { ...needQuoteIntake.answers, phone: "+15615550123" },
      }),
    ).toBe(false);
    expect(
      isValidWmChatIntake({ ...needQuoteIntake, other_text: "first\nsecond" }),
    ).toBe(false);
    expect(
      isValidWmChatIntake({ ...needQuoteIntake, entry_intent: "have_quote" }),
    ).toBe(false);
  });

  it("keeps session and submission IDs stable without storing submitted PII", async () => {
    const sessionId = getOrCreateWmChatSessionId();
    const submissionId = getOrCreateWmChatSubmissionId();
    expect(getOrCreateWmChatSessionId()).toBe(sessionId);
    expect(getOrCreateWmChatSubmissionId()).toBe(submissionId);
    expect(sessionStorage.getItem(WM_CHAT_SESSION_STORAGE_KEY)).toBe(sessionId);
    expect(sessionStorage.getItem(WM_CHAT_SUBMISSION_STORAGE_KEY)).toBe(
      submissionId,
    );
    invokeMock.mockResolvedValue({ data: null, error: new Error("offline") });
    await submitWmChatLead({
      ...sampleInput,
      sessionId,
      submissionId,
      phoneE164: "+15615550123",
    });
    const storedEntries = Array.from(
      { length: sessionStorage.length },
      (_, index) => {
        const key = sessionStorage.key(index)!;
        return `${key}:${sessionStorage.getItem(key)}`;
      },
    ).join("|");
    expect(storedEntries).not.toContain("5615550123");
  });

  it("rejects invalid mobile and malformed intake before invoking the Edge Function", async () => {
    expect(
      await submitWmChatLead({ ...sampleInput, phoneE164: "+11234567890" }),
    ).toEqual({
      ok: false,
      message:
        "I couldn’t save that yet. Your answers are still here—please try again.",
    });
    expect(
      await submitWmChatLead({
        ...sampleInput,
        wmchatIntake: { ...needQuoteIntake, answer_path: [] },
      }),
    ).toEqual(expect.objectContaining({ ok: false }));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("rejects invalid optional names and contact-like guided Other before invoking capture", async () => {
    for (const firstName of ["", "M", "x".repeat(101)]) {
      await expect(
        submitWmChatLead({ ...sampleInput, firstName }),
      ).resolves.toEqual(expect.objectContaining({ ok: false }));
    }
    await expect(
      submitWmChatLead({
        ...sampleInput,
        wmchatIntake: {
          ...needQuoteIntake,
          other_text: "Call me at 561-555-0123",
        },
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes only canonical capture and returns the trusted identity pair", async () => {
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
        reused: false,
      },
      error: null,
    });

    await expect(submitWmChatLead(sampleInput)).resolves.toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("capture-truth-gate-lead", {
      body: expect.objectContaining({ session_id: SESSION_ID }),
    });
  });

  it.each([
    [
      "wmchat_phone_invalid",
      "invalid_phone",
      "That number could not be validated. Check it and enter a valid US number.",
    ],
    [
      "wmchat_phone_lookup_unavailable",
      "lookup_unavailable",
      "I couldn’t check that number right now. Your answers are still here—please try again.",
    ],
    [
      "wmchat_lead_mismatch",
      "identity_conflict",
      "Let me start a fresh conversation for those details—one moment.",
    ],
    [
      "invalid_reused_lead_id",
      "identity_conflict",
      "Let me start a fresh conversation for those details—one moment.",
    ],
  ])(
    "maps the typed Edge code %s to safe WmChat UX",
    async (edgeCode, code, message) => {
      invokeMock.mockResolvedValue({
        data: null,
        error: {
          context: {
            json: vi.fn().mockResolvedValue({
              code: edgeCode,
              message: "untrusted upstream detail",
            }),
          },
        },
      });

      await expect(submitWmChatLead(sampleInput)).resolves.toEqual({
        ok: false,
        code,
        message,
      });
    },
  );

  it("falls back safely when an Edge error body cannot be read", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: vi.fn().mockRejectedValue(new Error("body unavailable")),
        },
      },
    });

    await expect(submitWmChatLead(sampleInput)).resolves.toEqual({
      ok: false,
      code: "capture_failed",
      message:
        "I couldn’t save that yet. Your answers are still here—please try again.",
    });
  });

  it("coalesces duplicate in-flight submits for the same session/submission identity", async () => {
    let resolveInvoke: ((value: unknown) => void) | undefined;
    invokeMock.mockReturnValue(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const first = submitWmChatLead(sampleInput);
    const duplicate = submitWmChatLead(sampleInput);
    expect(invokeMock).toHaveBeenCalledTimes(1);

    resolveInvoke?.({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
      },
      error: null,
    });
    await expect(first).resolves.toEqual(expect.objectContaining({ ok: true }));
    await expect(duplicate).resolves.toEqual(
      expect.objectContaining({ ok: true }),
    );
  });

  it("allows a failed retry while preserving the same session/submission identity", async () => {
    invokeMock
      .mockResolvedValueOnce({ data: null, error: new Error("offline") })
      .mockResolvedValueOnce({
        data: {
          success: true,
          lead_id: LEAD_ID,
          session_id: SESSION_ID,
          reused: true,
        },
        error: null,
      });

    await expect(submitWmChatLead(sampleInput)).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    await expect(submitWmChatLead(sampleInput)).resolves.toEqual(
      expect.objectContaining({ ok: true, reused: true }),
    );
    expect(invokeMock).toHaveBeenCalledTimes(2);
    const firstBody = invokeMock.mock.calls[0][1].body;
    const retryBody = invokeMock.mock.calls[1][1].body;
    expect(firstBody.session_id).toBe(SESSION_ID);
    expect(retryBody.session_id).toBe(SESSION_ID);
    expect(firstBody.consent.submissionId).toBe(SUBMISSION_ID);
    expect(retryBody.consent.submissionId).toBe(SUBMISSION_ID);
  });

  it("contains no browser conversion call or direct leads insert", () => {
    const source = readFileSync("src/services/wmchatLeadCapture.ts", "utf8");
    expect(source).not.toContain("trackConversion");
    expect(source).not.toMatch(/\.from\(["']leads["']\)\s*\.insert/);
    expect(source).not.toContain("capi-event");
  });

  it.each([
    [{ success: true, lead_id: null, session_id: SESSION_ID }, "missing lead"],
    [{ success: true, lead_id: LEAD_ID, session_id: null }, "missing session"],
    [
      {
        success: true,
        lead_id: LEAD_ID,
        session_id: "22222222-3333-4444-8555-666666666666",
      },
      "mismatched session",
    ],
  ])("fails closed for %s (%s)", async (data) => {
    invokeMock.mockResolvedValue({ data, error: null });
    await expect(submitWmChatLead(sampleInput)).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
  });
});
