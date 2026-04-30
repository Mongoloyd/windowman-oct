/**
 * Self-contained fixture for the Dark Forensic Dossier dev page.
 * Mirrors the 37-signal extraction shape. Cosmetic only — not real data.
 */

export interface DossierFinding {
  signalNumber: number;
  title: string;
  explanation: string;
  severity: "critical" | "warning" | "clear";
}

export interface DossierVulnerability {
  signalNumber: number;
  label: string;
  detail: string;
  triggered: boolean;
}

export interface DossierFixture {
  // Executive
  grade: string;
  signalsExtracted: number;
  signalsTotal: number;
  criticalFlags: number;
  confidencePct: number;
  verdict: string;

  // Findings
  topFindings: DossierFinding[];

  // Property
  homeowner_name: string;
  property_address: string;
  property_type: string;
  wind_zone: string;
  code_jurisdiction: string;

  // Scope
  total_openings: number;
  opening_types: string;
  installation_method: string;
  price_per_opening: string;

  // Product
  brand_manufacturer: string;
  product_series: string;
  dp_rating: string;
  dp_compliant: boolean;
  impact_rating: string;
  impact_compliant: boolean;
  glass_composition: string;
  frame_material: string;

  // Compliance
  fl_approval_number: string;
  mdc_noa_number: string;
  fbc_edition: string;
  permit_fee_disclosed: boolean;
  missing_code_language: boolean;

  // Financial
  total_contract_price: string;
  market_index_price: string;
  overpayment_total: string;
  overpayment_pct: string;
  deposit_amount: string;
  deposit_percentage: string;
  payment_schedule: string;
  warranty_glass: string;
  warranty_frame: string;
  warranty_labor: string;

  // Vulnerabilities (signals 33-37)
  vulnerabilities: DossierVulnerability[];
}

export const SAMPLE_DOSSIER: DossierFixture = {
  grade: "D-",
  signalsExtracted: 31,
  signalsTotal: 37,
  criticalFlags: 7,
  confidencePct: 94,
  verdict:
    "This quote shows significant pricing inflation, missing code-required disclosures, and warranty gaps that put you at financial and structural risk. Do not sign without renegotiating the issues flagged below.",

  topFindings: [
    {
      signalNumber: 14,
      title: "DP Rating Below HVHZ Requirement",
      explanation:
        "Quoted product lists DP +50/-55, but your wind zone (HVHZ) requires DP +65/-65 minimum. This product would not pass inspection and could be ordered to be removed at your expense.",
      severity: "critical",
    },
    {
      signalNumber: 22,
      title: "Permit Fee Buried in Lump Sum",
      explanation:
        "Florida law requires permit fees be itemized separately. Your contract bundles them into the total, making it impossible to verify you are not being double-charged.",
      severity: "critical",
    },
    {
      signalNumber: 27,
      title: "Lifetime Warranty Excludes Glass",
      explanation:
        "The 'lifetime' warranty explicitly excludes the glass IGU — the most failure-prone component. Real coverage drops to 5 years, well below market standard for impact products.",
      severity: "critical",
    },
  ],

  homeowner_name: "Marcus Reyes",
  property_address: "1428 Coral Reef Dr, Miami, FL 33149",
  property_type: "Single-family, 2-story CBS",
  wind_zone: "HVHZ",
  code_jurisdiction: "Miami-Dade County",

  total_openings: 14,
  opening_types: "11 single-hung, 2 sliding glass doors, 1 fixed picture",
  installation_method: "Buck-mounted, foam-set",
  price_per_opening: "$3,214",

  brand_manufacturer: "PGT Industries",
  product_series: "WinGuard Vinyl Series 5500",
  dp_rating: "+50 / -55",
  dp_compliant: false,
  impact_rating: "Large Missile Level D",
  impact_compliant: true,
  glass_composition: "5/16\" laminated SGP interlayer",
  frame_material: "Vinyl, reinforced",

  fl_approval_number: "FL-23456-R7",
  mdc_noa_number: "NOA 22-0314.05",
  fbc_edition: "2023 (8th Edition)",
  permit_fee_disclosed: false,
  missing_code_language: true,

  total_contract_price: "$45,000",
  market_index_price: "$36,200",
  overpayment_total: "$8,800",
  overpayment_pct: "+24.3%",
  deposit_amount: "$22,500",
  deposit_percentage: "50%",
  payment_schedule: "50% deposit / 50% on delivery",
  warranty_glass: "5 years",
  warranty_frame: "Lifetime (limited)",
  warranty_labor: "1 year",

  vulnerabilities: [
    {
      signalNumber: 33,
      label: "No Right-to-Cancel Notice",
      detail:
        "Florida requires a 3-day cancellation clause for in-home solicitation. This contract omits it.",
      triggered: true,
    },
    {
      signalNumber: 34,
      label: "Lien Waiver Language Present",
      detail: "Contract includes a proper conditional lien waiver for progress payments.",
      triggered: false,
    },
    {
      signalNumber: 35,
      label: "Subcontractor Disclosure Missing",
      detail:
        "Installation is subcontracted, but the subcontractor's license number is not listed in the contract.",
      triggered: true,
    },
    {
      signalNumber: 36,
      label: "Change Order Process Defined",
      detail: "Contract clearly defines written-only change order process with signed authorization.",
      triggered: false,
    },
    {
      signalNumber: 37,
      label: "Arbitration Clause Restricts Venue",
      detail:
        "Mandatory arbitration clause forces venue to contractor's home county and waives jury trial.",
      triggered: true,
    },
  ],
};
