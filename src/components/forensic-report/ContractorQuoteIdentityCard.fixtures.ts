/**
 * ContractorQuoteIdentityCard fixtures — mirrors MOCK_AUTHORIZED_FULL_REPORT_SOURCE.
 */
import { MOCK_AUTHORIZED_FULL_REPORT_SOURCE } from "./adapters/reportV2Adapter.fixtures";
import type {
  ContractorQuoteIdentityCardProps,
  ContractorQuoteIdentityLabInput,
} from "./ContractorQuoteIdentityCard.types";

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeConfidenceScore(value: number | null | undefined): number | null {
  if (!isFiniteNumber(value)) return null;
  if (value >= 0 && value <= 1) return Math.round(value * 100);
  return Math.round(value);
}

function hasMeaningfulProps(props: ContractorQuoteIdentityCardProps): boolean {
  return (
    isNonEmptyString(props.contractorName) ||
    isNonEmptyString(props.documentType) ||
    isFiniteNumber(props.pageCount) ||
    isFiniteNumber(props.lineItemCount) ||
    isFiniteNumber(props.openingCount) ||
    isNonEmptyString(props.analysisId) ||
    isNonEmptyString(props.rubricVersion) ||
    isFiniteNumber(props.confidenceScore)
  );
}

export function buildContractorQuoteIdentityProps(
  input: ContractorQuoteIdentityLabInput,
): ContractorQuoteIdentityCardProps | null {
  const proof = input.proofOfRead ?? null;

  const documentType =
    isNonEmptyString(proof?.document_type) ? proof.document_type : input.documentType ?? null;

  const props: ContractorQuoteIdentityCardProps = {
    contractorName: isNonEmptyString(proof?.contractor_name) ? proof.contractor_name : null,
    documentType: isNonEmptyString(documentType) ? documentType : null,
    pageCount: isFiniteNumber(proof?.page_count) ? proof.page_count : null,
    lineItemCount: isFiniteNumber(proof?.line_item_count) ? proof.line_item_count : null,
    openingCount: isFiniteNumber(proof?.opening_count) ? proof.opening_count : null,
    analysisId: isNonEmptyString(input.analysisId) ? input.analysisId : null,
    rubricVersion: isNonEmptyString(input.rubricVersion) ? input.rubricVersion : null,
    confidenceScore: normalizeConfidenceScore(input.confidenceScore),
  };

  return hasMeaningfulProps(props) ? props : null;
}

/** Default lab fixture aligned with mockFullReportAccessResponse + adapter source proof_of_read */
export const FIX_CONTRACTOR_IDENTITY_LAB = buildContractorQuoteIdentityProps({
  analysisId: "mock-analysis-windowman-v2",
  documentType: "estimate",
  rubricVersion: "1.6.0",
  confidenceScore: MOCK_AUTHORIZED_FULL_REPORT_SOURCE.confidence_score,
  proofOfRead: MOCK_AUTHORIZED_FULL_REPORT_SOURCE.proof_of_read,
});
