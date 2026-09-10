import { SAMPLE_QUOTE } from "./fixture";
import { CAPTURE_ERROR, trustedDemoLead, type TrustedDemoLead } from "./captureValidation";
import type { AnswerId, SignalId, SyntheticDemoContact, SyntheticDemoVariant } from "./types";

export type DemoPhase = "idle" | "interacting" | "value_revealed" | "capturing" | "handoff";
export type DemoHandoff = "has_quote" | "no_quote" | "has_quote_escape" | "xray_no_quote_escape";
export interface DemoState {
  phase: DemoPhase;
  variant: SyntheticDemoVariant | null;
  step: number;
  answers: Partial<Record<SignalId, AnswerId>>;
  revealed: SignalId[];
  sessionId: string | null;
  contact: SyntheticDemoContact;
  captureStatus: "idle" | "saving" | "error" | "saved";
  captureError: string | null;
  lead: TrustedDemoLead | null;
  handoff: DemoHandoff | null;
}
export type DemoAction =
  | { type: "OPEN"; sessionId: string; variant: SyntheticDemoVariant }
  | { type: "CLOSE" }
  | { type: "OPEN_FAILED" }
  | { type: "REVEAL" }
  | { type: "ANSWER"; answer: AnswerId }
  | { type: "NEXT" }
  | { type: "PREVIOUS" }
  | { type: "REVEAL_VALUE" }
  | { type: "BEGIN_CAPTURE" }
  | { type: "EDIT_CONTACT"; field: keyof SyntheticDemoContact; value: string }
  | { type: "SUBMIT_CAPTURE" }
  | { type: "CAPTURE_RESULT"; result: unknown; sessionId: string }
  | { type: "CAPTURE_FAILED"; sessionId: string }
  | { type: "XRAY_NO_QUOTE_HANDOFF" }
  | { type: "HANDOFF"; target: Exclude<DemoHandoff, "xray_no_quote_escape"> };

export const initialDemoState = (): DemoState => ({
  phase: "idle", variant: null, step: 0, answers: {}, revealed: [], sessionId: null,
  contact: { firstName: "", email: "" }, captureStatus: "idle", captureError: null,
  lead: null, handoff: null,
});
export function validContact(contact: SyntheticDemoContact): boolean {
  return contact.firstName.trim().length >= 2 && contact.firstName.trim().length <= 100 &&
    contact.email.trim().length <= 255 && /^\S+@\S+\.\S+$/.test(contact.email.trim());
}
export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  const signal = SAMPLE_QUOTE.signals[state.step];
  switch (action.type) {
    case "OPEN": return { ...initialDemoState(), phase: "interacting", variant: action.variant, sessionId: action.sessionId };
    case "CLOSE": return initialDemoState();
    case "OPEN_FAILED": return { ...initialDemoState(), captureStatus: "error", captureError: "The sample could not open. Close it and try again." };
    case "REVEAL":
    case "ANSWER": {
      if (state.phase !== "interacting") return state;
      return { ...state,
        revealed: state.revealed.includes(signal.id) ? state.revealed : [...state.revealed, signal.id],
        answers: action.type === "ANSWER" ? { ...state.answers, [signal.id]: action.answer } : state.answers,
      };
    }
    case "NEXT": return state.phase === "interacting" && state.revealed.includes(signal.id) && state.step < 2
      ? { ...state, step: state.step + 1 } : state;
    case "PREVIOUS": return state.phase === "interacting" && state.step > 0
      ? { ...state, step: state.step - 1 } : state;
    case "REVEAL_VALUE": return state.phase === "interacting" && state.step === 2 && state.revealed.length === 3
      ? { ...state, phase: "value_revealed" } : state;
    case "BEGIN_CAPTURE": return state.phase === "value_revealed"
      ? { ...state, phase: "capturing" } : state;
    case "EDIT_CONTACT": return state.phase === "capturing" && state.captureStatus !== "saving" && !state.lead
      ? { ...state, contact: { ...state.contact, [action.field]: action.value }, captureError: null } : state;
    case "SUBMIT_CAPTURE":
      if (state.phase !== "capturing" || state.captureStatus === "saving" || state.lead) return state;
      return validContact(state.contact)
        ? { ...state, captureStatus: "saving", captureError: null }
        : { ...state, captureStatus: "error", captureError: "Enter your first name and a valid email address." };
    case "CAPTURE_RESULT": {
      if (state.phase !== "capturing" || state.captureStatus !== "saving" || state.sessionId !== action.sessionId) return state;
      const lead = trustedDemoLead(action.result, action.sessionId);
      return lead ? { ...state, lead, captureStatus: "saved", captureError: null }
        : { ...state, captureStatus: "error", captureError: CAPTURE_ERROR };
    }
    case "CAPTURE_FAILED": return state.phase === "capturing" && state.captureStatus === "saving" && state.sessionId === action.sessionId
      ? { ...state, captureStatus: "error", captureError: CAPTURE_ERROR } : state;
    case "XRAY_NO_QUOTE_HANDOFF": return state.variant === "xray" && state.phase === "interacting"
      ? { ...state, phase: "handoff", handoff: "xray_no_quote_escape" } : state;
    case "HANDOFF": {
      const canEscape = action.target === "has_quote_escape" && state.phase !== "idle" && state.phase !== "handoff";
      const canFinish = action.target !== "has_quote_escape" && (state.phase === "value_revealed" ||
        (state.phase === "capturing" && state.captureStatus !== "saving" && state.captureStatus !== "error"));
      return canEscape || canFinish ? { ...state, phase: "handoff", handoff: action.target } : state;
    }
  }
}
