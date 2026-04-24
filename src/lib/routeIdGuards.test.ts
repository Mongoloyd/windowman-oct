import { describe, it, expect } from "vitest";
import {
  isUuid,
  isValidLeadId,
  isValidScanSessionId,
  normalizeRouteId,
  UUID_RE,
} from "./routeIdGuards";

const VALID = "a1b2c3d4-e5f6-7a8b-9c0d-e1f2a3b4c5d6";

describe("normalizeRouteId", () => {
  it("returns null for null, undefined, empty, whitespace", () => {
    expect(normalizeRouteId(null)).toBeNull();
    expect(normalizeRouteId(undefined)).toBeNull();
    expect(normalizeRouteId("")).toBeNull();
    expect(normalizeRouteId("   ")).toBeNull();
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeRouteId("  abc  ")).toBe("abc");
  });

  it("preserves already-clean values", () => {
    expect(normalizeRouteId(VALID)).toBe(VALID);
  });
});

describe("UUID_RE", () => {
  it("matches canonical UUID shape", () => {
    expect(UUID_RE.test(VALID)).toBe(true);
  });

  it("rejects non-UUID strings", () => {
    expect(UUID_RE.test("not-a-uuid")).toBe(false);
  });
});

describe("isUuid / isValidScanSessionId / isValidLeadId", () => {
  const INVALID: Array<string | null | undefined> = [
    null,
    undefined,
    "",
    " ",
    "not-a-uuid",
    `${VALID}x`,
    VALID.slice(0, -1),
    `${VALID} ${VALID}`,
    `  ${VALID}`,
    `${VALID}  `,
    `  ${VALID}  `,
  ];

  for (const v of INVALID) {
    it(`rejects ${JSON.stringify(v)}`, () => {
      expect(isUuid(v)).toBe(false);
      expect(isValidScanSessionId(v)).toBe(false);
      expect(isValidLeadId(v)).toBe(false);
    });
  }

  it("accepts a canonical UUID", () => {
    expect(isUuid(VALID)).toBe(true);
    expect(isValidScanSessionId(VALID)).toBe(true);
    expect(isValidLeadId(VALID)).toBe(true);
  });

  it("accepts upper-case hex", () => {
    const upper = VALID.toUpperCase();
    expect(isUuid(upper)).toBe(true);
    expect(isValidScanSessionId(upper)).toBe(true);
    expect(isValidLeadId(upper)).toBe(true);
  });
});
