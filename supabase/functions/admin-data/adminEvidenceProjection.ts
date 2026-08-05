/**
 * Browser-safe analysis evidence for admin CRM (no full_json).
 */

export type AdminPillarScore = {
  key: string;
  score: number | null;
};

export type AdminProofOfRead = {
  document_read?: boolean;
  fields_detected?: number;
  [key: string]: unknown;
};

export type AdminAnalysisEvidenceProjection = {
  analysis_id: string;
  scan_session_id: string | null;
  status: string | null;
  grade: string | null;
  confidence_score: number | null;
  dollar_delta: number | null;
  missing_detail_count: number | null;
  pillar_scores: AdminPillarScore[] | null;
  pillar_detail_available: boolean;
  document_type: string | null;
  rubric_version: string | null;
  proof_of_read: AdminProofOfRead | null;
  operator_summary: {
    contractor_name: string | null;
    total_quoted_price: number | null;
    opening_count: number | null;
    document_type: string | null;
  } | null;
};

const PILLAR_KEYS = [
  "safety",
  "install",
  "price",
  "finePrint",
  "warranty",
] as const;

function normalizePillarScoreEntry(entry: unknown): number | null {
  if (typeof entry === "number" && Number.isFinite(entry)) return entry;
  if (entry && typeof entry === "object") {
    const score = (entry as Record<string, unknown>).score;
    if (typeof score === "number" && Number.isFinite(score)) return score;
  }
  return null;
}

export function extractPillarScoresFromPreview(
  previewJson: unknown,
): AdminPillarScore[] | null {
  if (!previewJson || typeof previewJson !== "object") return null;
  const raw = (previewJson as Record<string, unknown>).pillar_scores;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const scores: AdminPillarScore[] = [];
  for (const key of PILLAR_KEYS) {
    const previewKey = key === "finePrint" ? "fine_print" : key;
    const entry = (raw as Record<string, unknown>)[previewKey] ??
      (raw as Record<string, unknown>)[key];
    scores.push({ key, score: normalizePillarScoreEntry(entry) });
  }
  const anyScore = scores.some((p) => p.score != null);
  return anyScore ? scores : null;
}

function countMissingDetail(flags: unknown): number | null {
  if (!Array.isArray(flags)) return null;
  return flags.length;
}

function safeOperatorSummary(
  previewJson: unknown,
  documentType: string | null,
): AdminAnalysisEvidenceProjection["operator_summary"] {
  if (!previewJson || typeof previewJson !== "object") {
    return documentType
      ? {
        contractor_name: null,
        total_quoted_price: null,
        opening_count: null,
        document_type: documentType,
      }
      : null;
  }
  const extraction = (previewJson as Record<string, unknown>).extraction;
  if (!extraction || typeof extraction !== "object") {
    return documentType
      ? {
        contractor_name: null,
        total_quoted_price: null,
        opening_count: null,
        document_type: documentType,
      }
      : null;
  }
  const ex = extraction as Record<string, unknown>;
  const contractor = typeof ex.contractor_name === "string"
    ? ex.contractor_name
    : null;
  const total = typeof ex.total_quoted_price === "number"
    ? ex.total_quoted_price
    : null;
  const openings = typeof ex.opening_count === "number" ? ex.opening_count : null;
  const docType = typeof ex.document_type === "string"
    ? ex.document_type
    : documentType;
  if (!contractor && total == null && openings == null && !docType) return null;
  return {
    contractor_name: contractor,
    total_quoted_price: total,
    opening_count: openings,
    document_type: docType,
  };
}

export function buildAdminAnalysisEvidenceProjection(
  row: Record<string, unknown>,
): AdminAnalysisEvidenceProjection {
  const previewJson = row.preview_json;
  const pillarScores = extractPillarScoresFromPreview(previewJson);
  const proof = row.proof_of_read;
  const proofOfRead = proof && typeof proof === "object"
    ? (proof as AdminProofOfRead)
    : null;

  const documentType = typeof row.document_type === "string"
    ? row.document_type
    : null;
  const rubricVersion = typeof row.rubric_version === "string"
    ? row.rubric_version
    : null;

  return {
    analysis_id: String(row.id ?? ""),
    scan_session_id: (row.scan_session_id as string | null) ?? null,
    status: (row.analysis_status as string | null) ?? null,
    grade: (row.grade as string | null) ?? null,
    confidence_score: typeof row.confidence_score === "number"
      ? row.confidence_score
      : null,
    dollar_delta: typeof row.dollar_delta === "number" ? row.dollar_delta : null,
    missing_detail_count: countMissingDetail(row.flags),
    pillar_scores: pillarScores,
    pillar_detail_available: pillarScores != null,
    document_type: documentType,
    rubric_version: rubricVersion,
    proof_of_read: proofOfRead,
    operator_summary: safeOperatorSummary(previewJson, documentType),
  };
}

/** Keys that must never appear in admin browser analysis payloads. */
export const FORBIDDEN_ANALYSIS_BROWSER_SELECT_KEYS = ["full_json"] as const;
