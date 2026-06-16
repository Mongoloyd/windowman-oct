export type QuoteReadiness =
  | "has_estimate"
  | "getting_quotes_now"
  | "need_quote_soon"
  | "researching";

export type NextdoorIdentityFields = {
  firstName: string;
  email: string;
  zip: string;
};

export type NextdoorPrefilledFields = {
  firstName: boolean;
  email: boolean;
  zip: boolean;
};

export type NextdoorTrafficMode =
  | "direct_nextdoor_click"
  | "native_followup"
  | "unknown";

export type NextdoorLeadMedium = "paid_social" | "native_followup" | "hosted_form";

export type NextdoorWmIntent = "has_quote" | "no_quote";

export type NextdoorAttributionSnapshot = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ndclid?: string;
  nd_lead_id?: string;
  nd_form_id?: string;
  nd_ad_id?: string;
  nd_ad_group_id?: string;
  nd_campaign_id?: string;
};

/** Local-only payload assembled on identity submit — not sent to backend in Prompt 4. */
export type NextdoorLeadPayload = {
  source: "nextdoor";
  campaign: string;
  medium: NextdoorLeadMedium;
  first_name: string;
  last_name?: string;
  email: string;
  zip: string;
  quote_readiness: QuoteReadiness;
  wm_intent: NextdoorWmIntent;
  attribution: NextdoorAttributionSnapshot;
  submitted_locally_at: string;
};
