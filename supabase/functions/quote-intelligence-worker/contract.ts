/**
 * Frozen V1 document-level quote-intelligence module.
 *
 * Field keys are the document-level evidence columns from
 * `quote_observations` plus the Phase 0 scanner classification triad
 * (`document_type`, `is_window_door_related`, confidence).
 * Opening/line-item extraction is out of scope.
 */

export const MODULE_KEY = "quote_document_header";
export const SCHEMA_VERSION = "v1";
export const PROMPT_VERSION = "p1";

export const ALLOWED_FIELD_KEYS = [
  "document_type",
  "is_window_door_related",
  "extraction_confidence",
  "contractor_raw_name",
  "contract_total_cents",
  "total_openings",
  "county_name",
  "zip_code",
] as const;

export type AllowedFieldKey = (typeof ALLOWED_FIELD_KEYS)[number];

export const ALLOWED_FIELD_KEY_SET: ReadonlySet<string> = new Set(
  ALLOWED_FIELD_KEYS,
);

export const PROVIDER = "gemini";
/** Aligns with authorized `GEMINI_SCAN_MODEL` / live `QI_GEMINI_MODEL` when unset. */
export const DEFAULT_RUNTIME_MODEL_ID = "gemini-3.1-flash-lite";

export const DEFAULT_JOB_LEASE_SECONDS = 300;
export const DEFAULT_CONTENT_LEASE_SECONDS = 300;
export const DEFAULT_PROVIDER_TIMEOUT_MS = 20_000;
export const DEFAULT_LEASE_SAFETY_MARGIN_MS = 5_000;
export const DEFAULT_LEASE_RETRY_DELAY_SECONDS = 30;

export const LOW_CONFIDENCE_THRESHOLD = 0.4;
