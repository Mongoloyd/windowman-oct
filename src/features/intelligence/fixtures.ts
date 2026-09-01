import { INTELLIGENCE_INSIGHTS } from "./insightRegistry";
import { transformSnapshotToPublicOracle } from "./publicOracleAdapter";
import type { BuyerChoiceStory, InsightMetric, InsightModule, InternalIntelligenceResponse, PublicOracleResponse, SalesBriefResponse } from "./types";

const metricSets: Record<number, InsightMetric[]> = {
  1: [{ label: "Quoted median", value: "$23,900", detail: "Offered population", tone: "BLUE" }, { label: "Accepted median", value: "$21,400", detail: "Verified accepted", tone: "ORANGE" }],
  2: [{ label: "Middle-band acceptance", value: "38%", detail: "Relationship, not causation", tone: "EMERALD" }],
  3: [{ label: "Median revision", value: "−6.8%", detail: "Initial to accepted", tone: "ORANGE" }],
  4: [{ label: "Median final variance", value: "+3.9%", detail: "Accepted to final", tone: "EMERALD" }],
  5: [{ label: "Accepted per opening", value: "$1,785", detail: "Approved definition required", tone: "ORANGE" }],
  6: [{ label: "Size-adjusted index", value: "0.94×", detail: "Synthetic normalization", tone: "BLUE" }],
  7: [{ label: "Product tier changed", value: "27%", detail: "Accepted revision differs", tone: "ORANGE" }],
  8: [{ label: "Upgrade take rate", value: "42%", detail: "Verified accepted", tone: "EMERALD" }],
  9: [{ label: "Complete scope", value: "64%", detail: "Deterministic checklist", tone: "BLUE" }],
  10: [{ label: "Structured terms", value: "71%", detail: "Accepted population", tone: "EMERALD" }],
  11: [{ label: "Explicit labor warranty", value: "58%", detail: "Accepted population", tone: "BLUE" }],
  12: [{ label: "Clear-quote revision rate", value: "18%", detail: "Synthetic preview", tone: "EMERALD" }],
  13: [{ label: "Lowest quote selected", value: "29%", detail: "Same-project comparisons", tone: "ORANGE" }],
  14: [{ label: "Stable final variance", value: "73%", detail: "Founder-only aggregate", tone: "BLUE" }],
  15: [{ label: "Quoted trend", value: "+4.2%", detail: "Six-month synthetic change", tone: "BLUE" }, { label: "Accepted trend", value: "+2.1%", detail: "Six-month synthetic change", tone: "ORANGE" }],
};
const interpretations: Record<number, [string, string]> = {
  1: ["Verified accepted projects sit below the quoted median in this synthetic cohort.", "This does not prove a market-wide discount or causal effect."],
  2: ["Accepted projects cluster in the middle of the observed quoted range.", "This does not prove that price position caused acceptance."],
  3: ["Accepted revisions tend to remove more value than they add in this preview.", "This does not identify the reason for an individual revision."],
  4: ["Final verified amounts trend modestly above accepted contracts.", "This does not imply every increase is an unexpected change order."],
  5: ["Opening-normalized pricing makes differently sized projects easier to compare.", "This remains disabled live until physical-opening semantics are approved."],
  6: ["Size adjustment reduces misleading comparisons between unlike projects.", "This is not a product-level unit-price claim."],
  7: ["Some accepted revisions change product tier before signing.", "This does not prove a downgrade or upgrade caused acceptance."],
  8: ["Upgraded glass appears in a meaningful share of accepted synthetic projects.", "This is not an approved live premium estimate."],
  9: ["Clear scope evidence can be compared with verified outcomes once governed.", "Missing text does not prove missing work."],
  10: ["Accepted projects frequently state deposits and payment stages explicitly.", "This does not recommend a financing structure."],
  11: ["Specific warranty language is more decision-useful than vague warranty claims.", "This does not evaluate enforceability."],
  12: ["A deterministic clarity checklist can expose avoidable ambiguity.", "This is not an AI quality opinion or contractor grade."],
  13: ["The lowest observed quote is not always the selected quote.", "This does not prove why a homeowner selected a bid."],
  14: ["Internal aggregates can expose stable or volatile offer-to-final behavior.", "This is not a public contractor ranking."],
  15: ["Quoted and accepted populations may move differently over time.", "This does not represent any live market."],
};

const modules: InsightModule[] = INTELLIGENCE_INSIGHTS.map((definition) => ({
  id: definition.id,
  status: "SYNTHETIC_PREVIEW",
  maturity: definition.maturity,
  title: definition.title,
  question: definition.question,
  interpretation: interpretations[definition.number][0],
  notClaimed: interpretations[definition.number][1],
  sampleSize: definition.number === 14 ? 52 : definition.number >= 13 ? 61 : 200,
  outcomeCoveragePct: 41,
  metrics: metricSets[definition.number],
}));

const evidence = {
  governedQuoteCount: 200, outcomeKnownCount: 82, verifiedAcceptedCount: 68, verifiedFinalCount: 31,
  outcomeCoveragePct: 41, exactMatchCount: 154,
  dateFrom: "2026-01-01T00:00:00.000Z", dateTo: "2026-08-31T00:00:00.000Z",
  geographyLabel: "Synthetic multi-region preview", cohortLabel: "10–20 opening residential projects",
  broadened: true, generatedAt: "2026-08-31T12:00:00.000Z",
} as const;

const quoted = { lowCents: 1_280_000, p25Cents: 1_680_000, medianCents: 2_390_000, p75Cents: 3_240_000, highCents: 4_180_000, sampleSize: 200 };
const verifiedAccepted = { lowCents: 1_220_000, p25Cents: 1_570_000, medianCents: 2_140_000, p75Cents: 2_880_000, highCents: 3_760_000, sampleSize: 68 };
const verifiedFinal = { lowCents: 1_350_000, p25Cents: 1_690_000, medianCents: 2_265_000, p75Cents: 3_010_000, highCents: 3_980_000, sampleSize: 31 };

export const INTERNAL_INTELLIGENCE_FIXTURE: InternalIntelligenceResponse = {
  contractVersion: "internal-intelligence-fixture/v1", dataSource: "SYNTHETIC_PREVIEW", evidence, quoted, verifiedAccepted, verifiedFinal, modules,
};

const buyerChoices: BuyerChoiceStory[] = [
  { title: "Value-focused refresh", projectLabel: "12 openings · mid-tier vinyl", quotedRangeCents: [1_820_000, 2_740_000], acceptedCents: 2_080_000, explanation: "Balanced visible scope and product evidence without the highest package tier." },
  { title: "Long-term comfort", projectLabel: "14 openings · upgraded glass", quotedRangeCents: [2_360_000, 3_480_000], acceptedCents: 2_790_000, explanation: "The accepted revision preserves glass and warranty evidence while trimming options." },
  { title: "Budget-conscious upgrade", projectLabel: "10 openings · entry-tier package", quotedRangeCents: [1_440_000, 2_190_000], acceptedCents: 1_720_000, explanation: "Scope stays explicit while optional upgrades are removed before signing." },
];

export const PUBLIC_ORACLE_FIXTURE: PublicOracleResponse = {
  contractVersion: "public-oracle-fixture/v1", dataSource: "SYNTHETIC_PREVIEW", evidence, quoted, verifiedAccepted,
  modules: modules.filter((module) => module.id !== "contractor_discipline"), buyerChoices,
};

export const SALES_BRIEF_FIXTURE: SalesBriefResponse = {
  contractVersion: "sales-brief-fixture/v1", dataSource: "SYNTHETIC_PREVIEW", cohortLabel: evidence.cohortLabel,
  strongestFacts: ["Verified accepted projects sit below the quoted median in this synthetic cohort.", "The lowest observed quote is not always the selected quote.", "Scope clarity and price movement should be discussed separately."],
  approvedLanguage: ["WindowMan keeps quoted and verified accepted evidence separate.", "This preview shows the shape of a future cohort, not live market truth.", "Your estimate still needs its own scope and product review."],
  doNotClaim: ["Do not call an unknown outcome a loss.", "Do not call synthetic values Florida market statistics.", "Do not claim a price relationship caused a sale."],
};

export const PUBLIC_ORACLE_VIEW_MODEL = transformSnapshotToPublicOracle(
  PUBLIC_ORACLE_FIXTURE,
);
