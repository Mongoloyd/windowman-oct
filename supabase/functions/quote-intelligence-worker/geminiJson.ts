/**
 * Worker-local Gemini JSON fence strip. Intentionally duplicated so this
 * function never imports scan-quote or `_shared`.
 */
export interface GeminiJsonNormalizationResult {
  normalizedText: string;
}

export function normalizeGeminiJsonText(
  rawText: string,
): GeminiJsonNormalizationResult {
  const trimmed = rawText.trim();
  let normalized = trimmed;
  const completeFence = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (completeFence) {
    normalized = completeFence[1].trim();
  } else if (trimmed.startsWith("```")) {
    const openFence = trimmed.match(/^```[^\n]*\n([\s\S]*)$/);
    if (openFence) {
      normalized = openFence[1].trim();
    } else {
      normalized = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").trim();
    }
    if (/\n?```\s*$/.test(normalized)) {
      normalized = normalized.replace(/\n?```\s*$/, "").trim();
    }
  }
  const bareLang = normalized.match(/^(?:json|JSON)\s*\n?\s*(\{[\s\S]*)$/);
  if (bareLang) normalized = bareLang[1].trim();
  return { normalizedText: normalized.trim() };
}
