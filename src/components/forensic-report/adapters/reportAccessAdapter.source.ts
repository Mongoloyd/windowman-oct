/**
 * V2 report-access transport bridge — pure transforms only.
 * Preferred: Edge v2_source → public V2ReportSource.
 * Transitional: legacy full_json → curated v2_source inside rawFullRowToV2ReportSource only.
 */

import type { RawFullRow } from "@/types/serviceResults";
import {
  parseV2SourceProjection,
  type V2ChangeOrderSource,
  type V2QuoteMathSource,
  type V2ScopeGapInstallationSource,
  type V2ScopeGapPermitsSource,
  type V2ScopeGapSource,
  type V2SourceProjection,
} from "@/types/v2ReportTransport";
import type { JsonRecord, V2FullReportSource, V2ReportSource } from "./reportAccessAdapter.types";
import {
  asArray,
  asBooleanOrNull,
  asNumber,
  asString,
  asTrimmedStringField,
  getRecord,
  isRecord,
} from "./reportAccessAdapter.helpers";

const LEGACY_FULL_JSON_V2_SOURCE_VERSION = "v2-source-legacy-full-json-fallback";

function hasDefinedKey(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function lineItemsAreUseful(lineItems: unknown[]): boolean {
  for (const rawItem of lineItems) {
    if (!isRecord(rawItem)) continue;
    if (asString(rawItem.description) !== null) return true;
  }
  return false;
}

function buildQuoteMathFromLegacy(
  extraction: JsonRecord,
  derivedMetrics: JsonRecord | null,
): V2QuoteMathSource | null {
  const quoteMath: V2QuoteMathSource = {};
  let useful = false;

  const rawLineItems = asArray(extraction.line_items);
  if (lineItemsAreUseful(rawLineItems)) {
    quoteMath.line_items = rawLineItems;
    useful = true;
  }

  if (hasDefinedKey(extraction, "contractor_name")) {
    quoteMath.contractor_name = asString(extraction.contractor_name);
    useful = true;
  }

  if (hasDefinedKey(extraction, "opening_count")) {
    quoteMath.opening_count = asNumber(extraction.opening_count);
    useful = true;
  }

  if (hasDefinedKey(extraction, "total_quoted_price")) {
    quoteMath.total_quoted_price = asNumber(extraction.total_quoted_price);
    useful = true;
  }

  const totals = derivedMetrics ? getRecord(derivedMetrics, "totals") : null;
  if (totals && hasDefinedKey(totals, "contract_total")) {
    const contractTotal = asNumber(totals.contract_total);
    quoteMath.derived_totals = { contract_total: contractTotal };
    useful = true;
  }

  return useful ? quoteMath : null;
}

function buildChangeOrderFromLegacy(extraction: JsonRecord): V2ChangeOrderSource | null {
  const changeOrder: V2ChangeOrderSource = {};
  let useful = false;

  const stringKeys = ["change_order_policy_text", "substrate_allowance_text"] as const;
  for (const key of stringKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    changeOrder[key] = asTrimmedStringField(extraction[key]);
    useful = true;
  }

  const booleanKeys = [
    "written_change_order_required",
    "homeowner_approval_required_for_change_orders",
    "unilateral_price_adjustment_allowed",
    "substrate_condition_clause_present",
    "rot_unit_pricing_present",
    "buck_replacement_unit_pricing_present",
    "remeasure_price_adjustment_cap_present",
  ] as const;
  for (const key of booleanKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    changeOrder[key] = asBooleanOrNull(extraction[key]);
    useful = true;
  }

  return useful ? changeOrder : null;
}

function buildScopeGapInstallationFromLegacy(
  installation: JsonRecord,
): V2ScopeGapInstallationSource | null {
  const installationOut: V2ScopeGapInstallationSource = {};
  let useful = false;

  if (hasDefinedKey(installation, "scope_detail")) {
    installationOut.scope_detail = asTrimmedStringField(installation.scope_detail);
    useful = true;
  }
  if (hasDefinedKey(installation, "disposal_included")) {
    installationOut.disposal_included = asBooleanOrNull(installation.disposal_included);
    useful = true;
  }

  return useful ? installationOut : null;
}

function buildScopeGapPermitsFromLegacy(permits: JsonRecord): V2ScopeGapPermitsSource | null {
  const permitsOut: V2ScopeGapPermitsSource = {};
  let useful = false;

  if (hasDefinedKey(permits, "included")) {
    permitsOut.included = asBooleanOrNull(permits.included);
    useful = true;
  }
  if (hasDefinedKey(permits, "responsible_party")) {
    permitsOut.responsible_party = asTrimmedStringField(permits.responsible_party);
    useful = true;
  }
  if (hasDefinedKey(permits, "details")) {
    permitsOut.details = asTrimmedStringField(permits.details);
    useful = true;
  }

  return useful ? permitsOut : null;
}

function buildScopeGapFromLegacy(extraction: JsonRecord): V2ScopeGapSource | null {
  const scopeGap: V2ScopeGapSource = {};
  let useful = false;

  const booleanKeys = [
    "debris_removal_included",
    "rot_unit_pricing_present",
    "substrate_condition_clause_present",
    "stucco_repair_included",
    "post_install_stucco_excluded",
    "permit_fees_itemized",
  ] as const;

  for (const key of booleanKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    scopeGap[key] = asBooleanOrNull(extraction[key]);
    useful = true;
  }

  if (hasDefinedKey(extraction, "substrate_allowance_text")) {
    scopeGap.substrate_allowance_text = asTrimmedStringField(extraction.substrate_allowance_text);
    useful = true;
  }
  if (hasDefinedKey(extraction, "waterproofing_method_text")) {
    scopeGap.waterproofing_method_text = asTrimmedStringField(extraction.waterproofing_method_text);
    useful = true;
  }
  if (hasDefinedKey(extraction, "wall_repair_scope")) {
    scopeGap.wall_repair_scope = asTrimmedStringField(extraction.wall_repair_scope);
    useful = true;
  }

  const installation = getRecord(extraction, "installation");
  if (installation) {
    const installationOut = buildScopeGapInstallationFromLegacy(installation);
    if (installationOut) {
      scopeGap.installation = installationOut;
      useful = true;
    }
  }

  const permits = getRecord(extraction, "permits");
  if (permits) {
    const permitsOut = buildScopeGapPermitsFromLegacy(permits);
    if (permitsOut) {
      scopeGap.permits = permitsOut;
      useful = true;
    }
  }

  return useful ? scopeGap : null;
}

/** Derive curated V2SourceProjection from legacy authorized full_json (transitional). */
function deriveV2SourceProjectionFromLegacyFullJson(
  fullJson: unknown,
): V2SourceProjection | null {
  if (!isRecord(fullJson)) return null;

  const extraction = getRecord(fullJson, "extraction");
  if (!extraction) return null;

  const derivedMetrics = getRecord(fullJson, "derived_metrics");

  const quoteMath = buildQuoteMathFromLegacy(extraction, derivedMetrics);
  const changeOrder = buildChangeOrderFromLegacy(extraction);
  const scopeGap = buildScopeGapFromLegacy(extraction);

  if (!quoteMath && !changeOrder && !scopeGap) {
    return null;
  }

  const projection: V2SourceProjection = {};
  if (quoteMath) projection.quote_math = quoteMath;
  if (changeOrder) projection.change_order = changeOrder;
  if (scopeGap) projection.scope_gap = scopeGap;

  return projection;
}

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
  const base: V2ReportSource = {
    proof_of_read: row.proof_of_read ?? null,
    confidence_score: row.confidence_score ?? null,
    v2_source_version: row.v2_source_version ?? null,
    v2_source: null,
  };

  const edgeProjection = parseV2SourceProjection(row.v2_source);
  if (edgeProjection) {
    return {
      ...base,
      v2_source: edgeProjection,
    };
  }

  const legacyProjection = deriveV2SourceProjectionFromLegacyFullJson(row.full_json);
  if (legacyProjection) {
    return {
      ...base,
      v2_source_version: LEGACY_FULL_JSON_V2_SOURCE_VERSION,
      v2_source: legacyProjection,
    };
  }

  return base;
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
