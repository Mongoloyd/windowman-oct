import type {
  IntakeLocationConfig,
  UniversalIntakeConfig,
} from "@/components/intake/universal/intakeTypes";

export const nq3FloridaProjectLocation = {
  marketId: "florida",
  inputLabel: "Florida project ZIP code",
  helperText:
    "Enter the ZIP code for the Florida property where the work will be completed.",
  placeholder: "e.g. 33139",
  invalidMessage: "Enter a valid 5-digit Florida project ZIP code.",
  isEligibleZip: (value: string) => /^3[2-4]\d{3}$/.test(value.trim()),
} as const satisfies IntakeLocationConfig;

export const nq3IntakeConfig = {
  route: "/nq3",
  campaignVariant: "nq3",
  wmIntent: "no_quote",
  captureSource: "windowman-first-quote",
  location: nq3FloridaProjectLocation,
  steps: [
    {
      id: "location",
      fields: ["zip"],
      validation: "service_area_zip",
    },
    {
      id: "product",
      fields: ["projectType"],
      validation: "product_scope",
    },
    {
      id: "openings",
      fields: ["openings"],
      validation: "openings_scope",
    },
    {
      id: "timing",
      fields: ["timing"],
      validation: "timing_scope",
    },
    {
      id: "contact",
      fields: ["name", "email", "phone"],
      validation: "contact",
    },
  ],
} as const satisfies UniversalIntakeConfig;
