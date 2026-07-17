// Unit tests for the pure scan-quote classification gate logic.
// Kept out of the production entry module so no test framework (Deno.test /
// assertion libs) is ever bundled into the deployed Edge Function.

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyScanGate,
  normalizeClassification,
} from "../../scan-quote/classificationGate.ts";

Deno.test("normalizeClassification: malformed object → not related, null confidence", () => {
  const norm = normalizeClassification(null);
  assertEquals(norm.related, false);
  assertEquals(norm.confidence, null);
  assertEquals(norm.hasLineItems, false);
});

Deno.test("normalizeClassification: string true → related", () => {
  const norm = normalizeClassification({
    is_window_door_related: "TRUE",
    confidence: 0.9,
    document_type: "window_quote",
    line_items: [{ description: "Impact window" }],
  });
  assertEquals(norm.related, true);
  assertEquals(norm.confidence, 0.9);
  assertEquals(norm.hasLineItems, true);
});

Deno.test("normalizeClassification: string confidence → coerced number", () => {
  const norm = normalizeClassification({
    is_window_door_related: true,
    confidence: "0.85",
    document_type: "window_quote",
    line_items: [],
  });
  assertEquals(norm.confidence, 0.85);
  assertEquals(norm.hasLineItems, false);
});

Deno.test("normalizeClassification: missing confidence → null", () => {
  const norm = normalizeClassification({
    is_window_door_related: true,
    document_type: "window_quote",
    line_items: [{ description: "Door" }],
  });
  assertEquals(norm.confidence, null);
  assertEquals(norm.related, true);
});

Deno.test("classifyScanGate: related + missing confidence → needs_better_upload", () => {
  const decision = classifyScanGate({
    related: true,
    confidence: null,
    documentType: "window_quote",
    lineItemCount: 1,
    hasLineItems: true,
  });
  assertEquals(decision.action, "terminate");
  if (decision.action === "terminate") {
    assertEquals(decision.analysisStatus, "needs_better_upload");
    assertEquals(decision.rejectReason, "unreadable");
  }
});

Deno.test("classifyScanGate: not related → invalid_document", () => {
  const decision = classifyScanGate({
    related: false,
    confidence: 0.9,
    documentType: "receipt",
    lineItemCount: 0,
    hasLineItems: false,
  });
  assertEquals(decision.action, "terminate");
  if (decision.action === "terminate") {
    assertEquals(decision.analysisStatus, "invalid_document");
    assertEquals(decision.rejectReason, "not_window_door");
  }
});

Deno.test("classifyScanGate: below-threshold confidence → low_confidence", () => {
  const decision = classifyScanGate({
    related: true,
    confidence: 0.1,
    documentType: "window_quote",
    lineItemCount: 3,
    hasLineItems: true,
  });
  assertEquals(decision.action, "terminate");
  if (decision.action === "terminate") {
    assertEquals(decision.analysisStatus, "needs_better_upload");
    assertEquals(decision.rejectReason, "low_confidence");
  }
});

Deno.test("classifyScanGate: empty line_items → needs_better_upload", () => {
  const decision = classifyScanGate({
    related: true,
    confidence: 0.8,
    documentType: "window_quote",
    lineItemCount: 0,
    hasLineItems: false,
  });
  assertEquals(decision.action, "terminate");
  if (decision.action === "terminate") {
    assertEquals(decision.rejectReason, "empty_line_items");
    assertEquals(decision.analysisStatus, "needs_better_upload");
  }
});

Deno.test("classifyScanGate: valid quote → continue", () => {
  const decision = classifyScanGate({
    related: true,
    confidence: 0.8,
    documentType: "window_quote",
    lineItemCount: 3,
    hasLineItems: true,
  });
  assertEquals(decision.action, "continue");
});
