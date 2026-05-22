/**
 * V2 report-access transport bridge — pure transforms only.
 * Preferred: v2_source → synthetic adapter input.
 * Legacy full_json fallback is not on V2ReportSource; Edge projection supplies v2_source.
 */

import type { RawFullRow } from "@/types/serviceResults";
import type { V2SourceProjection } from "@/types/v2ReportTransport";
import type { JsonRecord, V2FullReportSource, V2ReportSource } from "./reportAccessAdapter.types";

function buildExtractionFromV2Source(projection: V2SourceProjection): JsonRecord {
  const extraction: JsonRecord = {};
  const quoteMath = projection.quote_math;
  const changeOrder = projection.change_order;
  const scopeGap = projection.scope_gap;

  if (quoteMath) {
    if (quoteMath.line_items !== undefined) {
      extraction.line_items = quoteMath.line_items;
    }
    if (quoteMath.contractor_name !== undefined) {
      extraction.contractor_name = quoteMath.contractor_name;
    }
    if (quoteMath.opening_count !== undefined) {
      extraction.opening_count = quoteMath.opening_count;
    }
    if (quoteMath.total_quoted_price !== undefined) {
      extraction.total_quoted_price = quoteMath.total_quoted_price;
    }
  }

  if (changeOrder) {
    if (changeOrder.change_order_policy_text !== undefined) {
      extraction.change_order_policy_text = changeOrder.change_order_policy_text;
    }
    if (changeOrder.written_change_order_required !== undefined) {
      extraction.written_change_order_required = changeOrder.written_change_order_required;
    }
    if (changeOrder.homeowner_approval_required_for_change_orders !== undefined) {
      extraction.homeowner_approval_required_for_change_orders =
        changeOrder.homeowner_approval_required_for_change_orders;
    }
    if (changeOrder.unilateral_price_adjustment_allowed !== undefined) {
      extraction.unilateral_price_adjustment_allowed =
        changeOrder.unilateral_price_adjustment_allowed;
    }
    if (changeOrder.substrate_condition_clause_present !== undefined) {
      extraction.substrate_condition_clause_present =
        changeOrder.substrate_condition_clause_present;
    }
    if (changeOrder.rot_unit_pricing_present !== undefined) {
      extraction.rot_unit_pricing_present = changeOrder.rot_unit_pricing_present;
    }
    if (changeOrder.buck_replacement_unit_pricing_present !== undefined) {
      extraction.buck_replacement_unit_pricing_present =
        changeOrder.buck_replacement_unit_pricing_present;
    }
    if (changeOrder.substrate_allowance_text !== undefined) {
      extraction.substrate_allowance_text = changeOrder.substrate_allowance_text;
    }
    if (changeOrder.remeasure_price_adjustment_cap_present !== undefined) {
      extraction.remeasure_price_adjustment_cap_present =
        changeOrder.remeasure_price_adjustment_cap_present;
    }
  }

  if (scopeGap) {
    if (scopeGap.debris_removal_included !== undefined) {
      extraction.debris_removal_included = scopeGap.debris_removal_included;
    }
    if (scopeGap.rot_unit_pricing_present !== undefined) {
      extraction.rot_unit_pricing_present = scopeGap.rot_unit_pricing_present;
    }
    if (scopeGap.substrate_allowance_text !== undefined) {
      extraction.substrate_allowance_text = scopeGap.substrate_allowance_text;
    }
    if (scopeGap.substrate_condition_clause_present !== undefined) {
      extraction.substrate_condition_clause_present =
        scopeGap.substrate_condition_clause_present;
    }
    if (scopeGap.waterproofing_method_text !== undefined) {
      extraction.waterproofing_method_text = scopeGap.waterproofing_method_text;
    }
    if (scopeGap.stucco_repair_included !== undefined) {
      extraction.stucco_repair_included = scopeGap.stucco_repair_included;
    }
    if (scopeGap.post_install_stucco_excluded !== undefined) {
      extraction.post_install_stucco_excluded = scopeGap.post_install_stucco_excluded;
    }
    if (scopeGap.wall_repair_scope !== undefined) {
      extraction.wall_repair_scope = scopeGap.wall_repair_scope;
    }
    if (scopeGap.permit_fees_itemized !== undefined) {
      extraction.permit_fees_itemized = scopeGap.permit_fees_itemized;
    }
    if (scopeGap.installation !== undefined) {
      extraction.installation = scopeGap.installation;
    }
    if (scopeGap.permits !== undefined) {
      extraction.permits = scopeGap.permits;
    }
  }

  return extraction;
}

function buildDerivedMetricsFromV2Source(projection: V2SourceProjection): JsonRecord | null {
  const contractTotal = projection.quote_math?.derived_totals?.contract_total;
  if (contractTotal === undefined) return null;
  return {
    totals: {
      contract_total: contractTotal,
    },
  };
}

/** Map internal full row to curated V2 surface (no full_json on output). */
export function rawFullRowToV2ReportSource(row: RawFullRow): V2ReportSource {
  return {
    proof_of_read: row.proof_of_read ?? null,
    confidence_score: row.confidence_score ?? null,
    v2_source_version: row.v2_source_version ?? null,
    v2_source: row.v2_source ?? null,
  };
}

/** Preferred: v2_source → synthetic shim. No full_json on V2ReportSource. */
export function toV2AdapterSource(source: V2ReportSource): V2FullReportSource {
  const base: V2FullReportSource = {
    proof_of_read: source.proof_of_read ?? null,
    confidence_score: source.confidence_score ?? null,
    full_json: null,
  };

  if (!source.v2_source) {
    return base;
  }

  const derivedMetrics = buildDerivedMetricsFromV2Source(source.v2_source);
  const fullJson: JsonRecord = {
    extraction: buildExtractionFromV2Source(source.v2_source),
  };
  if (derivedMetrics) {
    fullJson.derived_metrics = derivedMetrics;
  }

  return { ...base, full_json: fullJson };
}
