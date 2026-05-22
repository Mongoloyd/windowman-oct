/**
 * ChangeOrderDefenseMatrix — local lab-only types mirroring scan-quote change-order fields.
 * Presentation-only; no global report types.
 */

export type ChangeOrderDatabaseKey =
  | "change_order_policy_text"
  | "written_change_order_required"
  | "homeowner_approval_required_for_change_orders"
  | "unilateral_price_adjustment_allowed"
  | "substrate_condition_clause_present"
  | "rot_unit_pricing_present"
  | "buck_replacement_unit_pricing_present"
  | "substrate_allowance_text"
  | "remeasure_price_adjustment_cap_present"
  | "hidden_condition_clause_present";

export type ChangeOrderRiskSeverity = "clear" | "warn" | "fail" | "unknown";

export interface ChangeOrderRiskRow {
  fieldKey: ChangeOrderDatabaseKey;
  displayLabel: string;
  detected: boolean | null;
  severity: ChangeOrderRiskSeverity;
  statusText: string;
  evidenceText?: string | null;
  homeownerRiskCopy: string;
  contractorQuestion: string;
}

export interface ChangeOrderDefenseMatrixProps {
  risks: ChangeOrderRiskRow[];
  policyBlobText?: string | null;
  title?: string;
  subtitle?: string;
}
