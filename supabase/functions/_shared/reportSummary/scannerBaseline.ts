/**
 * Scanner freeze baseline — read-only fingerprint evidence for Summary V1 Pass 1.
 * Values recorded from scan-quote/index.ts and _shared/scannerConfig.ts at HEAD
 * 931a9823e621a13ad3fb7d0f4730f17099b01e35. Do not modify protected scanner files.
 */
export const SCANNER_BASELINE = {
  geminiModelDefault: "gemini-3.1-flash-lite-preview",
  geminiTimeoutMsDefault: 15_000,
  geminiMaxOutputTokensDefault: 8192,
  staleProcessingMinutesDefault: 3,
  maxFileBytesDefault: 15 * 1024 * 1024,
  geminiExtractionPromptLength: 9358,
  geminiExtractionPromptSha256:
    "e3af0c40673db79701ae7eba147dd43723ea47f4293fbfdee9bfa8bbbec3eb31",
  geminiExtractionPromptPrefix:
    "You are a forensic document extraction engine for impact window and door quotes.",
} as const;

export async function sha256HexFromText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** Extract GEMINI_EXTRACTION_PROMPT from scan-quote/index.ts without importing Tier A code. */
export async function readGeminiExtractionPromptFromScanQuoteIndex(): Promise<
  string
> {
  const indexPath = new URL(
    "../../scan-quote/index.ts",
    import.meta.url,
  );
  const source = await Deno.readTextFile(indexPath);
  const marker = "const GEMINI_EXTRACTION_PROMPT";
  const start = source.indexOf(marker);
  if (start < 0) {
    throw new Error(
      "GEMINI_EXTRACTION_PROMPT not found in scan-quote/index.ts",
    );
  }
  const openTick = source.indexOf("`", start);
  const closeTick = source.indexOf("`", openTick + 1);
  if (openTick < 0 || closeTick < 0) {
    throw new Error("GEMINI_EXTRACTION_PROMPT delimiters not found");
  }
  return source.slice(openTick + 1, closeTick);
}
