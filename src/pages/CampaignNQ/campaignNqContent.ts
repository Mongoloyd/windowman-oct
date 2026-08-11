import type { CampaignNqConfig } from "./campaignNqTypes";

export const CAMPAIGN_NQ_CONFIG: CampaignNqConfig = {
  variant: "nq",
  headline: "Need a Window Quote? Start Here.",
  supportingCopy:
    "Tell us how to reach you. WindowMan will help you take the next step toward getting a contractor quote—and can independently review that quote before you sign.",
  primaryCta: "Help Me Get My First Quote",
  successMessage:
    "Thanks — we received your request. A WindowMan team member will follow up about your project and the next step toward getting a quote.",
};

export const CAMPAIGN_NQ_FAQS = [
  {
    question: "Is WindowMan a window contractor?",
    answer:
      "No. WindowMan is an independent software and quote-intelligence platform. WindowMan does not install windows or replace the contractor who measures, verifies conditions, and provides the construction agreement.",
  },
  {
    question: "Does submitting this form create or analyze a quote?",
    answer:
      "No. Submitting this form only sends your request for help taking the next step toward a contractor quote. No quote, scan, audit, or report is created by this form.",
  },
  {
    question: "What happens after I request help getting a quote?",
    answer:
      "A WindowMan team member will follow up about your project and the next step toward obtaining a contractor quote. Any installed price remains subject to contractor field verification. Once a quote exists, WindowMan can independently review its price, scope, fees, warranty, and fine print.",
  },
] as const;
