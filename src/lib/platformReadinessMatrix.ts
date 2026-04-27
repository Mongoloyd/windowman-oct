export type PlatformName = "meta" | "tiktok" | "google_ads" | "ga4" | "gtm_server" | "crm_webhook" | "internal" | "other";

export type PlatformField =
  | "token_present"
  | "pixel_id_present"
  | "dataset_id_present"
  | "conversion_id_present"
  | "conversion_label_present"
  | "endpoint_url_present";

export type PlatformRequirementMode = "all" | "any" | "none";

export interface PlatformReadinessRule {
  platform: PlatformName;
  tokenRequired: boolean;
  destinationMode: PlatformRequirementMode;
  destinationFields: PlatformField[];
  warningIfTokenMissing?: boolean;
}

export interface PlatformReadinessInput extends Record<PlatformField, boolean> {
  platform_name: unknown;
  is_active?: boolean;
}

export interface PlatformReadinessEvaluation {
  platform: PlatformName;
  exactPlatformMatch: boolean;
  tokenRequired: boolean;
  tokenPresent: boolean;
  destinationReady: boolean;
  ready: boolean;
  missingFields: PlatformField[];
  warningFields: PlatformField[];
  rule: PlatformReadinessRule;
}

export const PLATFORM_READINESS_MATRIX: Record<PlatformName, PlatformReadinessRule> = {
  meta: { platform: "meta", tokenRequired: true, destinationMode: "any", destinationFields: ["pixel_id_present", "dataset_id_present"] },
  tiktok: { platform: "tiktok", tokenRequired: true, destinationMode: "all", destinationFields: ["pixel_id_present"] },
  google_ads: { platform: "google_ads", tokenRequired: true, destinationMode: "all", destinationFields: ["conversion_id_present", "conversion_label_present"] },
  ga4: { platform: "ga4", tokenRequired: true, destinationMode: "all", destinationFields: ["conversion_id_present"] },
  gtm_server: { platform: "gtm_server", tokenRequired: false, destinationMode: "all", destinationFields: ["endpoint_url_present"], warningIfTokenMissing: true },
  crm_webhook: { platform: "crm_webhook", tokenRequired: false, destinationMode: "all", destinationFields: ["endpoint_url_present"], warningIfTokenMissing: true },
  internal: { platform: "internal", tokenRequired: false, destinationMode: "none", destinationFields: [] },
  other: { platform: "other", tokenRequired: false, destinationMode: "any", destinationFields: ["endpoint_url_present", "pixel_id_present", "dataset_id_present", "conversion_id_present", "conversion_label_present"], warningIfTokenMissing: true },
};

export const PLATFORM_NAMES = Object.keys(PLATFORM_READINESS_MATRIX) as PlatformName[];

export function normalizePlatformName(value: unknown): PlatformName {
  return PLATFORM_NAMES.includes(value as PlatformName) ? (value as PlatformName) : "other";
}

export function evaluatePlatformReadiness(input: PlatformReadinessInput): PlatformReadinessEvaluation {
  const exactPlatformMatch = PLATFORM_NAMES.includes(input.platform_name as PlatformName);
  const platform = normalizePlatformName(input.platform_name);
  const rule = PLATFORM_READINESS_MATRIX[platform];
  const tokenPresent = Boolean(input.token_present);
  const missingFields: PlatformField[] = [];
  const warningFields: PlatformField[] = [];

  if (rule.tokenRequired && !tokenPresent) missingFields.push("token_present");
  if (!rule.tokenRequired && rule.warningIfTokenMissing && !tokenPresent) warningFields.push("token_present");

  const destinationReady =
    rule.destinationMode === "none"
      ? true
      : rule.destinationMode === "all"
        ? rule.destinationFields.every((field) => Boolean(input[field]))
        : rule.destinationFields.some((field) => Boolean(input[field]));

  if (!destinationReady) missingFields.push(...rule.destinationFields.filter((field) => !input[field]));

  return {
    platform,
    exactPlatformMatch,
    tokenRequired: rule.tokenRequired,
    tokenPresent,
    destinationReady,
    ready: exactPlatformMatch && destinationReady && (!rule.tokenRequired || tokenPresent) && input.is_active !== false,
    missingFields: Array.from(new Set(missingFields)),
    warningFields: Array.from(new Set(warningFields)),
    rule,
  };
}
