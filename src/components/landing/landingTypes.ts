export type LandingIntent =
  | "quote_ready"
  | "needs_first_quote"
  | "compare_quotes"
  | "education_mode"
  | null;

export type LandingSectionId =
  | "hero"
  | "founder-intro"
  | "market-asymmetry"
  | "system-explainer"
  | "visitor-router"
  | "product-education"
  | "intelligence-database"
  | "sample-report"
  | "trust-credibility"
  | "faq"
  | "final-cta";

export type EducationModuleId =
  | "price-not-quote"
  | "missing-scope"
  | "product-details"
  | "payment-terms"
  | "warranty-clarity"
  | "permit-inspection"
  | "quote-comparison"
  | "sales-pressure";

export type EducationModule = {
  id: EducationModuleId;
  title: string;
  teachingLine: string;
  body?: string;
  expandable?: boolean;
};

export type QuoteAnatomyZoneId =
  | "scope"
  | "product"
  | "permit"
  | "payment"
  | "warranty"
  | "risk";

export type LandingFaqItem = {
  id: string;
  question: string;
  answer: string;
  voice?: "brand" | "sam";
};

/** Shared layout tokens for landing section rhythm */
export const landingSectionPad = "px-4 py-16 md:px-8 md:py-20 lg:py-24";
export const landingContainerWide = "mx-auto max-w-7xl";
export const landingContainerMid = "mx-auto max-w-5xl";
export const landingContainerNarrow = "mx-auto max-w-3xl";
export const landingCtaMinH = "min-h-[48px]";
export const landingFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2";
