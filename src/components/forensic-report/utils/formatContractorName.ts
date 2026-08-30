const LEGAL_SUFFIXES = new Set([
  "co",
  "corp",
  "inc",
  "llc",
  "llp",
  "lp",
  "ltd",
  "pllc",
]);

function titleCaseToken(token: string): string {
  const lower = token.toLocaleLowerCase("en-US");
  if (LEGAL_SUFFIXES.has(lower)) return lower.toLocaleUpperCase("en-US");

  return lower.replace(/(^|[-'’])([a-z])/g, (_, separator: string, letter: string) =>
    `${separator}${letter.toLocaleUpperCase("en-US")}`,
  );
}

/**
 * Presentation-only cleanup for OCR-extracted contractor names.
 *
 * Mixed-case names are preserved so known brand styling such as BrightView,
 * iQ, or PGT is not damaged. Only uniformly lower/upper-case OCR output is
 * converted to title case. Blank values fail closed to null.
 */
export function formatContractorName(
  value: string | null | undefined,
  maxLength = 120,
): string | null {
  const normalized = value?.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const bounded = normalized.slice(0, maxLength);
  const letters = bounded.replace(/[^A-Za-z]/g, "");
  const isUniformLower = letters.length > 0 && letters === letters.toLocaleLowerCase("en-US");
  const isUniformUpper = letters.length > 0 && letters === letters.toLocaleUpperCase("en-US");

  if (!isUniformLower && !isUniformUpper) return bounded;

  return bounded
    .split(" ")
    .map(titleCaseToken)
    .join(" ");
}
