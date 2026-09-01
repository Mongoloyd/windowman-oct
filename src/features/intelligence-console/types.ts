export type IntelligenceOutcomeState =
  | "VERIFIED_SOLD"
  | "VERIFIED_NOT_SOLD"
  | "REPORTED_SOLD_UNVERIFIED"
  | "OUTCOME_UNKNOWN";

export type IntelligenceEligibilityState =
  | "ELIGIBLE"
  | "QUARANTINED"
  | "PENDING";

export type ProductClass = "WINDOWS" | "DOORS" | "MIXED_PROJECT";

export type GlassPackage =
  | "LAMINATED"
  | "INSULATED_LAMINATED"
  | "LOW_E"
  | "MIXED"
  | "UNSPECIFIED";

export interface SyntheticProject {
  id: string;
  regionCode:
    | "SYNTHETIC_REGION_A"
    | "SYNTHETIC_REGION_B"
    | "SYNTHETIC_REGION_C";
  projectType: "FULL_HOME" | "PARTIAL_REPLACEMENT" | "DOOR_FOCUSED";
}

export interface SyntheticQuote {
  id: string;
  projectId: string;
  contractorKey: string;
  initialRevisionId: string;
}

export interface SyntheticQuoteRevision {
  id: string;
  quoteId: string;
  revisionNumber: number;
  quotedAt: string;
  quotedTotalCents: number;
  physicalOpeningCount: number;
  productClass: ProductClass;
  glassPackage: GlassPackage;
  scopeCompletenessScore: number;
  quoteClarityScore: number;
  depositBasisPoints: number;
  laborWarrantyMonths: number;
}

export interface SyntheticProjectOutcome {
  projectId: string;
  state: IntelligenceOutcomeState;
  acceptedQuoteRevisionId: string | null;
  acceptedContractTotalCents: number | null;
  changeOrderTotalCents: number | null;
  finalInvoiceTotalCents: number | null;
  verifiedAt: string | null;
}

export interface SyntheticQualityRecord {
  quoteRevisionId: string;
  eligibility: IntelligenceEligibilityState;
  extractionVersion: string | null;
  normalizationVersion: string | null;
  evidenceCoverageBasisPoints: number;
  quarantineReason:
    | "MISSING_PROVENANCE"
    | "MONETARY_RECONCILIATION"
    | "OPENING_MAPPING"
    | null;
}

export interface SyntheticIntelligenceDataset {
  fixtureId: string;
  generatedAt: string;
  label: string;
  isSynthetic: true;
  projects: SyntheticProject[];
  quotes: SyntheticQuote[];
  revisions: SyntheticQuoteRevision[];
  outcomes: SyntheticProjectOutcome[];
  quality: SyntheticQualityRecord[];
}

export type IntelligenceConsoleScenario =
  | "HEALTHY"
  | "THIN_DATA"
  | "NO_VERIFIED_OUTCOMES"
  | "EMPTY"
  | "LOADING"
  | "ERROR";
