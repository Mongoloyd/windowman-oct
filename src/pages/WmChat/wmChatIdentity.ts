import { createUuid } from "@/lib/createUuid";
import { isValidLeadSessionUuid } from "@/lib/leadSession";

export const WM_CHAT_SESSION_STORAGE_KEY = "wm_wmchat_session_id";
export const WM_CHAT_SUBMISSION_STORAGE_KEY = "wm_wmchat_submission_id";
export const WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY =
  "wm_wmchat_continuation_submission_id";
/**
 * Change-detector for the contact already bound to this tab's captured lead.
 * Stores a non-reversible digest — never the raw name or mobile number.
 */
export const WM_CHAT_CAPTURED_CONTACT_STORAGE_KEY =
  "wm_wmchat_captured_contact";

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

/**
 * Starts a fresh capture identity. The server binds one lead per session_id and
 * rejects a later capture that carries different contact details for that lead
 * (`wmchat_lead_mismatch`), so a genuinely new contact needs a new session.
 * The submission id rotates alongside it: a new lead means a new consent event.
 */
export function rotateWmChatCaptureIdentity(): {
  sessionId: string;
  submissionId: string;
} {
  const sessionId = replaceStoredUuid(WM_CHAT_SESSION_STORAGE_KEY);
  const submissionId = replaceStoredUuid(WM_CHAT_SUBMISSION_STORAGE_KEY);
  clearWmChatCapturedContact();
  return { sessionId, submissionId };
}

/**
 * Non-cryptographic digest (djb2). This only has to detect "the homeowner
 * changed their answer", so it is deliberately synchronous and keeps the raw
 * contact out of sessionStorage.
 */
export function buildWmChatContactDigest(
  firstName: string | null,
  phoneE164: string,
): string {
  const input = `${firstName?.trim().toLowerCase() ?? ""}|${phoneE164}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(36);
}

export function readWmChatCapturedContact(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(WM_CHAT_CAPTURED_CONTACT_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeWmChatCapturedContact(digest: string): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(WM_CHAT_CAPTURED_CONTACT_STORAGE_KEY, digest);
  } catch {
    // Storage may be unavailable; the reactive retry still recovers the user.
  }
}

export function clearWmChatCapturedContact(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(WM_CHAT_CAPTURED_CONTACT_STORAGE_KEY);
  } catch {
    // Nothing to clean up when storage is blocked.
  }
}
