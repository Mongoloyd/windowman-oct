import { describe, expect, it } from "vitest";

import {
  buildWmChatIntake,
  createWmChatInitialState,
  wmChatReducer,
} from "./wmChatReducer";
import { resolveWmChatNode } from "./wmChatContent";
import type {
  WmChatAction,
  WmChatNodeId,
  WmChatOptionId,
  WmChatState,
} from "./wmChatTypes";

const LEAD_ID = "d6d9a0b5-12ad-4b95-9493-72a3ba98ad2f";
const SESSION_ID = "86080f63-66ff-4756-bc21-81fbd497761c";
const CONTINUATION_ID = "b4fc75ef-f7a7-4c30-bc4c-e0fdd9ba0f8f";

function select(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionId: WmChatOptionId,
): WmChatState {
  return wmChatReducer(state, { type: "select_single", nodeId, optionId });
}

function startNeedQuote(): WmChatState {
  return select(
    createWmChatInitialState(),
    "entry",
    "entry_need_quote",
  );
}

function reachPriorities(): WmChatState {
  let state = startNeedQuote();
  state = select(state, "need_reason", "need_moved");
  return select(state, "need_detail_moved", "moved_baseline");
}

function reachPhone(): WmChatState {
  let state = reachPriorities();
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_price_baseline"],
  });
  state = select(state, "stakes", "stakes_later_cost");
  state = select(state, "trust", "trust_pressure");
  state = select(state, "recap", "recap_confirm");
  state = wmChatReducer(state, {
    type: "continue_contact",
    nodeId: "zip",
    value: "33301",
  });
  state = select(state, "project_scope", "scope_windows");
  state = select(state, "openings", "openings_6_10");
  state = select(state, "budget", "budget_baseline");
  state = select(state, "timing", "timing_1_3_months");
  return wmChatReducer(state, { type: "skip_name" });
}

function captureNeedQuote(): WmChatState {
  let state = reachPhone();
  state = wmChatReducer(state, {
    type: "update_phone",
    value: "(561) 555-0123",
  });
  state = wmChatReducer(state, { type: "capture_started" });
  return wmChatReducer(state, {
    type: "capture_succeeded",
    leadId: LEAD_ID,
    sessionId: SESSION_ID,
  });
}

function reachFullRecap(): WmChatState {
  let state = reachPriorities();
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_price_baseline", "priority_low_pressure"],
  });
  state = select(state, "stakes", "stakes_later_cost");
  return select(state, "trust", "trust_pressure");
}

function reachShortRecap(): WmChatState {
  let state = startNeedQuote();
  state = select(state, "need_reason", "need_planning");
  state = select(state, "need_detail_planning", "planning_where_start");
  state = wmChatReducer(state, {
    type: "continue_multi",
    nodeId: "priorities",
    optionIds: ["priority_not_sure"],
  });
  expect(state.currentNodeId).toBe("trust");
  return select(state, "trust", "trust_not_sure");
}

function reachOtherFullRecap(): WmChatState {
  let state = startNeedQuote();
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

function openRecapEditor(state: WmChatState): WmChatState {
  return select(state, "recap", "recap_edit");
}

function reachNotReady(): WmChatState {
  let state = select(
    createWmChatInitialState(),
    "entry",
    "entry_learn_powers",
  );
  state = select(state, "power_1", "power_next_2");
  state = select(state, "power_2", "power_next_3");
  state = select(state, "power_3", "power_next_4");
  state = select(state, "power_4", "power_next_5");
  state = select(state, "power_5", "power_not_ready");
  return state;
}

describe("wmChatReducer opening routes", () => {
  it("keeps thinking state transient and blocks Back until the pause finishes", () => {
    const progressed = startNeedQuote();
    const thinking = wmChatReducer(progressed, { type: "thinking_started" });

    expect(thinking.isThinking).toBe(true);
    expect(wmChatReducer(thinking, { type: "thinking_started" })).toBe(thinking);
    expect(wmChatReducer(thinking, { type: "back" })).toBe(thinking);

    const finished = wmChatReducer(thinking, { type: "thinking_finished" });
    expect(finished.isThinking).toBe(false);
    expect(wmChatReducer(finished, { type: "back" }).currentNodeId).toBe("entry");
    expect(wmChatReducer(thinking, { type: "restart" }).isThinking).toBe(false);
  });

  it.each([
    ["entry_have_quote", "have_quote", "have_concern", "quote_upload"],
    ["entry_need_quote", "need_quote", "need_reason", "lead"],
    ["entry_learn_powers", "learn_powers", "power_1", "lead"],
  ] as const)(
    "routes %s into its deterministic branch",
    (optionId, entryIntent, nextNodeId, captureMode) => {
      const state = select(createWmChatInitialState(), "entry", optionId);

      expect(state.entryIntent).toBe(entryIntent);
      expect(state.currentNodeId).toBe(nextNodeId);
      expect(state.captureMode).toBe(captureMode);
      expect(state.answers.entry_intent).toBe(entryIntent);
    },
  );

  it.each([
    ["need_moved", "need_detail_moved"],
    ["need_problems", "need_detail_problems"],
    ["need_storm", "need_detail_storm"],
    ["need_remodel", "need_detail_remodel"],
    ["need_comfort", "need_detail_comfort"],
    ["need_planning", "need_detail_planning"],
  ] as const)("routes the %s family to %s", (optionId, nextNodeId) => {
    const state = select(startNeedQuote(), "need_reason", optionId);

    expect(state.currentNodeId).toBe(nextNodeId);
    expect(state.answers.need_reason).toBe(optionId);
  });
});

describe("wmChatReducer quote-holder and powers paths", () => {
  it.each([
    ["have_price", "have_detail_price", "price_total"],
    ["have_scope", "have_detail_scope", "scope_included"],
    ["have_product_company", "have_detail_product", "product_brand_model"],
    ["have_compare", "have_detail_compare", "compare_price"],
    ["have_check", "have_detail_check", "check_price"],
    ["have_other", "have_detail_other", "have_other_missing"],
  ] as const)(
    "routes %s through its diagnosis and into optional name capture",
    (concernId, detailNodeId, detailId) => {
      let state = select(
        createWmChatInitialState(),
        "entry",
        "entry_have_quote",
      );
      state = select(state, "have_concern", concernId);
      expect(state.currentNodeId).toBe(detailNodeId);

      state = select(state, detailNodeId, detailId);
      expect(state.currentNodeId).toBe("first_name");
      expect(state.captureMode).toBe("quote_upload");
    },
  );

  it("keeps Upload first contact-owned while skipping diagnosis and name", () => {
    let state = select(
      createWmChatInitialState(),
      "entry",
      "entry_have_quote",
    );
    state = select(state, "have_concern", "have_upload_first");

    expect(state.currentNodeId).toBe("phone");
    expect(state.captureMode).toBe("quote_upload");
    expect(state.answers.have_concern).toBe("have_upload_first");
  });

  it("reveals all five powers, then rejoins the quote-holder path", () => {
    let state = select(
      createWmChatInitialState(),
      "entry",
      "entry_learn_powers",
    );
    state = select(state, "power_1", "power_next_2");
    state = select(state, "power_2", "power_next_3");
    state = select(state, "power_3", "power_next_4");
    state = select(state, "power_4", "power_next_5");
    state = select(state, "power_5", "power_put_to_work");

    expect(state.currentNodeId).toBe("power_route");

    state = select(state, "power_route", "power_route_have_quote");
    expect(state.currentNodeId).toBe("have_concern");
    expect(state.entryIntent).toBe("learn_powers");
    expect(state.captureMode).toBe("quote_upload");
    expect(state.answers.power_route).toBe("power_route_have_quote");
  });

  it("keeps education primary and defers the conversion CTA until power five", () => {
    const sequence = [
      ["power_1", "power_next_2", "Show me what quotes leave out"],
      ["power_2", "power_next_3", "Show me how real comparisons work"],
      ["power_3", "power_next_4", "Show me how my contact stays private"],
      ["power_4", "power_next_5", "Show me how you track follow-through"],
    ] as const;
    let state = select(
      createWmChatInitialState(),
      "entry",
      "entry_learn_powers",
    );

    for (const [nodeId, optionId, label] of sequence) {
      const node = resolveWmChatNode(state);
      expect(node.id).toBe(nodeId);
      expect(node.options).toEqual([
        expect.objectContaining({ id: optionId, label, tone: "primary" }),
      ]);
      expect(node.options?.some((option) => option.id === "power_put_to_work")).toBe(false);
      state = select(state, nodeId, optionId);
    }

    const terminalPower = resolveWmChatNode(state);
    expect(terminalPower.id).toBe("power_5");
    expect(terminalPower.options?.map((option) => option.id)).toEqual([
      "power_put_to_work",
      "power_not_ready",
    ]);
    expect(terminalPower.options?.[0]).toEqual(
      expect.objectContaining({
        id: "power_put_to_work",
        label: "Put WindowMan to work",
        tone: "primary",
      }),
    );
  });

  it("lets Not ready exit without losing its original intent", () => {
    const state = reachNotReady();

    expect(state.currentNodeId).toBe("not_ready");
    expect(state.status).toBe("not_ready");
    expect(state.entryIntent).toBe("learn_powers");
  });

  it("offers the Protection Kit and Instant Demo as two terminal hesitation paths", () => {
    const notReady = reachNotReady();
    expect(resolveWmChatNode(notReady).options?.map((option) => option.id)).toEqual([
      "not_ready_demo",
      "not_ready_protection_kit",
    ]);

    const email = select(
      notReady,
      "not_ready",
      "not_ready_protection_kit",
    );
    expect(email.currentNodeId).toBe("protection_kit_email");
    expect(email.captureMode).toBe("protection_kit");
    expect(email.answers.hesitation_action).toBe(
      "not_ready_protection_kit",
    );
    expect(buildWmChatIntake(email)).toEqual(
      expect.objectContaining({
        entry_intent: "learn_powers",
        continuation: "email_only",
        answer_path: expect.arrayContaining([
          "not_ready:not_ready_protection_kit",
        ]),
      }),
    );

    const demo = select(notReady, "not_ready", "not_ready_demo");
    expect(demo.currentNodeId).toBe("demo_launch");
    expect(demo.answers.hesitation_action).toBe("not_ready_demo");
    expect(buildWmChatIntake(demo)?.continuation).toBe("sms_then_voice");
  });

  it("gates Protection Kit success on the same real-ID capture boundary", () => {
    let state = select(
      reachNotReady(),
      "not_ready",
      "not_ready_protection_kit",
    );
    state = wmChatReducer(state, { type: "capture_started" });
    expect(state.status).toBe("submitting");

    const rejected = wmChatReducer(state, {
      type: "capture_succeeded",
      leadId: "not-a-uuid",
      sessionId: SESSION_ID,
    });
    expect(rejected).toBe(state);

    const accepted = wmChatReducer(state, {
      type: "capture_succeeded",
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
    expect(accepted.status).toBe("success");
    expect(accepted.currentNodeId).toBe("success");
  });
});

describe("wmChatReducer answer constraints", () => {
  it("accepts up to two unique priorities and rejects larger or duplicate sets", () => {
    const state = reachPriorities();
    const accepted = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline", "priority_low_pressure"],
    });

    expect(accepted.currentNodeId).toBe("stakes");
    expect(accepted.answers.priorities).toEqual([
      "priority_price_baseline",
      "priority_low_pressure",
    ]);

    const tooMany = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: [
        "priority_price_baseline",
        "priority_low_pressure",
        "priority_followthrough",
      ],
    });
    const duplicate = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline", "priority_price_baseline"],
    });

    expect(tooMany).toBe(state);
    expect(duplicate).toBe(state);
  });

  it("treats unknown, unavailable, and stale selections as no-ops", () => {
    const state = createWmChatInitialState();
    const unknown = wmChatReducer(state, {
      type: "select_single",
      nodeId: "entry",
      optionId: "unknown_option" as WmChatOptionId,
    });
    const unavailable = select(state, "entry", "need_moved");
    const stale = select(state, "need_reason", "need_moved");
    const unknownNode = wmChatReducer(state, {
      type: "select_single",
      nodeId: "unknown_node" as WmChatNodeId,
      optionId: "entry_need_quote",
    });

    expect(unknown).toBe(state);
    expect(unavailable).toBe(state);
    expect(stale).toBe(state);
    expect(unknownNode).toBe(state);
  });

  it("bounds guided Other to one line and 160 normalized characters", () => {
    let state = startNeedQuote();
    state = select(state, "need_reason", "need_other");
    state = select(state, "need_detail_other", "other_explain");

    const withNewline = wmChatReducer(state, {
      type: "continue_other",
      nodeId: "need_other_text",
      value: "First line\nSecond line",
    });
    expect(withNewline).toBe(state);

    const bounded = wmChatReducer(state, {
      type: "continue_other",
      nodeId: "need_other_text",
      value: `  ${"x".repeat(200)}  `,
    });

    expect(bounded.currentNodeId).toBe("priorities");
    expect(bounded.otherText).toHaveLength(160);
    expect(bounded.otherText).toBe("x".repeat(160));
  });
});

describe("wmChatReducer correction and completion safety", () => {
  it("Back restores the prior question and prunes its later answer", () => {
    let state = reachPriorities();
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_complete_scope"],
    });
    state = select(state, "stakes", "stakes_wrong_product");

    expect(state.currentNodeId).toBe("trust");
    expect(state.answers.stakes).toBe("stakes_wrong_product");

    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("stakes");
    expect(state.answers.stakes).toBeUndefined();
    expect(state.answers.priorities).toBe("priority_complete_scope");
  });

  it("shows only recap fields that were actually collected", () => {
    const fullOptions = resolveWmChatNode(
      openRecapEditor(reachFullRecap()),
    ).options?.map((option) => option.id);
    const shortOptions = resolveWmChatNode(
      openRecapEditor(reachShortRecap()),
    ).options?.map((option) => option.id);

    expect(fullOptions).toEqual([
      "recap_edit_reason",
      "recap_edit_detail",
      "recap_edit_priorities",
      "recap_edit_stakes",
      "recap_edit_trust",
    ]);
    expect(shortOptions).toEqual([
      "recap_edit_reason",
      "recap_edit_detail",
      "recap_edit_priorities",
      "recap_edit_trust",
    ]);
  });

  it("preserves a valid detail when the reason root stays the same", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_moved");

    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.answers).toMatchObject({
      need_reason: "need_moved",
      need_detail: "moved_baseline",
      priorities: ["priority_price_baseline", "priority_low_pressure"],
      stakes: "stakes_later_cost",
      trust_concern: "trust_pressure",
    });
  });

  it("prunes the old detail and rebuilds a changed reason atomically", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_comfort");

    expect(state.currentNodeId).toBe("need_detail_comfort");
    expect(state.answers.need_detail).toBeUndefined();

    state = select(state, "need_detail_comfort", "comfort_hot_rooms");
    const intake = buildWmChatIntake(state);

    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.answers).toMatchObject({
      need_reason: "need_comfort",
      need_detail: "comfort_hot_rooms",
      priorities: ["priority_price_baseline", "priority_low_pressure"],
      stakes: "stakes_later_cost",
      trust_concern: "trust_pressure",
    });
    expect(intake?.answer_path).toContain("need_reason:need_comfort");
    expect(intake?.answer_path).toContain(
      "need_detail_comfort:comfort_hot_rooms",
    );
    expect(intake?.answer_path).not.toContain("need_reason:need_moved");
    expect(intake?.answer_path).not.toContain(
      "need_detail_moved:moved_baseline",
    );
    expect(
      intake?.answer_path.filter((item) => item === "need_reason:need_comfort"),
    ).toHaveLength(1);
    expect(
      intake?.answer_path.some((item) => item.includes("recap_edit")),
    ).toBe(false);
  });

  it("edits the detail without disturbing branch-independent answers", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_moved", "moved_inspection");

    expect(state.currentNodeId).toBe("recap");
    expect(state.answers).toMatchObject({
      need_reason: "need_moved",
      need_detail: "moved_inspection",
      priorities: ["priority_price_baseline", "priority_low_pressure"],
      stakes: "stakes_later_cost",
      trust_concern: "trust_pressure",
    });
  });

  it("edits priorities while preserving compatible stakes and trust", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_priorities");
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_complete_scope"],
    });

    expect(state.currentNodeId).toBe("recap");
    expect(state.answers.priorities).toBe("priority_complete_scope");
    expect(state.answers.stakes).toBe("stakes_later_cost");
    expect(state.answers.trust_concern).toBe("trust_pressure");
  });

  it("edits practical stakes without changing the other recap fields", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_stakes");
    state = select(state, "stakes", "stakes_delay");

    expect(state.currentNodeId).toBe("recap");
    expect(state.answers.stakes).toBe("stakes_delay");
    expect(state.answers.trust_concern).toBe("trust_pressure");
  });

  it("edits the trust concern without changing practical stakes", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_trust");
    state = select(state, "trust", "trust_financing_first");

    expect(state.currentNodeId).toBe("recap");
    expect(state.answers.stakes).toBe("stakes_later_cost");
    expect(state.answers.trust_concern).toBe("trust_financing_first");
  });

  it("drops stakes when a correction changes the conversation to a short path", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_storm");
    state = select(state, "need_detail_storm", "storm_not_sure");

    expect(state.currentNodeId).toBe("recap");
    expect(state.answers.stakes).toBeUndefined();
    expect(
      state.history.some((entry) => entry.nodeId === "stakes"),
    ).toBe(false);
    expect(
      resolveWmChatNode(openRecapEditor(state)).options?.map(
        (option) => option.id,
      ),
    ).not.toContain("recap_edit_stakes");
  });

  it("asks stakes once when a correction changes a short path to a full path", () => {
    let state = openRecapEditor(reachShortRecap());
    state = select(state, "recap_edit_menu", "recap_edit_priorities");
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline"],
    });

    expect(state.currentNodeId).toBe("stakes");
    expect(state.answers.stakes).toBeUndefined();
    expect(state.recapEdit).not.toBeNull();

    state = select(state, "stakes", "stakes_uncertainty");
    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.answers.stakes).toBe("stakes_uncertainty");
    expect(
      state.history.filter((entry) => entry.nodeId === "stakes"),
    ).toHaveLength(1);
  });

  it("supports guided Other during an atomic reason correction", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_other");
    state = select(state, "need_detail_other", "other_explain");
    state = wmChatReducer(state, {
      type: "continue_other",
      nodeId: "need_other_text",
      value: "A patio door started sticking this week.",
    });

    const intake = buildWmChatIntake(state);
    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.answers.need_reason).toBe("need_other");
    expect(state.answers.need_detail).toBe("other_explain");
    expect(state.otherText).toBe("A patio door started sticking this week.");
    expect(intake?.other_text).toBe(
      "A patio door started sticking this week.",
    );
  });

  it("clears guided Other text when the corrected root no longer uses it", () => {
    let state = openRecapEditor(reachOtherFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_moved");
    expect(state.otherText).toBe("");
    state = select(state, "need_detail_moved", "moved_baseline");

    expect(state.currentNodeId).toBe("recap");
    expect(state.otherText).toBe("");
    expect(buildWmChatIntake(state)?.other_text).toBeUndefined();
  });

  it("lets an existing guided Other sentence be replaced", () => {
    let state = openRecapEditor(reachOtherFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_other", "other_explain");

    expect(state.currentNodeId).toBe("need_other_text");
    expect(state.recapEdit?.target).toBe("need_detail");

    state = wmChatReducer(state, {
      type: "continue_other",
      nodeId: "need_other_text",
      value: "The French doors now leak during heavy rain.",
    });

    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.otherText).toBe(
      "The French doors now leak during heavy rain.",
    );
    expect(buildWmChatIntake(state)?.other_text).toBe(
      "The French doors now leak during heavy rain.",
    );
  });

  it("rejects unknown and currently unavailable recap targets", () => {
    const fullMenu = openRecapEditor(reachFullRecap());
    const unknown = select(
      fullMenu,
      "recap_edit_menu",
      "unknown_option" as WmChatOptionId,
    );
    const shortMenu = openRecapEditor(reachShortRecap());
    const unavailable = select(
      shortMenu,
      "recap_edit_menu",
      "recap_edit_stakes",
    );

    expect(unknown).toBe(fullMenu);
    expect(unavailable).toBe(shortMenu);
  });

  it("makes Back deterministic before and after an atomic correction", () => {
    const original = reachFullRecap();
    let state = openRecapEditor(original);
    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("recap");
    expect(state.recapEdit).toBeNull();
    expect(state.answers).toEqual(original.answers);

    state = openRecapEditor(original);
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_comfort");
    expect(state.currentNodeId).toBe("need_detail_comfort");
    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("recap_edit_menu");
    expect(state.recapEdit?.target).toBeNull();
    expect(state.answers).toEqual(original.answers);

    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_moved", "moved_inspection");
    expect(state.currentNodeId).toBe("recap");
    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("trust");
    expect(state.recapEdit).toBeNull();
    expect(state.answers.trust_concern).toBeUndefined();
    expect(state.answers.need_detail).toBe("moved_inspection");
  });

  it("discards guided-Other and auto-required-stakes drafts on Back", () => {
    const otherBase = reachOtherFullRecap();
    let state = openRecapEditor(otherBase);
    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_other", "other_explain");
    expect(state.currentNodeId).toBe("need_other_text");
    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("recap_edit_menu");
    expect(state.otherText).toBe("The sliding door is my main concern.");
    expect(state.answers).toEqual(otherBase.answers);

    const shortBase = reachShortRecap();
    state = openRecapEditor(shortBase);
    state = select(state, "recap_edit_menu", "recap_edit_priorities");
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline"],
    });
    expect(state.currentNodeId).toBe("stakes");
    state = wmChatReducer(state, { type: "back" });
    expect(state.currentNodeId).toBe("recap_edit_menu");
    expect(state.answers).toEqual(shortBase.answers);
    expect(state.answers.stakes).toBeUndefined();
  });

  it("preserves the Learn Powers prefix when rebuilding the corrected path", () => {
    let state = select(
      createWmChatInitialState(),
      "entry",
      "entry_learn_powers",
    );
    state = select(state, "power_1", "power_next_2");
    state = select(state, "power_2", "power_next_3");
    state = select(state, "power_3", "power_next_4");
    state = select(state, "power_4", "power_next_5");
    state = select(state, "power_5", "power_put_to_work");
    state = select(state, "power_route", "power_route_need_quote");
    state = select(state, "need_reason", "need_moved");
    state = select(state, "need_detail_moved", "moved_baseline");
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline"],
    });
    state = select(state, "stakes", "stakes_later_cost");
    state = select(state, "trust", "trust_pressure");

    state = openRecapEditor(state);
    state = select(state, "recap_edit_menu", "recap_edit_detail");
    state = select(state, "need_detail_moved", "moved_inspection");

    const intake = buildWmChatIntake(state);
    expect(state.entryIntent).toBe("learn_powers");
    expect(intake?.answer_path.slice(0, 7)).toEqual([
      "entry:entry_learn_powers",
      "power_1:power_next_2",
      "power_2:power_next_3",
      "power_3:power_next_4",
      "power_4:power_next_5",
      "power_5:power_put_to_work",
      "power_route:power_route_need_quote",
    ]);
    expect(intake?.answer_path).toContain(
      "need_detail_moved:moved_inspection",
    );
    expect(intake?.answer_path).not.toContain(
      "need_detail_moved:moved_baseline",
    );
  });

  it("keeps two sequential corrections canonical and free of stale IDs", () => {
    let state = openRecapEditor(reachFullRecap());
    state = select(state, "recap_edit_menu", "recap_edit_reason");
    state = select(state, "need_reason", "need_comfort");
    state = select(state, "need_detail_comfort", "comfort_hot_rooms");

    state = openRecapEditor(state);
    state = select(state, "recap_edit_menu", "recap_edit_trust");
    state = select(state, "trust", "trust_too_many_calls");

    expect(buildWmChatIntake(state)?.answer_path).toEqual([
      "entry:entry_need_quote",
      "need_reason:need_comfort",
      "need_detail_comfort:comfort_hot_rooms",
      "priorities:priority_price_baseline",
      "priorities:priority_low_pressure",
      "stakes:stakes_later_cost",
      "trust:trust_too_many_calls",
    ]);
  });

  it("does not build an intake from any unfinished edit state", () => {
    let state = openRecapEditor(reachFullRecap());
    expect(buildWmChatIntake(state)).toBeNull();

    state = select(state, "recap_edit_menu", "recap_edit_reason");
    expect(buildWmChatIntake(state)).toBeNull();

    state = select(state, "need_reason", "need_other");
    state = select(state, "need_detail_other", "other_explain");
    expect(state.currentNodeId).toBe("need_other_text");
    expect(buildWmChatIntake(state)).toBeNull();

    state = openRecapEditor(reachShortRecap());
    state = select(state, "recap_edit_menu", "recap_edit_priorities");
    state = wmChatReducer(state, {
      type: "continue_multi",
      nodeId: "priorities",
      optionIds: ["priority_price_baseline"],
    });
    expect(state.currentNodeId).toBe("stakes");
    expect(buildWmChatIntake(state)).toBeNull();
  });

  it("returns the identical state for an unknown runtime action", () => {
    const state = reachFullRecap();
    const result = wmChatReducer(
      state,
      { type: "stale_serialized_action" } as unknown as WmChatAction,
    );

    expect(result).toBe(state);
  });

  it("only accepts a UUID-backed completion after an active phone submit", () => {
    const initial = createWmChatInitialState();
    const forced = wmChatReducer(initial, {
      type: "capture_succeeded",
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
    expect(forced).toBe(initial);

    let state = reachPhone();
    const beforePhone = wmChatReducer(state, { type: "capture_started" });
    expect(beforePhone).toBe(state);

    state = wmChatReducer(state, {
      type: "update_phone",
      value: "(561) 468-5571",
    });
    const beforeSubmit = state;
    state = wmChatReducer(state, { type: "capture_started" });
    expect(state.status).toBe("submitting");

    const invalid = wmChatReducer(state, {
      type: "capture_succeeded",
      leadId: "not-a-real-id",
      sessionId: SESSION_ID,
    });
    expect(invalid).toBe(state);

    state = wmChatReducer(state, {
      type: "capture_succeeded",
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
    });
    expect(state.currentNodeId).toBe("success");
    expect(state.status).toBe("success");
    expect(state.leadId).toBe(LEAD_ID);
    expect(state.sessionId).toBe(SESSION_ID);

    const intake = buildWmChatIntake(beforeSubmit);
    expect(intake?.entry_intent).toBe("need_quote");
    expect(intake?.answers.zip).toBe("33301");
    expect(intake?.answers.phone).toBeUndefined();
    expect(intake?.answers.firstName).toBeUndefined();
  });

  it("keeps typed phone failures transient and clears them when the number changes", () => {
    let state = reachPhone();
    state = wmChatReducer(state, {
      type: "update_phone",
      value: "(561) 555-0123",
    });
    state = wmChatReducer(state, { type: "capture_started" });
    state = wmChatReducer(state, {
      type: "capture_failed",
      code: "invalid_phone",
      message: "Check that number.",
    });

    expect(state.status).toBe("error");
    expect(state.submitError).toBe("Check that number.");
    expect(state.submitErrorCode).toBe("invalid_phone");

    state = wmChatReducer(state, {
      type: "update_phone",
      value: "(561) 555-0199",
    });
    expect(state.status).toBe("active");
    expect(state.submitError).toBeNull();
    expect(state.submitErrorCode).toBeNull();
    expect(state.contact.phone).toBe("(561) 555-0199");
  });

  it("distinguishes a temporary Lookup outage from an invalid number", () => {
    let state = reachPhone();
    state = wmChatReducer(state, {
      type: "update_phone",
      value: "(561) 555-0123",
    });
    state = wmChatReducer(state, { type: "capture_started" });
    state = wmChatReducer(state, {
      type: "capture_failed",
      code: "lookup_unavailable",
      message: "Try again shortly.",
    });

    expect(state.status).toBe("error");
    expect(state.submitErrorCode).toBe("lookup_unavailable");
  });

  describe("post-capture continuation", () => {
    it("opens the additive choice tree only after a durable lead capture", () => {
      const state = captureNeedQuote();

      expect(state.currentNodeId).toBe("success");
      expect(state.status).toBe("success");
      expect(state.postCaptureNodeId).toBe("choice");
      expect(state.leadId).toBe(LEAD_ID);
      expect(state.sessionId).toBe(SESSION_ID);
      expect(state.past).toEqual([]);
    });

    it("keeps direct quote-upload capture on the existing handoff", () => {
      let state: WmChatState = {
        ...reachPhone(),
        captureMode: "quote_upload",
      };
      state = wmChatReducer(state, {
        type: "update_phone",
        value: "(561) 555-0123",
      });
      state = wmChatReducer(state, { type: "capture_started" });
      state = wmChatReducer(state, {
        type: "capture_succeeded",
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
      });

      expect(state.postCaptureNodeId).toBeNull();
      expect(state.captureMode).toBe("quote_upload");
    });

    it("routes the game-plan fast lane through optional address and review", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "quote_request_game_plan",
      });
      expect(state.postCaptureNodeId).toBe("address");

      state = wmChatReducer(state, { type: "skip_property_address" });
      expect(state.postCaptureNodeId).toBe("review");
      expect(state.propertyAddressDecision).toBe("skip");

      state = wmChatReducer(state, { type: "post_capture_back" });
      expect(state.postCaptureNodeId).toBe("address");
      state = wmChatReducer(state, { type: "post_capture_back" });
      expect(state.postCaptureNodeId).toBe("choice");
      expect(state.currentNodeId).toBe("success");
      expect(state.leadId).toBe(LEAD_ID);
    });

    it("routes a conversation request through time preference before address", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "schedule_windowman_conversation",
      });
      expect(state.postCaptureNodeId).toBe("conversation_time");

      state = wmChatReducer(state, {
        type: "select_conversation_time",
        value: "weekday_afternoon",
      });
      expect(state.postCaptureNodeId).toBe("address");
      expect(state.conversationTimePreference).toBe("weekday_afternoon");
    });

    it("opens the scanner directly for a ready quote without an address node", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "review_quote_when_ready",
      });
      expect(state.postCaptureNodeId).toBe("quote_readiness");

      state = wmChatReducer(state, {
        type: "select_quote_readiness",
        value: "ready_now",
      });
      expect(state.postCaptureNodeId).toBe("scanner_transition");
      expect(state.propertyAddressDecision).toBeNull();
      expect(state.propertyAddressDraft.line1).toBe("");
    });

    it("records a future quote-review preference without claiming an appointment", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "review_quote_when_ready",
      });
      state = wmChatReducer(state, {
        type: "select_quote_readiness",
        value: "not_yet",
      });
      expect(state.postCaptureNodeId).toBe("callback_preference");

      state = wmChatReducer(state, {
        type: "select_callback_preference",
        value: "next_week",
      });
      expect(state.postCaptureNodeId).toBe("review");
      expect(state.callbackPreference).toBe("next_week");
    });

    it("accepts continuation success only for the active submission and bound pair", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "quote_request_game_plan",
      });
      state = wmChatReducer(state, { type: "skip_property_address" });
      state = wmChatReducer(state, {
        type: "continuation_started",
        submissionId: CONTINUATION_ID,
      });
      expect(state.continuationStatus).toBe("submitting");

      const mismatched = wmChatReducer(state, {
        type: "continuation_succeeded",
        submissionId: CONTINUATION_ID,
        leadId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        sessionId: SESSION_ID,
      });
      expect(mismatched).toBe(state);

      state = wmChatReducer(state, {
        type: "continuation_succeeded",
        submissionId: CONTINUATION_ID,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
      });
      expect(state.postCaptureNodeId).toBe("confirmation");
      expect(state.continuationStatus).toBe("success");
    });

    it("keeps a successfully persisted continuation immutable under choice-return actions", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "quote_request_game_plan",
      });
      state = wmChatReducer(state, { type: "skip_property_address" });
      state = wmChatReducer(state, {
        type: "continuation_started",
        submissionId: CONTINUATION_ID,
      });
      state = wmChatReducer(state, {
        type: "continuation_succeeded",
        submissionId: CONTINUATION_ID,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
      });

      const persisted = state;
      expect(
        wmChatReducer(persisted, { type: "post_capture_back" }),
      ).toBe(persisted);
      expect(
        wmChatReducer(persisted, { type: "return_to_post_capture_choices" }),
      ).toBe(persisted);
    });

    it("ignores stale failures and preserves the selected draft for retry", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "schedule_windowman_conversation",
      });
      state = wmChatReducer(state, {
        type: "select_conversation_time",
        value: "weekday_morning",
      });
      state = wmChatReducer(state, { type: "skip_property_address" });
      state = wmChatReducer(state, {
        type: "continuation_started",
        submissionId: CONTINUATION_ID,
      });

      const stale = wmChatReducer(state, {
        type: "continuation_failed",
        submissionId: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        message: "stale",
      });
      expect(stale).toBe(state);

      state = wmChatReducer(state, {
        type: "continuation_failed",
        submissionId: CONTINUATION_ID,
        message: "Try again.",
      });
      expect(state.continuationStatus).toBe("error");
      expect(state.postCaptureAction).toBe("schedule_windowman_conversation");
      expect(state.conversationTimePreference).toBe("weekday_morning");
      expect(state.propertyAddressDecision).toBe("skip");
    });

    it("never adds post-capture address or scheduling data to wmchat_v1", () => {
      let state = captureNeedQuote();
      state = wmChatReducer(state, {
        type: "select_post_capture_action",
        postCaptureAction: "quote_request_game_plan",
      });
      state = wmChatReducer(state, {
        type: "update_property_address",
        field: "line1",
        value: "123 Palm Avenue",
      });

      const intake = buildWmChatIntake(state);
      const raw = JSON.stringify(intake);
      expect(raw).not.toContain("postCapture");
      expect(raw).not.toContain("123 Palm Avenue");
      expect(raw).not.toContain("propertyAddress");
    });
  });
});
