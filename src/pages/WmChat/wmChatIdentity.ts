import { createUuid } from "@/lib/createUuid";
import { isValidLeadSessionUuid } from "@/lib/leadSession";

export const WM_CHAT_SESSION_STORAGE_KEY = "wm_wmchat_session_id";
export const WM_CHAT_SUBMISSION_STORAGE_KEY = "wm_wmchat_submission_id";
export const WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY =
  "wm_wmchat_continuation_submission_id";

function getOrCreateStoredUuid(key: string): string {
  if (typeof window === "undefined") return createUuid();

  try {
    const existing = sessionStorage.getItem(key);
    if (isValidLeadSessionUuid(existing)) return existing;
    const created = createUuid();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return createUuid();
  }
}

function replaceStoredUuid(key: string): string {
  const created = createUuid();
  if (typeof window === "undefined") return created;

  try {
    sessionStorage.setItem(key, created);
  } catch {
    // The secure in-memory UUID remains usable when storage is unavailable.
  }
  return created;
}

export function getOrCreateWmChatSessionId(): string {
  return getOrCreateStoredUuid(WM_CHAT_SESSION_STORAGE_KEY);
}

export function getOrCreateWmChatSubmissionId(): string {
  return getOrCreateStoredUuid(WM_CHAT_SUBMISSION_STORAGE_KEY);
}

export function getOrCreateWmChatContinuationSubmissionId(): string {
  return getOrCreateStoredUuid(WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY);
}

export function rotateWmChatContinuationSubmissionId(): string {
  return replaceStoredUuid(WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY);
}
