/**
 * useV2ReportModules — memoized V2 module view-model (no network, no OTP).
 * Single lab/production-facing bridge for Dark V2 evidence module prop assembly.
 */

import { useMemo } from "react";
import { buildCodeComplianceProofProps } from "@/components/forensic-report/CodeComplianceProofSection.fixtures";
import type { CodeComplianceProofSectionProps } from "@/components/forensic-report/CodeComplianceProofSection.types";
import { buildContractorQuoteIdentityProps } from "@/components/forensic-report/ContractorQuoteIdentityCard.fixtures";
import type { ContractorQuoteIdentityCardProps } from "@/components/forensic-report/ContractorQuoteIdentityCard.types";
import type { MockLabReportSource } from "@/components/forensic-report/adapters/reportV2Adapter.fixtures";
import { mapFullReportToChangeOrderDefenseMatrixProps } from "@/components/forensic-report/adapters/changeOrderDefenseAdapter";
import { mapFullReportToQuoteMathLedgerProps } from "@/components/forensic-report/adapters/quoteMathLedgerAdapter";
import { toV2AdapterSource } from "@/components/forensic-report/adapters/reportAccessAdapter.source";
import type { V2FullReportSource } from "@/components/forensic-report/adapters/reportAccessAdapter.types";
import { mapFullReportToScopeGapChecklistProps } from "@/components/forensic-report/adapters/scopeGapChecklistAdapter";
import {
  FIX_CHANGE_ORDER_UNKNOWN_STATE,
} from "@/components/forensic-report/ChangeOrderDefenseMatrix.fixtures";
import { LEDGER_FIXTURE_EMPTY } from "@/components/forensic-report/QuoteMathLedger.fixtures";
import { buildFinancialIntegrityProps } from "@/components/forensic-report/FinancialIntegritySection.fixtures";
import type { FinancialIntegritySectionProps } from "@/components/forensic-report/FinancialIntegritySection.types";
import type { ChangeOrderDefenseMatrixProps } from "@/components/forensic-report/ChangeOrderDefenseMatrix.types";
import type { QuoteMathLedgerProps } from "@/components/forensic-report/QuoteMathLedger.types";
import type { ScopeGapChecklistProps } from "@/components/forensic-report/ScopeGapChecklist.types";
import { buildWarrantyFinePrintProps } from "@/components/forensic-report/WarrantyFinePrintSection.fixtures";
import type { WarrantyFinePrintSectionProps } from "@/components/forensic-report/WarrantyFinePrintSection.types";
import type {
  V2ReportAccessLevel,
  V2ReportModuleSource,
  V2ReportSourceMode,
} from "@/types/v2ReportTransport";

export type V2ReportModulesResult = {
  contractorIdentityProps: ContractorQuoteIdentityCardProps | null;
  quoteMathLedgerProps: QuoteMathLedgerProps | null;
  codeComplianceProps: CodeComplianceProofSectionProps | null;
  changeOrderDefenseProps: ChangeOrderDefenseMatrixProps | null;
  scopeGapChecklistProps: ScopeGapChecklistProps | null;
  financialIntegrityProps: FinancialIntegritySectionProps | null;
  warrantyFinePrintProps: WarrantyFinePrintSectionProps | null;
};

export interface UseV2ReportModulesOptions {
  accessLevel: V2ReportAccessLevel;
  sourceMode: V2ReportSourceMode;
  /**
   * Lab-only substitutes for ledger/matrix/scope when DevReportPreview query params
   * request fixture variants (?ledger=, ?matrix=, ?scope=). Ignored when sourceMode is "adapter".
   */
  labModuleOverrides?: Pick<
    V2ReportModulesResult,
    "quoteMathLedgerProps" | "changeOrderDefenseProps" | "scopeGapChecklistProps"
  >;
}

const NULL_MODULES: V2ReportModulesResult = {
  contractorIdentityProps: null,
  quoteMathLedgerProps: null,
  codeComplianceProps: null,
  changeOrderDefenseProps: null,
  scopeGapChecklistProps: null,
  financialIntegrityProps: null,
  warrantyFinePrintProps: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toAdapterInput(source: V2ReportModuleSource): V2FullReportSource {
  if (source.full_json != null) {
    return {
      proof_of_read: source.proof_of_read ?? null,
      confidence_score: source.confidence_score ?? null,
      full_json: source.full_json,
    };
  }

  return toV2AdapterSource({
    proof_of_read: source.proof_of_read ?? null,
    confidence_score: source.confidence_score ?? null,
    v2_source_version: source.v2_source_version ?? null,
    v2_source: source.v2_source ?? null,
  });
}

function toLabBuilderSource(source: V2ReportModuleSource): MockLabReportSource {
  return {
    proof_of_read: source.proof_of_read ?? null,
    confidence_score: source.confidence_score ?? null,
    full_json: source.full_json ?? null,
    lab_sections: source.lab_sections ?? null,
  };
}

function buildContractorIdentityFromSource(
  source: V2ReportModuleSource,
): ContractorQuoteIdentityCardProps | null {
  const proofOfRead = isRecord(source.proof_of_read) ? source.proof_of_read : null;

  return buildContractorQuoteIdentityProps({
    analysisId: asString(source.analysis_id),
    documentType: asString(source.document_type),
    rubricVersion: asString(source.rubric_version),
    confidenceScore:
      typeof source.confidence_score === "number" ? source.confidence_score : null,
    proofOfRead: proofOfRead
      ? {
          contractor_name: asString(proofOfRead.contractor_name),
          page_count:
            typeof proofOfRead.page_count === "number" ? proofOfRead.page_count : null,
          line_item_count:
            typeof proofOfRead.line_item_count === "number"
              ? proofOfRead.line_item_count
              : null,
          opening_count:
            typeof proofOfRead.opening_count === "number" ? proofOfRead.opening_count : null,
          document_type: asString(proofOfRead.document_type),
        }
      : null,
  });
}

export function useV2ReportModules(
  source: V2ReportModuleSource | null,
  options: UseV2ReportModulesOptions,
): V2ReportModulesResult {
  const { accessLevel, sourceMode, labModuleOverrides } = options;

  return useMemo(() => {
    if (!source || accessLevel !== "full") {
      return NULL_MODULES;
    }

    const adapterInput = toAdapterInput(source);
    const labBuilderSource = toLabBuilderSource(source);

    const adapterQuoteMath =
      mapFullReportToQuoteMathLedgerProps(adapterInput) ?? LEDGER_FIXTURE_EMPTY;
    const adapterChangeOrder =
      mapFullReportToChangeOrderDefenseMatrixProps(adapterInput) ??
      FIX_CHANGE_ORDER_UNKNOWN_STATE;
    const adapterScopeGap = mapFullReportToScopeGapChecklistProps(adapterInput);

    const quoteMathLedgerProps =
      sourceMode === "fixture" && labModuleOverrides
        ? labModuleOverrides.quoteMathLedgerProps
        : adapterQuoteMath;

    const changeOrderDefenseProps =
      sourceMode === "fixture" && labModuleOverrides
        ? labModuleOverrides.changeOrderDefenseProps
        : adapterChangeOrder;

    const scopeGapChecklistProps =
      sourceMode === "fixture" && labModuleOverrides
        ? labModuleOverrides.scopeGapChecklistProps
        : adapterScopeGap;

    return {
      contractorIdentityProps: buildContractorIdentityFromSource(source),
      quoteMathLedgerProps,
      codeComplianceProps: buildCodeComplianceProofProps(labBuilderSource),
      changeOrderDefenseProps,
      scopeGapChecklistProps,
      financialIntegrityProps: buildFinancialIntegrityProps(labBuilderSource),
      warrantyFinePrintProps: buildWarrantyFinePrintProps(labBuilderSource),
    };
  }, [source, accessLevel, sourceMode, labModuleOverrides]);
}
