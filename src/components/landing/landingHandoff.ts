/**
 * Safe navigation helpers for the landing page.
 * Phase 1: anchors and canonical homepage handoff only — no scanner/backend calls.
 */

const TRUTH_GATE_PATH = "/#truth-gate";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function scrollToLandingSection(sectionId: string): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(sectionId);
  if (!el) return;
  el.scrollIntoView({
    behavior: prefersReducedMotion() ? "auto" : "smooth",
    block: "start",
  });
}

/** Hand off quote-ready users to the canonical homepage contact gate. */
export function handoffToCanonicalUpload(): void {
  if (typeof window === "undefined") return;
  window.location.assign(TRUTH_GATE_PATH);
}

export function handoffToFirstQuotePath(): void {
  scrollToLandingSection("visitor-router");
}

/** Scroll to product education for first-quote / no-quote guidance. */
export function handoffToFirstQuoteEducation(): void {
  scrollToLandingSection("product-education");
}

const REVEAL_EDUCATION_EVENT = "wm-landing-reveal-education";

export function handoffToCompareGuidance(): void {
  scrollToLandingSection("product-education");
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(REVEAL_EDUCATION_EVENT, { detail: { moduleId: "quote-comparison" } }),
  );
}

export function handoffToSampleReport(): void {
  scrollToLandingSection("sample-report");
}

export function handoffToSystemExplainer(): void {
  scrollToLandingSection("system-explainer");
}

export function handoffToFaq(): void {
  scrollToLandingSection("faq");
}

export function handoffToProductEducation(): void {
  scrollToLandingSection("product-education");
}
