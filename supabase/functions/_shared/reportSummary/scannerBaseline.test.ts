import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { getScannerRuntimeConfig } from "../scannerConfig.ts";
import {
  readGeminiExtractionPromptFromScanQuoteIndex,
  SCANNER_BASELINE,
  sha256HexFromText,
} from "./scannerBaseline.ts";

Deno.test("scanner runtime config defaults match freeze baseline", () => {
  const cfg = getScannerRuntimeConfig();

  assertEquals(cfg.geminiModel, SCANNER_BASELINE.geminiModelDefault);
  assertEquals(cfg.geminiTimeoutMs, SCANNER_BASELINE.geminiTimeoutMsDefault);
  assertEquals(
    cfg.geminiMaxOutputTokens,
    SCANNER_BASELINE.geminiMaxOutputTokensDefault,
  );
  assertEquals(
    cfg.staleProcessingMinutes,
    SCANNER_BASELINE.staleProcessingMinutesDefault,
  );
  assertEquals(cfg.maxFileBytes, SCANNER_BASELINE.maxFileBytesDefault);
});

Deno.test("GEMINI_EXTRACTION_PROMPT fingerprint unchanged", async () => {
  const prompt = await readGeminiExtractionPromptFromScanQuoteIndex();
  const hash = await sha256HexFromText(prompt);

  assertEquals(prompt.length, SCANNER_BASELINE.geminiExtractionPromptLength);
  assertEquals(hash, SCANNER_BASELINE.geminiExtractionPromptSha256);
  assertStringIncludes(prompt, SCANNER_BASELINE.geminiExtractionPromptPrefix);
});
