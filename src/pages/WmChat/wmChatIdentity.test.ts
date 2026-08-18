import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import {
  WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY,
  WM_CHAT_SESSION_STORAGE_KEY,
  WM_CHAT_SUBMISSION_STORAGE_KEY,
  getOrCreateWmChatContinuationSubmissionId,
  getOrCreateWmChatSessionId,
  getOrCreateWmChatSubmissionId,
  rotateWmChatContinuationSubmissionId,
} from "./wmChatIdentity";

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SUBMISSION_ID = "11111111-2222-4333-8444-555555555555";
const CONTINUATION_ID = "66666666-7777-4888-8999-aaaaaaaaaaaa";
const ROTATED_CONTINUATION_ID = "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff";

describe("wmChatIdentity", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("reuses valid stored session and submission identities", () => {
    sessionStorage.setItem(WM_CHAT_SESSION_STORAGE_KEY, SESSION_ID);
    sessionStorage.setItem(WM_CHAT_SUBMISSION_STORAGE_KEY, SUBMISSION_ID);
    const randomUUID = vi.fn(() => "99999999-8888-4777-8666-555555555555");
    vi.stubGlobal("crypto", { randomUUID });

    expect(getOrCreateWmChatSessionId()).toBe(SESSION_ID);
    expect(getOrCreateWmChatSubmissionId()).toBe(SUBMISSION_ID);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("reuses the continuation submission UUID across page reloads", () => {
    sessionStorage.setItem(
      WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY,
      CONTINUATION_ID,
    );
    const randomUUID = vi.fn(() => ROTATED_CONTINUATION_ID);
    vi.stubGlobal("crypto", { randomUUID });

    expect(getOrCreateWmChatContinuationSubmissionId()).toBe(CONTINUATION_ID);
    expect(getOrCreateWmChatContinuationSubmissionId()).toBe(CONTINUATION_ID);
    expect(randomUUID).not.toHaveBeenCalled();
  });

  it("stores only an opaque continuation UUID in sessionStorage and rotates it", () => {
    const randomUUID = vi
      .fn()
      .mockReturnValueOnce(CONTINUATION_ID)
      .mockReturnValueOnce(ROTATED_CONTINUATION_ID);
    vi.stubGlobal("crypto", { randomUUID });

    expect(getOrCreateWmChatContinuationSubmissionId()).toBe(CONTINUATION_ID);
    expect(sessionStorage.getItem(WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY)).toBe(
      CONTINUATION_ID,
    );
    expect(localStorage.getItem(WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY)).toBeNull();
    expect(rotateWmChatContinuationSubmissionId()).toBe(ROTATED_CONTINUATION_ID);
    expect(sessionStorage.getItem(WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY)).toBe(
      ROTATED_CONTINUATION_ID,
    );

    const storedContinuation = Array.from(
      { length: sessionStorage.length },
      (_, index) => {
        const key = sessionStorage.key(index);
        return key ? [key, sessionStorage.getItem(key)] : null;
      },
    ).filter(Boolean);
    expect(storedContinuation).toEqual([
      [WM_CHAT_CONTINUATION_SUBMISSION_STORAGE_KEY, ROTATED_CONTINUATION_ID],
    ]);
    expect(JSON.stringify(storedContinuation)).not.toMatch(
      /peter|example\.com|5615550123|123 main street/i,
    );
  });

  it("replaces malformed stored identities with secure UUIDs", () => {
    sessionStorage.setItem(WM_CHAT_SESSION_STORAGE_KEY, "not-a-uuid");
    vi.stubGlobal("crypto", { randomUUID: () => SESSION_ID });

    expect(getOrCreateWmChatSessionId()).toBe(SESSION_ID);
    expect(sessionStorage.getItem(WM_CHAT_SESSION_STORAGE_KEY)).toBe(SESSION_ID);
  });

  it("falls back to secure random values when randomUUID is unavailable", () => {
    vi.stubGlobal("crypto", {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });

    const sessionId = getOrCreateWmChatSessionId();
    expect(isValidLeadSessionUuid(sessionId)).toBe(true);
    expect(sessionStorage.getItem(WM_CHAT_SESSION_STORAGE_KEY)).toBe(sessionId);
  });

  it("fails closed when no secure random source exists", () => {
    vi.stubGlobal("crypto", {});
    expect(() => getOrCreateWmChatSessionId()).toThrow(
      "Cryptographic random is unavailable",
    );
  });

  it("returns a secure identity when sessionStorage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.stubGlobal("crypto", { randomUUID: () => SUBMISSION_ID });

    expect(getOrCreateWmChatSubmissionId()).toBe(SUBMISSION_ID);
  });
});
