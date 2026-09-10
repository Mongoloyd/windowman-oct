export const FUNCTION_NAME = "capture-quote-education-demo-lead";
export const SOURCE = "quote-education-demo" as const;
export const FIXTURE_ID = "windowman_sample_quote_v1";
export const HANDOFF_VERSION = "quote_education_handoff_v1";

export type QuoteEducationVariant = "xray" | "lens" | "challenge";
export type QuoteEducationHostPage = "/nq3" | "/nq4" | "/prophecy";
export type QuoteEducationAction =
  | "create"
  | "update_zip"
  | "update_phone"
  | "update_intake";

export interface DemoCreateMetadata {
  variant: QuoteEducationVariant;
  hostPage: QuoteEducationHostPage;
  entryPoint: string;
  fixtureId: typeof FIXTURE_ID;
}

export interface CampaignHandoffAnswers {
  handoff_version: typeof HANDOFF_VERSION;
  source_path: "/nq3" | "/nq4";
  wm_intent: "has_quote" | "no_quote";
  product_scope?: string;
  openings_bucket?: string;
  campaign_timing?: string;
}

const VARIANTS = new Set<QuoteEducationVariant>(["xray", "lens", "challenge"]);
const ACTIONS = new Set<QuoteEducationAction>([
  "create",
  "update_zip",
  "update_phone",
  "update_intake",
]);
const HOST_PAGES = new Set<QuoteEducationHostPage>([
  "/nq3",
  "/nq4",
  "/prophecy",
]);
const HANDOFF_PATHS = new Set<CampaignHandoffAnswers["source_path"]>([
  "/nq3",
  "/nq4",
]);
const PRODUCT_SCOPES = new Set([
  "Impact windows",
  "Impact doors",
  "Both windows and doors",
  "Not sure yet",
]);
const OPENINGS_BUCKETS = new Set(["1–5", "6–10", "11–15", "16+", "Not sure"]);
const TIMINGS = new Set(["ASAP", "1–3 months", "Planning ahead", "Not sure"]);
const HANDOFF_KEYS = new Set([
  "handoff_version",
  "source_path",
  "wm_intent",
  "product_scope",
  "openings_bucket",
  "campaign_timing",
]);
const ATTRIBUTION_KEYS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "ttclid",
  "wbraid",
  "gbraid",
  "msclkid",
  "ndclid",
  "nd_lead_id",
  "nd_form_id",
  "nd_ad_id",
  "nd_ad_group_id",
  "nd_campaign_id",
  "fbc",
  "fbp",
  "ttp",
  "client_slug",
  "wm_intent",
  "landing_page_url",
  "current_page_url",
  "latest_touch_page_url",
  "referrer",
  "landing_page",
  "latest_touch_page",
  "first_touch_at",
  "latest_touch_at",
  "captured_at",
]);
const EMAIL_LIKE = /[^\s/@]+@[^\s/@]+\.[^\s/@]+/;

function stringValue(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && trimmed.length <= max ? trimmed : null;
}

export function parseAction(value: unknown): QuoteEducationAction | null {
  return typeof value === "string" && ACTIONS.has(value as QuoteEducationAction)
    ? value as QuoteEducationAction
    : null;
}

export function parseCreateMetadata(
  body: Record<string, unknown>,
): { ok: true; value: DemoCreateMetadata } | { ok: false; code: string } {
  const variant = stringValue(body.variant, 20);
  if (!variant || !VARIANTS.has(variant as QuoteEducationVariant)) {
    return { ok: false, code: "invalid_variant" };
  }

  if (body.fixture_id !== FIXTURE_ID) {
    return { ok: false, code: "invalid_fixture" };
  }

  const entryPoint = stringValue(body.entry_point, 100);
  if (!entryPoint || !/^[a-zA-Z0-9_-]+$/.test(entryPoint)) {
    return { ok: false, code: "invalid_entry_point" };
  }

  const hostPage = stringValue(body.host_page, 100);
  if (
    !hostPage ||
    !HOST_PAGES.has(hostPage as QuoteEducationHostPage)
  ) {
    return { ok: false, code: "invalid_host_page" };
  }

  return {
    ok: true,
    value: {
      variant: variant as QuoteEducationVariant,
      hostPage: hostPage as QuoteEducationHostPage,
      entryPoint,
      fixtureId: FIXTURE_ID,
    },
  };
}

function safeMetadataObject(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const safe: Record<string, string> = {};
  for (const [key, rawValue] of Object.entries(value)) {
    if (!ATTRIBUTION_KEYS.has(key)) continue;
    const selected = stringValue(rawValue, 500);
    if (!selected || EMAIL_LIKE.test(selected)) continue;
    safe[key] = selected;
  }
  return safe;
}

export function buildStoredDemoMetadata(
  body: Record<string, unknown>,
  metadata: DemoCreateMetadata,
): {
  queryParams: Record<string, string>;
  attribution: Record<string, string>;
} {
  const demo = {
    synthetic_demo_variant: metadata.variant,
    synthetic_demo_host_path: metadata.hostPage,
    synthetic_demo_entry_point: metadata.entryPoint,
    synthetic_demo_fixture_id: metadata.fixtureId,
  };
  return {
    queryParams: { ...safeMetadataObject(body.query_params), ...demo },
    attribution: { ...safeMetadataObject(body.attribution), ...demo },
  };
}

export function parseCampaignHandoff(
  value: unknown,
): { ok: true; value: CampaignHandoffAnswers | null } | {
  ok: false;
  code: string;
} {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "invalid_handoff" };
  }

  const input = value as Record<string, unknown>;
  if (Object.keys(input).some((key) => !HANDOFF_KEYS.has(key))) {
    return { ok: false, code: "invalid_handoff" };
  }

  const sourcePath = stringValue(input.source_path, 10);
  const intent = stringValue(input.wm_intent, 20);
  if (
    input.handoff_version !== HANDOFF_VERSION ||
    !sourcePath ||
    !HANDOFF_PATHS.has(sourcePath as CampaignHandoffAnswers["source_path"]) ||
    (intent !== "has_quote" && intent !== "no_quote")
  ) {
    return { ok: false, code: "invalid_handoff" };
  }

  const productScope = stringValue(input.product_scope, 100);
  const openingsBucket = stringValue(input.openings_bucket, 30);
  const campaignTiming = stringValue(input.campaign_timing, 50);

  if (intent === "has_quote") {
    if (productScope || openingsBucket || campaignTiming) {
      return { ok: false, code: "invalid_handoff" };
    }
  } else if (
    !productScope || !PRODUCT_SCOPES.has(productScope) ||
    !openingsBucket || !OPENINGS_BUCKETS.has(openingsBucket) ||
    !campaignTiming || !TIMINGS.has(campaignTiming)
  ) {
    return { ok: false, code: "invalid_handoff" };
  }

  return {
    ok: true,
    value: {
      handoff_version: HANDOFF_VERSION,
      source_path: sourcePath as CampaignHandoffAnswers["source_path"],
      wm_intent: intent,
      ...(productScope ? { product_scope: productScope } : {}),
      ...(openingsBucket ? { openings_bucket: openingsBucket } : {}),
      ...(campaignTiming ? { campaign_timing: campaignTiming } : {}),
    },
  };
}
