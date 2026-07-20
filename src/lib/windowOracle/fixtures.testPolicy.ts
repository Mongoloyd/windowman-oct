/**
 * Proposed confidence thresholds for tests / fixtures only.
 * Production policy requires human approval before use.
 */
import type { OracleConfidencePolicy } from "./types";

export const FIXTURE_ORACLE_CONFIDENCE_POLICY: OracleConfidencePolicy = {
  insufficientMax: 4,
  lowMax: 9,
  moderateMax: 29,
  outlierRatioThreshold: 1.15,
  tightRelativeDelta: 0.05,
};

export const SYNTHETIC_DATA_BANNER = "SYNTHETIC / DEVELOPMENT DATA";
