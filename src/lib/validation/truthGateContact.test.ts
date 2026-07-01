import { describe, expect, it } from "vitest";
import {
  formatTruthGatePhoneDisplay,
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
  validateTruthGateContact,
  validateTruthGateContactField,
} from "./truthGateContact";

describe("truthGateContact", () => {
  describe("isValidTruthGatePhone", () => {
    it("treats empty phone as valid", () => {
      expect(isValidTruthGatePhone("")).toBe(true);
      expect(isValidTruthGatePhone("   ")).toBe(true);
    });

    it("rejects area code starting with 0", () => {
      expect(isValidTruthGatePhone("(012) 345-6789")).toBe(false);
    });

    it("rejects area code starting with 1", () => {
      expect(isValidTruthGatePhone("(123) 456-7890")).toBe(false);
    });

    it("rejects all-same-digit numbers", () => {
      expect(isValidTruthGatePhone("1111111111")).toBe(false);
      expect(isValidTruthGatePhone("(111) 111-1111")).toBe(false);
    });

    it("rejects 1234567890 and 0987654321", () => {
      expect(isValidTruthGatePhone("1234567890")).toBe(false);
      expect(isValidTruthGatePhone("0987654321")).toBe(false);
    });

    it("accepts valid 10-digit US phone", () => {
      expect(isValidTruthGatePhone("5551234567")).toBe(true);
      expect(isValidTruthGatePhone("(555) 123-4567")).toBe(true);
    });

    it("accepts valid 11-digit leading-1 phone", () => {
      expect(isValidTruthGatePhone("15551234567")).toBe(true);
    });
  });

  describe("normalizeTruthGatePhoneToE164", () => {
    it("normalizes empty phone to null", () => {
      expect(normalizeTruthGatePhoneToE164("")).toBe(null);
      expect(normalizeTruthGatePhoneToE164("   ")).toBe(null);
    });

    it("normalizes valid 10-digit phone to +1 E.164", () => {
      expect(normalizeTruthGatePhoneToE164("5551234567")).toBe("+15551234567");
      expect(normalizeTruthGatePhoneToE164("(555) 123-4567")).toBe("+15551234567");
    });

    it("normalizes valid 11-digit leading-1 phone to +1 E.164", () => {
      expect(normalizeTruthGatePhoneToE164("15551234567")).toBe("+15551234567");
    });
  });

  describe("formatTruthGatePhoneDisplay", () => {
    it("returns empty string for no digits", () => {
      expect(formatTruthGatePhoneDisplay("")).toBe("");
    });

    it("formats partial input progressively", () => {
      expect(formatTruthGatePhoneDisplay("5")).toBe("(5");
      expect(formatTruthGatePhoneDisplay("555")).toBe("(555");
      expect(formatTruthGatePhoneDisplay("5551")).toBe("(555) 1");
      expect(formatTruthGatePhoneDisplay("5551234")).toBe("(555) 123-4");
    });

    it("formats complete 10-digit input", () => {
      expect(formatTruthGatePhoneDisplay("5551234567")).toBe("(555) 123-4567");
    });

    it("strips leading 1 from 11-digit input for display", () => {
      expect(formatTruthGatePhoneDisplay("15551234567")).toBe("(555) 123-4567");
    });
  });

  describe("validateTruthGateContactField", () => {
    it("validates first name", () => {
      expect(validateTruthGateContactField("firstName", "Jo")).toBe("valid");
      expect(validateTruthGateContactField("firstName", "J")).toBe("invalid");
    });

    it("validates email", () => {
      expect(validateTruthGateContactField("email", "a@b.co")).toBe("valid");
      expect(validateTruthGateContactField("email", "not-email")).toBe("invalid");
    });

    it("keeps empty phone untouched", () => {
      expect(validateTruthGateContactField("phone", "")).toBe("untouched");
    });

    it("validates non-empty phone", () => {
      expect(validateTruthGateContactField("phone", "(555) 123-4567")).toBe("valid");
      expect(validateTruthGateContactField("phone", "1111111111")).toBe("invalid");
    });
  });

  describe("validateTruthGateContact", () => {
    it("accepts first name and email only", () => {
      const result = validateTruthGateContact({
        firstName: "Jane",
        email: "jane@example.com",
        phone: "",
      });
      expect(result.valid).toBe(true);
      expect(result.fieldStatus.phone).toBe("untouched");
    });

    it("rejects invalid email", () => {
      const result = validateTruthGateContact({
        firstName: "Jane",
        email: "bad",
        phone: "",
      });
      expect(result.valid).toBe(false);
      expect(result.fieldStatus.email).toBe("invalid");
    });

    it("rejects junk phone when provided", () => {
      const result = validateTruthGateContact({
        firstName: "Jane",
        email: "jane@example.com",
        phone: "1111111111",
      });
      expect(result.valid).toBe(false);
      expect(result.fieldStatus.phone).toBe("invalid");
    });
  });
});
