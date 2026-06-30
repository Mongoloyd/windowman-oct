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
