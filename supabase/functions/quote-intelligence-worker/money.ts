/**
 * Deterministic visible-money → integer USD cents.
 * NULL remains distinct from 0. Does not treat missing as zero.
 */

const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

function normalizeFormattedDecimalString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const stripped = trimmed.replace(/[$,\s]/g, "");
  if (!stripped || stripped === "-" || stripped === "." || stripped === "-.") {
    return null;
  }
  if (/e/i.test(stripped)) return null;
  if (!/^[-.\d]+$/.test(stripped)) return null;
  if ((stripped.match(/-/g) ?? []).length > 1) return null;
  if (stripped.includes("-") && !stripped.startsWith("-")) return null;
  if ((stripped.match(/\./g) ?? []).length > 1) return null;
  if (!/\d/.test(stripped)) return null;
  return stripped;
}

function normalizeDecimalInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const asString = value.toString();
    if (/e/i.test(asString)) return null;
    return asString;
  }
  if (typeof value === "string") {
    return normalizeFormattedDecimalString(value);
  }
  return null;
}

function signedHalfUpDivide(
  numerator: bigint,
  denominator: bigint,
): bigint | null {
  if (denominator <= 0n) return null;
  const negative = numerator < 0n;
  const absNum = negative ? -numerator : numerator;
  const quotient = (absNum + denominator / 2n) / denominator;
  return negative ? -quotient : quotient;
}

function bigintToSafeInteger(value: bigint): number | null {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null;
  }
  return Number(value);
}

/** Visible document money → integer USD cents. Empty/missing → null, not 0. */
export function parseMoneyToCents(value: unknown): number | null {
  const decimal = normalizeDecimalInput(value);
  if (decimal === null) return null;
  const match = decimal.match(DECIMAL_PATTERN);
  if (!match) return null;
  const negative = match[1] === "-";
  const whole = match[2];
  const frac = match[3] ?? "";
  const den = 10n ** BigInt(frac.length);
  let dollarsNumerator = BigInt(whole) * den +
    (frac.length > 0 ? BigInt(frac) : 0n);
  if (negative) dollarsNumerator = -dollarsNumerator;
  const centsBig = frac.length > 0
    ? signedHalfUpDivide(dollarsNumerator * 100n, den)
    : dollarsNumerator * 100n;
  if (centsBig === null) return null;
  return bigintToSafeInteger(centsBig);
}

export function isExplicitZeroMoney(value: unknown): boolean {
  const cents = parseMoneyToCents(value);
  return cents === 0;
}
