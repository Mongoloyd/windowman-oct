import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClient,
  type FunctionInvokeOptions,
  type SupabaseClient,
} from "@supabase/supabase-js";

import type { WmChatPostCaptureSubmitInput } from "@/pages/WmChat/wmChatTypes";

import {
  buildWmChatPostCapturePayload,
  submitWmChatPostCapture,
} from "./wmchatPostCapture";

const { invokeMock, fromMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  fromMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: (...args: unknown[]) => invokeMock(...args),
    },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

const LEAD_ID = "d6d9a0b5-12ad-4b95-9493-72a3ba98ad2f";
const SESSION_ID = "86080f63-66ff-4756-bc21-81fbd497761c";
const SUBMISSION_ID = "b4fc75ef-f7a7-4c30-bc4c-e0fdd9ba0f8f";

const SAFE_FAILURE_MESSAGE =
  "That next step did not save safely. Please try again.";
const CONFLICT_MESSAGE =
  "A different next step is already saved for this project. Your original project request remains safe.";

function gamePlanInput(
  overrides: Partial<WmChatPostCaptureSubmitInput> = {},
): WmChatPostCaptureSubmitInput {
  return {
    leadId: LEAD_ID,
    sessionId: SESSION_ID,
    submissionId: SUBMISSION_ID,
    action: "quote_request_game_plan",
    propertyAddress: null,
    conversationTimePreference: null,
    quoteReadiness: null,
    callbackPreference: null,
    ...overrides,
  };
}

function successfulInvoke() {
  return {
    data: {
      success: true,
      lead_id: LEAD_ID,
      session_id: SESSION_ID,
    },
    error: null,
  };
}

function testFunctionsClient(customFetch: typeof fetch): SupabaseClient {
  return createClient(
    "https://wmchat-timeout-contract.supabase.co",
    "wmchat-timeout-contract-anon-key",
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: { fetch: customFetch },
    },
  );
}

function invokeWith(client: SupabaseClient) {
  return (...args: unknown[]) => {
    const [functionName, options] = args as [
      string,
      FunctionInvokeOptions,
    ];
    return client.functions.invoke(functionName, options);
  };
}

describe("wmchatPostCapture", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    fromMock.mockReset();
  });

  it("builds the exact game-plan contract and required WmChat markers", () => {
    expect(buildWmChatPostCapturePayload(gamePlanInput())).toEqual({
      mode: "wmchat_post_capture_v1",
      source: "windowman-first-quote",
      lead_id: LEAD_ID,
      session_id: SESSION_ID,
      submission_id: SUBMISSION_ID,
      action: "quote_request_game_plan",
      property_address: null,
      conversation_time_preference: null,
      quote_readiness: null,
      callback_preference: null,
      query_params: {
        source_path: "/wmchat",
        intake_version: "wmchat_v1",
      },
    });
  });

  it("normalizes and serializes the optional project address", () => {
    expect(
      buildWmChatPostCapturePayload(
        gamePlanInput({
          propertyAddress: {
            line1: " 123 Palm Avenue ",
            line2: " Unit 4 ",
            city: " Boca Raton ",
            region: " fl ",
            postalCode: " 33431 ",
          },
        }),
      )?.property_address,
    ).toEqual({
      line1: "123 Palm Avenue",
      line2: "Unit 4",
      city: "Boca Raton",
      region: "FL",
      postal_code: "33431",
    });
  });

  it("builds the exact scheduling and review-later action shapes", () => {
    expect(
      buildWmChatPostCapturePayload(
        gamePlanInput({
          action: "schedule_windowman_conversation",
          conversationTimePreference: "weekday_afternoon",
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        action: "schedule_windowman_conversation",
        conversation_time_preference: "weekday_afternoon",
        quote_readiness: null,
        callback_preference: null,
      }),
    );

    expect(
      buildWmChatPostCapturePayload(
        gamePlanInput({
          action: "review_quote_when_ready",
          quoteReadiness: "not_yet",
          callbackPreference: "next_week",
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        action: "review_quote_when_ready",
        property_address: null,
        conversation_time_preference: null,
        quote_readiness: "not_yet",
        callback_preference: "next_week",
      }),
    );
  });

  it.each([
    ["lead", gamePlanInput({ leadId: "bad" })],
    ["session", gamePlanInput({ sessionId: "bad" })],
    ["submission", gamePlanInput({ submissionId: "bad" })],
  ])("rejects an invalid %s UUID before invocation", async (_label, input) => {
    expect(buildWmChatPostCapturePayload(input)).toBeNull();
    await expect(submitWmChatPostCapture(input)).resolves.toEqual({
      ok: false,
      message: "Review this next step and try again.",
    });
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it.each([
    gamePlanInput({ conversationTimePreference: "asap" }),
    gamePlanInput({ quoteReadiness: "not_yet" }),
    gamePlanInput({ callbackPreference: "one_month" }),
    gamePlanInput({
      action: "schedule_windowman_conversation",
      conversationTimePreference: null,
    }),
    gamePlanInput({
      action: "schedule_windowman_conversation",
      conversationTimePreference: "asap",
      callbackPreference: "one_month",
    }),
    gamePlanInput({
      action: "review_quote_when_ready",
      quoteReadiness: "ready_now",
      callbackPreference: "next_week",
    }),
    gamePlanInput({
      action: "review_quote_when_ready",
      quoteReadiness: "not_yet",
      callbackPreference: null,
    }),
    gamePlanInput({
      action: "review_quote_when_ready",
      propertyAddress: {
        line1: "123 Palm Avenue",
        line2: "",
        city: "Boca Raton",
        region: "FL",
        postalCode: "33431",
      },
      quoteReadiness: "not_yet",
      callbackPreference: "next_week",
    }),
    gamePlanInput({
      action: "unknown" as WmChatPostCaptureSubmitInput["action"],
    }),
  ])("rejects invalid or cross-action field combinations", async (input) => {
    expect(buildWmChatPostCapturePayload(input)).toBeNull();
    await submitWmChatPostCapture(input);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed address without invoking the Edge Function", async () => {
    const input = gamePlanInput({
      propertyAddress: {
        line1: "1",
        line2: "",
        city: "",
        region: "FL",
        postalCode: "3343",
      },
    });
    expect(buildWmChatPostCapturePayload(input)).toBeNull();
    await submitWmChatPostCapture(input);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("invokes only canonical capture and accepts only the exact trusted pair", async () => {
    invokeMock.mockResolvedValue(successfulInvoke());

    await expect(submitWmChatPostCapture(gamePlanInput())).resolves.toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("capture-truth-gate-lead", {
      body: expect.objectContaining({
        mode: "wmchat_post_capture_v1",
        lead_id: LEAD_ID,
        session_id: SESSION_ID,
        submission_id: SUBMISSION_ID,
      }),
      timeout: 15_000,
    });
    expect(fromMock).not.toHaveBeenCalled();
  });

  it.each([
    { success: true, lead_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", session_id: SESSION_ID },
    { success: true, lead_id: LEAD_ID, session_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
    { success: true, lead_id: "bad", session_id: SESSION_ID },
    { success: false, lead_id: LEAD_ID, session_id: SESSION_ID },
    null,
  ])("fails safely for a malformed or mismatched success response", async (data) => {
    invokeMock.mockResolvedValue({ data, error: null });
    await expect(submitWmChatPostCapture(gamePlanInput())).resolves.toEqual({
      ok: false,
      message: SAFE_FAILURE_MESSAGE,
    });
  });

  it("coalesces the same in-flight submission and fingerprint", async () => {
    let resolveInvoke!: (value: ReturnType<typeof successfulInvoke>) => void;
    invokeMock.mockReturnValue(
      new Promise<ReturnType<typeof successfulInvoke>>((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const first = submitWmChatPostCapture(gamePlanInput());
    const second = submitWmChatPostCapture(gamePlanInput());
    expect(invokeMock).toHaveBeenCalledTimes(1);

    resolveInvoke(successfulInvoke());
    await expect(Promise.all([first, second])).resolves.toEqual([
      { ok: true, leadId: LEAD_ID, sessionId: SESSION_ID },
      { ok: true, leadId: LEAD_ID, sessionId: SESSION_ID },
    ]);
  });

  it("fails a conflicting in-flight payload with the same submission identity", async () => {
    let resolveInvoke!: (value: ReturnType<typeof successfulInvoke>) => void;
    invokeMock.mockReturnValue(
      new Promise<ReturnType<typeof successfulInvoke>>((resolve) => {
        resolveInvoke = resolve;
      }),
    );

    const first = submitWmChatPostCapture(gamePlanInput());
    const conflict = await submitWmChatPostCapture(
      gamePlanInput({
        action: "schedule_windowman_conversation",
        conversationTimePreference: "asap",
      }),
    );
    expect(conflict).toEqual({ ok: false, message: CONFLICT_MESSAGE });
    expect(invokeMock).toHaveBeenCalledTimes(1);

    resolveInvoke(successfulInvoke());
    await expect(first).resolves.toEqual({
      ok: true,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
  });

  it("maps a typed server conflict without exposing raw upstream text", async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: {
        context: {
          json: vi.fn().mockResolvedValue({
            code: "wmchat_post_capture_conflict",
            message: "sensitive database detail",
          }),
        },
      },
    });

    const result = await submitWmChatPostCapture(gamePlanInput());
    expect(result).toEqual({ ok: false, message: CONFLICT_MESSAGE });
    expect(JSON.stringify(result)).not.toContain("sensitive database detail");
  });

  it("fails safely for unreadable HTTP errors, unknown response codes, and throws", async () => {
    invokeMock.mockResolvedValueOnce({
      data: null,
      error: { context: { json: vi.fn().mockRejectedValue(new Error("raw")) } },
    });
    await expect(submitWmChatPostCapture(gamePlanInput())).resolves.toEqual({
      ok: false,
      message: SAFE_FAILURE_MESSAGE,
    });

    invokeMock.mockResolvedValueOnce({
      data: { success: false, code: "unknown_private_code" },
      error: null,
    });
    await expect(submitWmChatPostCapture(gamePlanInput())).resolves.toEqual({
      ok: false,
      message: SAFE_FAILURE_MESSAGE,
    });

    invokeMock.mockRejectedValueOnce(new Error("offline"));
    await expect(submitWmChatPostCapture(gamePlanInput())).resolves.toEqual({
      ok: false,
      message: SAFE_FAILURE_MESSAGE,
    });
  });

  it("enforces the installed client's 15-second timeout without auto-retry or timer leakage", async () => {
    vi.useFakeTimers();
    try {
      const hangingFetch = vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (!signal) {
              reject(new Error("The Functions client did not provide an AbortSignal."));
              return;
            }
            signal.addEventListener(
              "abort",
              () => reject(new DOMException("Aborted", "AbortError")),
              { once: true },
            );
          }),
      );
      const client = testFunctionsClient(hangingFetch);
      invokeMock
        .mockImplementationOnce(invokeWith(client))
        .mockResolvedValueOnce(successfulInvoke());

      const input = gamePlanInput();
      const timeoutResult = submitWmChatPostCapture(input);
      const settled = vi.fn();
      void timeoutResult.then(settled);

      await vi.advanceTimersByTimeAsync(14_999);
      expect(settled).not.toHaveBeenCalled();
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(hangingFetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1);
      await expect(timeoutResult).resolves.toEqual({
        ok: false,
        message: SAFE_FAILURE_MESSAGE,
      });
      expect(invokeMock).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);

      await vi.advanceTimersByTimeAsync(1_000);
      expect(invokeMock).toHaveBeenCalledTimes(1);

      await expect(submitWmChatPostCapture(input)).resolves.toEqual({
        ok: true,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
      });
      expect(invokeMock).toHaveBeenCalledTimes(2);
      expect(invokeMock).toHaveBeenNthCalledWith(
        1,
        "capture-truth-gate-lead",
        expect.objectContaining({ timeout: 15_000 }),
      );
      expect(invokeMock).toHaveBeenNthCalledWith(
        2,
        "capture-truth-gate-lead",
        expect.objectContaining({ timeout: 15_000 }),
      );
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it.each([
    [
      "success",
      new Response(JSON.stringify(successfulInvoke().data), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      }),
      {
        ok: true,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
      },
    ],
    [
      "HTTP error",
      new Response(JSON.stringify({ code: "private_upstream_failure" }), {
        headers: { "Content-Type": "application/json" },
        status: 503,
      }),
      { ok: false, message: SAFE_FAILURE_MESSAGE },
    ],
  ])(
    "clears the installed client's timeout after an immediate %s response",
    async (_label, response, expected) => {
      vi.useFakeTimers();
      try {
        const customFetch = vi.fn().mockResolvedValue(response);
        const client = testFunctionsClient(customFetch);
        invokeMock.mockImplementationOnce(invokeWith(client));

        await expect(
          submitWmChatPostCapture(gamePlanInput()),
        ).resolves.toEqual(expected);
        expect(customFetch).toHaveBeenCalledTimes(1);
        expect(vi.getTimerCount()).toBe(0);
      } finally {
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    },
  );
});
