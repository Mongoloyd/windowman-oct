import type {
  IntakeLocationConfig,
  IntakeValues,
  UniversalIntakeConfig,
} from "@/components/intake/universal/intakeTypes";

/**
 * Florida service-area gate. Identical rule to /nq3 — 3xxxx ZIPs in the 32000
 * to 34999 band — so a visitor who bounces between campaigns is qualified the
 * same way on both.
 */
export const prophecyFloridaProjectLocation = {
  marketId: "florida",
  inputLabel: "Florida project ZIP code",
  helperText:
    "Enter the ZIP code for the Florida property. We only review Florida projects.",
  placeholder: "e.g. 33139",
  invalidMessage: "Enter a valid 5-digit Florida project ZIP code.",
  isEligibleZip: (value: string) => /^3[2-4]\d{3}$/.test(value.trim()),
} as const satisfies IntakeLocationConfig;

/** "What matters most" — asked only of visitors who do not have an estimate yet. */
export const PROPHECY_PRIORITY_OPTIONS = [
  "Not overpaying",
  "Hiring the right contractor",
  "Nothing missing from the scope",
  "Manageable payment terms",
  "Not sure yet",
] as const;

export type ProphecyPriority = (typeof PROPHECY_PRIORITY_OPTIONS)[number];

export function isProphecyPriority(
  value: string | undefined,
): value is ProphecyPriority {
  return PROPHECY_PRIORITY_OPTIONS.some((option) => option === value);
}

/** True once the visitor has said they already hold a written estimate. */
export function hasQuoteInHand(values: IntakeValues): boolean {
  return values.intent === "has_quote";
}

/**
 * Prophecy is the first dual-intent campaign: one page, two audiences, one
 * lead record either way.
 *
 * STEP ORDER — why contact is last
 * --------------------------------
 * `UniversalIntakeHost` persists exactly once, on the final step. Contact
 * therefore has to be the last step or the lead is never written. To keep the
 * pre-contact path from leaking visitors, every step before it is a single
 * thumb tap or a 5-digit ZIP:
 *
 *   has an estimate  →  intent · location · contact          (3 steps)
 *   needs an estimate →  intent · location · openings · priority · contact  (5)
 *
 * The ZIP gate sits ahead of contact deliberately: an out-of-state visitor is
 * disqualified before we ask for their name and number.
 *
 * The estimate-in-hand branch skips project scope entirely — that detail comes
 * out of the uploaded document, so asking for it would be redundant friction.
 */
export const prophecyIntakeConfig = {
  route: "/prophecy",
  campaignVariant: "prophecy",
  wmIntent: "dual",
  captureSource: "windowman-prophecy",
  location: prophecyFloridaProjectLocation,
  steps: [
    {
      id: "intent",
      fields: ["intent"],
      validation: "intent_selected",
    },
    {
      id: "location",
      fields: ["zip"],
      validation: "service_area_zip",
    },
    {
      id: "openings",
      fields: ["openings"],
      validation: "openings_scope",
      skipWhen: hasQuoteInHand,
    },
    {
      id: "priority",
      fields: ["priority"],
      validation: "priority_scope",
      skipWhen: hasQuoteInHand,
    },
    {
      id: "contact",
      fields: ["name", "email", "phone"],
      validation: "contact",
    },
  ],
} as const satisfies UniversalIntakeConfig;
