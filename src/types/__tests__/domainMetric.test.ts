import { describe, expect, it } from "vitest";
import {
  canRenderMetricOnSurface,
  canRenderRegisteredMetric,
  isIntCents,
  makeDomainMetric,
  toIntCents,
  toSignedIntCents,
} from "../domainMetric";
import {
  METRIC_DICTIONARY,
  METRIC_IDS,
  metricIdsForSurface,
  type MetricId,
} from "../metrics.dictionary";

const FRESHNESS = "2026-08-31T12:00:00.000Z";

describe("canonical Oracle metric dictionary", () => {
  it("gives every metric exactly one owner surface and a self-matching id", () => {
    expect(METRIC_IDS.length).toBeGreaterThan(0);
    for (const id of METRIC_IDS) {
      const definition = METRIC_DICTIONARY[id];
      expect(definition.id).toBe(id);
      expect([
        "PUBLIC_ORACLE",
        "OBSERVATORY",
        "FOUNDATION",
        "COCKPIT",
        "DATALAB",
      ]).toContain(definition.ownerSurface);
    }
    const surfaces = [
      "PUBLIC_ORACLE",
      "OBSERVATORY",
      "FOUNDATION",
      "COCKPIT",
      "DATALAB",
    ] as const;
    const assignedIds = new Set(surfaces.flatMap((surface) => metricIdsForSurface(surface)));
    expect(assignedIds.size).toBe(METRIC_IDS.length);
  });

  it("marks legacy dollar metrics so they cannot masquerade as integer cents", () => {
    expect(METRIC_DICTIONARY["cockpit.ppo_median"].unit).toBe("USD_LEGACY");
    expect(METRIC_DICTIONARY["datalab.project_market_distribution"].unit).toBe(
      "USD_LEGACY",
    );
  });

  it("uses a signed cents unit only for the governed median difference", () => {
    expect(METRIC_DICTIONARY["public.quoted_accepted_gap"].unit).toBe(
      "SIGNED_INT_CENTS",
    );
  });

  it("freezes definitions and returned surface inventories", () => {
    expect(Object.isFrozen(METRIC_DICTIONARY)).toBe(true);
    expect(Object.isFrozen(METRIC_DICTIONARY["public.sample_size"])).toBe(true);
    expect(Object.isFrozen(metricIdsForSurface("PUBLIC_ORACLE"))).toBe(true);
  });

  it("keeps every definition internally actionable", () => {
    for (const id of METRIC_IDS) {
      const definition = METRIC_DICTIONARY[id];
      expect(definition.label.trim()).not.toBe("");
      expect(definition.calculation.trim()).not.toBe("");
      expect(definition.denominator.trim()).not.toBe("");
      expect(definition.sourceModule.trim()).not.toBe("");
      expect(Number.isSafeInteger(definition.minSampleSize)).toBe(true);
      expect(definition.minSampleSize).toBeGreaterThanOrEqual(1);
      if (definition.profileable) {
        expect(["UNBOUND", "CONFLICTED"]).not.toContain(definition.semanticStatus);
      }
    }
  });
});

describe("DomainMetric", () => {
  it("derives exposure and ownership from the dictionary", () => {
    const metric = makeDomainMetric("public.sample_size", 200, {
      provenance: "SYNTHETIC_INFERRED",
      sampleSize: 200,
      freshness: FRESHNESS,
    });
    expect(metric.metricId).toBe("public.sample_size");
    expect(metric.exposureLevel).toBe("PUBLIC");
    expect(metric.ownerSurface).toBe("PUBLIC_ORACLE");
  });

  it("suppresses immediately below the public threshold and clears at it", () => {
    const id = "public.sample_size";
    const min = METRIC_DICTIONARY[id].minSampleSize;
    expect(
      makeDomainMetric(id, min, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: min,
        freshness: FRESHNESS,
      }).suppressionState,
    ).toBe(false);
    expect(
      makeDomainMetric(id, min - 1, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: min - 1,
        freshness: FRESHNESS,
      }).suppressionReason,
    ).toBe("BELOW_MINIMUM_SAMPLE");
  });

  it("always suppresses unbound and conflicted semantics", () => {
    expect(
      makeDomainMetric("public.bid_position_middle", 51, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: 200,
        freshness: FRESHNESS,
      }).suppressionReason,
    ).toBe("UNBOUND_SEMANTICS");
    expect(
      makeDomainMetric("public.scope_completeness_bar", 74, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: 200,
        freshness: FRESHNESS,
      }).suppressionReason,
    ).toBe("CONFLICTED_SEMANTICS");
  });

  it("lets a forced suppression override an otherwise displayable metric", () => {
    expect(
      makeDomainMetric("public.sample_size", 200, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: 200,
        freshness: FRESHNESS,
        forceSuppressed: true,
      }).suppressionReason,
    ).toBe("FORCED");
  });

  it("rejects unknown metric ids at runtime", () => {
    expect(() =>
      makeDomainMetric("public.not_registered" as MetricId, 1, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: 1,
        freshness: FRESHNESS,
      }),
    ).toThrow(TypeError);
  });

  it("rejects values that do not match their registered unit", () => {
    expect(() =>
      makeDomainMetric("public.sample_size", 1.5, {
        provenance: "SYNTHETIC_INFERRED",
        sampleSize: 200,
        freshness: FRESHNESS,
      }),
    ).toThrow(/COUNT/);
    expect(() =>
      makeDomainMetric("public.outcome_coverage_pct", 101, {
        provenance: "QUALITY",
        sampleSize: 200,
        freshness: FRESHNESS,
      }),
    ).toThrow(/PERCENT/);
    expect(() =>
      makeDomainMetric("public.distribution_quoted", {
        lowCents: 200,
        p25Cents: 150,
        medianCents: 300,
        p75Cents: 400,
        highCents: 500,
        sampleSize: 200,
      }, {
        provenance: "QUOTED",
        sampleSize: 200,
        freshness: FRESHNESS,
      }),
    ).toThrow(/DISTRIBUTION/);
  });

  it("fails closed when DomainMetric metadata is forged", () => {
    const metric = makeDomainMetric("public.sample_size", 200, {
      provenance: "SYNTHETIC_INFERRED",
      sampleSize: 200,
      freshness: FRESHNESS,
    });
    const forged = { ...metric, exposureLevel: "INTERNAL" as const };
    expect(canRenderMetricOnSurface(forged, "PUBLIC_ORACLE")).toBe(false);
    expect(
      canRenderMetricOnSurface(
        { ...metric, suppressionReason: "FORCED" as const },
        "PUBLIC_ORACLE",
      ),
    ).toBe(false);
    expect(
      canRenderMetricOnSurface(
        { ...metric, freshness: "2026-08-31" },
        "PUBLIC_ORACLE",
      ),
    ).toBe(false);
  });

  it("copies and freezes structured metric values at the boundary", () => {
    const mutableRange = {
      from: "2026-01-01T00:00:00.000Z",
      to: "2026-08-31T00:00:00.000Z",
    };
    const metric = makeDomainMetric("public.date_range", mutableRange, {
      provenance: "QUALITY",
      sampleSize: 200,
      freshness: FRESHNESS,
    });

    mutableRange.to = "2027-01-01T00:00:00.000Z";
    expect(metric.value.to).toBe("2026-08-31T00:00:00.000Z");
    expect(Object.isFrozen(metric.value)).toBe(true);
  });

  it("guards legacy renderers with the same semantic and sample rules", () => {
    expect(
      canRenderRegisteredMetric(
        "insight.acceptance_by_price_position",
        "OBSERVATORY",
        200,
      ),
    ).toBe(true);
    expect(
      canRenderRegisteredMetric(
        "insight.initial_to_accepted_delta",
        "OBSERVATORY",
        200,
      ),
    ).toBe(false);
    expect(
      canRenderRegisteredMetric("cockpit.sample_count", "DATALAB", 20),
    ).toBe(false);
  });

  it("enforces public surface exposure at the render boundary", () => {
    const internal = makeDomainMetric("observatory.governed_estimates", 200, {
      provenance: "SYNTHETIC_INFERRED",
      sampleSize: 200,
      freshness: FRESHNESS,
    });
    expect(canRenderMetricOnSurface(internal, "PUBLIC_ORACLE")).toBe(false);
    expect(canRenderMetricOnSurface(internal, "OBSERVATORY")).toBe(true);
  });
});

describe("integer cents boundary", () => {
  it("accepts only non-negative safe integers for money amounts", () => {
    expect(isIntCents(1_234_500)).toBe(true);
    expect(isIntCents(1.2)).toBe(false);
    expect(isIntCents(-1)).toBe(false);
    expect(toIntCents(1_234_500)).toBe(1_234_500);
    expect(() => toIntCents(1.25)).toThrow(TypeError);
    expect(toSignedIntCents(-500)).toBe(-500);
  });
});
