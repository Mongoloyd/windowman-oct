import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWmChatInitialState, wmChatReducer } from "./wmChatReducer";
import {
  WM_CHAT_RESUME_STORAGE_KEY,
  WM_CHAT_RESUME_TTL_MS,
  clearWmChatResume,
  createWmChatResumeSnapshot,
  loadWmChatResume,
  saveWmChatResume,
} from "./wmChatResume";
import type {
  WmChatNodeId,
  WmChatOptionId,
  WmChatState,
} from "./wmChatTypes";

const NOW_MS = Date.UTC(2026, 7, 15, 12, 0, 0);

function select(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionId: WmChatOptionId,
): WmChatState {
  return wmChatReducer(state, { type: "select_single", nodeId, optionId });
}

function progressToPriorities(): WmChatState {
  let state = createWmChatInitialState();
  state = select(state, "entry", "entry_need_quote");
  state = select(state, "need_reason", "need_moved");
  state = select(state, "need_detail_moved", "moved_baseline");
  return state;
}

function progressToZip(): WmChatState {
  let state = progressToPriorities();
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_price_baseline", "priority_low_pressure"],
  });
  state = select(state, "stakes", "stakes_later_cost");
  state = select(state, "trust", "trust_pressure");
  state = select(state, "recap", "recap_confirm");
  return state;
}

function progressToFullRecap(): WmChatState {
  let state = progressToPriorities();
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_price_baseline", "priority_low_pressure"],
  });
  state = select(state, "stakes", "stakes_later_cost");
  return select(state, "trust", "trust_pressure");
}

function progressToOtherFullRecap(): WmChatState {
  let state = createWmChatInitialState();
  state = select(state, "entry", "entry_need_quote");
  state = select(state, "need_reason", "need_other");
  state = select(state, "need_detail_other", "other_explain");
  state = wmChatReducer(state, {
    type: "continue_other",
    nodeId: "need_other_text",
    value: "The sliding door is my main concern.",
  });
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_complete_scope"],
  });
  state = select(state, "stakes", "stakes_disruption");
  return select(state, "trust", "trust_vague_scope");
}

function validStoredRecord() {
  const state = progressToPriorities();
  return createWmChatResumeSnapshot(state, NOW_MS)!;
}

function progressToProtectionKitEmail(): WmChatState {
  let state = createWmChatInitialState();
  state = select(state, "entry", "entry_learn_powers");
  state = select(state, "power_1", "power_next_2");
  state = select(state, "power_2", "power_next_3");
  state = select(state, "power_3", "power_next_4");
  state = select(state, "power_4", "power_next_5");
  state = select(state, "power_5", "power_not_ready");
  return select(state, "not_ready", "not_ready_protection_kit");
}

describe("wmChatResume", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("stores only versioned stable IDs and safe reducer position", () => {
    const thinkingState = wmChatReducer(progressToPriorities(), {
      type: "thinking_started",
    });
    const snapshot = saveWmChatResume(
      thinkingState,
      localStorage,
      NOW_MS,
    );

    expect(snapshot).toEqual({
      schemaVersion: 1,
      savedAtMs: NOW_MS,
      entryIntent: "need_quote",
      currentNodeId: "priorities",
      history: [
        { nodeId: "entry", optionIds: ["entry_need_quote"] },
        { nodeId: "need_reason", optionIds: ["need_moved"] },
        {
          nodeId: "need_detail_moved",
          optionIds: ["moved_baseline"],
        },
      ],
    });

    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;
    expect(Object.keys(JSON.parse(raw))).toEqual([
      "schemaVersion",
      "savedAtMs",
      "entryIntent",
      "currentNodeId",
      "history",
    ]);
    expect(raw).not.toContain("answers");
    expect(raw).not.toContain("contact");
    expect(raw).not.toContain("transcript");
    expect(raw).not.toContain("prompt");
    expect(raw).not.toContain("isThinking");
  });

  it("rewinds to ZIP and drops ZIP plus all later answers", () => {
    let state = progressToZip();
    state = wmChatReducer(state, {
      type: "continue_contact",
      nodeId: "zip",
      value: "33301",
    });
    state = select(state, "project_scope", "scope_both");
    state = select(state, "openings", "openings_6_10");

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("zip");
    expect(snapshot.history.at(-1)).toEqual({
      nodeId: "recap",
      optionIds: ["recap_confirm"],
    });
    expect(raw).not.toContain("33301");
    expect(raw).not.toContain("scope_both");
    expect(raw).not.toContain("openings_6_10");
  });

  it("rewinds to guided Other without retaining the sentence", () => {
    let state = createWmChatInitialState();
    state = select(state, "entry", "entry_need_quote");
    state = select(state, "need_reason", "need_other");
    state = select(state, "need_detail_other", "other_explain");
    state = wmChatReducer(state, {
      type: "continue_other",
      nodeId: "need_other_text",
      value: "My condo board asked me to research this.",
    });
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_complete_scope"],
    });

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("need_other_text");
    expect(snapshot.history.at(-1)).toEqual({
      nodeId: "need_detail_other",
      optionIds: ["other_explain"],
    });
    expect(raw).not.toContain("condo board");
    expect(raw).not.toContain("priority_complete_scope");
  });

  it("rewinds to optional name and never stores name or mobile", () => {
    let state = createWmChatInitialState();
    state = select(state, "entry", "entry_have_quote");
    state = select(state, "have_concern", "have_price");
    state = select(state, "have_detail_price", "price_total");
    state = wmChatReducer(state, {
      type: "continue_contact",
      nodeId: "first_name",
      value: "Maria",
    });
    state = wmChatReducer(state, {
      type: "update_phone",
      value: "(561) 555-0123",
    });

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("first_name");
    expect(raw).not.toContain("Maria");
    expect(raw).not.toContain("561");
    expect(raw).not.toContain("555");
  });

  it("can resume at mobile when Upload first reaches it without prior PII", () => {
    let state = createWmChatInitialState();
    state = select(state, "entry", "entry_have_quote");
    state = select(state, "have_concern", "have_upload_first");
    state = wmChatReducer(state, {
      type: "update_phone",
      value: "5615550199",
    });

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    expect(snapshot.currentNodeId).toBe("phone");
    expect(JSON.stringify(snapshot)).not.toContain("5615550199");

    const loaded = loadWmChatResume(localStorage, NOW_MS);
    expect(loaded).toEqual(snapshot);

    const restored = wmChatReducer(createWmChatInitialState(), {
      type: "restore",
      snapshot: loaded!,
    });
    expect(restored.currentNodeId).toBe("phone");
    expect(restored.contact).toEqual({ zip: "", firstName: "", phone: "" });
    expect(restored.transcript.join(" ")).not.toContain("5615550199");
  });

  it("resumes at the Protection Kit email boundary without storing email or identity", () => {
    const state = {
      ...progressToProtectionKitEmail(),
      leadId: "lead-must-not-persist",
      sessionId: "session-must-not-persist",
    };
    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("protection_kit_email");
    expect(snapshot.history.at(-1)).toEqual({
      nodeId: "not_ready",
      optionIds: ["not_ready_protection_kit"],
    });
    expect(raw).not.toContain("maria@example.com");
    expect(raw).not.toContain("contact");
    expect(raw).not.toContain("lead-must-not-persist");
    expect(raw).not.toContain("session-must-not-persist");

    const restored = wmChatReducer(createWmChatInitialState(), {
      type: "restore",
      snapshot: loadWmChatResume(localStorage, NOW_MS)!,
    });
    expect(restored.currentNodeId).toBe("protection_kit_email");
    expect(restored.captureMode).toBe("protection_kit");
  });

  it("stores the last coherent recap while a correction is unfinished", () => {
    const coherentRecap = progressToFullRecap();
    let state = select(coherentRecap, "recap", "recap_edit");
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_comfort");

    expect(state.currentNodeId).toBe("need_detail_comfort");
    expect(state.answers.need_reason).toBe("need_comfort");
    expect(state.recapEdit?.target).toBe("need_reason");

    const snapshot = saveWmChatResume(
      {
        ...state,
        contact: {
          zip: "33301",
          firstName: "Maria",
          phone: "+15615550123",
        },
        leadId: "lead-identity-must-not-persist",
        sessionId: "session-identity-must-not-persist",
      },
      localStorage,
      NOW_MS,
    )!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("recap");
    expect(snapshot.history).toEqual(coherentRecap.history);
    expect(raw).not.toContain("need_comfort");
    expect(raw).not.toContain("recap_edit");
    expect(raw).not.toContain("recapEdit");
    expect(raw).not.toContain("transcript");
    expect(raw).not.toContain("answers");
    expect(raw).not.toContain("33301");
    expect(raw).not.toContain("Maria");
    expect(raw).not.toContain("5615550123");
    expect(raw).not.toContain("lead-identity");
    expect(raw).not.toContain("session-identity");

    const restored = wmChatReducer(createWmChatInitialState(), {
      type: "restore",
      snapshot: loadWmChatResume(localStorage, NOW_MS)!,
    });
    expect(restored.currentNodeId).toBe("recap");
    expect(restored.answers.need_reason).toBe("need_moved");
    expect(restored.recapEdit).toBeNull();
  });

  it("stores only the corrected canonical history after an atomic commit", () => {
    let state = select(progressToFullRecap(), "recap", "recap_edit");
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_comfort");
    state = select(state, "need_detail_comfort", "comfort_hot_rooms");

    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot.currentNodeId).toBe("recap");
    expect(snapshot.history).toContainEqual({
      nodeId: "need_reason",
      optionIds: ["need_comfort"],
    });
    expect(snapshot.history).toContainEqual({
      nodeId: "need_detail_comfort",
      optionIds: ["comfort_hot_rooms"],
    });
    expect(raw).not.toContain("need_moved");
    expect(raw).not.toContain("moved_baseline");
    expect(raw).not.toContain("recap_edit");
    expect(raw).not.toContain("recapEdit");
    expect(raw).not.toContain("transcript");
    expect(raw).not.toContain("otherText");
    expect(raw).not.toContain("zip");
    expect(raw).not.toContain("firstName");
    expect(raw).not.toContain("phone");
    expect(raw).not.toContain("leadId");
    expect(raw).not.toContain("sessionId");

    const restored = wmChatReducer(createWmChatInitialState(), {
      type: "restore",
      snapshot: loadWmChatResume(localStorage, NOW_MS)!,
    });
    expect(restored.currentNodeId).toBe("recap");
    expect(restored.answers.need_reason).toBe("need_comfort");
    expect(restored.answers.need_detail).toBe("comfort_hot_rooms");
  });

  it("keeps guided Other private while saving an unfinished correction", () => {
    let state = select(progressToOtherFullRecap(), "recap", "recap_edit");
    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_other", "other_explain");

    expect(state.currentNodeId).toBe("need_other_text");
    expect(state.recapEdit?.baseOtherText).toBe(
      "The sliding door is my main concern.",
    );

    const snapshot = saveWmChatResume(state, localStorage, NOW_MS)!;
    const raw = localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)!;

    expect(snapshot).not.toBeNull();
    expect(snapshot.currentNodeId).toBe("need_other_text");
    expect(snapshot.history.at(-1)).toEqual({
      nodeId: "need_detail_other",
      optionIds: ["other_explain"],
    });
    expect(raw).not.toContain("sliding door");
    expect(raw).not.toContain("recap_edit");
    expect(raw).not.toContain("recapEdit");
    expect(raw).not.toContain("otherText");
    expect(raw).not.toContain("transcript");
    expect(raw).not.toContain("phone");

    const restored = wmChatReducer(createWmChatInitialState(), {
      type: "restore",
      snapshot: loadWmChatResume(localStorage, NOW_MS)!,
    });
    expect(restored.currentNodeId).toBe("need_other_text");
    expect(restored.otherText).toBe("");
    expect(restored.recapEdit).toBeNull();
  });

  it("expires and clears the record after 24 hours", () => {
    localStorage.setItem(
      WM_CHAT_RESUME_STORAGE_KEY,
      JSON.stringify({
        ...validStoredRecord(),
        savedAtMs: NOW_MS - WM_CHAT_RESUME_TTL_MS - 1,
      }),
    );

    expect(loadWmChatResume(localStorage, NOW_MS)).toBeNull();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).toBeNull();
  });

  it("accepts a record at the exact 24-hour boundary", () => {
    const record = {
      ...validStoredRecord(),
      savedAtMs: NOW_MS - WM_CHAT_RESUME_TTL_MS,
    };
    localStorage.setItem(WM_CHAT_RESUME_STORAGE_KEY, JSON.stringify(record));

    expect(loadWmChatResume(localStorage, NOW_MS)).toEqual(record);
  });

  it.each([
    ["malformed JSON", "{not-json"],
    [
      "unknown version",
      JSON.stringify({ ...validStoredRecord(), schemaVersion: 2 }),
    ],
    [
      "future timestamp",
      JSON.stringify({ ...validStoredRecord(), savedAtMs: NOW_MS + 1 }),
    ],
    [
      "unknown node",
      JSON.stringify({ ...validStoredRecord(), currentNodeId: "mystery" }),
    ],
    [
      "unknown option",
      JSON.stringify({
        ...validStoredRecord(),
        history: [{ nodeId: "entry", optionIds: ["mystery"] }],
      }),
    ],
    [
      "option invalid for its node",
      JSON.stringify({
        ...validStoredRecord(),
        currentNodeId: "need_detail_moved",
        history: [{ nodeId: "entry", optionIds: ["need_moved"] }],
      }),
    ],
    [
      "mismatched reducer position",
      JSON.stringify({ ...validStoredRecord(), currentNodeId: "phone" }),
    ],
    [
      "extra PII-shaped field",
      JSON.stringify({ ...validStoredRecord(), phone: "+15615550123" }),
    ],
  ])("rejects and clears %s", (_label, raw) => {
    localStorage.setItem(WM_CHAT_RESUME_STORAGE_KEY, raw);

    expect(loadWmChatResume(localStorage, NOW_MS)).toBeNull();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).toBeNull();
  });

  it("does not create a resume prompt for pristine or completed state", () => {
    const initial = createWmChatInitialState();
    expect(saveWmChatResume(initial, localStorage, NOW_MS)).toBeNull();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).toBeNull();

    const completed: WmChatState = {
      ...progressToPriorities(),
      currentNodeId: "success",
      status: "success",
      leadId: "lead-id",
      sessionId: "session-id",
    };
    expect(saveWmChatResume(completed, localStorage, NOW_MS)).toBeNull();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).toBeNull();
  });

  it("never serializes durable identity or post-capture address drafts", () => {
    const postCapture: WmChatState = {
      ...progressToPriorities(),
      currentNodeId: "success",
      status: "active",
      leadId: "d6d9a0b5-12ad-4b95-9493-72a3ba98ad2f",
      sessionId: "86080f63-66ff-4756-bc21-81fbd497761c",
      postCaptureNodeId: "address",
      postCaptureAction: "quote_request_game_plan",
      propertyAddressDraft: {
        line1: "123 Palm Avenue",
        line2: "Unit 4",
        city: "Boca Raton",
        region: "FL",
        postalCode: "33431",
      },
    };

    expect(saveWmChatResume(postCapture, localStorage, NOW_MS)).toBeNull();
    expect(localStorage.getItem(WM_CHAT_RESUME_STORAGE_KEY)).toBeNull();
  });

  it("fails quietly when storage is unavailable", () => {
    const blockedStorage = {
      getItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      setItem: vi.fn(() => {
        throw new Error("blocked");
      }),
      removeItem: vi.fn(() => {
        throw new Error("blocked");
      }),
    };

    expect(() =>
      saveWmChatResume(progressToPriorities(), blockedStorage, NOW_MS),
    ).not.toThrow();
    expect(loadWmChatResume(blockedStorage, NOW_MS)).toBeNull();
    expect(() => clearWmChatResume(blockedStorage)).not.toThrow();
  });
});
