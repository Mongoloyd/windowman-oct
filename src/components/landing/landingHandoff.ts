/**
 * Safe navigation helpers for the landing page.
 * Phase 1: anchors and canonical homepage handoff only — no scanner/backend calls.
 *
 * Attribution allowlist mirrors keys captured in `src/lib/useUtmCapture.ts`.
 * Do not import from tracking/UTM modules — keep this file dependency-free.
 */

/** Safe query params to forward to the canonical homepage Truth Gate handoff. */
const HANDOFF_PARAM_ALLOWLIST = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "ttclid",
  "msclkid",
  "ndclid",
  "nd_lead_id",
  "nd_form_id",
  "nd_ad_id",
  "nd_ad_group_id",
  "nd_campaign_id",
  "client_slug",
  "client",
  "partner",
  "syndicate",
] as const;

export type CanonicalWmIntent = "has_quote" | "no_quote";

const TRUTH_GATE_HASH = "#truth-gate";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

/**
 * Build a canonical homepage Truth Gate URL from the current page query string.
 * Copies only allowlisted attribution params, sets wm_intent, and appends #truth-gate.
 */
export function buildCanonicalTruthGateHandoffUrl(intent: CanonicalWmIntent): string {
  const outbound = new URLSearchParams();

  if (typeof window !== "undefined") {
    const inbound = new URLSearchParams(window.location.search);
    for (const key of HANDOFF_PARAM_ALLOWLIST) {
      const value = inbound.get(key)?.trim();
      if (value) outbound.set(key, value);
    }
  }

  outbound.set("wm_intent", intent);

  const query = outbound.toString();
  return query ? `/?${query}${TRUTH_GATE_HASH}` : `/?wm_intent=${intent}${TRUTH_GATE_HASH}`;
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
  window.location.assign(buildCanonicalTruthGateHandoffUrl("has_quote"));
}

export const FIRST_QUOTE_INTAKE_EVENT = "wm-landing-open-first-quote-intake";

/** Open the guided first-quote intelligence intake modal on /windowman. */
export function openFirstQuoteIntake(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FIRST_QUOTE_INTAKE_EVENT));
}

export function handoffToFirstQuotePath(): void {
  openFirstQuoteIntake();
}

/** @deprecated Use openFirstQuoteIntake — opens intake modal instead of scrolling. */
export function handoffToFirstQuoteEducation(): void {
  openFirstQuoteIntake();
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
