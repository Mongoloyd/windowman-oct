import type { CampaignNq2Config } from "./campaignNq2Types";

export const CAMPAIGN_NQ2_CONFIG: CampaignNq2Config = {
  variant: "nq2",
  route: "/nq2",
  headline: "Get a Free Window Quote — Then Let AI Audit It.",
  supportingCopy:
    "WindowMan helps you get a window estimate, then independently checks the price, scope and fine print before you sign.",
  primaryCta: "Get My Free Quote",
  secondaryCta: "Already Have a Quote? Upload It Here",
  successMessage:
    "Thanks — your request was saved. WindowMan will follow up about the next step toward getting a contractor estimate. Once you have a quote, you can return for an independent review.",
};

export const CAMPAIGN_NQ2_REASSURANCE = [
  "Independent Analysis",
  "No-Pressure Guidance",
  "AI-Powered Quote Review",
] as const;

export const CAMPAIGN_NQ2_STEPS = [
  {
    number: "01",
    title: "Request Your Estimate",
    body: "Start the process of obtaining a contractor quote.",
  },
  {
    number: "02",
    title: "Let WindowMan Check It",
    body: "WindowMan analyzes price, project scope, fees, warranty and fine print.",
  },
  {
    number: "03",
    title: "Compare With More Confidence",
    body: "Use independent information before making the purchasing decision.",
  },
] as const;

export const CAMPAIGN_NQ2_AUDIT_ROWS = [
  {
    label: "Contractor quote",
    detail: "The written estimate you receive from the contractor.",
  },
  {
    label: "Pricing benchmark",
    detail: "How the quoted price compares with available market context.",
  },
  {
    label: "Project scope",
    detail: "What is included, excluded, or left unclear.",
  },
  {
    label: "Fees",
    detail: "Permit, financing, administrative, and other add-on costs.",
  },
  {
    label: "Warranty",
    detail: "Coverage terms, duration, limitations, and exclusions.",
  },
] as const;

export const CAMPAIGN_NQ2_FAQS = [
  {
    question: "Is WindowMan a window contractor?",
    answer:
      "No. WindowMan is independent software and quote intelligence—not the installing contractor, a government agency, or a law firm.",
  },
  {
    question: "Is this free?",
    answer:
      "WindowMan starts with free quote help because education builds trust. If you later ask for help getting a better estimate, that step is optional. You are not required to use any contractor.",
  },
  {
    question: "What happens after I request a quote?",
    answer:
      "WindowMan will follow up about your project and the next step toward obtaining a contractor estimate. Once you have a written quote, WindowMan can independently review its price, scope, fees, warranty, and fine print before you sign.",
  },
] as const;
