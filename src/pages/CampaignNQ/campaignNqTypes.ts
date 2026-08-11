export type CampaignNqVariant = "nq";

export type CampaignNqFormValues = {
  firstName: string;
  phone: string;
  email: string;
};

export type CampaignNqField = keyof CampaignNqFormValues;

export type CampaignNqSubmitState =
  | "idle"
  | "editing"
  | "submitting"
  | "error"
  | "success";

export type CampaignNqConfig = {
  variant: CampaignNqVariant;
  headline: string;
  supportingCopy: string;
  primaryCta: string;
  successMessage: string;
};
