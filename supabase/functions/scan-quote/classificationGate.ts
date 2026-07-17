// ═══════════════════════════════════════════════════════════════════════════════
// scan-quote/classificationGate.ts
//
// Pure, side-effect-free classification normalization + fail-closed gate logic.
// Extracted from index.ts so it can be unit-tested without importing the
// Deno.serve entrypoint or any test framework into the production bundle.
//
// The production entry module (index.ts) imports from here; this module must
// never import test files, assertion libraries, or test-runner registration.
// ═══════════════════════════════════════════════════════════════════════════════

import { CONFIDENCE_THRESHOLD } from "./scoring.ts";

/** Gemini schema asks for boolean + number; runtime may omit or stringify fields. */
export type NormalizedClassification = {
  related: boolean;
  confidence: number | null;
  documentType: string | null;
  lineItemCount: number;
  hasLineItems: boolean;
};

export type RejectReason =
  | "not_window_door"
  | "low_confidence"
  | "unreadable"
  | "empty_line_items";

function coerceConfidence(raw: unknown): number | null {
  if (typeof raw === "number" && !Number.isNaN(raw)) {
    return raw >= 0 && raw <= 1 ? raw : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw);
    if (!Number.isNaN(n) && n >= 0 && n <= 1) return n;
  }
  return null;
}

function coerceRelated(raw: unknown): boolean {
  if (raw === true) return true;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "true") {
    return true;
  }
  return false;
}

/**
 * Normalize Gemini classification fields before the fail-closed gate.
 */
export function normalizeClassification(
  parsed: unknown,
): NormalizedClassification {
  if (!parsed || typeof parsed !== "object") {
    return {
      related: false,
      confidence: null,
      documentType: null,
      lineItemCount: 0,
      hasLineItems: false,
    };
  }
  const obj = parsed as Record<string, unknown>;
  const lineItems = Array.isArray(obj.line_items) ? obj.line_items : null;
  const lineItemCount = lineItems?.length ?? 0;

  return {
    related: coerceRelated(obj.is_window_door_related),
    confidence: coerceConfidence(obj.confidence),
    documentType: typeof obj.document_type === "string"
      ? obj.document_type
      : null,
    lineItemCount,
    hasLineItems: lineItemCount >= 1,
  };
}

export type ScanGateDecision =
  | { action: "continue" }
  | {
    action: "terminate";
    analysisStatus: "invalid_document" | "needs_better_upload";
    sessionStatus: "invalid_document" | "needs_better_upload";
    rejectReason: RejectReason;
    reason: string;
  };

export function classifyScanGate(
  norm: NormalizedClassification,
): ScanGateDecision {
  if (!norm.related) {
    return {
      action: "terminate",
      analysisStatus: "invalid_document",
      sessionStatus: "invalid_document",
      rejectReason: "not_window_door",
      reason:
        "This file does not appear to be an impact window or door quote.",
    };
  }
  if (norm.confidence === null) {
    return {
      action: "terminate",
      analysisStatus: "needs_better_upload",
      sessionStatus: "needs_better_upload",
      rejectReason: "unreadable",
      reason:
        "We couldn't read this file clearly enough. Please upload a higher quality scan or photo.",
    };
  }
  if (norm.confidence < CONFIDENCE_THRESHOLD) {
    return {
      action: "terminate",
      analysisStatus: "needs_better_upload",
      sessionStatus: "needs_better_upload",
      rejectReason: "low_confidence",
      reason:
        "We couldn't read this file clearly enough. Please upload a higher quality scan or photo.",
    };
  }
  if (!norm.hasLineItems) {
    return {
      action: "terminate",
      analysisStatus: "needs_better_upload",
      sessionStatus: "needs_better_upload",
      rejectReason: "empty_line_items",
      reason:
        "We found a window quote but couldn't extract line items. Please try a clearer upload.",
    };
  }
  return { action: "continue" };
}
