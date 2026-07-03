import { describe, expect, it } from "vitest";
import {
  mapOpeningMixFromDerivedMetrics,
  mapWindZoneFromHvhz,
} from "./mapPropertyContext";

describe("mapWindZoneFromHvhz", () => {
  it("returns quote-stated HVHZ when hvhz is true", () => {
    expect(mapWindZoneFromHvhz(true)).toEqual({
      value: "HVHZ (quote-stated)",
      sourceLabel: "quote_visible",
    });
  });

  it("returns null when hvhz is false", () => {
    expect(mapWindZoneFromHvhz(false)).toBeNull();
  });

  it("returns null when hvhz is null", () => {
    expect(mapWindZoneFromHvhz(null)).toBeNull();
  });

  it("returns null when hvhz is undefined", () => {
    expect(mapWindZoneFromHvhz(undefined)).toBeNull();
  });
});

describe("mapOpeningMixFromDerivedMetrics", () => {
  it("returns windows and doors from derived_metrics.counts", () => {
    expect(
      mapOpeningMixFromDerivedMetrics({
        counts: { window_openings: 12, door_openings: 2 },
      }),
    ).toEqual({
      windows: 12,
      doors: 2,
      sourceLabel: "derived",
    });
  });

  it("tolerates one valid side when the other is missing", () => {
    expect(
      mapOpeningMixFromDerivedMetrics({
        counts: { window_openings: 8 },
      }),
    ).toEqual({
      windows: 8,
      doors: 0,
      sourceLabel: "derived",
    });

    expect(
      mapOpeningMixFromDerivedMetrics({
        counts: { door_openings: 3 },
      }),
    ).toEqual({
      windows: 0,
      doors: 3,
      sourceLabel: "derived",
    });
  });

  it("returns null when both sides are missing", () => {
    expect(mapOpeningMixFromDerivedMetrics({ counts: {} })).toBeNull();
    expect(mapOpeningMixFromDerivedMetrics({})).toBeNull();
  });

  it("returns null when both sides are zero", () => {
    expect(
      mapOpeningMixFromDerivedMetrics({
        counts: { window_openings: 0, door_openings: 0 },
      }),
    ).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(mapOpeningMixFromDerivedMetrics(null)).toBeNull();
    expect(mapOpeningMixFromDerivedMetrics(undefined)).toBeNull();
    expect(mapOpeningMixFromDerivedMetrics("bad")).toBeNull();
    expect(
      mapOpeningMixFromDerivedMetrics({
        counts: { window_openings: "12", door_openings: NaN },
      }),
    ).toBeNull();
  });

  it("does not throw for null/undefined", () => {
    expect(() => mapOpeningMixFromDerivedMetrics(null)).not.toThrow();
    expect(() => mapOpeningMixFromDerivedMetrics(undefined)).not.toThrow();
  });
});
