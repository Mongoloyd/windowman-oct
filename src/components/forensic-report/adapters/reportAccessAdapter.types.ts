/**
 * V2 report adapter boundary types — local lab/production mapping layer only.
 */

export type JsonRecord = Record<string, unknown>;

export interface V2FullReportSource {
  proof_of_read?: JsonRecord | null;
  confidence_score?: number | null;
  full_json?: JsonRecord | null;
}
