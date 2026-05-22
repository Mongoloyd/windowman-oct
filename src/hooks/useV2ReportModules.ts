/**
 * useV2ReportModules — memoized V2 module view-model (no network, no OTP).
 * Maps curated v2ReportSource through existing pure adapters.
 */

import { useMemo } from "react";
import { mapFullReportToChangeOrderDefenseMatrixProps } from "@/components/forensic-report/adapters/changeOrderDefenseAdapter";
import { mapFullReportToQuoteMathLedgerProps } from "@/components/forensic-report/adapters/quoteMathLedgerAdapter";
import { toV2AdapterSource } from "@/components/forensic-report/adapters/reportAccessAdapter.source";
import type { V2ReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import { mapFullReportToScopeGapChecklistProps } from "@/components/forensic-report/adapters/scopeGapChecklistAdapter";
import type { ChangeOrderDefenseMatrixProps } from "@/components/forensic-report/ChangeOrderDefenseMatrix.types";
import type { QuoteMathLedgerProps } from "@/components/forensic-report/QuoteMathLedger.types";
import type { ScopeGapChecklistProps } from "@/components/forensic-report/ScopeGapChecklist.types";

export interface V2ReportModulesAvailability {
  quoteMath: boolean;
  changeOrder: boolean;
  scopeGap: boolean;
}

export interface V2ReportModulesResult {
  v2SourceVersion: string | null;
  quoteMathLedger: QuoteMathLedgerProps | null;
  changeOrderDefense: ChangeOrderDefenseMatrixProps | null;
  scopeGapChecklist: ScopeGapChecklistProps | null;
  availability: V2ReportModulesAvailability;
}

const EMPTY_AVAILABILITY: V2ReportModulesAvailability = {
  quoteMath: false,
  changeOrder: false,
  scopeGap: false,
};

export function useV2ReportModules(
  v2ReportSource: V2ReportSource | null,
): V2ReportModulesResult {
  return useMemo(() => {
    if (!v2ReportSource) {
      return {
        v2SourceVersion: null,
        quoteMathLedger: null,
        changeOrderDefense: null,
        scopeGapChecklist: null,
        availability: EMPTY_AVAILABILITY,
      };
    }

    const adapterInput = toV2AdapterSource(v2ReportSource);
    const quoteMathLedger = mapFullReportToQuoteMathLedgerProps(adapterInput);
    const changeOrderDefense = mapFullReportToChangeOrderDefenseMatrixProps(adapterInput);
    const scopeGapChecklist = mapFullReportToScopeGapChecklistProps(adapterInput);

    return {
      v2SourceVersion: v2ReportSource.v2_source_version ?? null,
      quoteMathLedger,
      changeOrderDefense,
      scopeGapChecklist,
      availability: {
        quoteMath: quoteMathLedger !== null,
        changeOrder: changeOrderDefense !== null,
        scopeGap: scopeGapChecklist !== null,
      },
    };
  }, [v2ReportSource]);
}
