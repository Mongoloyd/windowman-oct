/**
 * _shared/scannerConfig.ts
 *
 * Single source of truth for the scan-quote runtime configuration that has
 * historically been scattered as inline magic numbers (model name, timeouts,
 * stale-session thresholds, max payload size).
 *
 * Pure helpers only. Reads `Deno.env` at call time so that tests can override
 * via `Deno.env.set(...)` without rebuilding the module.
 *
 * ⚠️  No I/O, no Supabase client construction, no Gemini calls. This file
 * must remain importable from any edge function without side effects.
 */

// ── Defaults ─────────────────────────────────────────────────────────────────

/**
 * Default Gemini model used by `scan-quote`. The previous inline value was
 * `gemini-3.1-flash-lite-preview` (verified working as of 2026-03-18, per
 * `.lovable/memory/features/scanner-brain-followups.md`). We keep the same
 * default so this hardening pass changes zero observable scoring behavior;
 * operators can override via `GEMINI_SCAN_MODEL` without a redeploy.
 */
const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite-preview";

/** Default hard timeout for the Gemini extraction call. Matches prior 15s. */
const DEFAULT_GEMINI_TIMEOUT_MS = 15_000;

/**
 * How long a `scan_sessions` row can sit in `processing` before a re-invocation
 * is allowed to take it over. Tuned just above the Gemini timeout + a safety
 * margin so a still-running invocation is never preempted by a parallel retry.
 */
const DEFAULT_STALE_PROCESSING_MINUTES = 3;

/** Hard cap on uploaded file size sent to Gemini (bytes). */
const DEFAULT_MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB

// ── Helpers ─────────────────────────────────────────────────────────────────

function readPositiveInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonEmptyString(name: string, fallback: string): string {
  const raw = Deno.env.get(name);
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

// ── Public API ──────────────────────────────────────────────────────────────

export interface ScannerRuntimeConfig {
  geminiModel: string;
  geminiTimeoutMs: number;
  staleProcessingMinutes: number;
  maxFileBytes: number;
}

/**
 * Read the active scanner runtime config. Always returns a fully populated
 * struct — env overrides only apply when the value is a positive integer or
 * non-empty string, otherwise the safe default is used. This guarantees
 * `scan-quote` never silently degrades into ambiguous config.
 */
export function getScannerRuntimeConfig(): ScannerRuntimeConfig {
  return {
    geminiModel: readNonEmptyString("GEMINI_SCAN_MODEL", DEFAULT_GEMINI_MODEL),
    geminiTimeoutMs: readPositiveInt(
      "GEMINI_SCAN_TIMEOUT_MS",
      DEFAULT_GEMINI_TIMEOUT_MS,
    ),
    staleProcessingMinutes: readPositiveInt(
      "SCAN_STALE_PROCESSING_MINUTES",
      DEFAULT_STALE_PROCESSING_MINUTES,
    ),
    maxFileBytes: readPositiveInt(
      "SCAN_MAX_FILE_BYTES",
      DEFAULT_MAX_FILE_BYTES,
    ),
  };
}

/**
 * Build the Gemini generateContent URL. Kept here so the model name is
 * referenced in exactly one place. The API key is appended as a query param
 * to match Google's existing endpoint contract.
 */
export function buildGeminiUrl(model: string, apiKey: string): string {
  const encodedModel = encodeURIComponent(model);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodedModel}:generateContent?key=${apiKey}`;
}
