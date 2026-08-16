import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAttributionPayload } from "@/lib/useUtmCapture";
import type { WmChatIntakeV1 } from "@/pages/WmChat/wmChatTypes";
import {
  WM_CHAT_EMAIL_CAPTURE_KIND,
  WM_CHAT_EMAIL_ENTRY_POINT,
  WM_CHAT_EMAIL_SESSION_STORAGE_KEY,
  WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY,
  buildWmChatEmailLeadPayload,
  clearWmChatEmailCaptureIdentity,
  getOrCreateWmChatEmailCaptureIdentity,
  isProtectionKitWmChatIntake,
  submitWmChatEmailLead,
} from "./wmchatEmailLeadCapture";
import { WM_CHAT_SOURCE, WM_CHAT_SOURCE_PATH } from "./wmchatLeadCapture";

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
    utm_campaign: "wmchat_kit",
    utm_term: null,
    utm_content: "powers",
    fbclid: "fb-click",
    gclid: null,
    fbp: null,
    fbc: null,
    client_slug: "partner-a",
    landing_page: "/wmchat",
    landing_page_url: "/wmchat?utm_source=meta",
  })),
  getAttributionPayload: vi.fn(() => ({
    utm_source: "meta",
    query_params: { campaign_id: "campaign-1" },
  })),
}));

vi.mock("@/lib/attribution/fbCookies", () => ({
  readLateFbCookies: vi.fn(() => ({ fbp: "fbp-cookie", fbc: "fbc-cookie" })),
}));

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SUBMISSION_ID = "11111111-2222-4333-8444-555555555555";
const LEAD_ID = "99999999-8888-4777-8666-555555555555";

const protectionKitIntake: WmChatIntakeV1 = {
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
    "not_ready:not_ready_protection_kit",
  ],
  answers: {
    entry_intent: "learn_powers",
    powers: "power_not_ready",
    hesitation_action: "not_ready_protection_kit",
  },
  continuation: "email_only",
};

describe("wmchatEmailLeadCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it("builds the exact canonical email-only payload and service-email consent", () => {
    const payload = buildWmChatEmailLeadPayload(
      { email: " Maria@Example.com ", wmchatIntake: protectionKitIntake },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID },
    );
    expect(payload).toEqual(
      expect.objectContaining({
        session_id: SESSION_ID,
        first_name: null,
        phone_e164: null,
        email: "maria@example.com",
        source: WM_CHAT_SOURCE,
        client_slug: "partner-a",
        wmchat_capture_kind: WM_CHAT_EMAIL_CAPTURE_KIND,
        wmchat_intake: protectionKitIntake,
      }),
    );
    expect(payload.source).not.toBe("wm_chat");
    // Lead ownership remains canonical; wm_chat is entry-point attribution only.
    const query = payload.query_params as Record<string, string>;
    expect(query).toEqual(
      expect.objectContaining({
        source_path: WM_CHAT_SOURCE_PATH,
        intake_version: "wmchat_v1",
        capture_kind: WM_CHAT_EMAIL_CAPTURE_KIND,
        entry_point: WM_CHAT_EMAIL_ENTRY_POINT,
        wm_intent: "no_quote",
        campaign_id: "campaign-1",
      }),
    );
    const consent = payload.consent as {
      submissionId: string;
      source: string;
      events: Array<{ purpose: string; decision: string }>;
    };
    expect(consent.submissionId).toBe(SUBMISSION_ID);
    expect(consent.source).toBe(WM_CHAT_SOURCE);
    expect(consent.events).toEqual([
      expect.objectContaining({
        purpose: "service_communications",
        decision: "granted",
      }),
    ]);
    expect(JSON.stringify(payload.wmchat_intake)).not.toContain(
      "maria@example.com",
    );
  });

  it("keeps every Protection Kit marker when attribution exceeds the server limit", () => {
    vi.mocked(getAttributionPayload).mockReturnValueOnce({
      query_params: Object.fromEntries(
        Array.from({ length: 60 }, (_, index) => [
          `key_${index}`,
          `value-${index}`,
        ]),
      ),
    });

    const payload = buildWmChatEmailLeadPayload(
      { email: "maria@example.com", wmchatIntake: protectionKitIntake },
      { sessionId: SESSION_ID, submissionId: SUBMISSION_ID },
    );
    const query = payload.query_params as Record<string, string>;

    expect(Object.keys(query)).toHaveLength(50);
    expect(query).toEqual(
      expect.objectContaining({
        wm_intent: "no_quote",
        source_path: WM_CHAT_SOURCE_PATH,
        intake_version: "wmchat_v1",
        capture_kind: WM_CHAT_EMAIL_CAPTURE_KIND,
        entry_point: WM_CHAT_EMAIL_ENTRY_POINT,
      }),
    );
    expect(query.key_44).toBe("value-44");
    expect(query.key_45).toBeUndefined();
  });

  it("uses dedicated stable identities without storing submitted contact PII", async () => {
    const first = getOrCreateWmChatEmailCaptureIdentity();
    const second = getOrCreateWmChatEmailCaptureIdentity();
    expect(second).toEqual(first);
    expect(sessionStorage.getItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY)).toBe(
      first.sessionId,
    );
    expect(sessionStorage.getItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY)).toBe(
      first.submissionId,
    );
    invokeMock.mockResolvedValue({ data: null, error: new Error("offline") });
    await submitWmChatEmailLead({
      email: "maria@example.com",
      wmchatIntake: protectionKitIntake,
    });
    const storedEntries = Array.from(
      { length: sessionStorage.length },
      (_, index) => {
        const key = sessionStorage.key(index)!;
        return `${key}:${sessionStorage.getItem(key)}`;
      },
    ).join("|");
    expect(storedEntries).not.toContain("example.com");
    clearWmChatEmailCaptureIdentity();
    expect(
      sessionStorage.getItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY),
    ).toBeNull();
    expect(
      sessionStorage.getItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY),
    ).toBeNull();
  });

  it("rejects invalid email or any non-terminal Protection Kit path before invocation", async () => {
    await expect(
      submitWmChatEmailLead({
        email: "not-an-email",
        wmchatIntake: protectionKitIntake,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    await expect(
      submitWmChatEmailLead({
        email: "maria@example.com",
        wmchatIntake: {
          ...protectionKitIntake,
          continuation: "sms_then_voice",
        },
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes only canonical capture and requires a real matching identity pair", async () => {
    sessionStorage.setItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY, SESSION_ID);
    sessionStorage.setItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY, SUBMISSION_ID);
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
        reused: false,
      },
      error: null,
    });

    await expect(
      submitWmChatEmailLead({
        email: "Maria@Example.com",
        wmchatIntake: protectionKitIntake,
      }),
    ).resolves.toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      reused: false,
    });
    expect(
      sessionStorage.getItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY),
    ).toBeNull();
    expect(
      sessionStorage.getItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY),
    ).toBeNull();
    expect(invokeMock).toHaveBeenCalledWith("capture-truth-gate-lead", {
      body: expect.objectContaining({
        session_id: SESSION_ID,
        email: "maria@example.com",
        wmchat_capture_kind: "protection_kit",
      }),
    });

    sessionStorage.setItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY, SESSION_ID);
    sessionStorage.setItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY, SUBMISSION_ID);
    invokeMock.mockResolvedValue({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff",
      },
      error: null,
    });
    await expect(
      submitWmChatEmailLead({
        email: "maria@example.com",
        wmchatIntake: protectionKitIntake,
      }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
  });

  it("coalesces duplicate submits and reuses identities after a failed retry", async () => {
    sessionStorage.setItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY, SESSION_ID);
    sessionStorage.setItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY, SUBMISSION_ID);
    let resolveInvoke: ((value: unknown) => void) | undefined;
    invokeMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const input = {
      email: "maria@example.com",
      wmchatIntake: protectionKitIntake,
    };
    const first = submitWmChatEmailLead(input);
    const duplicate = submitWmChatEmailLead(input);
    expect(invokeMock).toHaveBeenCalledTimes(1);
    resolveInvoke?.({ data: null, error: new Error("offline") });
    await expect(first).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    await expect(duplicate).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );

    invokeMock.mockResolvedValueOnce({
      data: {
        success: true,
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
        reused: true,
      },
      error: null,
    });
    await expect(submitWmChatEmailLead(input)).resolves.toEqual(
      expect.objectContaining({ ok: true, reused: true }),
    );
    const firstBody = invokeMock.mock.calls[0][1].body;
    const retryBody = invokeMock.mock.calls[1][1].body;
    expect(retryBody.session_id).toBe(firstBody.session_id);
    expect(retryBody.consent.submissionId).toBe(firstBody.consent.submissionId);
  });

  it("contains no browser conversion or direct leads insert", () => {
    const source = readFileSync(
      "src/services/wmchatEmailLeadCapture.ts",
      "utf8",
    );
    expect(source).not.toContain("trackConversion");
    expect(source).not.toContain("dataLayer");
    expect(source).not.toContain("capi-event");
    expect(source).not.toMatch(/\.from\(["']leads["']\)\s*\.insert/);
    expect(isProtectionKitWmChatIntake(protectionKitIntake)).toBe(true);
  });
});
