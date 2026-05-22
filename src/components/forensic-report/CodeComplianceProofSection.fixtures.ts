/**
 * CodeComplianceProofSection fixtures — derives from MOCK_AUTHORIZED_FULL_REPORT_SOURCE.
 */
import {
  MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
  type MockLabReportSource,
} from "./adapters/reportV2Adapter.fixtures";
import type {
  CodeComplianceProofRow,
  CodeComplianceProofSectionProps,
  CodeComplianceRowStatus,
  CodeComplianceStatus,
} from "./CodeComplianceProofSection.types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => asString(entry))
    .filter((entry): entry is string => entry !== null);
}

function getLineItems(source: MockLabReportSource): Record<string, unknown>[] {
  const fullJson = source.full_json;
  if (!isRecord(fullJson)) return [];
  const extraction = fullJson.extraction;
  if (!isRecord(extraction)) return [];
  const items = extraction.line_items;
  if (!Array.isArray(items)) return [];
  return items.filter(isRecord);
}

function collectUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function summarizeMultiValueLabel(count: number, singular: string, plural: string): string {
  if (count === 0) return "Not documented";
  if (count === 1) return `1 ${singular}`;
  return `${count} ${plural}`;
}

function rowStatusFromCoverage(documented: number, total: number): CodeComplianceRowStatus {
  if (total === 0 || documented === 0) return "missing";
  if (documented < total) return "partial";
  return "documented";
}

function deriveSectionStatus(rows: CodeComplianceProofRow[]): {
  status: CodeComplianceStatus;
  statusLabel: string;
} {
  if (rows.length === 0) {
    return { status: "missing", statusLabel: "Missing From Quote" };
  }

  const statuses = rows.map((row) => row.status);
  if (statuses.every((status) => status === "documented")) {
    return { status: "documented", statusLabel: "Documented" };
  }
  if (statuses.every((status) => status === "missing")) {
    return { status: "missing", statusLabel: "Missing From Quote" };
  }
  if (statuses.some((status) => status === "unclear")) {
    return { status: "unclear", statusLabel: "Needs Verification" };
  }
  return { status: "partial", statusLabel: "Partial" };
}

function buildNoaRow(
  lineItems: Record<string, unknown>[],
  rawNoas: string[],
): CodeComplianceProofRow {
  const fromLines = lineItems
    .map((item) => asString(item.noa_number))
    .filter((value): value is string => value !== null);
  const identifiers = collectUnique([...rawNoas, ...fromLines]);
  const totalOpenings = lineItems.length;
  const documented = fromLines.length;

  const status =
    identifiers.length === 0
      ? "missing"
      : rowStatusFromCoverage(documented, totalOpenings > 0 ? totalOpenings : identifiers.length);

  return {
    id: "noa-fl-approval",
    label: "NOA / FL approval identifiers",
    value:
      identifiers.length === 0
        ? "Not documented"
        : summarizeMultiValueLabel(identifiers.length, "identifier documented", "identifiers documented"),
    detail:
      identifiers.length === 0
        ? "The fixture does not show a specific NOA / FL approval identifier on every opening."
        : documented < totalOpenings && totalOpenings > 0
          ? `${documented} of ${totalOpenings} line items include an identifier in parsed text.`
          : "Identifiers appear in parsed line-item fields — verification against the approval database is not performed here.",
    examples: identifiers.slice(0, 3),
    status,
    severity: status === "missing" ? "danger" : status === "partial" ? "warning" : "info",
  };
}

function buildDpRow(
  lineItems: Record<string, unknown>[],
  rawDps: string[],
): CodeComplianceProofRow {
  const fromLines = lineItems
    .map((item) => asString(item.dp_rating))
    .filter((value): value is string => value !== null);
  const ratings = collectUnique([...rawDps, ...fromLines]);
  const totalOpenings = lineItems.length;
  const documented = fromLines.length;

  const status =
    ratings.length === 0
      ? "missing"
      : rowStatusFromCoverage(documented, totalOpenings > 0 ? totalOpenings : ratings.length);

  return {
    id: "dp-rating-visibility",
    label: "DP rating visibility",
    value:
      ratings.length === 0
        ? "Not documented"
        : summarizeMultiValueLabel(ratings.length, "rating found", "ratings found"),
    detail:
      ratings.length === 0
        ? "DP rating visibility helps verify performance expectations, but none were detected in the lab source."
        : "DP ratings appear in parsed line items — this checks documentation visibility only.",
    examples: ratings.slice(0, 3),
    status,
    severity: status === "missing" ? "warning" : "info",
  };
}

function buildTextRow(
  id: string,
  label: string,
  text: string | null,
  missingDetail: string,
): CodeComplianceProofRow {
  if (!text) {
    return {
      id,
      label,
      value: "Not documented",
      detail: missingDetail,
      status: "missing",
      severity: "warning",
    };
  }

  return {
    id,
    label,
    value: "Language documented",
    detail: text.length > 160 ? `${text.slice(0, 157)}…` : text,
    status: "documented",
    severity: "info",
  };
}

export function buildCodeComplianceProofProps(
  source: MockLabReportSource = MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
): CodeComplianceProofSectionProps {
  const raw = source.lab_sections?.code_compliance ?? null;
  const lineItems = getLineItems(source);

  const rows: CodeComplianceProofRow[] = [
    buildNoaRow(lineItems, asStringArray(raw?.noa_identifiers)),
    buildDpRow(lineItems, asStringArray(raw?.dp_ratings)),
    buildTextRow(
      "hvhz-language",
      "HVHZ / high-velocity language",
      asString(raw?.hvhz_language),
      "HVHZ-related install language is not visible in the lab source.",
    ),
    buildTextRow(
      "impact-language",
      "Impact product language",
      asString(raw?.impact_language),
      "Impact-rated product language is not clearly documented in the lab source.",
    ),
    buildTextRow(
      "laminated-glass",
      "Laminated glass / interlayer language",
      asString(raw?.laminated_glass_language),
      "Laminated or interlayer glass language is not documented in the lab source.",
    ),
    buildTextRow(
      "jurisdiction-context",
      "Jurisdiction / county context",
      asString(raw?.jurisdiction_context),
      "County or jurisdiction context is not documented in the lab source.",
    ),
  ];

  const sourceNotes = asStringArray(raw?.source_notes);
  if (sourceNotes.length > 0) {
    rows.push({
      id: "compliance-source-notes",
      label: "Compliance proof notes",
      value: summarizeMultiValueLabel(sourceNotes.length, "note captured", "notes captured"),
      detail: sourceNotes[0],
      examples: sourceNotes.slice(0, 3),
      status: "partial",
      severity: "warning",
    });
  }

  const { status, statusLabel } = deriveSectionStatus(rows);
  const missingStateMessage =
    status === "missing"
      ? "No documented NOA / FL approval identifier, DP rating, or compliance language found in the lab source."
      : null;

  const footerBadges = collectUnique(
    rows.flatMap((row) => {
      if (row.status === "documented") return ["Documented"];
      if (row.status === "partial") return ["Partial"];
      if (row.status === "missing") return ["Missing"];
      if (row.status === "unclear") return ["Needs Verification"];
      return [];
    }),
  ).slice(0, 4);

  return {
    title: "Code & Compliance Proof",
    subtitle:
      "Does this quote document the code and product proof a homeowner would expect to see before signing?",
    status,
    statusLabel,
    rows,
    whyItMatters:
      "This section checks whether the quote shows approval numbers, performance ratings, and compliance language. It does not independently validate whether a product is approved or legal to install.",
    missingStateMessage,
    footerBadges,
  };
}
