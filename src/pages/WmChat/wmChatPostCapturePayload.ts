import { isValidLeadSessionUuid } from "@/lib/leadSession";

import type {
  WmChatPostCaptureSubmitInput,
  WmChatPropertyAddressDraft,
  WmChatState,
} from "./wmChatTypes";

const US_POSTAL_CODE_PATTERN = /^\d{5}$/;

export type WmChatPostCaptureDraft = Omit<
  WmChatPostCaptureSubmitInput,
  "submissionId"
>;

function normalizeAddress(
  address: WmChatPropertyAddressDraft,
): WmChatPropertyAddressDraft {
  return {
    line1: address.line1.trim(),
    line2: address.line2.trim(),
    city: address.city.trim(),
    region: address.region.trim().toUpperCase(),
    postalCode: address.postalCode.trim(),
  };
}

export function isCompleteWmChatPropertyAddress(
  address: WmChatPropertyAddressDraft,
): boolean {
  const normalized = normalizeAddress(address);
  return (
    normalized.line1.length >= 3 &&
    normalized.line1.length <= 120 &&
    normalized.line2.length <= 120 &&
    normalized.city.length >= 2 &&
    normalized.city.length <= 80 &&
    normalized.region.length >= 2 &&
    normalized.region.length <= 40 &&
    US_POSTAL_CODE_PATTERN.test(normalized.postalCode)
  );
}

export function buildWmChatPostCaptureDraft(
  state: WmChatState,
): WmChatPostCaptureDraft | null {
  if (
    state.postCaptureNodeId !== "review" ||
    !state.postCaptureAction ||
    !isValidLeadSessionUuid(state.leadId) ||
    !isValidLeadSessionUuid(state.sessionId)
  ) {
    return null;
  }

  let propertyAddress: WmChatPropertyAddressDraft | null = null;
  if (state.postCaptureAction !== "review_quote_when_ready") {
    if (!state.propertyAddressDecision) return null;
    if (state.propertyAddressDecision === "add") {
      if (!isCompleteWmChatPropertyAddress(state.propertyAddressDraft)) {
        return null;
      }
      propertyAddress = normalizeAddress(state.propertyAddressDraft);
    }
  }

  if (
    state.postCaptureAction === "schedule_windowman_conversation" &&
    !state.conversationTimePreference
  ) {
    return null;
  }

  if (
    state.postCaptureAction === "review_quote_when_ready" &&
    (state.quoteReadiness !== "not_yet" || !state.callbackPreference)
  ) {
    return null;
  }

  return {
    leadId: state.leadId,
    sessionId: state.sessionId,
    action: state.postCaptureAction,
    propertyAddress,
    conversationTimePreference:
      state.postCaptureAction === "schedule_windowman_conversation"
        ? state.conversationTimePreference
        : null,
    quoteReadiness:
      state.postCaptureAction === "review_quote_when_ready"
        ? state.quoteReadiness
        : null,
    callbackPreference:
      state.postCaptureAction === "review_quote_when_ready"
        ? state.callbackPreference
        : null,
  };
}

export function buildWmChatPostCaptureSubmission(
  state: WmChatState,
  submissionId: string,
): WmChatPostCaptureSubmitInput | null {
  const draft = buildWmChatPostCaptureDraft(state);
  if (!draft || !isValidLeadSessionUuid(submissionId)) return null;
  return { ...draft, submissionId };
}

export function fingerprintWmChatPostCaptureDraft(
  draft: WmChatPostCaptureDraft,
): string {
  return JSON.stringify(draft);
}
