export const FIRST_QUOTE_INTAKE_VERSION = "windowman_first_quote_v1";

export const HOMEOWNER_ROLE_OPTIONS = [
  "I own the home",
  "I help make the decision",
  "I'm researching for someone else",
] as const;

export const PROPERTY_TYPE_OPTIONS = [
  "Single-family home",
  "Condo",
  "Townhouse",
  "Other",
] as const;

export const OPENINGS_BUCKET_OPTIONS = ["1–5", "6–10", "11–15", "16+", "Not sure"] as const;

export const PRODUCT_SCOPE_OPTIONS = [
  "Impact windows",
  "Impact doors",
  "Both windows and doors",
  "Not sure yet",
] as const;

export const TIMING_OPTIONS = ["ASAP", "1–3 months", "Planning ahead", "Not sure"] as const;

export const HELP_NEEDED_OPTIONS = [
  "I want to know what a strong quote should include.",
  "I want to avoid missing scope.",
  "I want help requesting my first estimate.",
  "I already talked to a contractor but do not have the quote yet.",
] as const;

export const PREFERRED_CONTACT_OPTIONS = ["Text", "Call", "Email"] as const;

export type HomeownerRole = (typeof HOMEOWNER_ROLE_OPTIONS)[number];
export type PropertyType = (typeof PROPERTY_TYPE_OPTIONS)[number];
export type OpeningsBucket = (typeof OPENINGS_BUCKET_OPTIONS)[number];
export type ProductScope = (typeof PRODUCT_SCOPE_OPTIONS)[number];
export type Timing = (typeof TIMING_OPTIONS)[number];
export type HelpNeeded = (typeof HELP_NEEDED_OPTIONS)[number];
export type PreferredContact = (typeof PREFERRED_CONTACT_OPTIONS)[number];

export type FirstQuoteProjectBasics = {
  zipOrCity: string;
  homeownerRole: HomeownerRole | "";
  propertyType: PropertyType | "";
  openingsBucket: OpeningsBucket | "";
  productScope: ProductScope | "";
  timing: Timing | "";
};

export type FirstQuoteContactFields = {
  firstName: string;
  phone: string;
  email: string;
  preferredContact: PreferredContact | "";
};

export type FirstQuoteIntakeFormState = {
  projectBasics: FirstQuoteProjectBasics;
  helpNeeded: HelpNeeded | "";
  contact: FirstQuoteContactFields;
};

export const EMPTY_FIRST_QUOTE_INTAKE: FirstQuoteIntakeFormState = {
  projectBasics: {
    zipOrCity: "",
    homeownerRole: "",
    propertyType: "",
    openingsBucket: "",
    productScope: "",
    timing: "",
  },
  helpNeeded: "",
  contact: {
    firstName: "",
    phone: "",
    email: "",
    preferredContact: "",
  },
};

export const FIRST_QUOTE_SAFE_ERROR =
  "We couldn't save your plan yet. Check your details and try again.";

export const ZIP_CODE_ERROR = "Enter a 5-digit ZIP code.";

/** Trim outer whitespace; does not mutate invalid input. */
export function normalizeZipCode(value: string): string {
  return value.trim();
}

/** Exactly 5 digits after trim; rejects letters, spaces, and wrong lengths. */
export function isValidZipCode(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^\d{5}$/.test(trimmed);
}
