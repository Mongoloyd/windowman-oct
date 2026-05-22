/**
 * QuoteMathLedger — local types mirroring scan-quote `LineItem` extraction fields.
 * Lab-only forensic ledger; no `any` permitted in consumers of these types.
 */

export interface QuoteMathLedgerLineItem {
  description: string;
  quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  brand?: string | null;
  series?: string | null;
  dp_rating?: string | null;
  noa_number?: string | null;
  dimensions?: string | null;
  opening_location?: string | null;
  opening_tag?: string | null;
  product_assignment_text?: string | null;
  glass_package_text?: string | null;
  glass_makeup_type?:
    | "monolithic_laminated"
    | "insulated_laminated"
    | "laminated"
    | "insulated"
    | "tempered"
    | "unknown"
    | null;
  glass_low_e_present?: boolean | null;
  glass_argon_present?: boolean | null;
  glass_tint_text?: string | null;
  glass_spec_complete?: boolean | null;
}

export interface QuoteMathLedgerProps {
  lineItems: QuoteMathLedgerLineItem[];
  contractorName?: string | null;
  totalQuotedPrice?: number | null;
  openingCount?: number | null;
  /** 0..1 or 0..100; formatConfidence auto-detects */
  confidenceScore?: number | null;
  locale?: string;
  currency?: string;
  /** Default 200; rows beyond collapse with notice */
  maxRows?: number;
}

export type ProofBadge =
  | "NOA not detected"
  | "DP rating not detected"
  | "Brand not detected"
  | "Series not detected"
  | "Glass package unclear";
