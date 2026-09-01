import type {
  IntelligenceConsoleScenario,
  IntelligenceOutcomeState,
  SyntheticIntelligenceDataset,
  SyntheticProject,
  SyntheticProjectOutcome,
  SyntheticQualityRecord,
  SyntheticQuote,
  SyntheticQuoteRevision,
} from "./types";

const GENERATED_AT = "2026-08-31T12:00:00.000Z";
const PROJECT_COUNT = 80;
const QUOTE_COUNT = 200;

const projectId = (index: number) =>
  `synthetic-project-${String(index + 1).padStart(3, "0")}`;
const quoteId = (index: number) =>
  `synthetic-quote-${String(index + 1).padStart(3, "0")}`;
const revisionId = (quoteIndex: number, revisionNumber: number) =>
  `${quoteId(quoteIndex)}-revision-${revisionNumber}`;

function buildProjects(): SyntheticProject[] {
  const regions: SyntheticProject["regionCode"][] = [
    "SYNTHETIC_REGION_A",
    "SYNTHETIC_REGION_B",
    "SYNTHETIC_REGION_C",
  ];
  const projectTypes: SyntheticProject["projectType"][] = [
    "FULL_HOME",
    "PARTIAL_REPLACEMENT",
    "DOOR_FOCUSED",
  ];

  return Array.from({ length: PROJECT_COUNT }, (_, index) => ({
    id: projectId(index),
    regionCode: regions[index % regions.length],
    projectType: projectTypes[(index * 2) % projectTypes.length],
  }));
}

function buildQuotesAndInitialRevisions(): {
  quotes: SyntheticQuote[];
  revisions: SyntheticQuoteRevision[];
} {
  const productClasses: SyntheticQuoteRevision["productClass"][] = [
    "WINDOWS",
    "MIXED_PROJECT",
    "DOORS",
  ];
  const glassPackages: SyntheticQuoteRevision["glassPackage"][] = [
    "LAMINATED",
    "INSULATED_LAMINATED",
    "LOW_E",
    "MIXED",
    "UNSPECIFIED",
  ];

  const quotes = Array.from(
    { length: QUOTE_COUNT },
    (_, index): SyntheticQuote => ({
      id: quoteId(index),
      projectId: projectId(index % PROJECT_COUNT),
      contractorKey: `synthetic-contractor-${String((index % 12) + 1).padStart(2, "0")}`,
      initialRevisionId: revisionId(index, 1),
    }),
  );

  const revisions = quotes.map((quote, index): SyntheticQuoteRevision => {
    const physicalOpeningCount = 6 + ((index * 7) % 25);
    const pricePerOpeningCents = 185_000 + ((index * 19_700) % 215_000);
    const scopeAdjustmentCents = (index * 37_000) % 600_000;

    return {
      id: quote.initialRevisionId,
      quoteId: quote.id,
      revisionNumber: 1,
      quotedAt: new Date(
        Date.UTC(2026, index % 8, 1 + (index % 27)),
      ).toISOString(),
      quotedTotalCents:
        physicalOpeningCount * pricePerOpeningCents + scopeAdjustmentCents,
      physicalOpeningCount,
      productClass: productClasses[index % productClasses.length],
      glassPackage: glassPackages[(index * 3) % glassPackages.length],
      scopeCompletenessScore: 54 + ((index * 11) % 47),
      quoteClarityScore: 48 + ((index * 13) % 53),
      depositBasisPoints: 1_000 + (index % 5) * 500,
      laborWarrantyMonths: [12, 24, 60, 120][index % 4],
    };
  });

  return { quotes, revisions };
}

function outcomeStateForProject(index: number): IntelligenceOutcomeState {
  const bucket = index % 10;
  if (bucket <= 3) return "VERIFIED_SOLD";
  if (bucket <= 5) return "VERIFIED_NOT_SOLD";
  if (bucket === 6) return "REPORTED_SOLD_UNVERIFIED";
  return "OUTCOME_UNKNOWN";
}

function buildHealthyDataset(): SyntheticIntelligenceDataset {
  const projects = buildProjects();
  const { quotes, revisions: initialRevisions } =
    buildQuotesAndInitialRevisions();
  const acceptedRevisions: SyntheticQuoteRevision[] = [];

  const outcomes = projects.map(
    (project, projectIndex): SyntheticProjectOutcome => {
      const state = outcomeStateForProject(projectIndex);
      const selectedQuote =
        quotes.find((quote) => quote.projectId === project.id) ?? null;
      const initialRevision = selectedQuote
        ? initialRevisions.find(
            (revision) => revision.id === selectedQuote.initialRevisionId,
          ) ?? null
        : null;

      if (state !== "VERIFIED_SOLD" || !selectedQuote || !initialRevision) {
        return {
          projectId: project.id,
          state,
          acceptedQuoteRevisionId: null,
          acceptedContractTotalCents: null,
          changeOrderTotalCents: null,
          finalInvoiceTotalCents: null,
          verifiedAt: null,
        };
      }

      const negotiatedDeltaCents = Math.round(
        (initialRevision.quotedTotalCents *
          (250 + (projectIndex % 4) * 75)) /
          10_000,
      );
      const acceptedContractTotalCents =
        initialRevision.quotedTotalCents - negotiatedDeltaCents;
      const changeOrderTotalCents =
        projectIndex % 3 === 0
          ? 75_000 + ((projectIndex * 21_000) % 275_000)
          : 0;
      const quoteIndex = Number(selectedQuote.id.slice(-3)) - 1;
      const acceptedRevision: SyntheticQuoteRevision = {
        ...initialRevision,
        id: revisionId(quoteIndex, 2),
        revisionNumber: 2,
        quotedAt: new Date(
          Date.parse(initialRevision.quotedAt) + 7 * 86_400_000,
        ).toISOString(),
        quotedTotalCents: acceptedContractTotalCents,
        scopeCompletenessScore: Math.min(
          100,
          initialRevision.scopeCompletenessScore + 4,
        ),
        quoteClarityScore: Math.min(
          100,
          initialRevision.quoteClarityScore + 6,
        ),
      };
      acceptedRevisions.push(acceptedRevision);

      return {
        projectId: project.id,
        state,
        acceptedQuoteRevisionId: acceptedRevision.id,
        acceptedContractTotalCents,
        changeOrderTotalCents,
        finalInvoiceTotalCents:
          acceptedContractTotalCents + changeOrderTotalCents,
        verifiedAt: new Date(
          Date.UTC(2026, 7, 1 + (projectIndex % 27)),
        ).toISOString(),
      };
    },
  );

  const revisions = [...initialRevisions, ...acceptedRevisions];
  const quality = revisions.map(
    (revision, index): SyntheticQualityRecord => {
      const eligibility =
        index % 13 === 0
          ? "QUARANTINED"
          : index % 11 === 0
            ? "PENDING"
            : "ELIGIBLE";

      return {
        quoteRevisionId: revision.id,
        eligibility,
        extractionVersion:
          index % 17 === 0 ? null : "intelligence-extraction-v0.1",
        normalizationVersion:
          index % 19 === 0 ? null : "normalization-v0.1",
        evidenceCoverageBasisPoints: 6_200 + ((index * 173) % 3_801),
        quarantineReason:
          eligibility === "QUARANTINED"
            ? (
                [
                  "MISSING_PROVENANCE",
                  "MONETARY_RECONCILIATION",
                  "OPENING_MAPPING",
                ] as const
              )[index % 3]
            : null,
      };
    },
  );

  return {
    fixtureId: "internal-intelligence-healthy-v0",
    generatedAt: GENERATED_AT,
    label: "Healthy synthetic population",
    isSynthetic: true,
    projects,
    quotes,
    revisions,
    outcomes,
    quality,
  };
}

function subsetDataset(
  source: SyntheticIntelligenceDataset,
  projectLimit: number,
  fixtureId: string,
  label: string,
): SyntheticIntelligenceDataset {
  const projects = source.projects.slice(0, projectLimit);
  const projectIds = new Set(projects.map((project) => project.id));
  const quotes = source.quotes.filter((quote) =>
    projectIds.has(quote.projectId),
  );
  const quoteIds = new Set(quotes.map((quote) => quote.id));
  const revisions = source.revisions.filter((revision) =>
    quoteIds.has(revision.quoteId),
  );
  const revisionIds = new Set(revisions.map((revision) => revision.id));

  return {
    ...source,
    fixtureId,
    label,
    projects,
    quotes,
    revisions,
    outcomes: source.outcomes.filter((outcome) =>
      projectIds.has(outcome.projectId),
    ),
    quality: source.quality.filter((record) =>
      revisionIds.has(record.quoteRevisionId),
    ),
  };
}

const HEALTHY_DATASET = buildHealthyDataset();
const THIN_DATASET = subsetDataset(
  HEALTHY_DATASET,
  6,
  "internal-intelligence-thin-v0",
  "Thin synthetic population",
);
const NO_VERIFIED_OUTCOMES_DATASET: SyntheticIntelligenceDataset = {
  ...HEALTHY_DATASET,
  fixtureId: "internal-intelligence-no-outcomes-v0",
  label: "No verified outcomes",
  outcomes: HEALTHY_DATASET.outcomes.map((outcome) => ({
    ...outcome,
    state: "OUTCOME_UNKNOWN",
    acceptedQuoteRevisionId: null,
    acceptedContractTotalCents: null,
    changeOrderTotalCents: null,
    finalInvoiceTotalCents: null,
    verifiedAt: null,
  })),
};
const EMPTY_DATASET: SyntheticIntelligenceDataset = {
  fixtureId: "internal-intelligence-empty-v0",
  generatedAt: GENERATED_AT,
  label: "Empty synthetic population",
  isSynthetic: true,
  projects: [],
  quotes: [],
  revisions: [],
  outcomes: [],
  quality: [],
};
export const SYNTHETIC_INTELLIGENCE_DATASETS: Record<
  Exclude<IntelligenceConsoleScenario, "LOADING" | "ERROR">,
  SyntheticIntelligenceDataset
> = {
  HEALTHY: HEALTHY_DATASET,
  THIN_DATA: THIN_DATASET,
  NO_VERIFIED_OUTCOMES: NO_VERIFIED_OUTCOMES_DATASET,
  EMPTY: EMPTY_DATASET,
};
