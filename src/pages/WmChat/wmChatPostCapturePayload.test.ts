import { describe, expect, it } from "vitest";

import { createWmChatInitialState } from "./wmChatReducer";
import {
  buildWmChatPostCaptureDraft,
  buildWmChatPostCaptureSubmission,
  fingerprintWmChatPostCaptureDraft,
} from "./wmChatPostCapturePayload";
import type { WmChatState } from "./wmChatTypes";

const LEAD_ID = "d6d9a0b5-12ad-4b95-9493-72a3ba98ad2f";
const SESSION_ID = "86080f63-66ff-4756-bc21-81fbd497761c";
const SUBMISSION_ID = "b4fc75ef-f7a7-4c30-bc4c-e0fdd9ba0f8f";

function capturedState(overrides: Partial<WmChatState> = {}): WmChatState {
  return {
    ...createWmChatInitialState(),
    currentNodeId: "success",
    status: "success",
    leadId: LEAD_ID,
    sessionId: SESSION_ID,
    postCaptureNodeId: "review",
    postCaptureAction: "quote_request_game_plan",
    propertyAddressDecision: "skip",
    ...overrides,
  };
}

describe("wmChatPostCapturePayload", () => {
  it("builds a game-plan request with an intentionally skipped address", () => {
    expect(buildWmChatPostCaptureDraft(capturedState())).toEqual({
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      action: "quote_request_game_plan",
      propertyAddress: null,
      conversationTimePreference: null,
      quoteReadiness: null,
      callbackPreference: null,
    });
  });

  it("normalizes a complete optional address", () => {
    const draft = buildWmChatPostCaptureDraft(
      capturedState({
        propertyAddressDecision: "add",
        propertyAddressDraft: {
          line1: " 123 Palm Avenue ",
          line2: " Unit 4 ",
          city: " Boca Raton ",
          region: " fl ",
          postalCode: " 33431 ",
        },
      }),
    );

    expect(draft?.propertyAddress).toEqual({
      line1: "123 Palm Avenue",
      line2: "Unit 4",
      city: "Boca Raton",
      region: "FL",
      postalCode: "33431",
    });
  });

  it("rejects incomplete address and missing scheduling choices", () => {
    expect(
      buildWmChatPostCaptureDraft(
        capturedState({
          propertyAddressDecision: "add",
          propertyAddressDraft: {
            line1: "1",
            line2: "",
            city: "",
            region: "FL",
            postalCode: "3343",
          },
        }),
      ),
    ).toBeNull();

    expect(
      buildWmChatPostCaptureDraft(
        capturedState({
          postCaptureAction: "schedule_windowman_conversation",
          conversationTimePreference: null,
        }),
      ),
    ).toBeNull();
  });

  it("requires the not-yet quote path and a callback preference", () => {
    expect(
      buildWmChatPostCaptureDraft(
        capturedState({
          postCaptureAction: "review_quote_when_ready",
          quoteReadiness: "not_yet",
          callbackPreference: null,
        }),
      ),
    ).toBeNull();

    const draft = buildWmChatPostCaptureDraft(
      capturedState({
        postCaptureAction: "review_quote_when_ready",
        quoteReadiness: "not_yet",
        callbackPreference: "next_week",
        propertyAddressDecision: "add",
        propertyAddressDraft: {
          line1: "123 Palm Avenue",
          line2: "",
          city: "Boca Raton",
          region: "FL",
          postalCode: "33431",
        },
      }),
    );

    expect(draft?.propertyAddress).toBeNull();
    expect(draft?.callbackPreference).toBe("next_week");
  });

  it("does not persist the ready-now scanner handoff as a continuation request", () => {
    expect(
      buildWmChatPostCaptureDraft(
        capturedState({
          postCaptureNodeId: "scanner_transition",
          postCaptureAction: "review_quote_when_ready",
          quoteReadiness: "ready_now",
        }),
      ),
    ).toBeNull();
  });

  it("requires the exact bound UUIDs and review node", () => {
    expect(buildWmChatPostCaptureDraft(capturedState({ leadId: "bad" }))).toBeNull();
    expect(
      buildWmChatPostCaptureDraft(capturedState({ postCaptureNodeId: "address" })),
    ).toBeNull();
    expect(
      buildWmChatPostCaptureSubmission(capturedState(), "not-a-uuid"),
    ).toBeNull();
  });

  it("adds a submission identity without changing the deterministic draft", () => {
    const state = capturedState();
    const draft = buildWmChatPostCaptureDraft(state)!;
    const submission = buildWmChatPostCaptureSubmission(state, SUBMISSION_ID);

    expect(submission).toEqual({ ...draft, submissionId: SUBMISSION_ID });
    expect(fingerprintWmChatPostCaptureDraft(draft)).toBe(
      fingerprintWmChatPostCaptureDraft(buildWmChatPostCaptureDraft(state)!),
    );
  });
});
