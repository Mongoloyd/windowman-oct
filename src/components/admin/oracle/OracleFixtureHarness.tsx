/**
 * Wires pure queryEngine to synthetic fixtures with local React state only.
 * No Supabase. No network. No admin-data.
 */

import { useMemo, useState } from "react";
import {
  FIXTURE_ORACLE_CONFIDENCE_POLICY,
  SYNTHETIC_ORACLE_NOW_MS,
  SYNTHETIC_ORACLE_OBSERVATIONS,
  runOracleQuery,
  type OracleQueryRequest,
  type OracleQueryResponse,
} from "@/lib/windowOracle";

const DEFAULT_REQUEST: OracleQueryRequest = {
  geography: { zip: "33301", county: "Broward" },
  product: { brand: "PGT", series: "WinGuard", type: "single_hung" },
  project: { projectType: "full_home", openingCountMin: 8, openingCountMax: 20 },
  provenance: "QUOTED",
  dateRangeMonths: 24,
  homeownerPpo: 2710,
};

export function useOracleFixtureHarness() {
  const [request, setRequest] = useState<OracleQueryRequest>(DEFAULT_REQUEST);
  const [committed, setCommitted] = useState<OracleQueryRequest>(DEFAULT_REQUEST);

  const response: OracleQueryResponse = useMemo(
    () =>
      runOracleQuery({
        observations: SYNTHETIC_ORACLE_OBSERVATIONS,
        request: committed,
        policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
        nowMs: SYNTHETIC_ORACLE_NOW_MS,
      }),
    [committed],
  );

  return {
    request,
    setRequest,
    response,
    search: () => setCommitted(request),
    observations: SYNTHETIC_ORACLE_OBSERVATIONS,
  };
}
