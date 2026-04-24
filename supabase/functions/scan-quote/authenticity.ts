// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT AUTHENTICITY GATE (pure)
//
// Decides whether a Gemini classification payload represents a real
// contractor estimate, or whether it must be rejected as a WindowMan UI
// artifact, marketing mockup, unrelated file, or an underspecified document.
//
// Pure function — no IO, deterministic, safely unit-testable in isolation.
// ═══════════════════════════════════════════════════════════════════════════════

export type AuthenticityVerdict =
  | { accepted: true }
  | {
      accepted: false;
      rejection_reason: string;
      document_authenticity: string | null;
      ui_artifact_detected: boolean;
      estimate_artifact_count: number;
    };

export function evaluateDocumentAuthenticity(
  classData: Record<string, unknown>,
): AuthenticityVerdict {
  const documentAuthenticity =
    typeof classData.document_authenticity === "string"
      ? (classData.document_authenticity as string)
      : null;
  const isRealEstimate = classData.is_real_contractor_estimate === true;
  const uiArtifactDetected = classData.ui_artifact_detected === true;
  const estimateArtifacts = Array.isArray(classData.estimate_artifacts_present)
    ? (classData.estimate_artifacts_present as unknown[]).filter(
        (v) => typeof v === "string",
      )
    : [];

  const explicitlyRejected =
    documentAuthenticity === "windowman_ui_artifact" ||
    documentAuthenticity === "sample_mockup" ||
    documentAuthenticity === "unrelated" ||
    documentAuthenticity === "insufficient";

  // If the model never returned the new authenticity fields at all, do not
  // reject here — fall back to the existing window/door classification gate.
  // Keeps backward compatibility while the new prompt rolls out.
  const modelDeclaredAuthenticity = documentAuthenticity !== null;

  const insufficientArtifacts =
    modelDeclaredAuthenticity &&
    (documentAuthenticity === "real_estimate" ||
      documentAuthenticity === "real_estimate_screenshot") &&
    estimateArtifacts.length < 3;

  const notRealEstimateButClaimedAccept =
    modelDeclaredAuthenticity &&
    !isRealEstimate &&
    (documentAuthenticity === "real_estimate" ||
      documentAuthenticity === "real_estimate_screenshot");

  if (
    uiArtifactDetected ||
    explicitlyRejected ||
    insufficientArtifacts ||
    notRealEstimateButClaimedAccept
  ) {
    let rejection_reason: string;
    if (uiArtifactDetected || documentAuthenticity === "windowman_ui_artifact") {
      rejection_reason = "windowman_ui_artifact";
    } else if (
      typeof classData.rejection_reason === "string" &&
      classData.rejection_reason
    ) {
      rejection_reason = classData.rejection_reason as string;
    } else if (insufficientArtifacts) {
      rejection_reason = "no_estimate_artifacts";
    } else {
      rejection_reason = documentAuthenticity ?? "not_a_real_estimate";
    }

    return {
      accepted: false,
      rejection_reason,
      document_authenticity: documentAuthenticity,
      ui_artifact_detected: uiArtifactDetected,
      estimate_artifact_count: estimateArtifacts.length,
    };
  }

  return { accepted: true };
}
