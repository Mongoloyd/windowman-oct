import { describe, expect, it } from "vitest";
import { buildInternalIntelligenceViewModel } from "../adapter";
import { SYNTHETIC_INTELLIGENCE_DATASETS } from "../fixtures";

describe("intelligence console fixture contract", () => {
  it("creates 200 synthetic quotes with integer-cent monetary values", () => {
    const dataset = SYNTHETIC_INTELLIGENCE_DATASETS.HEALTHY;

    expect(dataset.quotes).toHaveLength(200);
    expect(dataset.projects).toHaveLength(80);
    expect(dataset.revisions.length).toBeGreaterThan(dataset.quotes.length);
    expect(
      dataset.revisions.every((revision) =>
        Number.isInteger(revision.quotedTotalCents),
      ),
    ).toBe(true);
    expect(
      dataset.outcomes.every(
        (outcome) =>
          outcome.acceptedContractTotalCents === null ||
          Number.isInteger(outcome.acceptedContractTotalCents),
      ),
    ).toBe(true);
  });

  it("keeps unknown and unverified outcomes separate from verified losses", () => {
    const viewModel = buildInternalIntelligenceViewModel(
      SYNTHETIC_INTELLIGENCE_DATASETS.HEALTHY,
    );
    const byState = new Map(
      viewModel.outcomes.map((outcome) => [outcome.state, outcome.count]),
    );

    expect(byState.get("VERIFIED_SOLD")).toBe(32);
    expect(byState.get("VERIFIED_NOT_SOLD")).toBe(16);
    expect(byState.get("REPORTED_SOLD_UNVERIFIED")).toBe(8);
    expect(byState.get("OUTCOME_UNKNOWN")).toBe(24);
    expect(viewModel.knownOutcomeCoverageBasisPoints).toBe(6_000);
  });

  it("produces exactly the same view model for the same fixture", () => {
    const dataset = SYNTHETIC_INTELLIGENCE_DATASETS.HEALTHY;

    expect(buildInternalIntelligenceViewModel(dataset)).toEqual(
      buildInternalIntelligenceViewModel(dataset),
    );
  });

  it("withholds the unpaired initial-to-accepted population delta", () => {
    const viewModel = buildInternalIntelligenceViewModel(
      SYNTHETIC_INTELLIGENCE_DATASETS.HEALTHY,
    );

    expect(viewModel.initialToAcceptedDeltaCents).toBeNull();
    expect(viewModel.initialToAcceptedDeltaBasisPoints).toBeNull();
    expect(viewModel.acceptedToFinalDeltaCents).toBe(0);
    expect(viewModel.acceptedToFinalDeltaBasisPoints).toBe(0);
  });

  it("withholds verified-purchase values when outcomes are unknown", () => {
    const viewModel = buildInternalIntelligenceViewModel(
      SYNTHETIC_INTELLIGENCE_DATASETS.NO_VERIFIED_OUTCOMES,
    );

    expect(viewModel.status).toBe("INSUFFICIENT_DATA");
    expect(viewModel.moneyStages[1].medianCents).toBeNull();
    expect(viewModel.moneyStages[2].medianCents).toBeNull();
    expect(viewModel.initialToAcceptedDeltaCents).toBeNull();
  });
});
