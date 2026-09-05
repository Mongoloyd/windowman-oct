import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearProphecyUploadResume,
  PROPHECY_UPLOAD_RESUME_TTL_MS,
  readProphecyUploadResume,
  writeProphecyUploadResume,
} from "./prophecyUploadResume";

const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const NOW = 1_800_000_000_000;
const STORAGE_KEY = "wm_prophecy_upload_resume_v1";

describe("prophecyUploadResume", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("writes and reads the exact four-field versioned record", () => {
    const written = writeProphecyUploadResume(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      NOW,
    );

    expect(written).toEqual({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      expiresAt: NOW + PROPHECY_UPLOAD_RESUME_TTL_MS,
    });
    expect(
      Object.keys(
        JSON.parse(window.sessionStorage.getItem(STORAGE_KEY) ?? "{}") as object,
      ).sort(),
    ).toEqual(["expiresAt", "leadId", "sessionId", "version"]);
    expect(readProphecyUploadResume(NOW)).toEqual(written);
  });

  it("expires at the fixed thirty-minute boundary and removes the record", () => {
    writeProphecyUploadResume({ leadId: LEAD_ID, sessionId: SESSION_ID }, NOW);

    expect(
      readProphecyUploadResume(NOW + PROPHECY_UPLOAD_RESUME_TTL_MS - 1),
    ).not.toBeNull();
    expect(
      readProphecyUploadResume(NOW + PROPHECY_UPLOAD_RESUME_TTL_MS),
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
      "missing identifier",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        expiresAt: NOW + 1,
      }),
    ],
    [
      "invalid identifier",
      JSON.stringify({
        version: 1,
        leadId: "not-a-uuid",
        sessionId: SESSION_ID,
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
        name: "must-not-be-stored",
      }),
    ],
    [
      "expiry beyond the fixed TTL",
      JSON.stringify({
        version: 1,
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        expiresAt: NOW + PROPHECY_UPLOAD_RESUME_TTL_MS + 1,
      }),
    ],
  ])("clears %s", (_label, serialized) => {
    window.sessionStorage.setItem(STORAGE_KEY, serialized);

    expect(readProphecyUploadResume(NOW)).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("ignores invalid write identities", () => {
    expect(
      writeProphecyUploadResume(
        { leadId: "invalid", sessionId: SESSION_ID },
        NOW,
      ),
    ).toBeNull();
    expect(window.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("swallows blocked storage reads, writes, and removals", () => {
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(readProphecyUploadResume(NOW)).toBeNull();
    getItem.mockRestore();

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(
      writeProphecyUploadResume(
        { leadId: LEAD_ID, sessionId: SESSION_ID },
        NOW,
      ),
    ).toEqual({
      version: 1,
      leadId: LEAD_ID,
      sessionId: SESSION_ID,
      expiresAt: NOW + PROPHECY_UPLOAD_RESUME_TTL_MS,
    });
    setItem.mockRestore();

    const removeItem = vi
      .spyOn(Storage.prototype, "removeItem")
      .mockImplementation(() => {
        throw new DOMException("blocked");
      });
    expect(() => clearProphecyUploadResume()).not.toThrow();
    removeItem.mockRestore();
  });
});
