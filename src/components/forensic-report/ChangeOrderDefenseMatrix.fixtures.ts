import type { ChangeOrderDefenseMatrixProps } from "./ChangeOrderDefenseMatrix.types";
import { buildChangeOrderRiskRows } from "./adapters/changeOrderFieldMapping";

const FIXTURE_TITLE = "Change-Order Defense Matrix";
const FIXTURE_SUBTITLE =
  "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.";

export const FIX_CHANGE_ORDER_HIGH_RISK = {
  risks: buildChangeOrderRiskRows({
    written_change_order_required: false,
    homeowner_approval_required_for_change_orders: false,
    unilateral_price_adjustment_allowed: true,
    substrate_condition_clause_present: true,
    rot_unit_pricing_present: false,
    buck_replacement_unit_pricing_present: false,
    substrate_allowance_text: "",
    remeasure_price_adjustment_cap_present: false,
    hidden_condition_clause_present: null,
    change_order_policy_text: "",
  }),
  policyBlobText:
    "All additional work, substrate repair, rotten wood replacement, and buck repair shall be billed at prevailing rates after discovery. Contractor may adjust contract price based on field conditions. Verbal authorization accepted for urgent repairs.",
  title: FIXTURE_TITLE,
  subtitle: FIXTURE_SUBTITLE,
} satisfies ChangeOrderDefenseMatrixProps;

export const FIX_CHANGE_ORDER_PROTECTED_STATE = {
  risks: buildChangeOrderRiskRows({
    written_change_order_required: true,
    homeowner_approval_required_for_change_orders: true,
    unilateral_price_adjustment_allowed: false,
    substrate_condition_clause_present: true,
    rot_unit_pricing_present: true,
    buck_replacement_unit_pricing_present: true,
    substrate_allowance_text:
      "Includes up to $750 substrate repair allowance per opening; additional substrate repair billed at $45/LF with written change order.",
    remeasure_price_adjustment_cap_present: true,
    hidden_condition_clause_present: null,
    change_order_policy_text:
      "No extra work will begin without a signed change order. Homeowner written approval required before any added charges. Remeasure adjustments capped at 5% of contract total.",
  }),
  policyBlobText:
    "Change orders require signed authorization before work begins. Wood rot: $38/LF. Buck replacement: $125 each. Remeasure price adjustment shall not exceed 5% of original contract total.",
  title: FIXTURE_TITLE,
  subtitle: FIXTURE_SUBTITLE,
} satisfies ChangeOrderDefenseMatrixProps;

export const FIX_CHANGE_ORDER_UNKNOWN_STATE = {
  risks: buildChangeOrderRiskRows({
    written_change_order_required: null,
    homeowner_approval_required_for_change_orders: null,
    unilateral_price_adjustment_allowed: null,
    substrate_condition_clause_present: null,
    rot_unit_pricing_present: null,
    buck_replacement_unit_pricing_present: null,
    substrate_allowance_text: null,
    remeasure_price_adjustment_cap_present: null,
    hidden_condition_clause_present: null,
    change_order_policy_text: null,
  }),
  policyBlobText: null,
  title: FIXTURE_TITLE,
  subtitle: FIXTURE_SUBTITLE,
} satisfies ChangeOrderDefenseMatrixProps;
