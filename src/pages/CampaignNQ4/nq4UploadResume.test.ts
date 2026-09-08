import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearNq4UploadResume,
  NQ4_UPLOAD_RESUME_TTL_MS,
  readNq4UploadResume,
  writeNq4UploadResume,
} from "./nq4UploadResume";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;
const STORAGE_KEY = "wm_nq4_upload_resume_v1";

describe("nq4UploadResume", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("writes and reads the exact four-field version-1 record without PII", () => {
    const written = writeNq4UploadResume(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      NOW,
    );
    const serialized = window.sessionStorage.getItem(STORAGE_KEY) ?? "{}";

    expect(written).toEqual({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      expiresAt: NOW + NQ4_UPLOAD_RESUME_TTL_MS,
    });
    expect(Object.keys(JSON.parse(serialized) as object).sort()).toEqual([
      "expiresAt",
      "leadId",
      "sessionId",
      "version",
    ]);
    expect(serialized).not.toMatch(/name|email|phone|Sam|sam@example\.com/i);
    expect(readNq4UploadResume(NOW)).toEqual(written);
  });

  it("expires exactly at the thirty-minute boundary and removes the record", () => {
    writeNq4UploadResume({ leadId: LEAD_ID, sessionId: SESSION_ID }, NOW);

    expect(
      readNq4UploadResume(NOW + NQ4_UPLOAD_RESUME_TTL_MS - 1),
    ).not.toBeNull();
    expect(
      readNq4UploadResume(NOW + NQ4_UPLOAD_RESUME_TTL_MS),
    ).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    ["malformed JSON", "{"],
    [
      "unsupported version",
      JSON.stringify({
        version: 2,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: NOW + 1,
      }),
    ],
    [
      "missing field",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        expiresAt: NOW + 1,
      }),
    ],
    [
      "malformed lead UUID",
      JSON.stringify({
        version: 1,
        leadId: "not-a-uuid",
        sessionId: SESSION_ID,
        expiresAt: NOW + 1,
      }),
    ],
    [
      "malformed session UUID",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: "not-a-uuid",
        expiresAt: NOW + 1,
      }),
    ],
    [
      "unexpected field",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: NOW + 1,
        email: "must-not-be-stored@example.com",
      }),
    ],
    [
      "expiry beyond the fixed TTL",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: NOW + NQ4_UPLOAD_RESUME_TTL_MS + 1,
      }),
    ],
  ])("clears %s", (_label, serialized) => {
    window.sessionStorage.setItem(STORAGE_KEY, serialized);

    expect(readNq4UploadResume(NOW)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it.each([
    { leadId: "not-a-uuid", sessionId: SESSION_ID },
    { leadId: LEAD_ID, sessionId: "not-a-uuid" },
  ])("rejects malformed write identity %#", (identity) => {
    expect(writeNq4UploadResume(identity, NOW)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("swallows blocked storage reads, writes, and removals", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(readNq4UploadResume(NOW)).toBeNull();
    getItem.mockRestore();

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(
      writeNq4UploadResume(
        { leadId: LEAD_ID, sessionId: SESSION_ID },
        NOW,
      ),
    ).toEqual({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      expiresAt: NOW + NQ4_UPLOAD_RESUME_TTL_MS,
    });
    setItem.mockRestore();

    window.sessionStorage.setItem(STORAGE_KEY, "stored");
    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(() => clearNq4UploadResume()).not.toThrow();
    removeItem.mockRestore();
  });

  it("clears a stored handoff", () => {
    writeNq4UploadResume({ leadId: LEAD_ID, sessionId: SESSION_ID }, NOW);

    clearNq4UploadResume();

    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
