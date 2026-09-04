import { describe, expect, it } from "vitest";
import type { CapiDiagnosticCode, CapiDiagnostics, SignalEventRow } from "@/services/signalDispatch";
import {
  CAPI_DIAGNOSTIC_DEFINITIONS,
  aggregateCapiIntelligence,
  buildCopySafeDiagnostic,
  buildHumanGatedRecommendation,
  calculateEmqScore,
  getRemediationPlaybook,
  platformOutcomeLabel,
  selectCapiRows,
} from "@/utils/capiScoring";

const EMPTY_KEYS: SignalEventRow["matchKeys"] = {
  emailHash: false,
  phoneHash: false,
  fbc: false,
  fbp: false,
  gclid: false,
  externalId: false,
  leadId: false,
  clientIpPresent: false,
  clientUserAgentPresent: false,
};

function matchKeys(overrides: Partial<SignalEventRow["matchKeys"]> = {}): SignalEventRow["matchKeys"] {
  return { ...EMPTY_KEYS, ...overrides };
}

function diagnostics(
  reasonCodes: CapiDiagnosticCode[] = [],
  overrides: Partial<CapiDiagnostics> = {},
): CapiDiagnostics {
  return {
    scorable: true,
    reasonCodes,
    match: {
      emailHash: "missing",
      phoneHash: "missing",
      clientIp: "missing",
      clientUserAgent: "missing",
      fbp: "missing",
      fbc: "missing",
      externalId: "missing",
    },
    dispatch: {
      envelope: "valid",
      eventTimeFormat: "valid",
      eventTimeDrift: "valid",
      eventId: "valid",
      eventName: "valid",
      actionSource: "valid",
    },
    ...overrides,
  };
}

function makeRow(index: number, codes: CapiDiagnosticCode[] = [], overrides: Partial<SignalEventRow> = {}): SignalEventRow {
  return {
    id: `capi:${index}`,
    sourceTable: "capi_signal_logs",
    timestamp: new Date(Date.UTC(2026, 8, 3, 12, 0, index)).toISOString(),
    platform: "Meta CAPI",
    eventType: "Lead",
    leadId: null,
    sourceCampaign: null,
    eventId: null,
    dedupKey: null,
    matchKeys: matchKeys(),
    capiDiagnostics: diagnostics(codes),
    httpStatus: 200,
    status: "success",
    retryStatus: "Complete",
    payloadHash: null,
    payloadVersion: null,
    payloadSize: null,
    responseCode: null,
    errorMessage: null,
    responseExcerpt: null,
    related: {},
    ...overrides,
  };
}

describe("calculateEmqScore", () => {
  it("returns exactly 10 with an exact earned/available ledger", () => {
    const keys = matchKeys({
      emailHash: true,
      phoneHash: true,
      clientIpPresent: true,
      clientUserAgentPresent: true,
      fbp: true,
      fbc: true,
      externalId: true,
    });
    const result = calculateEmqScore(keys, diagnostics([], {
      match: {
        emailHash: "valid",
        phoneHash: "valid",
        clientIp: "valid",
        clientUserAgent: "valid",
        fbp: "valid",
        fbc: "valid",
        externalId: "valid",
      },
    }));

    expect(result.score).toBe(10);
    expect(result.max).toBe(10);
    expect(result.ledger.map(({ label, availablePoints, earnedPoints }) => ({ label, availablePoints, earnedPoints }))).toEqual([
      { label: "Email hash", availablePoints: 2, earnedPoints: 2 },
      { label: "Phone hash", availablePoints: 2, earnedPoints: 2 },
      { label: "Valid client IP", availablePoints: 1, earnedPoints: 1 },
      { label: "Client user agent", availablePoints: 1, earnedPoints: 1 },
      { label: "Valid raw fbp", availablePoints: 1, earnedPoints: 1 },
      { label: "Valid raw fbc", availablePoints: 1, earnedPoints: 1 },
      { label: "External ID hash", availablePoints: 2, earnedPoints: 2 },
    ]);
  });

  it("distinguishes zero known-ready factors from an unscorable envelope", () => {
    const zero = calculateEmqScore(matchKeys(), diagnostics());
    const unscorable = calculateEmqScore(matchKeys(), diagnostics(["CAPI_DATA_EMPTY"], { scorable: false }));

    expect(zero).toMatchObject({ score: 0, scorable: true });
    expect(unscorable).toMatchObject({ score: null, scorable: false });
  });

  it("scores partial combinations and keeps external ID at two points", () => {
    expect(calculateEmqScore(matchKeys({ emailHash: true, fbp: true, clientUserAgentPresent: true })).score).toBe(4);
    expect(calculateEmqScore(matchKeys({ externalId: true })).score).toBe(2);
  });

  it.each([
    ["hashed fbp", { fbp: "hashed" as const }, { fbp: false }],
    ["malformed fbp", { fbp: "malformed" as const }, { fbp: false }],
    ["hashed fbc", { fbc: "hashed" as const }, { fbc: false }],
    ["malformed fbc", { fbc: "malformed" as const }, { fbc: false }],
  ])("awards zero for %s", (_label, matchOverride, keyOverride) => {
    const diagnostic = diagnostics([], { match: { ...diagnostics().match, ...matchOverride } });
    const result = calculateEmqScore(matchKeys(keyOverride), diagnostic);
    expect(result.score).toBe(0);
    expect(result.ledger.find((entry) => entry.key === ("fbp" in matchOverride ? "fbp" : "fbc"))?.earnedPoints).toBe(0);
  });

  it("treats missing fbc as an informational zero-point opportunity", () => {
    const result = calculateEmqScore(matchKeys(), diagnostics(["CAPI_FBC_MISSING"]));
    expect(result.score).toBe(0);
    expect(result.ledger.find((entry) => entry.key === "fbc")?.statusLabel).toMatch(/informational/i);
    expect(CAPI_DIAGNOSTIC_DEFINITIONS.CAPI_FBC_MISSING.severity).toBe("info");
  });

  it("does not change score for dispatch, HTTP, gclid, or leadId evidence", () => {
    const keys = matchKeys({ gclid: true, leadId: true });
    const result = calculateEmqScore(keys, diagnostics(["CAPI_TIME_WRONG_UNIT", "CAPI_EVENT_ID_MISSING"]));
    expect(result.score).toBe(0);
    expect(platformOutcomeLabel(400)).toMatch(/rejected at HTTP layer/i);
  });
});

describe("aggregateCapiIntelligence", () => {
  it("excludes non-CAPI rows, ignores hostile primitives, and does not mutate input", () => {
    const older = makeRow(1);
    const newer = makeRow(2);
    const nonCapi = makeRow(3, [], { id: "conversion:3", sourceTable: "conversion_logs" });
    const hostile = [older, null, "bad", 4, nonCapi, newer] as unknown as SignalEventRow[];
    const original = [...hostile];

    const selected = selectCapiRows(hostile);
    const summary = aggregateCapiIntelligence(hostile);

    expect(selected.map((row) => row.id)).toEqual(["capi:2", "capi:1"]);
    expect(summary.sampleSize).toBe(2);
    expect(hostile).toEqual(original);
  });

  it("analyzes the full fetched CAPI sample rather than only the latest 20", () => {
    const rows = Array.from({ length: 25 }, (_, index) => makeRow(index, ["CAPI_EVENT_ID_MISSING"]));
    const summary = aggregateCapiIntelligence(rows);
    expect(summary.sampleSize).toBe(25);
    expect(summary.frequencies[0]).toMatchObject({ code: "CAPI_EVENT_ID_MISSING", count: 25, denominator: 25, percentage: 100 });
  });

  it("counts a reason once per row and rounds percentages deterministically", () => {
    const duplicated = makeRow(3, ["CAPI_FBP_HASHED", "CAPI_FBP_HASHED"]);
    const summary = aggregateCapiIntelligence([duplicated, makeRow(2), makeRow(1)]);
    expect(summary.frequencies.find((item) => item.code === "CAPI_FBP_HASHED")).toMatchObject({ count: 1, denominator: 3, percentage: 33.3 });
  });

  it("reports event-type denominators from sanitized eventType values", () => {
    const summary = aggregateCapiIntelligence([
      makeRow(3, ["CAPI_FBP_HASHED"], { eventType: "Lead" }),
      makeRow(2, [], { eventType: "Lead" }),
      makeRow(1, [], { eventType: "Purchase" }),
    ]);
    expect(summary.frequencies[0].eventTypes).toEqual([{ eventType: "Lead", count: 1, denominator: 2, percentage: 50 }]);
  });

  it("calculates a seven-event current streak and independent overlapping streaks", () => {
    const rows = Array.from({ length: 7 }, (_, index) => makeRow(index + 1, ["CAPI_FBP_HASHED", ...(index >= 4 ? ["CAPI_TIME_WRONG_UNIT" as const] : [])]));
    const summary = aggregateCapiIntelligence(rows);
    expect(summary.currentStreaks).toContainEqual({ code: "CAPI_FBP_HASHED", count: 7 });
    expect(summary.currentStreaks).toContainEqual({ code: "CAPI_TIME_WRONG_UNIT", count: 3 });
  });

  it("does not call a historical cluster a current streak", () => {
    const summary = aggregateCapiIntelligence([
      makeRow(3),
      makeRow(2, ["CAPI_FBP_HASHED"]),
      makeRow(1, ["CAPI_FBP_HASHED"]),
    ]);
    expect(summary.currentStreaks).toEqual([]);
  });

  it("detects recovery after five healthy newest rows and an immediately older failure", () => {
    const rows = [
      makeRow(6), makeRow(5), makeRow(4), makeRow(3), makeRow(2),
      makeRow(1, ["CAPI_TIME_WRONG_UNIT"]),
    ];
    expect(aggregateCapiIntelligence(rows).recovery).toEqual({
      recovered: true,
      healthyRunLength: 5,
      previousFailureCodes: ["CAPI_TIME_WRONG_UNIT"],
    });
    expect(aggregateCapiIntelligence(rows.slice(0, 5)).recovery.recovered).toBe(false);
  });

  it("keeps informational missing fbc health-neutral for recovery", () => {
    const rows = [
      makeRow(6, ["CAPI_FBC_MISSING"]), makeRow(5), makeRow(4), makeRow(3), makeRow(2),
      makeRow(1, ["CAPI_FBP_HASHED"]),
    ];
    const summary = aggregateCapiIntelligence(rows);
    expect(summary.recovery.recovered).toBe(true);
    expect(summary.integrityHealthyCount).toBe(5);
  });

  it("does not label informational observations as current failure streaks", () => {
    const summary = aggregateCapiIntelligence([
      makeRow(3, ["CAPI_FBC_MISSING"]),
      makeRow(2, ["CAPI_FBC_MISSING"]),
      makeRow(1, ["CAPI_FBC_MISSING"]),
    ]);

    expect(summary.currentStreaks).toEqual([]);
  });

  it("counts actionable rows separately and excludes informational codes from dominance", () => {
    const summary = aggregateCapiIntelligence([
      makeRow(3, ["CAPI_FBC_MISSING"]),
      makeRow(2, ["CAPI_FBP_HASHED", "CAPI_TIME_WRONG_UNIT"]),
      makeRow(1, ["CAPI_FBP_HASHED"]),
    ]);
    expect(summary.actionableIssueCount).toBe(2);
    expect(summary.dominantIssue).toBe("CAPI_FBP_HASHED");
  });

  it("uses severity and then lexical reason code for deterministic dominant ties", () => {
    const severityTie = aggregateCapiIntelligence([
      makeRow(2, ["CAPI_FBP_HASHED"]),
      makeRow(1, ["CAPI_TIME_WRONG_UNIT"]),
    ]);
    const lexicalTie = aggregateCapiIntelligence([
      makeRow(2, ["CAPI_PHONE_MALFORMED"]),
      makeRow(1, ["CAPI_FBP_HASHED"]),
    ]);
    expect(severityTie.dominantIssue).toBe("CAPI_TIME_WRONG_UNIT");
    expect(lexicalTie.dominantIssue).toBe("CAPI_FBP_HASHED");
  });

  it("returns stable empty behavior and an anonymous count-only fingerprint", () => {
    expect(aggregateCapiIntelligence([])).toMatchObject({ sampleSize: 0, dominantIssue: null, fingerprint: "N=0" });
    const first = aggregateCapiIntelligence([makeRow(1, ["CAPI_FBP_HASHED"], { eventId: "raw-event-sentinel" })]);
    const second = aggregateCapiIntelligence([makeRow(1, ["CAPI_FBP_HASHED"], { eventId: "different-event-sentinel" })]);
    const changed = aggregateCapiIntelligence([makeRow(1, ["CAPI_TIME_WRONG_UNIT"])]);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprint).not.toBe(changed.fingerprint);
    expect(first.fingerprint).not.toContain("sentinel");
  });
});

describe("playbook and human-gated output", () => {
  it("separates observed evidence from an inferred likely cause", () => {
    const entry = getRemediationPlaybook("CAPI_FBP_HASHED");
    expect(entry?.observed).toMatch(/SHA-256/i);
    expect(entry?.likelyCause).toMatch(/may/i);
    expect(entry?.protectedSystemTrigger).toBe(true);
  });

  it("marks every diagnostic remediation as protected measurement territory", () => {
    expect(Object.values(CAPI_DIAGNOSTIC_DEFINITIONS).every((definition) => definition.protectedSystemTrigger)).toBe(true);
  });

  it("builds a recommendation with sample coverage, verification, and no implementation authority", () => {
    const summary = aggregateCapiIntelligence([makeRow(1, ["CAPI_FBP_HASHED"])]);
    const brief = buildHumanGatedRecommendation(summary);
    expect(brief).toContain("SAMPLE / COVERAGE:");
    expect(brief).toContain("PROTECTED SYSTEM TRIGGER: YES");
    expect(brief).toContain("VERIFICATION:");
    expect(brief).toMatch(/grants no implementation authority/i);
  });

  it("copies only schema, counts, rates, streak, recovery, confidence, and protected trigger", () => {
    const summary = aggregateCapiIntelligence([makeRow(1, ["CAPI_FBP_HASHED"], {
      id: "row-secret",
      eventId: "event-secret",
      leadId: "lead-secret",
      sourceCampaign: "campaign-secret",
      responseExcerpt: "response-secret",
    })]);
    const copied = buildCopySafeDiagnostic(summary);
    expect(copied).toContain("CAPI_FBP_HASHED");
    for (const sentinel of ["row-secret", "event-secret", "lead-secret", "campaign-secret", "response-secret"]) {
      expect(copied).not.toContain(sentinel);
    }
  });
});
