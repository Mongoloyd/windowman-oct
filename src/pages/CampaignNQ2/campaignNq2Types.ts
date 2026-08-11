export type CampaignNq2Variant = "nq2";

export type CampaignNq2FormValues = {
  firstName: string;
  phone: string;
  email: string;
};

export type CampaignNq2Field = keyof CampaignNq2FormValues;

export type CampaignNq2SubmitState =
  | "idle"
  | "editing"
  | "submitting"
  | "error"
  | "success";

export type CampaignNq2Config = {
  variant: CampaignNq2Variant;
  route: "/nq2";
  headline: string;
  supportingCopy: string;
  primaryCta: string;
  secondaryCta: string;
  successMessage: string;
};
