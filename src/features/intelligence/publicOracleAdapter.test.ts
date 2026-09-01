import { describe, expect, it } from "vitest";
import { PUBLIC_ORACLE_FIXTURE } from "./fixtures";
import { transformSnapshotToPublicOracle } from "./publicOracleAdapter";

describe("transformSnapshotToPublicOracle", () => {
  it("is deterministic and preserves integer-cent market values", () => {
    const first = transformSnapshotToPublicOracle(PUBLIC_ORACLE_FIXTURE);
    const second = transformSnapshotToPublicOracle(PUBLIC_ORACLE_FIXTURE);
    expect(first).toEqual(second);
    expect(first.prices.quotedMedianCents.value).toBe(2_390_000);
    expect(first.prices.acceptedMedianCents.value).toBe(2_140_000);
    expect(first.prices.quotedAcceptedGapCents.value).toBe(250_000);
    expect(Number.isInteger(first.prices.quotedMedianCents.value)).toBe(true);
  });

  it("carries metric identity, public exposure, provenance, and sample size", () => {
    const viewModel = transformSnapshotToPublicOracle(PUBLIC_ORACLE_FIXTURE);
    expect(viewModel.prices.quotedMedianCents).toMatchObject({
      metricId: "public.quoted_median",
      exposureLevel: "PUBLIC",
      ownerSurface: "PUBLIC_ORACLE",
      provenance: "QUOTED",
      sampleSize: 200,
      suppressionState: false,
    });
    expect(viewModel.prices.acceptedMedianCents).toMatchObject({
      provenance: "VERIFIED_ACCEPTED",
      sampleSize: 68,
      suppressionState: false,
    });
  });

  it("suppresses a thin public cohort", () => {
    const thin = {
      ...PUBLIC_ORACLE_FIXTURE,
      evidence: {
        ...PUBLIC_ORACLE_FIXTURE.evidence,
        governedQuoteCount: 29,
        outcomeKnownCount: 20,
        verifiedAcceptedCount: 18,
        verifiedFinalCount: 10,
        outcomeCoveragePct: 69,
        exactMatchCount: 29,
      },
      quoted: { ...PUBLIC_ORACLE_FIXTURE.quoted, sampleSize: 29 },
      verifiedAccepted: {
        ...PUBLIC_ORACLE_FIXTURE.verifiedAccepted,
        sampleSize: 18,
      },
    };
    const viewModel = transformSnapshotToPublicOracle(thin);
    expect(viewModel.prices.quotedMedianCents.suppressionReason).toBe(
      "BELOW_MINIMUM_SAMPLE",
    );
  });

  it("does not expose individual synthetic scenario prices in the public view model", () => {
    const viewModel = transformSnapshotToPublicOracle(PUBLIC_ORACLE_FIXTURE);
    const serialized = JSON.stringify(viewModel);
    expect(serialized).not.toContain("quotedRangeCents");
    expect(serialized).not.toContain("acceptedCents");
    expect(serialized).not.toContain("contractor");
    expect(viewModel).not.toHaveProperty("buyerPatterns");
    expect(viewModel).not.toHaveProperty("geographyLabel");
    expect(viewModel).not.toHaveProperty("cohortLabel");
    expect(viewModel).not.toHaveProperty("sourceLabel");
  });

  it("rejects a source-mode mismatch instead of relabeling it synthetic", () => {
    expect(() =>
      transformSnapshotToPublicOracle({
        ...PUBLIC_ORACLE_FIXTURE,
        dataSource: "LIVE_AGGREGATE",
      }),
    ).toThrow(/synthetic preview data only/);
  });

  it("rejects irreconcilable evidence counts", () => {
    expect(() =>
      transformSnapshotToPublicOracle({
        ...PUBLIC_ORACLE_FIXTURE,
        evidence: {
          ...PUBLIC_ORACLE_FIXTURE.evidence,
          outcomeCoveragePct: 42,
        },
      }),
    ).toThrow(/does not reconcile/);
    expect(() =>
      transformSnapshotToPublicOracle({
        ...PUBLIC_ORACLE_FIXTURE,
        verifiedAccepted: {
          ...PUBLIC_ORACLE_FIXTURE.verifiedAccepted,
          sampleSize: 67,
        },
      }),
    ).toThrow(/does not match verified accepted count/);
  });

  it("rejects an unordered price distribution", () => {
    expect(() =>
      transformSnapshotToPublicOracle({
        ...PUBLIC_ORACLE_FIXTURE,
        quoted: {
          ...PUBLIC_ORACLE_FIXTURE.quoted,
          p25Cents: PUBLIC_ORACLE_FIXTURE.quoted.medianCents + 1,
        },
      }),
    ).toThrow(/monotonically ordered/);
  });
});
