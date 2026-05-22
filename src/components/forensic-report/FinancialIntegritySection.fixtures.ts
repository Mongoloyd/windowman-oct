/**
 * FinancialIntegritySection fixtures — derives from MOCK_AUTHORIZED_FULL_REPORT_SOURCE.
 */
import {
  MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
  type MockLabReportSource,
} from "./adapters/reportV2Adapter.fixtures";
import type {
  FinancialIntegrityRow,
  FinancialIntegrityRowStatus,
  FinancialIntegritySectionProps,
  FinancialIntegrityStatus,
} from "./FinancialIntegritySection.types";

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

function collectUnique(values: string[]): string[] {
  return [...new Set(values)];
}

function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function deriveSectionStatus(rows: FinancialIntegrityRow[]): {
  status: FinancialIntegrityStatus;
  statusLabel: string;
} {
  if (rows.length === 0) {
    return { status: "unclear", statusLabel: "Unclear" };
  }

  const statuses = rows.map((row) => row.status);
  if (statuses.some((status) => status === "high_friction")) {
    return { status: "high_friction", statusLabel: "High Friction" };
  }
  if (statuses.every((status) => status === "transparent")) {
    return { status: "transparent", statusLabel: "Transparent" };
  }
  if (statuses.every((status) => status === "unclear" || status === "needs_verification")) {
    return { status: "needs_verification", statusLabel: "Needs Verification" };
  }
  return { status: "needs_verification", statusLabel: "Needs Verification" };
}

function buildDocumentedRow(
  id: string,
  label: string,
  text: string | null,
  missingDetail: string,
  highFrictionHint?: boolean,
): FinancialIntegrityRow {
  if (!text) {
    return {
      id,
      label,
      value: "Unclear",
      detail: missingDetail,
      status: "unclear",
      severity: "warning",
    };
  }

  return {
    id,
    label,
    value: "Documented in quote",
    detail: truncate(text),
    status: highFrictionHint ? "high_friction" : "transparent",
    severity: highFrictionHint ? "danger" : "info",
  };
}

function buildFeePaymentSummaryRow(texts: string[]): FinancialIntegrityRow | null {
  const documented = texts.filter(Boolean);
  if (documented.length === 0) return null;

  return {
    id: "fee-payment-clarity",
    label: "Fee and payment clarity",
    value: `${documented.length} payment/fee reference${documented.length === 1 ? "" : "s"} found`,
    detail: truncate(documented[0]),
    examples: documented.slice(0, 3).map((entry) => truncate(entry, 80)),
    status: documented.length >= 3 ? "transparent" : "needs_verification",
    severity: "info",
  };
}

export function buildFinancialIntegrityProps(
  source: MockLabReportSource = MOCK_AUTHORIZED_FULL_REPORT_SOURCE,
): FinancialIntegritySectionProps {
  const raw = source.lab_sections?.financial_integrity ?? null;
  const extraction = isRecord(source.full_json) ? source.full_json.extraction : null;
  const extractionRecord = isRecord(extraction) ? extraction : null;

  const permitText =
    asString(raw?.permit_fee_text) ??
    (isRecord(extractionRecord?.permits) ? asString(extractionRecord.permits.details) : null);

  const rows: FinancialIntegrityRow[] = [
    buildDocumentedRow(
      "deposit-visibility",
      "Deposit visibility",
      asString(raw?.deposit_text),
      "Payment timing is not clearly documented in this fixture.",
    ),
    buildDocumentedRow(
      "payment-schedule",
      "Payment schedule",
      asString(raw?.payment_schedule_text),
      "A payment schedule is not clearly documented in this fixture.",
    ),
    buildDocumentedRow(
      "final-payment-timing",
      "Final payment timing",
      asString(raw?.final_payment_timing_text),
      "Final payment timing is not clearly documented in this fixture.",
      Boolean(asString(raw?.final_payment_timing_text)?.toLowerCase().includes("before")),
    ),
    buildDocumentedRow(
      "permit-fee-clarity",
      "Permit fee clarity",
      permitText,
      "Permit fee responsibility is not clearly documented in this fixture.",
    ),
    buildDocumentedRow(
      "line-item-transparency",
      "Line-item pricing transparency",
      asString(raw?.line_item_transparency_text),
      "Line-item pricing transparency is not documented in this fixture.",
      true,
    ),
    buildDocumentedRow(
      "math-confidence",
      "Quote math confidence",
      asString(raw?.math_confidence_text),
      "Quote math confidence notes are not documented in this fixture.",
    ),
  ];

  const feeSummary = buildFeePaymentSummaryRow(
    [
      asString(raw?.deposit_text),
      asString(raw?.payment_schedule_text),
      permitText,
      asString(raw?.engineering_fee_text),
      asString(raw?.financing_fee_text),
      asString(raw?.discount_or_promo_text),
    ].filter((value): value is string => value !== null),
  );
  if (feeSummary) rows.splice(3, 0, feeSummary);

  const policyText = extractionRecord ? asString(extractionRecord.change_order_policy_text) : null;
  if (policyText?.toLowerCase().includes("adjust contract price")) {
    rows.push({
      id: "price-adjustment-language",
      label: "Price adjustment language",
      value: "Adjustment language documented",
      detail: truncate(policyText),
      status: "high_friction",
      severity: "danger",
    });
  }

  const sourceNotes = asStringArray(raw?.source_notes);
  if (sourceNotes.length > 0) {
    rows.push({
      id: "financial-source-notes",
      label: "Financial clarity notes",
      value: `${sourceNotes.length} note${sourceNotes.length === 1 ? "" : "s"} captured`,
      detail: sourceNotes[0],
      examples: sourceNotes.slice(0, 3),
      status: "needs_verification",
      severity: "warning",
    });
  }

  const { status, statusLabel } = deriveSectionStatus(rows);
  const unclearCount = rows.filter(
    (row) => row.status === "unclear" || row.status === "needs_verification",
  ).length;

  const missingStateMessage =
    unclearCount === rows.length
      ? "Payment timing, deposit terms, and fee clarity are not clearly documented in the lab source."
      : null;

  return {
    title: "Financial Integrity",
    subtitle:
      "Are the payment and fee terms transparent enough to understand financial exposure before signing?",
    status,
    statusLabel,
    rows,
    whyItMatters:
      "This section checks whether the quote gives enough payment and fee clarity to understand financial exposure. WindowMan is not estimating markup or judging price fairness here.",
    missingStateMessage,
    footerBadges: collectUnique(
      rows.flatMap((row) => {
        if (row.status === "transparent") return ["Documented"];
        if (row.status === "needs_verification") return ["Needs Verification"];
        if (row.status === "high_friction") return ["High Friction"];
        return ["Unclear"];
      }),
    ).slice(0, 4),
  };
}
