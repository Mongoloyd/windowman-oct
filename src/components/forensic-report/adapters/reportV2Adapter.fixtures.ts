import type { V2FullReportSource } from "./reportAccessAdapter.types";

export interface LabCodeComplianceRaw {
  noa_identifiers?: string[] | null;
  fl_product_approval_identifiers?: string[] | null;
  dp_ratings?: string[] | null;
  hvhz_language?: string | null;
  miami_dade_language?: string | null;
  impact_language?: string | null;
  laminated_glass_language?: string | null;
  jurisdiction_context?: string | null;
  source_notes?: string[] | null;
}

export interface LabFinancialIntegrityRaw {
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
}

export interface LabWarrantyFinePrintRaw {
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
}

export interface LabSectionsShape {
  code_compliance?: LabCodeComplianceRaw | null;
  financial_integrity?: LabFinancialIntegrityRaw | null;
  warranty_fine_print?: LabWarrantyFinePrintRaw | null;
}

export type MockLabReportSource = V2FullReportSource & {
  lab_sections?: LabSectionsShape | null;
};

export const MOCK_AUTHORIZED_FULL_REPORT_SOURCE = {
  proof_of_read: {
    contractor_name: "BrightView Window",
    opening_count: 14,
    line_item_count: 3,
    page_count: 4,
    document_type: "estimate",
  },
  confidence_score: 0.91,
  full_json: {
    extraction: {
      contractor_name: "BrightView Window Co.",
      opening_count: 14,
      total_quoted_price: 51800,
      change_order_policy_text:
        "All additional work, substrate repair, rotten wood replacement, and buck repair shall be billed at prevailing rates after discovery. Contractor may adjust contract price based on field conditions.",
      written_change_order_required: false,
      homeowner_approval_required_for_change_orders: false,
      unilateral_price_adjustment_allowed: true,
      substrate_condition_clause_present: true,
      rot_unit_pricing_present: true,
      buck_replacement_unit_pricing_present: false,
      substrate_allowance_text:
        "Wood rot and substrate repair billed at $95/LF if discovered during removal.",
      remeasure_price_adjustment_cap_present: false,
      debris_removal_included: true,
      waterproofing_method_text:
        "Polyurethane sealant and flashing tape installed per manufacturer installation guide.",
      stucco_repair_included: false,
      post_install_stucco_excluded: true,
      permit_fees_itemized: true,
      wall_repair_scope: "Stucco patch as needed after installation.",
      permits: {
        included: true,
        responsible_party: "Contractor",
        details: "Permit filing and municipal fees included in contract total.",
      },
      installation: {
        scope_detail:
          "Remove and replace impact units. We do not exclude cleanup from base scope, but final disposal is subject to field conditions.",
        disposal_included: true,
        accessories_mentioned: true,
      },
      line_items: [
        {
          description: "Impact Window 32x54 — Living Room",
          quantity: 10,
          unit_price: 1250,
          total_price: 12500,
          brand: "PGT WinGuard",
          series: "WinGuard Aluminum",
          dimensions: '32" x 54"',
          opening_location: "Living Room",
          opening_tag: "W-01",
          noa_number: "FL12345.1",
          dp_rating: "DP-50",
          glass_package_text: "Impact laminated insulated glass with LoE-366",
          glass_makeup_type: "insulated_laminated",
          glass_low_e_present: true,
          glass_argon_present: true,
          glass_tint_text: "Clear with LoE",
          glass_spec_complete: true,
          product_assignment_text: "PGT WinGuard 32x54 single hung",
        },
        {
          description: "Impact Horizontal Roller Window — Bedroom",
          quantity: 4,
          unit_price: 1325,
          total_price: 5300,
          brand: "PGT WinGuard",
          series: "WinGuard Aluminum",
          dimensions: '36" x 48"',
          opening_location: "Bedroom",
          opening_tag: "W-02",
          noa_number: "FL12345.2",
          dp_rating: "DP-45",
          glass_package_text: "Impact laminated insulated glass",
          glass_makeup_type: "insulated_laminated",
          glass_low_e_present: true,
          glass_argon_present: false,
          glass_tint_text: null,
          glass_spec_complete: true,
          product_assignment_text: "PGT WinGuard horizontal roller 36x48",
        },
        {
          description: "Impact Entry Door — Front Entry",
          quantity: 1,
          unit_price: 2200,
          brand: "Therma-Tru",
          series: "Classic-Craft",
          dimensions: '36" x 80"',
          opening_location: "Front Entry",
          opening_tag: "D-01",
          noa_number: null,
          dp_rating: "DP-50",
          glass_package_text: "Decorative impact glass insert",
          glass_makeup_type: "laminated",
          glass_low_e_present: null,
          glass_argon_present: null,
          glass_tint_text: "Decorative",
          glass_spec_complete: false,
          product_assignment_text: "Therma-Tru impact entry door with sidelite",
        },
      ],
    },
    derived_metrics: {
      totals: {
        contract_total: 51800,
        discount_subtotal: 0,
        install_like_subtotal: 8500,
        accessory_subtotal: 1800,
      },
    },
  },
  lab_sections: {
    code_compliance: {
      hvhz_language:
        "Install includes HVHZ-compliant anchoring per manufacturer specification (lab fixture excerpt).",
      impact_language:
        "Impact-rated windows and entry door referenced across multiple line items in the parsed quote.",
      laminated_glass_language:
        "Laminated and insulated laminated glass packages referenced on window and door line items.",
      jurisdiction_context:
        "Broward County — Florida Product Approval documentation is expected on quoted openings.",
      source_notes: [
        "Entry door line item shows a DP rating but no NOA / FL approval identifier in parsed text.",
        "This section checks whether the quote documents proof — it does not validate approvals.",
      ],
    },
    financial_integrity: {
      deposit_text: "50% deposit due at contract signing (lab fixture excerpt).",
      payment_schedule_text:
        "Remaining balance due upon substantial completion; payment milestones are referenced but not itemized by date.",
      final_payment_timing_text:
        "Final payment referenced before final inspection — timing should be confirmed in writing.",
      permit_fee_text:
        "Permit filing and municipal fees included in contract total per permit responsibility block.",
      line_item_transparency_text:
        "Quote lists three priced line groups; accessory and disposal breakout is not fully itemized.",
      math_confidence_text:
        "Structured estimate layout parsed with high OCR confidence in the lab fixture.",
      source_notes: [
        "Unilateral price adjustment language detected in the change-order policy block.",
      ],
    },
    warranty_fine_print: {
      labor_warranty_text:
        "Labor warranty duration and scope are not clearly stated in the parsed fixture text.",
      manufacturer_warranty_text:
        "Manufacturer warranty is referenced indirectly through brand and series fields only.",
      warranty_exclusions_text:
        "Water intrusion damage exclusion language referenced in fine-print scan (lab fixture).",
      cancellation_language: "Cancellation policy not detected in the parsed fixture.",
      subject_to_remeasure_language:
        "Contract subject to field remeasure with no documented price adjustment cap in parsed policy text.",
      change_order_language:
        "Additional work billed at prevailing rates; verbal authorization accepted for urgent repairs (lab excerpt).",
      source_notes: [
        "Written change-order approval requirement not detected in parsed policy text.",
      ],
    },
  },
} satisfies MockLabReportSource;
