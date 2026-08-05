import type { RawPreviewRow } from "@/types/serviceResults";
import type { HybridPreviewPayload } from "@/types/reportHybrid";
import type {
  QuotePreviewFinding,
  QuotePreviewImportance,
  QuotePreviewViewModel,
} from "./scanPrototypeModel";

export type MapSafePreviewResult =
  | { ok: true; preview: QuotePreviewViewModel }
  | { ok: false; reason: "full_json" | "invalid_input" | "missing_grade" };

export function containsFullJsonKey(value: unknown, seen = new WeakSet<object>()): boolean {
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return false;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => containsFullJsonKey(item, seen));
  }

  const record = value as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(record, "full_json")) {
    return true;
  }

  return Object.values(record).some((nested) => containsFullJsonKey(nested, seen));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(record: Record<string, unknown> | null, key: string): string | null {
  if (!record) return null;
  const value = record[key];
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function formatOpeningScope(
  proof: Record<string, unknown> | null,
  previewJson: Record<string, unknown> | null,
): string | null {
  const bucket = readString(previewJson, "opening_count_bucket");
  if (bucket) return bucket;

  const openingCount = proof?.opening_count;
  if (typeof openingCount === "number" && Number.isFinite(openingCount) && openingCount > 0) {
    return `${openingCount} openings`;
  }

  return null;
}

function inferImportance(title: string, hybrid: HybridPreviewPayload | null): QuotePreviewImportance {
  const upper = title.toUpperCase();
  if (upper.includes("RED FLAG") || hybrid?.payment_risk_detected) {
    return "high";
  }
  if (hybrid?.scope_gap_detected) {
    return "medium";
  }
  if (upper.includes("HIGH RISK")) {
    return "high";
  }
  return "medium";
}

function buildFinding(
  id: string,
  title: string,
  hybrid: HybridPreviewPayload | null,
): QuotePreviewFinding | null {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return null;

  const teaser =
    typeof hybrid?.summary_teaser === "string" ? hybrid.summary_teaser.trim() : "";
  const evidence = teaser.length > 0 ? teaser : trimmedTitle;
  const importance = inferImportance(trimmedTitle, hybrid);

  return {
    id,
    title: trimmedTitle,
    evidence,
    importance,
    whyItMatters:
      teaser.length > 0
        ? teaser
        : "This preview flag may affect price clarity, scope, or signing risk.",
    recommendedAction:
      "Ask your contractor to clarify this point in writing before you sign.",
  };
}

function buildFindings(hybrid: HybridPreviewPayload | null): QuotePreviewFinding[] {
  const findings: QuotePreviewFinding[] = [];

  if (typeof hybrid?.top_warning === "string" && hybrid.top_warning.trim()) {
    const finding = buildFinding("preview-top-warning", hybrid.top_warning, hybrid);
    if (finding) findings.push(finding);
  }

  if (typeof hybrid?.top_missing_item === "string" && hybrid.top_missing_item.trim()) {
    const finding = buildFinding("preview-top-missing", hybrid.top_missing_item, hybrid);
    if (finding) findings.push(finding);
  }

  return findings.slice(0, 3);
}

export function mapSafePreview(input: unknown): MapSafePreviewResult {
  if (containsFullJsonKey(input)) {
    return { ok: false, reason: "full_json" };
  }

  if (!input || typeof input !== "object") {
    return { ok: false, reason: "invalid_input" };
  }

  const row = input as RawPreviewRow;
  if (typeof row.grade !== "string" || !row.grade.trim()) {
    return { ok: false, reason: "missing_grade" };
  }

  const proof = asRecord(row.proof_of_read);
  const previewJsonRecord = asRecord(row.preview_json);
  const hybrid = previewJsonRecord as HybridPreviewPayload | null;

  const contractorName =
    readString(proof, "contractor_name") ?? null;
  const documentType = row.document_type?.trim() || readString(proof, "document_type");
  const openingCountBucket = formatOpeningScope(proof, previewJsonRecord);

  const warningCount =
    typeof row.flag_count === "number" && row.flag_count >= 0 ? row.flag_count : null;

  const missingDetailCount =
    typeof hybrid?.missing_items_count === "number" && hybrid.missing_items_count >= 0
      ? hybrid.missing_items_count
      : null;

  const preview: QuotePreviewViewModel = {
    source: "live_preview",
    gradeBand: row.grade.trim(),
    warningCount,
    missingDetailCount,
    contractorName,
    openingCountBucket,
    documentType,
    findings: buildFindings(hybrid),
  };

  return { ok: true, preview };
}
