import type { ChangeOrderRiskRow } from "../ChangeOrderDefenseMatrix.types";

export interface ChangeOrderFieldInput {
  change_order_policy_text?: string | null;
  written_change_order_required?: boolean | null;
  homeowner_approval_required_for_change_orders?: boolean | null;
  unilateral_price_adjustment_allowed?: boolean | null;
  substrate_condition_clause_present?: boolean | null;
  rot_unit_pricing_present?: boolean | null;
  buck_replacement_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  remeasure_price_adjustment_cap_present?: boolean | null;
  hidden_condition_clause_present?: boolean | null;
}

const INVALID_EVIDENCE_TEXT = new Set(["false", "none", "n/a", "—", "-"]);

function normalizeEvidenceText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (INVALID_EVIDENCE_TEXT.has(trimmed.toLowerCase())) return null;
  return trimmed;
}

function mapWrittenChangeOrderRequired(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "written_change_order_required",
      displayLabel: "Written Change Orders",
      detected: true,
      severity: "clear",
      statusText: "Signed Agreement Enforced",
      homeownerRiskCopy:
        "The parsed quote shows written change-order guardrails before extra work is tracked.",
      contractorQuestion:
        "Will every project modification be documented on signed change-order sheets?",
    };
  }
  if (value === false) {
    return {
      fieldKey: "written_change_order_required",
      displayLabel: "Written Change Orders",
      detected: false,
      severity: "fail",
      statusText: "Written Guardrail Not Detected",
      homeownerRiskCopy:
        "The parsed quote does not show a written change-order guardrail for extra charges.",
      contractorQuestion:
        "Will you guarantee in writing that no verbal change orders can alter our total cost?",
    };
  }
  return {
    fieldKey: "written_change_order_required",
    displayLabel: "Written Change Orders",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "The parsed quote does not clearly specify modification safety rules.",
    contractorQuestion:
      "Can project modifications be authorized verbally, or is a signed change order required?",
  };
}

function mapHomeownerApprovalRequired(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "homeowner_approval_required_for_change_orders",
      displayLabel: "Homeowner Approval Rule",
      detected: true,
      severity: "clear",
      statusText: "Written Approval Required",
      homeownerRiskCopy:
        "Added work appears to require homeowner approval before proceeding.",
      contractorQuestion:
        "Will no added work begin until I approve the change in writing?",
    };
  }
  if (value === false) {
    return {
      fieldKey: "homeowner_approval_required_for_change_orders",
      displayLabel: "Homeowner Approval Rule",
      detected: false,
      severity: "fail",
      statusText: "Approval Guardrail Not Detected",
      homeownerRiskCopy:
        "The parsed quote does not clearly show homeowner authorization rules for added charges.",
      contractorQuestion:
        "Will you add language requiring my written approval before any extra work or charges?",
    };
  }
  return {
    fieldKey: "homeowner_approval_required_for_change_orders",
    displayLabel: "Homeowner Approval Rule",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "WindowMan could not verify homeowner approval rules from the parsed document.",
    contractorQuestion:
      "What exact approval is required before extra charges can be added?",
  };
}

function mapUnilateralPriceAdjustment(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "unilateral_price_adjustment_allowed",
      displayLabel: "Unilateral Price Adjustments",
      detected: true,
      severity: "fail",
      statusText: "Potential Price Exposure",
      homeownerRiskCopy:
        "The parsed quote suggests the company may reserve power to alter your total cost without another signature.",
      contractorQuestion:
        "Will you remove or clarify any provision allowing price changes without my signed consent?",
    };
  }
  if (value === false) {
    return {
      fieldKey: "unilateral_price_adjustment_allowed",
      displayLabel: "Unilateral Price Adjustments",
      detected: false,
      severity: "clear",
      statusText: "No Unilateral Language Detected",
      homeownerRiskCopy:
        "The parsed quote does not show unilateral company price-change power.",
      contractorQuestion:
        "Please confirm the contract total cannot be changed unilaterally.",
    };
  }
  return {
    fieldKey: "unilateral_price_adjustment_allowed",
    displayLabel: "Unilateral Price Adjustments",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "Pricing volatility and contract-adjustment rules are not clearly shown in the parsed quote.",
    contractorQuestion:
      "Does the company reserve any right to alter the contract total without another signature?",
  };
}

function mapSubstrateConditionClause(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "substrate_condition_clause_present",
      displayLabel: "Open-Wall / Substrate Clause",
      detected: true,
      severity: "warn",
      statusText: "Condition Clause Detected",
      homeownerRiskCopy:
        "The quote appears to reference conditions discovered after opening the wall or frame area.",
      contractorQuestion:
        "What costs can be added if substrate, framing, or wall conditions are discovered after removal?",
    };
  }
  if (value === false) {
    return {
      fieldKey: "substrate_condition_clause_present",
      displayLabel: "Open-Wall / Substrate Clause",
      detected: false,
      severity: "warn",
      statusText: "Not Detected in Parsed Quote",
      homeownerRiskCopy:
        "WindowMan did not detect clear open-wall condition language, so surprise-condition handling needs confirmation.",
      contractorQuestion:
        "How are hidden substrate or wall conditions handled if discovered during installation?",
    };
  }
  return {
    fieldKey: "substrate_condition_clause_present",
    displayLabel: "Open-Wall / Substrate Clause",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "Not enough document evidence was available to verify open-wall condition handling.",
    contractorQuestion:
      "Can you provide the written rule for hidden conditions discovered after demolition starts?",
  };
}

function mapRotUnitPricing(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "rot_unit_pricing_present",
      displayLabel: "Wood Rot Unit Prices",
      detected: true,
      severity: "clear",
      statusText: "Standardized Unit Rates",
      homeownerRiskCopy:
        "Wood decay remediation appears to have defined pricing or a written pricing method.",
      contractorQuestion:
        "Please confirm the exact wood rot repair rates that apply before work starts.",
    };
  }
  if (value === false) {
    return {
      fieldKey: "rot_unit_pricing_present",
      displayLabel: "Wood Rot Unit Prices",
      detected: false,
      severity: "warn",
      statusText: "Open Checkbook Risk",
      homeownerRiskCopy:
        "No predefined wood rot rates were detected. Charges may become difficult to compare after demolition.",
      contractorQuestion:
        "What is the written per-foot or per-unit charge if wood rot is uncovered?",
    };
  }
  return {
    fieldKey: "rot_unit_pricing_present",
    displayLabel: "Wood Rot Unit Prices",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "No extraction data was found regarding wood rot remediation pricing.",
    contractorQuestion:
      "If wood rot is found during frame removal, how will that extra billing be calculated?",
  };
}

function mapBuckReplacementPricing(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "buck_replacement_unit_pricing_present",
      displayLabel: "Buck Replacement Pricing",
      detected: true,
      severity: "clear",
      statusText: "Buck Pricing Defined",
      homeownerRiskCopy:
        "Buck replacement pricing appears to be defined before demolition.",
      contractorQuestion:
        "Please confirm the written unit price for buck replacement if needed.",
    };
  }
  if (value === false) {
    return {
      fieldKey: "buck_replacement_unit_pricing_present",
      displayLabel: "Buck Replacement Pricing",
      detected: false,
      severity: "warn",
      statusText: "Pricing Not Detected",
      homeownerRiskCopy:
        "WindowMan did not detect predefined buck replacement pricing in the parsed quote.",
      contractorQuestion:
        "What is the written unit price for buck replacement if hidden damage is found?",
    };
  }
  return {
    fieldKey: "buck_replacement_unit_pricing_present",
    displayLabel: "Buck Replacement Pricing",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "Not enough document evidence was available to verify buck replacement pricing.",
    contractorQuestion:
      "How will buck replacement be priced if it becomes necessary?",
  };
}

function mapSubstrateAllowanceText(value: string | null): ChangeOrderRiskRow {
  if (value === null) {
    return {
      fieldKey: "substrate_allowance_text",
      displayLabel: "Substrate Allowance",
      detected: null,
      severity: "unknown",
      statusText: "Needs Contractor Review",
      evidenceText: null,
      homeownerRiskCopy:
        "WindowMan could not verify substrate allowance language from the parsed document.",
      contractorQuestion:
        "Can you provide written substrate allowance terms before contract signing?",
    };
  }

  const evidence = normalizeEvidenceText(value);
  if (evidence !== null) {
    return {
      fieldKey: "substrate_allowance_text",
      displayLabel: "Substrate Allowance",
      detected: true,
      severity: "clear",
      statusText: "Allowance Language Detected",
      evidenceText: evidence,
      homeownerRiskCopy:
        "The parsed quote includes some substrate allowance language.",
      contractorQuestion:
        "Please confirm exactly what the substrate allowance includes and what happens above that allowance.",
    };
  }

  return {
    fieldKey: "substrate_allowance_text",
    displayLabel: "Substrate Allowance",
    detected: false,
    severity: "warn",
    statusText: "Allowance Not Detected",
    evidenceText: null,
    homeownerRiskCopy:
      "No clear substrate allowance text was detected in the parsed quote.",
    contractorQuestion:
      "Is any substrate repair included in the quote, or is it billed separately?",
  };
}

function mapRemeasurePriceCap(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "remeasure_price_adjustment_cap_present",
      displayLabel: "Remeasure Price Cap",
      detected: true,
      severity: "clear",
      statusText: "Adjustment Cap Detected",
      homeownerRiskCopy:
        "The parsed quote appears to define limits around price changes after remeasure.",
      contractorQuestion:
        "Please confirm the exact cap on any price change after final measurement.",
    };
  }
  if (value === false) {
    return {
      fieldKey: "remeasure_price_adjustment_cap_present",
      displayLabel: "Remeasure Price Cap",
      detected: false,
      severity: "fail",
      statusText: "No Cap Detected",
      homeownerRiskCopy:
        "WindowMan did not detect a cap on price changes after final measurement.",
      contractorQuestion:
        "Will you add a written maximum cap for any remeasure-based price adjustment?",
    };
  }
  return {
    fieldKey: "remeasure_price_adjustment_cap_present",
    displayLabel: "Remeasure Price Cap",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "Remeasure price-adjustment limits were not clear in the parsed quote.",
    contractorQuestion:
      "Can the final price change after remeasurement, and if yes, what is the maximum cap?",
  };
}

function mapHiddenConditionClause(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "hidden_condition_clause_present",
      displayLabel: "Hidden Condition Clause",
      detected: true,
      severity: "warn",
      statusText: "Hidden Condition Language Detected",
      homeownerRiskCopy:
        "The parsed quote appears to reference hidden conditions that may affect price or scope.",
      contractorQuestion:
        "What exact hidden conditions can trigger added charges, and how are those charges priced?",
    };
  }
  if (value === false) {
    return {
      fieldKey: "hidden_condition_clause_present",
      displayLabel: "Hidden Condition Clause",
      detected: false,
      severity: "warn",
      statusText: "Not Detected in Parsed Quote",
      homeownerRiskCopy:
        "WindowMan did not detect clear hidden-condition language, so the rule needs contractor confirmation.",
      contractorQuestion:
        "If hidden conditions are discovered, what written pricing rules apply?",
    };
  }
  return {
    fieldKey: "hidden_condition_clause_present",
    displayLabel: "Hidden Condition Clause",
    detected: null,
    severity: "unknown",
    statusText: "Needs Contractor Review",
    homeownerRiskCopy:
      "Not enough document evidence was available to verify hidden-condition terms.",
    contractorQuestion:
      "Can you provide the written hidden-condition clause before signing?",
  };
}

function mapChangeOrderPolicyText(value: string | null): ChangeOrderRiskRow {
  if (value === null) {
    return {
      fieldKey: "change_order_policy_text",
      displayLabel: "Change-Order Policy Text",
      detected: null,
      severity: "unknown",
      statusText: "Needs Contractor Review",
      evidenceText: null,
      homeownerRiskCopy:
        "The parsed document did not provide enough evidence to verify the change-order policy.",
      contractorQuestion:
        "Where in the contract are the change-order rules stated?",
    };
  }

  const evidence = normalizeEvidenceText(value);
  if (evidence !== null) {
    return {
      fieldKey: "change_order_policy_text",
      displayLabel: "Change-Order Policy Text",
      detected: true,
      severity: "clear",
      statusText: "Policy Language Detected",
      evidenceText: evidence,
      homeownerRiskCopy:
        "The parsed quote includes change-order policy language that should be reviewed before signing.",
      contractorQuestion:
        "Please confirm this is the complete change-order policy and no other change-order terms apply.",
    };
  }

  return {
    fieldKey: "change_order_policy_text",
    displayLabel: "Change-Order Policy Text",
    detected: false,
    severity: "warn",
    statusText: "Policy Not Detected",
    evidenceText: null,
    homeownerRiskCopy:
      "WindowMan did not detect clear change-order policy language in the parsed quote.",
    contractorQuestion:
      "Can you provide the written change-order policy before signing?",
  };
}

export function buildChangeOrderRiskRows(input: ChangeOrderFieldInput): ChangeOrderRiskRow[] {
  return [
    mapWrittenChangeOrderRequired(input.written_change_order_required ?? null),
    mapHomeownerApprovalRequired(input.homeowner_approval_required_for_change_orders ?? null),
    mapUnilateralPriceAdjustment(input.unilateral_price_adjustment_allowed ?? null),
    mapSubstrateConditionClause(input.substrate_condition_clause_present ?? null),
    mapRotUnitPricing(input.rot_unit_pricing_present ?? null),
    mapBuckReplacementPricing(input.buck_replacement_unit_pricing_present ?? null),
    mapSubstrateAllowanceText(input.substrate_allowance_text ?? null),
    mapRemeasurePriceCap(input.remeasure_price_adjustment_cap_present ?? null),
    mapHiddenConditionClause(input.hidden_condition_clause_present ?? null),
    mapChangeOrderPolicyText(input.change_order_policy_text ?? null),
  ];
}
