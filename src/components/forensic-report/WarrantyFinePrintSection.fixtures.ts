/**
 * WarrantyFinePrintSection fixtures — derives from MOCK_AUTHORIZED_FULL_REPORT_SOURCE.
 */
import {
  MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
  type MockLabReportSource,
} from "./adapters/reportV2Adapter.fixtures";
import type {
  WarrantyFinePrintRow,
  WarrantyFinePrintRowStatus,
  WarrantyFinePrintSectionProps,
  WarrantyFinePrintStatus,
} from "./WarrantyFinePrintSection.types";

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

function collectUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function deriveSectionStatus(rows: WarrantyFinePrintRow[]): {
  status: WarrantyFinePrintStatus;
  statusLabel: string;
} {
  if (rows.length === 0) {
    return { status: "unclear", statusLabel: "Unclear" };
  }

  const statuses = rows.map((row) => row.status);
  if (statuses.some((status) => status === "exposed")) {
    return { status: "exposed", statusLabel: "Exposed" };
  }
  if (statuses.every((status) => status === "protected")) {
    return { status: "protected", statusLabel: "Documented" };
  }
  if (statuses.every((status) => status === "unclear")) {
    return { status: "unclear", statusLabel: "Unclear" };
  }
  return { status: "partial", statusLabel: "Partial" };
}

function buildWarrantyRow(
  id: string,
  label: string,
  text: string | null,
  missingDetail: string,
  exposedHint = false,
): WarrantyFinePrintRow {
  if (!text) {
    return {
      id,
      label,
      value: "Not documented",
      detail: missingDetail,
      status: "unclear",
      severity: "warning",
    };
  }

  if (text.toLowerCase().includes("not clearly") || text.toLowerCase().includes("not detected")) {
    return {
      id,
      label,
      value: "Not clearly documented",
      detail: truncate(text),
      status: "unclear",
      severity: "warning",
    };
  }

  return {
    id,
    label,
    value: "Language documented",
    detail: truncate(text),
    status: exposedHint ? "exposed" : "partial",
    severity: exposedHint ? "danger" : "info",
  };
}

function buildWarrantyLanguageSummaryRow(texts: string[]): WarrantyFinePrintRow | null {
  const documented = texts.filter(Boolean);
  if (documented.length === 0) return null;

  const labels: string[] = [];
  if (documented.some((entry) => entry.toLowerCase().includes("labor"))) labels.push("labor");
  if (documented.some((entry) => entry.toLowerCase().includes("manufacturer"))) {
    labels.push("manufacturer");
  }
  if (documented.some((entry) => entry.toLowerCase().includes("installation"))) {
    labels.push("installation");
  }

  return {
    id: "warranty-language-summary",
    label: "Warranty language",
    value:
      labels.length > 0
        ? `${labels.map((label) => label.charAt(0).toUpperCase() + label.slice(1)).join(" + ")} language referenced`
        : `${documented.length} warranty/fine-print reference${documented.length === 1 ? "" : "s"} found`,
    detail: truncate(documented[0]),
    examples: documented.slice(0, 2).map((entry) => truncate(entry, 80)),
    status: labels.length >= 2 ? "partial" : "unclear",
    severity: "info",
  };
}

export function buildWarrantyFinePrintProps(
  source: MockLabReportSource = MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
): WarrantyFinePrintSectionProps {
  const raw = source.lab_sections?.warranty_fine_print ?? null;

  const warrantyTexts = [
    asString(raw?.labor_warranty_text),
    asString(raw?.manufacturer_warranty_text),
    asString(raw?.installation_warranty_text),
  ].filter((value): value is string => value !== null);

  const rows: WarrantyFinePrintRow[] = [];

  const warrantySummary = buildWarrantyLanguageSummaryRow(warrantyTexts);
  if (warrantySummary) rows.push(warrantySummary);

  rows.push(
    buildWarrantyRow(
      "labor-warranty",
      "Labor warranty visibility",
      asString(raw?.labor_warranty_text),
      "Labor warranty terms are not visible in the fixture.",
    ),
    buildWarrantyRow(
      "manufacturer-warranty",
      "Manufacturer warranty visibility",
      asString(raw?.manufacturer_warranty_text),
      "Manufacturer warranty terms are not visible in the fixture.",
    ),
    buildWarrantyRow(
      "warranty-exclusions",
      "Warranty exclusions",
      asString(raw?.warranty_exclusions_text),
      "Warranty exclusions are not documented in the fixture.",
      true,
    ),
    buildWarrantyRow(
      "cancellation-language",
      "Cancellation language",
      asString(raw?.cancellation_language),
      "Cancellation language is not documented in the fixture.",
    ),
    buildWarrantyRow(
      "subject-to-remeasure",
      "Subject-to-remeasure language",
      asString(raw?.subject_to_remeasure_language),
      "Subject-to-remeasure language is not documented in the fixture.",
      true,
    ),
    buildWarrantyRow(
      "change-order-language",
      "Change-order language",
      asString(raw?.change_order_language),
      "Change-order language is not documented in the fixture.",
      true,
    ),
  );

  const sourceNotes = asStringArray(raw?.source_notes);
  if (sourceNotes.length > 0) {
    rows.push({
      id: "warranty-source-notes",
      label: "Fine-print notes",
      value: `${sourceNotes.length} note${sourceNotes.length === 1 ? "" : "s"} captured`,
      detail: sourceNotes[0],
      examples: sourceNotes.slice(0, 3),
      status: "partial",
      severity: "warning",
    });
  }

  const { status, statusLabel } = deriveSectionStatus(rows);
  const undocumentedCount = rows.filter(
    (row) => row.status === "unclear" || row.status === "exposed",
  ).length;

  return {
    title: "Warranty & Fine Print",
    subtitle:
      "Does the quote clearly show warranty coverage and the fine-print terms that can affect homeowner protection?",
    status,
    statusLabel,
    rows,
    whyItMatters:
      "A warranty is only useful if the quote clearly states what is covered, who backs it, and how long it lasts. This is a document clarity review, not a legal opinion.",
    missingStateMessage:
      undocumentedCount >= rows.length - 1
        ? "Warranty terms and fine-print protections are not clearly visible in the lab source."
        : null,
    footerBadges: collectUnique(
      rows.flatMap((row) => {
        if (row.status === "protected") return ["Documented"];
        if (row.status === "partial") return ["Partial"];
        if (row.status === "exposed") return ["Needs Verification"];
        return ["Unclear"];
      }),
    ).slice(0, 4),
  };
}
