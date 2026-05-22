/**
 * ContractorQuoteIdentityCard — lab-only proof-of-read identity types.
 * Derived from MOCK_AUTHORIZED_FULL_REPORT_SOURCE / lab full fixtures only.
 */

export interface ContractorQuoteIdentityCardProps {
  contractorName?: string | null;
  documentType?: string | null;
  pageCount?: number | null;
  lineItemCount?: number | null;
  openingCount?: number | null;
  analysisId?: string | null;
  rubricVersion?: string | null;
  /** Display-ready 0–100 confidence; omit when unknown */
  confidenceScore?: number | null;
}

export interface ContractorQuoteIdentityLabInput {
  analysisId?: string | null;
  documentType?: string | null;
  rubricVersion?: string | null;
  confidenceScore?: number | null;
  proofOfRead?: {
    contractor_name?: string | null;
    page_count?: number | null;
    line_item_count?: number | null;
    opening_count?: number | null;
    document_type?: string | null;
  } | null;
}
