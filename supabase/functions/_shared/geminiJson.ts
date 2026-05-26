/**
 * _shared/geminiJson.ts
 *
 * Pure helpers for normalizing Gemini text responses into JSON-parseable strings.
 * Shared by scan-quote and the local diagnostic harness.
 *
 * ⚠️  No I/O, no logging, no quote repair. Does not invent missing braces.
 */

export interface GeminiJsonNormalizationFlags {
  startsWithMarkdownFence: boolean;
  containsMarkdownFence: boolean;
  strippedMarkdownFence: boolean;
  startsWithBraceAfterNormalization: boolean;
  endsWithBraceAfterNormalization: boolean;
  rawLength: number;
  normalizedLength: number;
}

export interface GeminiJsonNormalizationResult {
  normalizedText: string;
  flags: GeminiJsonNormalizationFlags;
}

/**
 * Normalize Gemini candidate text before JSON.parse.
 * Handles markdown fences and bare language tags; never repairs truncated JSON.
 */
export function normalizeGeminiJsonText(rawText: string): GeminiJsonNormalizationResult {
  const trimmed = rawText.trim();
  const startsWithMarkdownFence = trimmed.startsWith("```");
  const containsMarkdownFence = trimmed.includes("```");

  let normalized = trimmed;
  let strippedMarkdownFence = false;

  // Complete fenced block: ```lang\n...\n```
  const completeFence = trimmed.match(/^```[^\n]*\n([\s\S]*?)\n?```\s*$/);
  if (completeFence) {
    normalized = completeFence[1].trim();
    strippedMarkdownFence = true;
  } else if (trimmed.startsWith("```")) {
    // Opening fence without closing fence (common when MAX_TOKENS truncates)
    const openFence = trimmed.match(/^```[^\n]*\n([\s\S]*)$/);
    if (openFence) {
      normalized = openFence[1].trim();
      strippedMarkdownFence = true;
    } else {
      normalized = trimmed.replace(/^```[a-zA-Z0-9_-]*\s*\n?/, "").trim();
      if (normalized !== trimmed) strippedMarkdownFence = true;
    }
    // Strip trailing fence if present mid-truncation recovery
    if (/\n?```\s*$/.test(normalized)) {
      normalized = normalized.replace(/\n?```\s*$/, "").trim();
      strippedMarkdownFence = true;
    }
  }

  // Bare language tag before JSON object: json\n{...}
  const bareLang = normalized.match(/^(?:json|JSON)\s*\n?\s*(\{[\s\S]*)$/);
  if (bareLang) {
    normalized = bareLang[1].trim();
    strippedMarkdownFence = true;
  }

  normalized = normalized.trim();

  return {
    normalizedText: normalized,
    flags: {
      startsWithMarkdownFence,
      containsMarkdownFence,
      strippedMarkdownFence,
      startsWithBraceAfterNormalization: normalized.startsWith("{"),
      endsWithBraceAfterNormalization: normalized.endsWith("}"),
      rawLength: rawText.length,
      normalizedLength: normalized.length,
    },
  };
}

export interface ParseErrorMeta {
  parseErrorName: string;
  parseErrorMessage: string;
  parseErrorPosition: number | null;
}

/** Safe parse-error metadata — no raw quote payload in message beyond SyntaxError boilerplate. */
export function extractParseErrorMeta(err: unknown): ParseErrorMeta {
  if (err instanceof SyntaxError) {
    const message = err.message.slice(0, 240);
    const posMatch = message.match(/position\s+(\d+)/i);
    const position = posMatch
      ? Number.parseInt(posMatch[1], 10)
      : null;
    return {
      parseErrorName: err.name,
      parseErrorMessage: message,
      parseErrorPosition: Number.isFinite(position) ? position : null,
    };
  }
  const message = String(err).slice(0, 240);
  return {
    parseErrorName: "Error",
    parseErrorMessage: message,
    parseErrorPosition: null,
  };
}

export function isGeminiOutputTruncated(finishReason: string | null): boolean {
  return finishReason === "MAX_TOKENS";
}
