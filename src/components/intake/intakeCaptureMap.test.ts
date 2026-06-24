import { describe, it, expect } from "vitest";
import {
  mapBucketToHasEstimate,
  mapThreatToDealBreaker,
  mapProjectSizeToScope,
  mapTimelineToTimeframe,
  mapCallIntent,
  safeArbError,
  CAPTURE_SESSION_ERROR_CODES,
} from "./intakeCaptureMap";
import type {
  BackendDealBreaker,
  BackendScope,
  MappedBackendDealBreaker,
  MappedBackendScope,
} from "./intakeCaptureMap";
import type {
  IntakeBucket,
  ThreatConcern,
  ProjectSize,
  Timeline,
  CallIntentChoice,
} from "./intakeTypes";

/**
 * The intake mapper and the backend speak two DIFFERENT enum spaces:
 *
 *   - Backend-accepted: every value `capture-arbitrage-lead` will accept.
 *   - Mapper-reachable: the subset the CURRENT intake vocabulary can emit.
 *
 * These arrays pin down the backend contract (compile-checked via `satisfies`)
 * so tests can prove that mapper output is BOTH a valid backend value AND a
 * member of the narrower reachable set — without pretending the mapper can
 * produce backend values it never will (e.g. "Timing", "11-15").
 */
const BACKEND_DEAL_BREAKERS = [
  "Price",
  "Company Reputation",
  "Timing",
  "Financing",
  "Other",
] as const satisfies readonly BackendDealBreaker[];

const BACKEND_SCOPES = [
  "1-5",
  "6-10",
  "11-15",
  "15+",
] as const satisfies readonly BackendScope[];

// What the current intake vocabulary can actually emit.
const REACHABLE_DEAL_BREAKERS = [
  "Price",
  "Company Reputation",
  "Financing",
  "Other",
] as const satisfies readonly MappedBackendDealBreaker[];

const REACHABLE_SCOPES = ["1-5", "6-10", "15+"] as const satisfies readonly MappedBackendScope[];

const ALL_THREATS: ThreatConcern[] = [
  "overpaying",
  "wrong_contractor",
  "missing_scope_or_permits",
  "financing_or_payment",
  "not_sure",
];

const ALL_PROJECT_SIZES: ProjectSize[] = [
  "1-5",
  "6-10",
  "11-20",
  "whole_house_or_not_sure",
];

describe("mapBucketToHasEstimate", () => {
  it("treats quote-in-hand buckets as having an estimate", () => {
    expect(mapBucketToHasEstimate("quote_ready")).toBe("Yes");
    expect(mapBucketToHasEstimate("quote_not_handy")).toBe("Yes");
  });

  it("treats no-quote buckets as not having an estimate", () => {
    expect(mapBucketToHasEstimate("no_quote_yet")).toBe("No");
    expect(mapBucketToHasEstimate("researching")).toBe("No");
  });

  it("returns one of the exact backend enum values for every bucket", () => {
    const buckets: IntakeBucket[] = [
      "quote_ready",
      "quote_not_handy",
      "no_quote_yet",
      "researching",
    ];
    for (const b of buckets) {
      expect(["Yes", "No"]).toContain(mapBucketToHasEstimate(b));
    }
  });
});

describe("mapThreatToDealBreaker", () => {
  // 1. Exact input → output table.
  it.each([
    ["overpaying", "Price"],
    ["wrong_contractor", "Company Reputation"],
    ["financing_or_payment", "Financing"],
    ["missing_scope_or_permits", "Other"],
    ["not_sure", "Other"],
  ] as const)("maps %s → %s", (threat, expected) => {
    expect(mapThreatToDealBreaker(threat)).toBe(expected);
  });

  // 2. Reachable output set equals the mapped subset — and excludes "Timing".
  it("reachable output set is exactly the mapped subset (no Timing)", () => {
    const reachable = new Set(ALL_THREATS.map(mapThreatToDealBreaker));
    expect([...reachable].sort()).toEqual([...REACHABLE_DEAL_BREAKERS].sort());
    expect(reachable.has("Timing" as MappedBackendDealBreaker)).toBe(false);
  });

  // 3. Backend compatibility: every reachable output is a valid backend value,
  //    but the backend accepts strictly more than the mapper emits.
  it("every reachable output is a valid backend deal-breaker", () => {
    for (const t of ALL_THREATS) {
      expect(BACKEND_DEAL_BREAKERS).toContain(mapThreatToDealBreaker(t));
    }
  });

  it("backend accepts more deal-breakers than the intake mapper emits", () => {
    const reachable = new Set<string>(ALL_THREATS.map(mapThreatToDealBreaker));
    const backendOnly = BACKEND_DEAL_BREAKERS.filter((v) => !reachable.has(v));
    expect(backendOnly).toEqual(["Timing"]);
  });
});

describe("mapProjectSizeToScope", () => {
  // 1. Exact input → output table.
  it.each([
    ["1-5", "1-5"],
    ["6-10", "6-10"],
    ["11-20", "15+"],
    ["whole_house_or_not_sure", "15+"],
  ] as const)("maps %s → %s", (size, expected) => {
    expect(mapProjectSizeToScope(size)).toBe(expected);
  });

  // 2. Reachable output set equals the mapped subset — and excludes "11-15".
  it("reachable output set is exactly the mapped subset (no 11-15)", () => {
    const reachable = new Set(ALL_PROJECT_SIZES.map(mapProjectSizeToScope));
    expect([...reachable].sort()).toEqual([...REACHABLE_SCOPES].sort());
    expect(reachable.has("11-15" as MappedBackendScope)).toBe(false);
  });

  // 3. Backend compatibility: every reachable output is a valid backend value,
  //    but the backend accepts strictly more than the mapper emits.
  it("every reachable output is a valid backend scope", () => {
    for (const s of ALL_PROJECT_SIZES) {
      expect(BACKEND_SCOPES).toContain(mapProjectSizeToScope(s));
    }
  });

  it("backend accepts more scope bands than the intake mapper emits", () => {
    const reachable = new Set<string>(ALL_PROJECT_SIZES.map(mapProjectSizeToScope));
    const backendOnly = BACKEND_SCOPES.filter((v) => !reachable.has(v));
    expect(backendOnly).toEqual(["11-15"]);
  });
});

describe("mapTimelineToTimeframe", () => {
  it("collapses near-term timelines into the 1 Month band", () => {
    expect(mapTimelineToTimeframe("this_week")).toBe("1 Month");
    expect(mapTimelineToTimeframe("this_month")).toBe("1 Month");
  });

  it("maps mid- and research-stage timelines to their bands", () => {
    expect(mapTimelineToTimeframe("2-3_months")).toBe("2-3 Months");
    expect(mapTimelineToTimeframe("just_researching")).toBe("Just Researching");
  });

  it("only ever returns supported backend timeframe values", () => {
    const allowed = ["1 Month", "2-3 Months", "Just Researching"];
    const timelines: Timeline[] = [
      "this_week",
      "this_month",
      "2-3_months",
      "just_researching",
    ];
    for (const t of timelines) {
      expect(allowed).toContain(mapTimelineToTimeframe(t));
    }
  });
});

describe("mapCallIntent", () => {
  it("maps yes/no choices to backend Yes/No", () => {
    expect(mapCallIntent("yes")).toBe("Yes");
    expect(mapCallIntent("no")).toBe("No");
  });

  it("only ever returns supported backend call-intent values", () => {
    const choices: CallIntentChoice[] = ["yes", "no"];
    for (const c of choices) {
      expect(["Yes", "No"]).toContain(mapCallIntent(c));
    }
  });
});

describe("safeArbError", () => {
  it("returns user-safe copy for known backend codes", () => {
    expect(safeArbError("invalid_zip")).toBe("Please enter a valid 5-digit ZIP code.");
    expect(safeArbError("invalid_email")).toBe("Please enter a valid email address.");
    expect(safeArbError("consent_required")).toBe(
      "Please agree to be contacted to continue.",
    );
  });

  it("falls back to a generic message for unknown codes", () => {
    expect(safeArbError("some_unmapped_code")).toBe(
      "Something went wrong. Please try again.",
    );
  });
});

describe("CAPTURE_SESSION_ERROR_CODES", () => {
  it("includes the token/session invalidation codes", () => {
    expect(CAPTURE_SESSION_ERROR_CODES.has("capture_token_required")).toBe(true);
    expect(CAPTURE_SESSION_ERROR_CODES.has("invalid_capture_token")).toBe(true);
    expect(CAPTURE_SESSION_ERROR_CODES.has("capture_token_expired")).toBe(true);
    expect(CAPTURE_SESSION_ERROR_CODES.has("invalid_funnel_stage")).toBe(true);
  });

  it("does not flag a normal field-validation code as a session failure", () => {
    expect(CAPTURE_SESSION_ERROR_CODES.has("invalid_zip")).toBe(false);
  });
});
