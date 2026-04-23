/**
 * Homepage A/B Test Variants
 *
 * Each variant swaps ONLY the hero section text content.
 * Nothing below the hero changes — buttons, flows, CTAs, upload zones stay identical.
 *
 * To add a new variant: add an entry here. The hook handles assignment automatically.
 * To force a variant for review: append ?v=KEY to the URL (e.g., ?v=loss_aversion)
 *   NOTE: URL overrides are session-only — they do NOT persist to localStorage.
 * To disable A/B testing: set ACTIVE_VARIANTS to a single-element array.
 */

export interface HomepageVariant {
  id: string;
  badgeText: string;
  headline: string;
  subheadline: string;
  weight: number;
}

export const ALL_VARIANTS: Record<string, HomepageVariant> = {
  accusation: {
    id: "accusation",
    badgeText: "FORENSIC QUOTE INTELLIGENCE",
    // Empty strings trigger AuditHero's JSX fallback, preserving the original
    // orange-glow "THEY'RE COUNTING ON." span and the "under 60 seconds" bold.
    headline: "",
    subheadline: "",
    weight: 1,
  },
  direct_action: {
    id: "direct_action",
    badgeText: "AI-POWERED QUOTE ANALYSIS",
    headline: "Scan your quote. Beat your contractors.",
    subheadline:
      "See exactly where you're being overcharged and get the leverage to negotiate fair pricing — powered by AI that's analyzed thousands of Florida quotes.",
    weight: 1,
  },
  loss_aversion: {
    id: "loss_aversion",
    badgeText: "EXPOSED: FLORIDA PRICING DATA",
    headline: "The average Florida homeowner overpays $4,800 on impact windows. Don't be average.",
    subheadline:
      "We've analyzed thousands of contractor quotes across all 67 Florida counties. Upload yours and see exactly where your money is going — and where it shouldn't be.",
    weight: 1,
  },
  fine_print: {
    id: "fine_print",
    badgeText: "QUOTE INTELLIGENCE ENGINE",
    headline: "Your contractor hopes you don't read the fine print. We read it for you.",
    subheadline:
      "Hidden fees, scope gaps, missing warranties — our AI catches what contractors count on you missing. Free forensic analysis in under 60 seconds.",
    weight: 1,
  },
  pre_sign: {
    id: "pre_sign",
    badgeText: "FREE AI QUOTE AUDIT",
    headline: "Before you sign that quote, let AI check the math.",
    subheadline:
      "Upload your estimate. In seconds, our AI forensically grades it across 5 key areas: safety, scope, pricing, fine print, and warranty. Best of all, it's free.",
    weight: 1,
  },
  question: {
    id: "question",
    badgeText: "INSTANT AI ANALYSIS",
    headline: "Is your contractor overcharging you? Find out in 60 seconds.",
    subheadline:
      "Drop your impact window quote below. Our AI compares your pricing to thousands of verified Florida projects — then tells you exactly what to do about it.",
    weight: 1,
  },
  free_audit: {
    id: "free_audit",
    badgeText: "100% FREE · NO SIGNUP REQUIRED",
    headline: "Free AI audit: see exactly where your quote is overpriced.",
    subheadline:
      "Upload any contractor estimate — PDF, photo, screenshot. Our AI reads every line item, checks pricing against county benchmarks, and flags what's wrong. Takes 60 seconds.",
    weight: 1,
  },
};

export const ACTIVE_VARIANTS: string[] = [
  "accusation",
  "direct_action",
  "loss_aversion",
  "fine_print",
  "pre_sign",
  "question",
  "free_audit",
];
