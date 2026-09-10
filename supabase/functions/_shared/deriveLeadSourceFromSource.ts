/**
 * Derive canonical leads.lead_source from the normalized capture source.
 * Server-side only — never trust client-provided lead_source.
 */

const SOURCE_TO_LEAD_SOURCE: Record<string, string> = {
  "truth-gate": "truth-gate",
  nextdoor: "nextdoor",
  "arbitrage-engine": "arbitrage-engine",
  "power-tool-demo": "power-tool-demo",
  "quote-education-demo": "quote-education-demo",
  "ai-demo": "ai-demo",
  direct_upload: "direct_upload",
  paid_upload: "paid_upload",
  facebook_lead_ads: "facebook_lead_ads",
};

/**
 * Maps a normalized `source` string to canonical `lead_source`.
 * Unknown/null/empty values fall back to the trimmed source or "direct".
 */
export function deriveLeadSourceFromSource(
  source: string | null | undefined,
): string {
  const normalized = typeof source === "string" ? source.trim() : "";
  if (!normalized) return "direct";
  return SOURCE_TO_LEAD_SOURCE[normalized] ?? normalized;
}
