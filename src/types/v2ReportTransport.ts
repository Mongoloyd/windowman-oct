/**
 * Client contract mirror for report-access full-mode v2_source projection.
 * Not raw full_json; not React component props.
 */

import type {
  JsonRecord,
  V2ReportSource,
} from "@/components/forensic-report/adapters/reportAccessAdapter.types";

export type { V2ReportSource };

export const V2_SOURCE_VERSION = "v2-source-2026-05";

export type V2ReportAccessLevel = "preview" | "full";

export type V2ReportSourceMode = "fixture" | "adapter";

/**
 * Lab-only optional presentation slices used by DevReportPreview until Edge v2_source expands.
 * Not a backend contract. Do not rely on these fields in production routes.
 */
export type V2ReportLabSections = {
  code_compliance?: {
    noa_identifiers?: string[] | null;
    fl_product_approval_identifiers?: string[] | null;
    dp_ratings?: string[] | null;
    hvhz_language?: string | null;
    miami_dade_language?: string | null;
    impact_language?: string | null;
    laminated_glass_language?: string | null;
    jurisdiction_context?: string | null;
    source_notes?: string[] | null;
  } | null;
  financial_integrity?: {
    deposit_text?: string | null;
    payment_schedule_text?: string | null;
    final_payment_timing_text?: string | null;
    permit_fee_text?: string | null;
    engineering_fee_text?: string | null;
    financing_fee_text?: string | null;
    discount_or_promo_text?: string | null;
    line_item_transparency_text?: string | null;
    math_confidence_text?: string | null;
    source_notes?: string[] | null;
  } | null;
  warranty_fine_print?: {
    labor_warranty_text?: string | null;
    manufacturer_warranty_text?: string | null;
    installation_warranty_text?: string | null;
    warranty_exclusions_text?: string | null;
    transferable_warranty_text?: string | null;
    cancellation_language?: string | null;
    restocking_or_nonrefundable_language?: string | null;
    subject_to_remeasure_language?: string | null;
    change_order_language?: string | null;
    source_notes?: string[] | null;
  } | null;
};

/**
 * Frontend/lab module transport input for useV2ReportModules.
 * Extends curated V2ReportSource with optional lab scaffolding — not an Edge payload contract.
 */
export type V2ReportModuleSource = V2ReportSource & {
  full_json?: JsonRecord | null;
  analysis_id?: string | null;
  document_type?: string | null;
  rubric_version?: string | null;
  /** Temporary lab-only slices; future Edge expansion should replace or formalize. */
  lab_sections?: V2ReportLabSections | null;
};

export interface V2QuoteMathSource {
  line_items?: unknown[];
  contractor_name?: string | null;
  opening_count?: number | null;
  total_quoted_price?: number | null;
  derived_totals?: {
    contract_total?: number | null;
  } | null;
}

export interface V2ChangeOrderSource {
  change_order_policy_text?: string | null;
  written_change_order_required?: boolean | null;
  homeowner_approval_required_for_change_orders?: boolean | null;
  unilateral_price_adjustment_allowed?: boolean | null;
  substrate_condition_clause_present?: boolean | null;
  rot_unit_pricing_present?: boolean | null;
  buck_replacement_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  remeasure_price_adjustment_cap_present?: boolean | null;
}

export interface V2ScopeGapInstallationSource {
  scope_detail?: string | null;
  disposal_included?: boolean | null;
}

export interface V2ScopeGapPermitsSource {
  included?: boolean | null;
  responsible_party?: string | null;
  details?: string | null;
}

export interface V2ScopeGapSource {
  debris_removal_included?: boolean | null;
  installation?: V2ScopeGapInstallationSource | null;
  rot_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  substrate_condition_clause_present?: boolean | null;
  waterproofing_method_text?: string | null;
  stucco_repair_included?: boolean | null;
  post_install_stucco_excluded?: boolean | null;
  wall_repair_scope?: string | null;
  permit_fees_itemized?: boolean | null;
  permits?: V2ScopeGapPermitsSource | null;
}

export interface V2SourceProjection {
  quote_math?: V2QuoteMathSource | null;
  change_order?: V2ChangeOrderSource | null;
  scope_gap?: V2ScopeGapSource | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Narrow Edge/RPC unknown into V2SourceProjection without using any. */
export function parseV2SourceProjection(value: unknown): V2SourceProjection | null {
  if (!isRecord(value)) return null;
  return value as V2SourceProjection;
}

export function parseV2SourceVersion(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
