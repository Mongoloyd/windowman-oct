import type { JsonRecord } from "./reportAccessAdapter.types";

const NUMERIC_STRING_RE = /^-?\d+(\.\d+)?$/;
const RANGE_PATTERN_RE = /(\d[\d,.$\s]*\s*[-–—]\s*\d)|(\d[\d,.$\s]*\s+to\s+\d)/i;

export function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Preserves empty string for tri-state text-field mapping (null vs ""). */
export function asTrimmedStringField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.trim();
}

export function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("%")) return null;
  if (RANGE_PATTERN_RE.test(trimmed)) return null;

  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (!NUMERIC_STRING_RE.test(cleaned)) return null;

  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function asBooleanOrNull(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function getRecord(
  record: JsonRecord | null | undefined,
  key: string,
): JsonRecord | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}
