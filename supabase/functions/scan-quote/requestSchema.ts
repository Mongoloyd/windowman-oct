/**
 * scan-quote/requestSchema.ts
 *
 * Zod request validator for the scan-quote entry point. Lives next to the
 * function so it can reference scoring types if needed and is the single
 * boundary contract for incoming HTTP bodies.
 *
 * Why Zod (and not the manual checks that existed before):
 *  - one-shot validation produces deterministic 4xx errors
 *  - malformed payloads can never drift past line 1 of the handler
 *  - the dev-bypass shape is co-located with the canonical contract so any
 *    drift is caught at parse time rather than mid-pipeline
 */

import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// UUID v4-ish pattern (8-4-4-4-12). We do not enforce v4 specifically because
// scan_sessions ids are gen_random_uuid() and could be any RFC4122 variant.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ScanQuoteRequestSchema = z.object({
  scan_session_id: z
    .string({ required_error: "scan_session_id is required" })
    .regex(UUID_REGEX, "scan_session_id must be a UUID"),

  /**
   * Browser-generated transport-safe event id (opaque, ≤128 chars).
   *
   * TOLERANT BOUNDARY (forever rule):
   * Bad event_id MUST NEVER block a scan. If the field is missing,
   * not a string, empty, or longer than 128 characters, we transform
   * it to a server-minted UUID instead of returning 400. The handler
   * logs a `event_id_substituted` warning when this happens so we can
   * spot frontend regressions in observability without taking an outage.
   *
   * Rules enforced elsewhere (frontend + downstream):
   *  - event_id is opaque (UUID v4 by default), never descriptive
   *  - metadata (event_name, lead_id, scan_session_id, …) lives in
   *    separate fields, never concatenated into event_id
   *  - same business-event instance reuses the same event_id across
   *    browser/server/dispatch; different milestones get different ids
   */
  event_id: z
    .preprocess((value) => {
      if (typeof value !== "string") return crypto.randomUUID();
      const trimmed = value.trim();
      if (trimmed.length === 0 || trimmed.length > 128) {
        return crypto.randomUUID();
      }
      return trimmed;
    }, z.string().min(1).max(128))
    .optional()
    .default(() => crypto.randomUUID()),

  /**
   * DEV-only escape hatch: accept a fully formed extraction object so the
   * scanner brain can be exercised without a real Gemini round trip.
   * Gated by `dev_secret === DEV_BYPASS_SECRET` inside the handler.
   * The shape is intentionally permissive (`unknown`) — the same downstream
   * `validateDocumentClassification` + `validateExtraction` checks still run.
   */
  dev_extraction_override: z.unknown().optional(),
  dev_secret: z.string().min(1).max(256).optional(),
});

export type ScanQuoteRequest = z.infer<typeof ScanQuoteRequestSchema>;

export interface ParsedScanRequest {
  ok: true;
  value: ScanQuoteRequest;
}

export interface ParseScanRequestError {
  ok: false;
  error: string;
  details: Record<string, string[]>;
}

/**
 * Parse + validate a raw request body. Always returns a discriminated union
 * so the handler can reject in one branch without throwing.
 */
export function parseScanQuoteRequest(
  raw: unknown,
): ParsedScanRequest | ParseScanRequestError {
  const result = ScanQuoteRequestSchema.safeParse(raw);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const flat = result.error.flatten();
  return {
    ok: false,
    error: "Invalid request body",
    details: flat.fieldErrors as Record<string, string[]>,
  };
}
