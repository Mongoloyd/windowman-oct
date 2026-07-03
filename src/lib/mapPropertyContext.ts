/**
 * Pure property/jurisdiction context mappers for lab full-mode display.
 * No React, no I/O, no inference from geography.
 */

export type PropertyContextSourceLabel =
  | "quote_visible"
  | "derived"
  | "benchmark_reference";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonNegativeFinite(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return null;
  }
  return value;
}

export function mapWindZoneFromHvhz(
  hvhzZone: boolean | null | undefined,
): { value: string; sourceLabel: "quote_visible" } | null {
  if (hvhzZone !== true) {
    return null;
  }

  return {
    value: "HVHZ (quote-stated)",
    sourceLabel: "quote_visible",
  };
}

export function mapOpeningMixFromDerivedMetrics(
  derivedMetrics: unknown,
): { windows: number; doors: number; sourceLabel: "derived" } | null {
  if (!isRecord(derivedMetrics)) {
    return null;
  }

  const counts = isRecord(derivedMetrics.counts) ? derivedMetrics.counts : null;
  if (!counts) {
    return null;
  }

  const rawWindows = readNonNegativeFinite(counts.window_openings);
  const rawDoors = readNonNegativeFinite(counts.door_openings);

  const windowsValid = rawWindows !== null && rawWindows > 0;
  const doorsValid = rawDoors !== null && rawDoors > 0;

  if (!windowsValid && !doorsValid) {
    return null;
  }

  return {
    windows: windowsValid ? rawWindows! : 0,
    doors: doorsValid ? rawDoors! : 0,
    sourceLabel: "derived",
  };
}
