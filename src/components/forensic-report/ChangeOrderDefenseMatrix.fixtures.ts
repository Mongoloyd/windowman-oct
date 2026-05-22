import type {
  ChangeOrderDefenseMatrixProps,
  ChangeOrderRiskRow,
} from "./ChangeOrderDefenseMatrix.types";

function mapWrittenChangeOrderRequired(value: boolean | null): ChangeOrderRiskRow {
  if (value === true) {
    return {
      fieldKey: "written_change_order_required",
      displayLabel: "Written Change Orders",
      detected: true,
      severity: "clear",
      statusText: "Signed Agreement Enforced",
      homeownerRiskCopy:
        "Contractor must issue written forms before tracking extra work.",
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
  if (value !== null && value.trim().length > 0) {
    return {
      fieldKey: "substrate_allowance_text",
      displayLabel: "Substrate Allowance",
      detected: true,
      severity: "clear",
      statusText: "Allowance Language Detected",
      evidenceText: value,
      homeownerRiskCopy:
        "The parsed quote includes some substrate allowance language.",
      contractorQuestion:
        "Please confirm exactly what the substrate allowance includes and what happens above that allowance.",
    };
  }
  if (value === "") {
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
  if (value !== null && value.trim().length > 0) {
    return {
      fieldKey: "change_order_policy_text",
      displayLabel: "Change-Order Policy Text",
      detected: true,
      severity: "clear",
      statusText: "Policy Language Detected",
      evidenceText: value,
      homeownerRiskCopy:
        "The parsed quote includes change-order policy language that should be reviewed before signing.",
      contractorQuestion:
        "Please confirm this is the complete change-order policy and no other change-order terms apply.",
    };
  }
  if (value === "") {
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

interface RawChangeOrderFields {
  written_change_order_required: boolean | null;
  homeowner_approval_required_for_change_orders: boolean | null;
  unilateral_price_adjustment_allowed: boolean | null;
  substrate_condition_clause_present: boolean | null;
  rot_unit_pricing_present: boolean | null;
  buck_replacement_unit_pricing_present: boolean | null;
  substrate_allowance_text: string | null;
  remeasure_price_adjustment_cap_present: boolean | null;
  hidden_condition_clause_present: boolean | null;
  change_order_policy_text: string | null;
}

function buildMappedRows(fields: RawChangeOrderFields): ChangeOrderRiskRow[] {
  return [
    mapWrittenChangeOrderRequired(fields.written_change_order_required),
    mapHomeownerApprovalRequired(fields.homeowner_approval_required_for_change_orders),
    mapUnilateralPriceAdjustment(fields.unilateral_price_adjustment_allowed),
    mapSubstrateConditionClause(fields.substrate_condition_clause_present),
    mapRotUnitPricing(fields.rot_unit_pricing_present),
    mapBuckReplacementPricing(fields.buck_replacement_unit_pricing_present),
    mapSubstrateAllowanceText(fields.substrate_allowance_text),
    mapRemeasurePriceCap(fields.remeasure_price_adjustment_cap_present),
    mapHiddenConditionClause(fields.hidden_condition_clause_present),
    mapChangeOrderPolicyText(fields.change_order_policy_text),
  ];
}

export const FIX_CHANGE_ORDER_HIGH_RISK = {
  risks: buildMappedRows({
    written_change_order_required: false,
    homeowner_approval_required_for_change_orders: false,
    unilateral_price_adjustment_allowed: true,
    substrate_condition_clause_present: true,
    rot_unit_pricing_present: false,
    buck_replacement_unit_pricing_present: false,
    substrate_allowance_text: "",
    remeasure_price_adjustment_cap_present: false,
    hidden_condition_clause_present: true,
    change_order_policy_text: "",
  }),
  policyBlobText:
    "All additional work, substrate repair, rotten wood replacement, and buck repair shall be billed at prevailing rates after discovery. Contractor may adjust contract price based on field conditions. Verbal authorization accepted for urgent repairs.",
  title: "Change-Order Defense Matrix",
  subtitle:
    "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.",
} satisfies ChangeOrderDefenseMatrixProps;

export const FIX_CHANGE_ORDER_PROTECTED_STATE = {
  risks: buildMappedRows({
    written_change_order_required: true,
    homeowner_approval_required_for_change_orders: true,
    unilateral_price_adjustment_allowed: false,
    substrate_condition_clause_present: true,
    rot_unit_pricing_present: true,
    buck_replacement_unit_pricing_present: true,
    substrate_allowance_text:
      "Includes up to $750 substrate repair allowance per opening; additional substrate repair billed at $45/LF with written change order.",
    remeasure_price_adjustment_cap_present: true,
    hidden_condition_clause_present: false,
    change_order_policy_text:
      "No extra work will begin without a signed change order. Homeowner written approval required before any added charges. Remeasure adjustments capped at 5% of contract total.",
  }),
  policyBlobText:
    "Change orders require signed authorization before work begins. Wood rot: $38/LF. Buck replacement: $125 each. Remeasure price adjustment shall not exceed 5% of original contract total.",
  title: "Change-Order Defense Matrix",
  subtitle:
    "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.",
} satisfies ChangeOrderDefenseMatrixProps;

export const FIX_CHANGE_ORDER_UNKNOWN_STATE = {
  risks: buildMappedRows({
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
  title: "Change-Order Defense Matrix",
  subtitle:
    "This is where surprise invoices can hide. WindowMan checks whether the quote defines the rules before demolition starts.",
} satisfies ChangeOrderDefenseMatrixProps;
