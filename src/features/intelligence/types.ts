export type IntelligenceDataSource = "SYNTHETIC_PREVIEW" | "LIVE_AGGREGATE";

export type IntelligenceViewState =
  | "SUCCESS"
  | "LOADING"
  | "ERROR"
  | "INSUFFICIENT_DATA"
  | "SUPPRESSED";

export type InsightStatus =
  | "LIVE"
  | "THIN_DATA"
  | "INSUFFICIENT_DATA"
  | "SUPPRESSED"
  | "AWAITING_OUTCOME_COVERAGE"
  | "SYNTHETIC_PREVIEW";

export type IntelligenceMaturity = "M0" | "M1" | "M2" | "M3" | "M4";

export type IntelligenceAudience = "FOUNDER" | "SALES" | "PUBLIC";

export type OutcomeClass =
  | "OUTCOME_UNKNOWN"
  | "REPORTED_ACCEPTED_UNVERIFIED"
  | "VERIFIED_ACCEPTED"
  | "VERIFIED_NOT_ACCEPTED"
  | "VERIFIED_CANCELLED"
  | "VERIFIED_INSTALLED"
  | "VERIFIED_FINAL_INVOICE"
  | "VERIFIED_PAID";

export type MoneyCents = number;

export type InsightId =
  | "quoted_vs_accepted_price"
  | "acceptance_by_price_position"
  | "initial_to_accepted_delta"
  | "accepted_to_final_delta"
  | "price_per_opening"
  | "size_adjusted_price"
  | "product_tier_migration"
  | "glass_package_premium"
  | "scope_completeness"
  | "payment_structure"
  | "warranty_specificity"
  | "quote_clarity"
  | "multi_bid_spread"
  | "contractor_discipline"
  | "market_movement";

export type InsightDefinition = {
  id: InsightId;
  number: number;
  title: string;
  question: string;
  maturity: IntelligenceMaturity;
  audiences: IntelligenceAudience[];
  publicTitle: string;
};
export type EvidenceSummary = {
  governedQuoteCount: number;
  outcomeKnownCount: number;
  verifiedAcceptedCount: number;
  verifiedFinalCount: number;
  outcomeCoveragePct: number;
  exactMatchCount: number;
  dateFrom: string;
  dateTo: string;
  geographyLabel: string;
  cohortLabel: string;
  broadened: boolean;
  generatedAt: string;
};

export type DistributionSummary = {
  lowCents: MoneyCents;
  p25Cents: MoneyCents;
  medianCents: MoneyCents;
  p75Cents: MoneyCents;
  highCents: MoneyCents;
  sampleSize: number;
};

export type InsightMetric = {
  label: string;
  value: string;
  detail: string;
  tone: "BLUE" | "ORANGE" | "EMERALD" | "SLATE";
};

export type InsightModule = {
  id: InsightId;
  status: InsightStatus;
  maturity: IntelligenceMaturity;
  title: string;
  question: string;
  interpretation: string;
  notClaimed: string;
  sampleSize: number;
  outcomeCoveragePct: number;
  metrics: InsightMetric[];
};

/** @deprecated Legacy visual-only story. The governed public adapter never projects it. */
export type BuyerChoiceStory = {
  title: string;
  projectLabel: string;
  quotedRangeCents: [MoneyCents, MoneyCents];
  acceptedCents: MoneyCents;
  explanation: string;
};

export type InternalIntelligenceResponse = {
  contractVersion: "internal-intelligence-fixture/v1";
  dataSource: IntelligenceDataSource;
  evidence: EvidenceSummary;
  quoted: DistributionSummary;
  verifiedAccepted: DistributionSummary;
  verifiedFinal: DistributionSummary;
  modules: InsightModule[];
};

export type SalesBriefResponse = {
  contractVersion: "sales-brief-fixture/v1";
  dataSource: IntelligenceDataSource;
  cohortLabel: string;
  strongestFacts: string[];
  approvedLanguage: string[];
  doNotClaim: string[];
};

export type PublicOracleResponse = {
  contractVersion: "public-oracle-fixture/v1";
  dataSource: IntelligenceDataSource;
  evidence: EvidenceSummary;
  quoted: DistributionSummary;
  verifiedAccepted: DistributionSummary;
  modules: InsightModule[];
  buyerChoices: BuyerChoiceStory[];
};

export type TruthReportBenchmarkResponse = {
  contractVersion: "truth-report-benchmark-future/v1";
  status: "NOT_IMPLEMENTED";
};
