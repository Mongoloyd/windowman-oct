import type { UniversalIntakeConfig } from "@/components/intake/universal/intakeTypes";

export const nq4IntakeConfig = {
  route: "/nq4",
  campaignVariant: "nq4",
  wmIntent: "no_quote",
  captureSource: "windowman-first-quote",
  steps: [
    {
      id: "location",
      fields: ["zip"],
      validation: "florida_zip",
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
