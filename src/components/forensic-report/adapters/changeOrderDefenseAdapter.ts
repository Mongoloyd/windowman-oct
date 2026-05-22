import type { ChangeOrderDefenseMatrixProps } from "../ChangeOrderDefenseMatrix.types";
import type { V2FullReportSource } from "./reportAccessAdapter.types";
import {
  asBooleanOrNull,
  asString,
  asTrimmedStringField,
  getRecord,
} from "./reportAccessAdapter.helpers";
import { buildChangeOrderRiskRows } from "./changeOrderFieldMapping";

const DEFAULT_TITLE = "Change-Order Defense Matrix";
const DEFAULT_SUBTITLE =
  "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.";

export function mapFullReportToChangeOrderDefenseMatrixProps(
  source: V2FullReportSource,
): ChangeOrderDefenseMatrixProps | null {
  const fullJson = source.full_json;
  if (!fullJson) return null;

  const extraction = getRecord(fullJson, "extraction");
  if (!extraction) return null;

  const changeOrderPolicyTextRaw = asTrimmedStringField(extraction.change_order_policy_text);
  const changeOrderPolicyText = asString(changeOrderPolicyTextRaw);

  const fieldInput = {
    change_order_policy_text: changeOrderPolicyTextRaw,
    written_change_order_required: asBooleanOrNull(extraction.written_change_order_required),
    homeowner_approval_required_for_change_orders: asBooleanOrNull(
      extraction.homeowner_approval_required_for_change_orders,
    ),
    unilateral_price_adjustment_allowed: asBooleanOrNull(
      extraction.unilateral_price_adjustment_allowed,
    ),
    substrate_condition_clause_present: asBooleanOrNull(
      extraction.substrate_condition_clause_present,
    ),
    rot_unit_pricing_present: asBooleanOrNull(extraction.rot_unit_pricing_present),
    buck_replacement_unit_pricing_present: asBooleanOrNull(
      extraction.buck_replacement_unit_pricing_present,
    ),
    substrate_allowance_text: asTrimmedStringField(extraction.substrate_allowance_text),
    remeasure_price_adjustment_cap_present: asBooleanOrNull(
      extraction.remeasure_price_adjustment_cap_present,
    ),
    hidden_condition_clause_present: null,
  };

  return {
    risks: buildChangeOrderRiskRows(fieldInput),
    policyBlobText: changeOrderPolicyText,
    title: DEFAULT_TITLE,
    subtitle: DEFAULT_SUBTITLE,
  };
}
