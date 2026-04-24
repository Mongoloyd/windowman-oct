import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateDocumentAuthenticity } from "./authenticity.ts";

// ─────────────────────────────────────────────────────────────────────────────
// Real contractor estimate — accepted
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: accepts a real contractor estimate PDF", () => {
  const result = evaluateDocumentAuthenticity({
    document_type: "impact_window_quote",
    document_authenticity: "real_estimate",
    is_real_contractor_estimate: true,
    ui_artifact_detected: false,
    rejection_reason: null,
    estimate_artifacts_present: [
      "contractor_name",
      "customer_name",
      "project_address",
      "document_number",
      "document_date",
      "line_items",
      "total_amount",
    ],
    is_window_door_related: true,
    confidence: 0.92,
  });
  assertEquals(result.accepted, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// Photo / screenshot of a real contractor estimate — accepted
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: accepts a photo/screenshot of a real estimate", () => {
  const result = evaluateDocumentAuthenticity({
    document_type: "impact_window_quote",
    document_authenticity: "real_estimate_screenshot",
    is_real_contractor_estimate: true,
    ui_artifact_detected: false,
    rejection_reason: null,
    estimate_artifacts_present: [
      "contractor_name",
      "project_address",
      "line_items",
      "total_amount",
    ],
    is_window_door_related: true,
    confidence: 0.78,
  });
  assertEquals(result.accepted, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: WindowMan demo proposal screenshot — REJECTED
// (mirrors the originally-uploaded fixture that slipped through).
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: REJECTS WindowMan demo proposal screenshot", () => {
  const result = evaluateDocumentAuthenticity({
    document_type: "screenshot",
    document_authenticity: "windowman_ui_artifact",
    is_real_contractor_estimate: false,
    ui_artifact_detected: true,
    rejection_reason: "windowman_ui_artifact",
    estimate_artifacts_present: [],
    is_window_door_related: false,
    confidence: 0.9,
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.accepted, false);
  assertEquals(result.rejection_reason, "windowman_ui_artifact");
  assertEquals(result.ui_artifact_detected, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// REGRESSION: ui_artifact_detected=true ALONE forces rejection,
// even if model labels it as real_estimate.
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: ui_artifact_detected=true forces rejection", () => {
  const result = evaluateDocumentAuthenticity({
    document_type: "screenshot",
    document_authenticity: "real_estimate",
    is_real_contractor_estimate: true,
    ui_artifact_detected: true,
    rejection_reason: null,
    estimate_artifacts_present: ["contractor_name", "line_items", "total_amount"],
    is_window_door_related: true,
    confidence: 0.6,
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.rejection_reason, "windowman_ui_artifact");
});

// ─────────────────────────────────────────────────────────────────────────────
// Sample mockup / annotated marketing — REJECTED
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: REJECTS sample mockup", () => {
  const result = evaluateDocumentAuthenticity({
    document_authenticity: "sample_mockup",
    is_real_contractor_estimate: false,
    ui_artifact_detected: false,
    rejection_reason: "sample_mockup",
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.rejection_reason, "sample_mockup");
});

// ─────────────────────────────────────────────────────────────────────────────
// Unrelated photo (random non-estimate image) — REJECTED
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: REJECTS unrelated document", () => {
  const result = evaluateDocumentAuthenticity({
    document_authenticity: "unrelated",
    is_real_contractor_estimate: false,
    ui_artifact_detected: false,
    rejection_reason: "unrelated_document",
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.rejection_reason, "unrelated_document");
});

// ─────────────────────────────────────────────────────────────────────────────
// Insufficient content — REJECTED
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: REJECTS insufficient document", () => {
  const result = evaluateDocumentAuthenticity({
    document_authenticity: "insufficient",
    is_real_contractor_estimate: false,
    ui_artifact_detected: false,
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.document_authenticity, "insufficient");
});

// ─────────────────────────────────────────────────────────────────────────────
// Claimed real_estimate but fewer than 3 estimate artifacts — REJECTED
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: REJECTS real_estimate with <3 artifacts (no_estimate_artifacts)", () => {
  const result = evaluateDocumentAuthenticity({
    document_authenticity: "real_estimate",
    is_real_contractor_estimate: true,
    ui_artifact_detected: false,
    estimate_artifacts_present: ["contractor_name", "line_items"],
  });
  if (result.accepted) throw new Error("Expected rejection");
  assertEquals(result.rejection_reason, "no_estimate_artifacts");
  assertEquals(result.estimate_artifact_count, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Backward compatibility: pre-rollout payload with no authenticity fields
// must NOT be rejected by this gate (the older window/door gate handles it).
// ─────────────────────────────────────────────────────────────────────────────
Deno.test("authenticity: backward-compat — missing authenticity fields → accepted", () => {
  const result = evaluateDocumentAuthenticity({
    document_type: "impact_window_quote",
    is_window_door_related: true,
    confidence: 0.9,
  });
  assertEquals(result.accepted, true);
});
