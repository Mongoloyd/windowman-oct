import { describe, expect, it } from "vitest";
import { demoReducer, initialDemoState, type DemoAction, type DemoState } from "./reducer";
import { SAMPLE_QUOTE } from "./fixture";

const sessionId = "22222222-2222-4222-8222-222222222222";
const leadId = "11111111-1111-4111-8111-111111111111";
const advance = (state: DemoState, ...actions: DemoAction[]) => actions.reduce(demoReducer, state);
function revealedState() {
  return advance(initialDemoState(), { type: "OPEN", sessionId, variant: "lens" }, { type: "REVEAL" }, { type: "NEXT" },
    { type: "REVEAL" }, { type: "NEXT" }, { type: "REVEAL" }, { type: "REVEAL_VALUE" });
}
function savingState() {
  return advance(revealedState(), { type: "BEGIN_CAPTURE" }, { type: "EDIT_CONTACT", field: "firstName", value: "Taylor" },
    { type: "EDIT_CONTACT", field: "email", value: "taylor@example.test" }, { type: "SUBMIT_CAPTURE" });
}
describe("synthetic demo reducer", () => {
  it("keeps capture and premature payoff unreachable until all sample value is revealed", () => {
    for (const state of [initialDemoState(), demoReducer(initialDemoState(), { type: "OPEN", sessionId, variant: "lens" })]) {
      for (const action of [{ type: "BEGIN_CAPTURE" }, { type: "SUBMIT_CAPTURE" }, { type: "REVEAL_VALUE" }] satisfies DemoAction[]) {
        expect(demoReducer(state, action)).toBe(state);
      }
    }
    expect(revealedState().phase).toBe("value_revealed");
    expect(savingState().phase).toBe("capturing");
    expect(savingState().captureStatus).toBe("saving");
  });
  it("does not skip unseen signals and preserves answers when going back", () => {
    const start = demoReducer(initialDemoState(), { type: "OPEN", sessionId, variant: "lens" });
    expect(demoReducer(start, { type: "NEXT" })).toBe(start);
    const state = advance(start, { type: "ANSWER", answer: "clarify" }, { type: "NEXT" }, { type: "PREVIOUS" });
    expect(state.answers.scope).toBe("clarify");
    expect(state.revealed).toEqual(["scope"]);
  });
  it.each([null, {}, { ok: true, leadId, sessionId }, { ok: true, leadId, sessionId, source: "wrong" },
    { ok: true, leadId: "not-a-uuid", sessionId, source: "quote-education-demo" },
    { ok: true, leadId, sessionId: "33333333-3333-4333-8333-333333333333", source: "quote-education-demo" }])("rejects untrusted capture response %#", (result) => {
    const state = demoReducer(savingState(), { type: "CAPTURE_RESULT", result, sessionId });
    expect(state.captureStatus).toBe("error");
    expect(state.lead).toBeNull();
    expect(demoReducer(state, { type: "HANDOFF", target: "no_quote" })).toBe(state);
    expect(state.contact.email).toBe("taylor@example.test");
  });
  it("accepts a trusted result and deduplicates saving transitions", () => {
    const saving = savingState();
    expect(demoReducer(saving, { type: "SUBMIT_CAPTURE" })).toBe(saving);
    const saved = demoReducer(saving, { type: "CAPTURE_RESULT", sessionId, result: { ok: true, leadId, sessionId, source: "quote-education-demo" } });
    expect(saved.captureStatus).toBe("saved");
    expect(demoReducer(saved, { type: "HANDOFF", target: "no_quote" }).handoff).toBe("no_quote");
  });
  it("permits real-quote escape before capture, during capture, and after a failed save", () => {
    const open = demoReducer(initialDemoState(), { type: "OPEN", sessionId, variant: "lens" });
    const failed = demoReducer(savingState(), { type: "CAPTURE_FAILED", sessionId });
    for (const state of [open, revealedState(), savingState(), failed]) {
      expect(demoReducer(state, { type: "HANDOFF", target: "has_quote_escape" }).handoff).toBe("has_quote_escape");
    }
  });
  it("resets identity, answers, contact and errors; ignores an old lifecycle response", () => {
    const closed = demoReducer(savingState(), { type: "CLOSE" });
    expect(closed).toEqual(initialDemoState());
    expect(demoReducer(closed, { type: "CAPTURE_RESULT", sessionId, result: { ok: true, leadId, sessionId, source: "quote-education-demo" } })).toBe(closed);
  });
  it("allows only active X-Ray to request an early no-quote handoff, once", () => {
    const start = demoReducer(initialDemoState(), { type: "OPEN", sessionId, variant: "xray" });
    expect(start.revealed).toEqual([]);
    expect(demoReducer(start, { type: "BEGIN_CAPTURE" })).toBe(start);
    expect(demoReducer(start, { type: "HANDOFF", target: "no_quote" })).toBe(start);
    const handed = demoReducer(start, { type: "XRAY_NO_QUOTE_HANDOFF" });
    expect(handed).toMatchObject({ phase: "handoff", handoff: "xray_no_quote_escape", lead: null, revealed: [], step: 0 });
    expect(demoReducer(handed, { type: "XRAY_NO_QUOTE_HANDOFF" })).toBe(handed);
    expect(demoReducer(handed, { type: "HANDOFF", target: "has_quote_escape" })).toBe(handed);
    const closed = demoReducer(handed, { type: "CLOSE" });
    expect(demoReducer(closed, { type: "XRAY_NO_QUOTE_HANDOFF" })).toBe(closed);
  });
  it.each(["lens", "challenge"] as const)("does not grant %s an early no-quote path in any phase", (variant) => {
    const start = demoReducer(initialDemoState(), { type: "OPEN", sessionId, variant });
    for (const state of [start, { ...revealedState(), variant }, { ...savingState(), variant },
      { ...savingState(), variant, captureStatus: "error" as const }]) {
      expect(demoReducer(state, { type: "XRAY_NO_QUOTE_HANDOFF" })).toBe(state);
    }
    expect(demoReducer(start, { type: "HANDOFF", target: "no_quote" })).toBe(start);
    expect(demoReducer(start, { type: "BEGIN_CAPTURE" })).toBe(start);
  });
  it("has one consistent integer-cent fixture total", () => {
    expect(SAMPLE_QUOTE.lines.reduce((sum, line) => sum + line.amountCents, 0)).toBe(SAMPLE_QUOTE.totalCents);
    expect(SAMPLE_QUOTE.lines.every((line) => Number.isInteger(line.amountCents))).toBe(true);
  });
});
