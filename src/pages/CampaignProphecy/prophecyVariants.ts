/**
 * Prophecy hero copy variants.
 *
 * Swapping a headline is a config edit, never a component edit. Add an entry
 * here and list its id in ACTIVE_VARIANTS; `useProphecyVariant` handles
 * assignment, persistence and reporting.
 *
 * Force one for review with `?v=<id>` — session-only, never persisted, so a
 * shared review link cannot contaminate a real visitor's assignment.
 *
 * `headlineAccent` is rendered in the warm signal colour and reads as the tail
 * of `headline`. Keeping them as two plain strings — rather than the
 * empty-string-sentinel-plus-JSX-fallback trick used by the homepage variants —
 * means every variant can carry the accent, not just the hardcoded default.
 */
export interface ProphecyVariant {
  id: string;
  eyebrow: string;
  headline: string;
  headlineAccent?: string;
  subheadline: string;
  ctaLabel: string;
  weight: number;
}

export const ALL_PROPHECY_VARIANTS: Record<string, ProphecyVariant> = {
  prophecy: {
    id: "prophecy",
    eyebrow: "FLORIDA STATEWIDE · IMPACT WINDOWS & DOORS",
    headline: "We can tell you what's on your estimate",
    headlineAccent: "without reading it.",
    subheadline:
      "One lump line called “installation.” A glass package with a name and no specs. A warranty nobody wrote down. Send us the estimate and we'll point at the lines worth asking about — free, and we don't sell windows.",
    ctaLabel: "Read My Estimate Free",
    weight: 1,
  },
  unsaid: {
    id: "unsaid",
    eyebrow: "INDEPENDENT ESTIMATE REVIEW",
    headline: "What your estimate",
    headlineAccent: "doesn't say.",
    subheadline:
      "The price is the part everyone reads. The scope, the fees, the warranty and the fine print are the parts that decide what you actually get. WindowMan reads all of it and tells you what to ask.",
    ctaLabel: "Check My Estimate Free",
    weight: 1,
  },
  four_checks: {
    id: "four_checks",
    eyebrow: "BEFORE YOU SIGN",
    headline: "Four things to check",
    headlineAccent: "before you sign.",
    subheadline:
      "Product approval number. Itemized scope. Written warranty terms. Payment schedule. Miss one and you find out after the deposit clears. We check all four in about 60 seconds.",
    ctaLabel: "Run The Four Checks",
    weight: 1,
  },
  opening_offer: {
    id: "opening_offer",
    eyebrow: "FLORIDA STATEWIDE · IMPACT WINDOWS & DOORS",
    headline: "One estimate isn't a price.",
    headlineAccent: "It's an opening offer.",
    subheadline:
      "Most homeowners sign the first number they're shown because they have nothing to compare it to. We close that gap — then help you go get a second number worth comparing.",
    ctaLabel: "See Where My Number Lands",
    weight: 1,
  },
};

export const ACTIVE_PROPHECY_VARIANTS: string[] = [
  "prophecy",
  "unsaid",
  "four_checks",
  "opening_offer",
];

export const DEFAULT_PROPHECY_VARIANT_ID = "prophecy";
