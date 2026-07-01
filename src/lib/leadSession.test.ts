import { describe, expect, it } from "vitest";
import { hasTrustedContactIdentity, isValidLeadSessionUuid } from "./leadSession";

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";

describe("leadSession", () => {
  describe("isValidLeadSessionUuid", () => {
    it("accepts valid UUID v4", () => {
      expect(isValidLeadSessionUuid(LEAD_ID)).toBe(true);
      expect(isValidLeadSessionUuid(SESSION_ID)).toBe(true);
    });

    it("rejects invalid UUID", () => {
      expect(isValidLeadSessionUuid("not-a-uuid")).toBe(false);
      expect(isValidLeadSessionUuid("123")).toBe(false);
    });

    it("rejects null and undefined", () => {
      expect(isValidLeadSessionUuid(null)).toBe(false);
      expect(isValidLeadSessionUuid(undefined)).toBe(false);
    });
  });

  describe("hasTrustedContactIdentity", () => {
    it("returns true only when both IDs are valid UUIDs", () => {
      expect(hasTrustedContactIdentity(LEAD_ID, SESSION_ID)).toBe(true);
    });

    it("returns false when either ID is missing or invalid", () => {
      expect(hasTrustedContactIdentity(null, SESSION_ID)).toBe(false);
      expect(hasTrustedContactIdentity(LEAD_ID, null)).toBe(false);
      expect(hasTrustedContactIdentity(undefined, SESSION_ID)).toBe(false);
      expect(hasTrustedContactIdentity(LEAD_ID, undefined)).toBe(false);
      expect(hasTrustedContactIdentity("bad", SESSION_ID)).toBe(false);
      expect(hasTrustedContactIdentity(LEAD_ID, "bad")).toBe(false);
    });
  });
});
