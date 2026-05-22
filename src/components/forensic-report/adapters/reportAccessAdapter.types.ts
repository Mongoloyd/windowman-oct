/**
 * V2 report adapter boundary types — local lab/production mapping layer only.
 */

import type { V2SourceProjection } from "@/types/v2ReportTransport";

export type JsonRecord = Record<string, unknown>;

/** Curated full-only transport surface (no raw full_json on public hook contract). */
export interface V2ReportSource {
  proof_of_read?: JsonRecord | null;
  confidence_score?: number | null;
  v2_source_version?: string | null;
  v2_source?: V2SourceProjection | null;
}

/** Lab fixtures and legacy adapter input shape. */
export interface V2FullReportSource {
  proof_of_read?: JsonRecord | null;
  confidence_score?: number | null;
  full_json?: JsonRecord | null;
}
