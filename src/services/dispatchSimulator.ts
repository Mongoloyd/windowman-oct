import { fetchClientPlatformConfigs, maskConfigId, type PlatformConfigRow } from "@/services/clientPlatformConfigs";
import {
  fetchRevenueDispatchReadiness,
  maskId,
  type AttributionStrength,
  type ReadinessReasonCode,
  type ReadinessStatus,
  type RevenueReadinessRow,
} from "@/services/revenueDispatchReadiness";

export type DryRunStatus = "dry_run_ready" | "dry_run_warning" | "dry_run_blocked";
export type DryRunReasonCode =
  | "missing_client_slug"
  | "tenant_not_resolved"
  | "no_active_platform_config"
  | "token_missing"
  | "required_destination_id_missing"
  | "missing_event_id"
  | "missing_value"
  | "malformed_payload"
  | "weak_attribution"
  | "gross_value_used_not_true_margin"
  | "platform_mapper_basic"
  | "meta_missing_pixel_or_dataset"
  | "meta_missing_token"
  | "meta_missing_event_id"
  | "meta_event_id_quality_warning"
  | "meta_missing_value"
  | "meta_event_time_missing"
  | "meta_missing_fbc"
  | "meta_missing_fbp"
  | "meta_missing_fbclid"
  | "meta_missing_external_id"
  | "meta_missing_ip_or_user_agent"
  | "meta_using_gross_value_proxy"
  | "meta_payload_draft_only"
  | "meta_dedup_event_id_present"
  | "meta_match_quality_weak"
  | "tiktok_missing_pixel_id"
  | "tiktok_missing_event_source_id"
  | "tiktok_missing_ttclid"
  | "tiktok_missing_ttp"
  | "tiktok_missing_external_id"
  | "tiktok_missing_ip_or_user_agent"
  | "tiktok_value_missing"
  | "tiktok_event_id_missing"
  | "tiktok_event_time_missing"
  | "tiktok_using_gross_value_proxy"
  | "tiktok_payload_draft_only"
  | "google_missing_conversion_destination"
  | "google_missing_token"
  | "google_missing_event_id"
  | "google_missing_value"
  | "google_event_time_missing"
  | "google_missing_gclid"
  | "google_missing_gbraid"
  | "google_missing_wbraid"
  | "google_missing_google_click_id"
  | "google_missing_user_id"
  | "google_using_gross_value_proxy"
  | "google_payload_draft_only"
  | "google_attribution_quality_weak"
  | "endpoint_missing_url"
  | "endpoint_invalid_url"
  | "endpoint_non_https_url_warning"
  | "endpoint_missing_token_warning"
  | "endpoint_missing_event_id"
  | "endpoint_missing_value"
  | "endpoint_event_time_missing"
  | "endpoint_using_gross_value_proxy"
  | "endpoint_payload_draft_only"
  | "endpoint_weak_attribution_warning"
  | "payload_draft_ready";

export type TikTokMatchQuality = "strong" | "medium" | "weak" | "missing";
export type MetaMatchInputQuality = "strong" | "medium" | "weak" | "missing";
export type GoogleAttributionQuality = "strong" | "medium" | "weak" | "missing";
export type EndpointReadiness = "ready" | "warning" | "blocked";

export const TIKTOK_DRY_RUN_MAPPER_VERSION = "tiktok-dry-run-v1";
export const META_CAPI_DRY_RUN_MAPPER_VERSION = "meta-capi-dry-run-v1";
export const GOOGLE_DRY_RUN_MAPPER_VERSION = "google-ads-ga4-dry-run-v1";
export const GTM_SERVER_DRY_RUN_MAPPER_VERSION = "gtm-server-dry-run-v1";
export const CRM_WEBHOOK_DRY_RUN_MAPPER_VERSION = "crm-webhook-dry-run-v1";
export const GENERIC_ENDPOINT_DRY_RUN_MAPPER_VERSION = "generic-endpoint-dry-run-v1";

export interface DispatchDryRunConfigSummary {
  id: string;
  platformName: string;
  tokenPresent: boolean;
  pixelIdPresent: boolean;
  datasetIdPresent: boolean;
  conversionIdPresent: boolean;
  conversionLabelPresent: boolean;
  endpointUrlPresent: boolean;
  destinationSummary: string;
}

export interface DispatchDryRunRow {
  id: string;
  eventRowId: string;
  canonicalEventId: string | null;
  eventName: string | null;
  eventTimestamp: string | null;
  clientSlug: string | null;
  leadId: string | null;
  platformName: string;
  config: DispatchDryRunConfigSummary;
  simulatedStatus: DryRunStatus;
  reasons: DryRunReasonCode[];
  valueUsd: number | null;
  attributionStrength: AttributionStrength;
  attributionPresence: Record<string, boolean>;
  tokenPresent: boolean;
  payload: Record<string, unknown>;
  readinessStatus: ReadinessStatus;
  sourceReadinessReasons: ReadinessReasonCode[];
  canonical: RevenueReadinessRow;
}

export interface DispatchDryRunOrphan {
  id: string;
  eventRowId: string;
  canonicalEventId: string | null;
  eventName: string | null;
  eventTimestamp: string | null;
  clientSlug: string | null;
  leadId: string | null;
  valueUsd: number | null;
  readinessStatus: ReadinessStatus;
  attributionStrength: AttributionStrength;
  reasons: DryRunReasonCode[];
  suggestedFix: string;
  canonical: RevenueReadinessRow;
}

export interface DispatchDryRunResult {
  rows: DispatchDryRunRow[];
  orphans: DispatchDryRunOrphan[];
  kpis: {
    canonicalRevenueEventsInspected: number;
    readyEvents: number;
    warningEvents: number;
    blockedOrOrphanedEvents: number;
    totalSimulatedDispatches: number;
    metaDispatches: number;
    tiktokDispatches: number;
    googleDispatches: number;
    gtmWebhookDispatches: number;
    orphanedNoActiveConfig: number;
  };
}

const HARD_ROW_REASONS: DryRunReasonCode[] = [
  "missing_client_slug",
  "tenant_not_resolved",
  "no_active_platform_config",
  "required_destination_id_missing",
  "missing_event_id",
  "missing_value",
  "malformed_payload",
  "meta_missing_pixel_or_dataset",
  "meta_missing_event_id",
  "meta_missing_value",
  "meta_event_time_missing",
  "tiktok_missing_event_source_id",
  "tiktok_value_missing",
  "tiktok_event_id_missing",
  "tiktok_event_time_missing",
  "google_missing_conversion_destination",
  "google_missing_event_id",
  "google_missing_value",
  "google_event_time_missing",
  "endpoint_missing_url",
  "endpoint_invalid_url",
  "endpoint_missing_event_id",
  "endpoint_missing_value",
  "endpoint_event_time_missing",
];

const GOOGLE_PLATFORM_NAMES = new Set(["google", "google_ads", "ga4"]);
const ENDPOINT_PLATFORM_NAMES = new Set(["gtm_server", "crm_webhook"]);

function hasText(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function addReason(reasons: Set<DryRunReasonCode>, code: DryRunReasonCode) {
  reasons.add(code);
}

function unixSeconds(value: string | null): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function destinationSummary(config: PlatformConfigRow): string {
  const platform = config.platform_name;
  if (platform === "meta") return config.pixel_id ? `Pixel ${maskId(config.pixel_id)}` : config.dataset_id ? `Dataset ${maskId(config.dataset_id)}` : "Meta destination missing";
  if (platform === "tiktok") return config.pixel_id ? `Pixel ${maskId(config.pixel_id)}` : config.dataset_id ? `Dataset ${maskId(config.dataset_id)}` : "TikTok destination missing";
  if (GOOGLE_PLATFORM_NAMES.has(platform)) return googleDestination(config).id ? `${googleDestination(config).type} ${maskId(googleDestination(config).id)}` : "Google destination missing";
  if (platform === "gtm_server") return config.endpoint_url ? "GTM endpoint present" : "GTM endpoint missing";
  if (platform === "crm_webhook") return config.endpoint_url ? "CRM webhook endpoint present" : "CRM webhook endpoint missing";
  if (platform === "other" && config.endpoint_url) return "Generic endpoint present";
  return "Generic destination";
}

function isEndpointBackedPlatform(config: PlatformConfigRow): boolean {
  return ENDPOINT_PLATFORM_NAMES.has(config.platform_name) || (config.platform_name === "other" && hasText(config.endpoint_url));
}

function configSummary(config: PlatformConfigRow): DispatchDryRunConfigSummary {
  return {
    id: config.id,
    platformName: config.platform_name,
    tokenPresent: Boolean(config.token_secret_id),
    pixelIdPresent: hasText(config.pixel_id),
    datasetIdPresent: hasText(config.dataset_id),
    conversionIdPresent: hasText(config.conversion_id),
    conversionLabelPresent: hasText(config.conversion_label),
    endpointUrlPresent: hasText(config.endpoint_url),
    destinationSummary: destinationSummary(config),
  };
}

function platformRequiresToken(platform: string): boolean {
  return ["meta", "tiktok"].includes(platform);
}

function addConfigReasons(config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  const platform = config.platform_name;
  if (platformRequiresToken(platform) && !config.token_secret_id) addReason(reasons, "token_missing");
  if ((platform === "meta" || platform === "tiktok") && !hasText(config.pixel_id) && !hasText(config.dataset_id)) addReason(reasons, "required_destination_id_missing");
}

function baseReasons(row: RevenueReadinessRow): Set<DryRunReasonCode> {
  const reasons = new Set<DryRunReasonCode>();
  if (!row.clientSlug) addReason(reasons, "missing_client_slug");
  if (row.clientSlug && !row.config.tenantResolved) addReason(reasons, "tenant_not_resolved");
  if (!row.eventId) addReason(reasons, "missing_event_id");
  if (!row.valueUsd || row.valueUsd <= 0) addReason(reasons, "missing_value");
  if (!row.payloadIntegrity.payloadIsObject) addReason(reasons, "malformed_payload");
  if (row.attributionStrength === "weak") addReason(reasons, "weak_attribution");
  if (row.reasons.includes("gross_value_used_not_true_margin")) addReason(reasons, "gross_value_used_not_true_margin");
  return reasons;
}

function computeStatus(reasons: DryRunReasonCode[]): DryRunStatus {
  if (reasons.some((code) => HARD_ROW_REASONS.includes(code))) return "dry_run_blocked";
  if (reasons.some((code) => code !== "payload_draft_ready")) return "dry_run_warning";
  return "dry_run_ready";
}

function presence(row: RevenueReadinessRow, key: string): boolean {
  return Boolean(row.attributionPresence[key]);
}

function leadExternalId(row: RevenueReadinessRow) {
  return { external_id_present: Boolean(row.leadId), external_id: row.leadId ? maskId(row.leadId) : null };
}

function metaDestination(config: PlatformConfigRow): { id: string | null; type: "pixel_id" | "dataset_id" | "missing" } {
  if (hasText(config.pixel_id)) return { id: config.pixel_id, type: "pixel_id" };
  if (hasText(config.dataset_id)) return { id: config.dataset_id, type: "dataset_id" };
  return { id: null, type: "missing" };
}

function googleDestination(config: PlatformConfigRow): { id: string | null; type: "conversion_id" | "conversion_label" | "dataset_id" | "pixel_id" | "missing"; strength: "strong" | "acceptable" | "fallback" | "missing" } {
  if (hasText(config.conversion_id) && hasText(config.conversion_label)) return { id: config.conversion_id, type: "conversion_id", strength: "strong" };
  if (hasText(config.conversion_id)) return { id: config.conversion_id, type: "conversion_id", strength: "acceptable" };
  if (hasText(config.conversion_label)) return { id: config.conversion_label, type: "conversion_label", strength: "acceptable" };
  if (hasText(config.dataset_id)) return { id: config.dataset_id, type: "dataset_id", strength: "fallback" };
  if (hasText(config.pixel_id)) return { id: config.pixel_id, type: "pixel_id", strength: "fallback" };
  return { id: null, type: "missing", strength: "missing" };
}

function metaMatchInputQuality(row: RevenueReadinessRow): MetaMatchInputQuality {
  const externalId = Boolean(row.leadId);
  const hasFbc = presence(row, "fbc");
  const hasFbp = presence(row, "fbp");
  const hasFbclid = presence(row, "fbclid");
  const hasUtm = presence(row, "utm_source") || presence(row, "utm_campaign");

  if (externalId && hasFbc && hasFbp) return "strong";
  if (externalId && (hasFbc || hasFbp || hasFbclid)) return "medium";
  if (externalId || hasUtm) return "weak";
  return "missing";
}

function hasSuspiciousEventId(eventId: string | null): boolean {
  if (!eventId) return false;
  return eventId.trim().length < 12 || /^\d+$/.test(eventId.trim());
}

function addMetaReasons(row: RevenueReadinessRow, config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);
  const matchQuality = metaMatchInputQuality(row);

  if (!metaDestination(config).id) addReason(reasons, "meta_missing_pixel_or_dataset");
  if (!config.token_secret_id) addReason(reasons, "meta_missing_token");
  if (!row.eventId) addReason(reasons, "meta_missing_event_id");
  if (hasSuspiciousEventId(row.eventId)) addReason(reasons, "meta_event_id_quality_warning");
  if (!row.valueUsd || row.valueUsd <= 0) addReason(reasons, "meta_missing_value");
  if (!eventTime) addReason(reasons, "meta_event_time_missing");
  if (!presence(row, "fbc")) addReason(reasons, "meta_missing_fbc");
  if (!presence(row, "fbp")) addReason(reasons, "meta_missing_fbp");
  if (!presence(row, "fbclid")) addReason(reasons, "meta_missing_fbclid");
  if (!row.leadId) addReason(reasons, "meta_missing_external_id");
  addReason(reasons, "meta_missing_ip_or_user_agent");
  if (row.reasons.includes("gross_value_used_not_true_margin")) addReason(reasons, "meta_using_gross_value_proxy");
  if (row.eventId) addReason(reasons, "meta_dedup_event_id_present");
  if (matchQuality === "weak" || matchQuality === "missing") addReason(reasons, "meta_match_quality_weak");
  addReason(reasons, "meta_payload_draft_only");
}

function tiktokEventSourceId(config: PlatformConfigRow): string | null {
  return hasText(config.pixel_id) ? config.pixel_id : hasText(config.dataset_id) ? config.dataset_id : null;
}

function tiktokEventName(row: RevenueReadinessRow): "Purchase" {
  return "Purchase";
}

function tiktokMatchQuality(row: RevenueReadinessRow): TikTokMatchQuality {
  const externalId = Boolean(row.leadId);
  const hasTikTokClickOrCookie = presence(row, "ttclid") || presence(row, "ttp");
  const hasHashedIdentifier = false;
  const hasIpAndUserAgent = false;
  const hasUtm = presence(row, "utm_source") || presence(row, "utm_campaign");

  if (externalId && hasTikTokClickOrCookie && hasIpAndUserAgent) return "strong";
  if (externalId && (hasTikTokClickOrCookie || hasHashedIdentifier)) return "medium";
  if (externalId || hasUtm) return "weak";
  return "missing";
}

function addTikTokReasons(row: RevenueReadinessRow, config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  if (!hasText(config.pixel_id)) addReason(reasons, "tiktok_missing_pixel_id");
  if (!tiktokEventSourceId(config)) addReason(reasons, "tiktok_missing_event_source_id");
  if (!row.eventId) addReason(reasons, "tiktok_event_id_missing");
  if (!row.valueUsd || row.valueUsd <= 0) addReason(reasons, "tiktok_value_missing");
  if (!unixSeconds(row.timestamp ?? row.createdAt)) addReason(reasons, "tiktok_event_time_missing");
  if (!presence(row, "ttclid")) addReason(reasons, "tiktok_missing_ttclid");
  if (!presence(row, "ttp")) addReason(reasons, "tiktok_missing_ttp");
  if (!row.leadId) addReason(reasons, "tiktok_missing_external_id");
  addReason(reasons, "tiktok_missing_ip_or_user_agent");
  if (row.reasons.includes("gross_value_used_not_true_margin")) addReason(reasons, "tiktok_using_gross_value_proxy");
  addReason(reasons, "tiktok_payload_draft_only");
}

function googleAttributionQuality(row: RevenueReadinessRow): GoogleAttributionQuality {
  const hasGoogleClickId = presence(row, "gclid") || presence(row, "gbraid") || presence(row, "wbraid");
  const hasEventId = Boolean(row.eventId);
  const hasValue = Boolean(row.valueUsd && row.valueUsd > 0);
  const hasUserId = Boolean(row.leadId);
  const hasUtm = presence(row, "utm_source") || presence(row, "utm_campaign");

  if (hasGoogleClickId && hasEventId && hasValue) return "strong";
  if (hasUserId && hasUtm && !hasGoogleClickId) return "medium";
  if (hasUserId || hasUtm) return "weak";
  return "missing";
}

function addGoogleReasons(row: RevenueReadinessRow, config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  const attributionQuality = googleAttributionQuality(row);

  if (!googleDestination(config).id) addReason(reasons, "google_missing_conversion_destination");
  if (!config.token_secret_id) addReason(reasons, "google_missing_token");
  if (!row.eventId) addReason(reasons, "google_missing_event_id");
  if (!row.valueUsd || row.valueUsd <= 0) addReason(reasons, "google_missing_value");
  if (!unixSeconds(row.timestamp ?? row.createdAt)) addReason(reasons, "google_event_time_missing");
  if (!presence(row, "gclid")) addReason(reasons, "google_missing_gclid");
  if (!presence(row, "gbraid")) addReason(reasons, "google_missing_gbraid");
  if (!presence(row, "wbraid")) addReason(reasons, "google_missing_wbraid");
  if (!presence(row, "gclid") && !presence(row, "gbraid") && !presence(row, "wbraid")) addReason(reasons, "google_missing_google_click_id");
  if (!row.leadId) addReason(reasons, "google_missing_user_id");
  if (row.reasons.includes("gross_value_used_not_true_margin")) addReason(reasons, "google_using_gross_value_proxy");
  if (attributionQuality === "weak" || attributionQuality === "missing") addReason(reasons, "google_attribution_quality_weak");
  addReason(reasons, "google_payload_draft_only");
}

function endpointUrlShape(config: PlatformConfigRow): { present: boolean; valid: boolean; https: boolean } {
  if (!hasText(config.endpoint_url)) return { present: false, valid: false, https: false };

  try {
    const parsed = new URL(config.endpoint_url);
    return {
      present: true,
      valid: parsed.protocol === "http:" || parsed.protocol === "https:",
      https: parsed.protocol === "https:",
    };
  } catch {
    return { present: true, valid: false, https: false };
  }
}

function endpointReadiness(row: RevenueReadinessRow, config: PlatformConfigRow): EndpointReadiness {
  const url = endpointUrlShape(config);
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);

  if (!url.present || !url.valid || !row.eventId || !row.valueUsd || row.valueUsd <= 0 || !eventTime) return "blocked";
  if (!url.https || !config.token_secret_id || row.attributionStrength === "weak" || row.reasons.includes("gross_value_used_not_true_margin")) return "warning";
  return "ready";
}

function addEndpointReasons(row: RevenueReadinessRow, config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  const url = endpointUrlShape(config);

  if (!url.present) addReason(reasons, "endpoint_missing_url");
  if (url.present && !url.valid) addReason(reasons, "endpoint_invalid_url");
  if (url.present && url.valid && !url.https) addReason(reasons, "endpoint_non_https_url_warning");
  if (!config.token_secret_id) addReason(reasons, "endpoint_missing_token_warning");
  if (!row.eventId) addReason(reasons, "endpoint_missing_event_id");
  if (!row.valueUsd || row.valueUsd <= 0) addReason(reasons, "endpoint_missing_value");
  if (!unixSeconds(row.timestamp ?? row.createdAt)) addReason(reasons, "endpoint_event_time_missing");
  if (row.reasons.includes("gross_value_used_not_true_margin")) addReason(reasons, "endpoint_using_gross_value_proxy");
  if (row.attributionStrength === "weak") addReason(reasons, "endpoint_weak_attribution_warning");
  addReason(reasons, "endpoint_payload_draft_only");
}

function endpointDestinationShape(config: PlatformConfigRow) {
  const url = endpointUrlShape(config);
  return {
    endpoint_url_present: url.present,
    endpoint_url_valid: url.valid,
    endpoint_https: url.https,
    token_present: Boolean(config.token_secret_id),
  };
}

function endpointDebug(row: RevenueReadinessRow, config: PlatformConfigRow, mapperVersion: string) {
  const warnings = new Set<DryRunReasonCode>();
  addEndpointReasons(row, config, warnings);
  return {
    canonical_event_row_id: maskId(row.id),
    platform_config_id: maskConfigId(config.id),
    mapper_version: mapperVersion,
    endpoint_readiness: endpointReadiness(row, config),
    event_id_present: Boolean(row.eventId),
    event_id_source: "canonical_event_id",
    event_time_present: Boolean(unixSeconds(row.timestamp ?? row.createdAt)),
    value_basis: row.payloadIntegrity.optimizationValueBasis ?? "gross_sale_value",
    true_margin_available: row.payloadIntegrity.trueMarginAvailable === true,
    warnings: Array.from(warnings),
  };
}

function attributionPresenceSnapshot(row: RevenueReadinessRow) {
  return {
    fbc_present: presence(row, "fbc"),
    fbp_present: presence(row, "fbp"),
    ttclid_present: presence(row, "ttclid"),
    ttp_present: presence(row, "ttp"),
    gclid_present: presence(row, "gclid"),
    gbraid_present: presence(row, "gbraid"),
    wbraid_present: presence(row, "wbraid"),
  };
}

function userIdentityPresenceSnapshot(row: RevenueReadinessRow) {
  return {
    external_id_present: Boolean(row.leadId),
    lead_id_present: Boolean(row.leadId),
    email_hash_present: false,
    phone_hash_present: false,
  };
}

function buildMetaPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  const destination = metaDestination(config);
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);
  const warningSet = new Set<DryRunReasonCode>();
  addMetaReasons(row, config, warningSet);

  return {
    data: [
      {
        event_name: "Purchase",
        event_time: eventTime,
        event_id: row.eventId,
        action_source: "website",
        event_source_url_present: false,
        landing_path_present: false,
        referrer_present: false,
        user_data: {
          ...leadExternalId(row),
          em_present: false,
          ph_present: false,
          fbc_present: presence(row, "fbc"),
          fbp_present: presence(row, "fbp"),
          fbclid_present: presence(row, "fbclid"),
          client_ip_address_present: false,
          client_user_agent_present: false,
        },
        custom_data: {
          currency: "USD",
          value: row.valueUsd,
          content_name: "WindowMan sold lead",
          content_category: "home_improvement",
          order_id: row.eventId ? maskId(row.eventId) : row.leadId ? maskId(row.leadId) : null,
          status: row.payloadIntegrity.dispositionState ?? "sold_closed",
          value_basis: row.payloadIntegrity.optimizationValueBasis ?? "gross_sale_value",
          true_margin_available: row.payloadIntegrity.trueMarginAvailable === true,
        },
      },
    ],
    dry_run: true,
    windowman_debug: {
      canonical_event_row_id: maskId(row.id),
      client_slug: row.clientSlug,
      platform_config_id: maskConfigId(config.id),
      mapper_version: META_CAPI_DRY_RUN_MAPPER_VERSION,
      destination_id_present: Boolean(destination.id),
      destination_id_type: destination.type,
      destination_id_masked: destination.id ? maskId(destination.id) : null,
      deduplication_event_id_present: Boolean(row.eventId),
      deduplication_event_id_source: "canonical_event_id",
      deduplication_event_id_masked: row.eventId ? maskId(row.eventId) : null,
      match_input_quality: metaMatchInputQuality(row),
      warnings: Array.from(warningSet),
    },
  };
}

function buildTikTokPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  const eventSourceId = tiktokEventSourceId(config);
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);
  const warningSet = new Set<DryRunReasonCode>();
  addTikTokReasons(row, config, warningSet);

  return {
    event_source: "web",
    event_source_id: eventSourceId ? maskId(eventSourceId) : null,
    data: [
      {
        event: tiktokEventName(row),
        event_time: eventTime,
        event_id: row.eventId,
        user: {
          external_id_present: Boolean(row.leadId),
          ttclid_present: presence(row, "ttclid"),
          ttp_present: presence(row, "ttp"),
          ip_present: false,
          user_agent_present: false,
          email_hash_present: false,
          phone_hash_present: false,
        },
        properties: {
          currency: "USD",
          value: row.valueUsd,
          content_type: "product",
          description: "WindowMan sold lead",
          order_id: row.eventId ? maskId(row.eventId) : row.leadId ? maskId(row.leadId) : null,
          status: row.payloadIntegrity.dispositionState ?? "sold_closed",
        },
        page: {
          url_present: false,
          referrer_present: false,
        },
      },
    ],
    dry_run: true,
    windowman_debug: {
      canonical_event_row_id: maskId(row.id),
      client_slug: row.clientSlug,
      platform_config_id: maskConfigId(config.id),
      mapper_version: TIKTOK_DRY_RUN_MAPPER_VERSION,
      value_basis: "gross_sale_value",
      true_margin_available: row.payloadIntegrity.trueMarginAvailable === true,
      match_quality: tiktokMatchQuality(row),
      warnings: Array.from(warningSet),
    },
  };
}

function buildGooglePayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  const destination = googleDestination(config);
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);
  const warningSet = new Set<DryRunReasonCode>();
  addGoogleReasons(row, config, warningSet);
  const maskedEventOrLeadId = row.eventId ? maskId(row.eventId) : row.leadId ? maskId(row.leadId) : null;

  return {
    event_type: "google_conversion_dry_run",
    google_ads: {
      conversion_action_present: Boolean(destination.id),
      conversion_id_present: hasText(config.conversion_id),
      conversion_label_present: hasText(config.conversion_label),
      order_id: maskedEventOrLeadId,
      conversion_date_time_present: Boolean(eventTime),
      conversion_value: row.valueUsd,
      currency_code: "USD",
      gclid_present: presence(row, "gclid"),
      gbraid_present: presence(row, "gbraid"),
      wbraid_present: presence(row, "wbraid"),
    },
    ga4: {
      event_name: "purchase",
      client_id_present: false,
      session_id_present: false,
      user_id_present: Boolean(row.leadId),
      transaction_id: maskedEventOrLeadId,
      currency: "USD",
      value: row.valueUsd,
      items_included: false,
    },
    dry_run: true,
    windowman_debug: {
      canonical_event_row_id: maskId(row.id),
      client_slug: row.clientSlug,
      platform_config_id: maskConfigId(config.id),
      mapper_version: GOOGLE_DRY_RUN_MAPPER_VERSION,
      destination_present: Boolean(destination.id),
      destination_type: destination.type,
      destination_strength: destination.strength,
      google_attribution_quality: googleAttributionQuality(row),
      event_id_present: Boolean(row.eventId),
      event_id_source: "canonical_event_id",
      event_time_present: Boolean(eventTime),
      value_basis: "gross_sale_value",
      true_margin_available: false,
      warnings: Array.from(warningSet),
    },
  };
}

function buildGtmPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  return {
    event_type: "gtm_server_dry_run",
    gtm_server: {
      event_name: "purchase",
      event_id: row.eventId ? maskId(row.eventId) : null,
      client_slug: row.clientSlug,
      value: row.valueUsd,
      currency: "USD",
      source: "windowman",
      attribution_presence: attributionPresenceSnapshot(row),
      user_identity_presence: userIdentityPresenceSnapshot(row),
    },
    endpoint: endpointDestinationShape(config),
    dry_run: true,
    windowman_debug: endpointDebug(row, config, GTM_SERVER_DRY_RUN_MAPPER_VERSION),
  };
}

function buildCrmPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  return {
    event_type: "crm_webhook_dry_run",
    crm_webhook: {
      event: "sold_closed",
      event_id: row.eventId ? maskId(row.eventId) : null,
      lead_id: row.leadId ? maskId(row.leadId) : null,
      client_slug: row.clientSlug,
      value_usd: row.valueUsd,
      currency: "USD",
      source: "windowman",
      status: "sold_closed",
      occurred_at_present: Boolean(unixSeconds(row.timestamp ?? row.createdAt)),
      contractor_outcome_present: false,
      opportunity_present: false,
    },
    routing: {
      tenant_key: row.clientSlug,
      destination_type: "crm_webhook",
      ...endpointDestinationShape(config),
    },
    dry_run: true,
    windowman_debug: endpointDebug(row, config, CRM_WEBHOOK_DRY_RUN_MAPPER_VERSION),
  };
}

function buildGenericEndpointPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  return {
    event_type: "generic_endpoint_dry_run",
    generic_endpoint: {
      event: "sold_event",
      event_id: row.eventId ? maskId(row.eventId) : null,
      client_slug: row.clientSlug,
      value_usd: row.valueUsd,
      currency: "USD",
      source: "windowman",
    },
    endpoint: endpointDestinationShape(config),
    dry_run: true,
    windowman_debug: endpointDebug(row, config, GENERIC_ENDPOINT_DRY_RUN_MAPPER_VERSION),
  };
}

function buildGenericPayload(row: RevenueReadinessRow) {
  return {
    event_name: row.eventName,
    event_id: row.eventId ? maskId(row.eventId) : null,
    client_slug: row.clientSlug,
    value_usd: row.valueUsd,
    dry_run: true,
  };
}

function buildPayload(row: RevenueReadinessRow, config: PlatformConfigRow): Record<string, unknown> {
  if (GOOGLE_PLATFORM_NAMES.has(config.platform_name)) return buildGooglePayload(row, config);

  switch (config.platform_name) {
    case "meta":
      return buildMetaPayload(row, config);
    case "tiktok":
      return buildTikTokPayload(row, config);
    case "gtm_server":
      return buildGtmPayload(row, config);
    case "crm_webhook":
      return buildCrmPayload(row, config);
    case "other":
      return hasText(config.endpoint_url) ? buildGenericEndpointPayload(row, config) : buildGenericPayload(row);
    default:
      return buildGenericPayload(row);
  }
}

function suggestedFix(reasons: DryRunReasonCode[]) {
  if (reasons.includes("missing_client_slug")) return "Backfill client_slug on the canonical event, lead, or scan session.";
  if (reasons.includes("tenant_not_resolved")) return "Create or activate the matching client record for this client_slug.";
  if (reasons.includes("no_active_platform_config")) return "Create an active Platform Config for this client.";
  if (reasons.includes("required_destination_id_missing")) return "Add the required pixel, dataset, conversion, or endpoint identifier.";
  if (reasons.includes("token_missing")) return "Rotate/set the destination token in Platform Configs.";
  if (reasons.includes("missing_value")) return "Attach final sale value or optimization value metadata.";
  if (reasons.includes("missing_event_id")) return "Backfill deterministic canonical event_id before dispatch.";
  if (reasons.includes("malformed_payload")) return "Repair canonical payload shape before simulation.";
  return "Review readiness warnings before enabling live dispatch.";
}

export async function fetchDispatchDryRunQueue(): Promise<DispatchDryRunResult> {
  const [readiness, platformConfigResult] = await Promise.all([
    fetchRevenueDispatchReadiness(),
    fetchClientPlatformConfigs(),
  ]);
  const configsByClientSlug = new Map<string, PlatformConfigRow[]>();
  for (const config of platformConfigResult.configs) {
    if (!config.is_active || !config.clients?.slug) continue;
    const list = configsByClientSlug.get(config.clients.slug) ?? [];
    list.push(config);
    configsByClientSlug.set(config.clients.slug, list);
  }

  const rows: DispatchDryRunRow[] = [];
  const orphans: DispatchDryRunOrphan[] = [];

  for (const event of readiness.rows) {
    const sharedReasons = baseReasons(event);
    const activeConfigs = event.clientSlug ? (configsByClientSlug.get(event.clientSlug) ?? []) : [];

    if (activeConfigs.length === 0) {
      addReason(sharedReasons, "no_active_platform_config");
      const reasons = Array.from(sharedReasons);
      orphans.push({
        id: `orphan:${event.id}`,
        eventRowId: event.id,
        canonicalEventId: event.eventId,
        eventName: event.eventName,
        eventTimestamp: event.timestamp ?? event.createdAt,
        clientSlug: event.clientSlug,
        leadId: event.leadId,
        valueUsd: event.valueUsd,
        readinessStatus: event.status,
        attributionStrength: event.attributionStrength,
        reasons,
        suggestedFix: suggestedFix(reasons),
        canonical: event,
      });
      continue;
    }

    for (const config of activeConfigs) {
      const reasons = new Set(sharedReasons);
      addConfigReasons(config, reasons);
      if (config.platform_name === "meta") {
        addMetaReasons(event, config, reasons);
      } else if (config.platform_name === "tiktok") {
        addTikTokReasons(event, config, reasons);
      } else if (GOOGLE_PLATFORM_NAMES.has(config.platform_name)) {
        addGoogleReasons(event, config, reasons);
      } else {
        addReason(reasons, "platform_mapper_basic");
      }
      addReason(reasons, "payload_draft_ready");
      const reasonList = Array.from(reasons);
      rows.push({
        id: `${event.id}:${config.id}`,
        eventRowId: event.id,
        canonicalEventId: event.eventId,
        eventName: event.eventName,
        eventTimestamp: event.timestamp ?? event.createdAt,
        clientSlug: event.clientSlug,
        leadId: event.leadId,
        platformName: config.platform_name,
        config: configSummary(config),
        simulatedStatus: computeStatus(reasonList),
        reasons: reasonList,
        valueUsd: event.valueUsd,
        attributionStrength: event.attributionStrength,
        attributionPresence: event.attributionPresence,
        tokenPresent: Boolean(config.token_secret_id),
        payload: buildPayload(event, config),
        readinessStatus: event.status,
        sourceReadinessReasons: event.reasons,
        canonical: event,
      });
    }
  }

  return {
    rows,
    orphans,
    kpis: {
      canonicalRevenueEventsInspected: readiness.rows.length,
      readyEvents: readiness.rows.filter((row) => row.status === "ready").length,
      warningEvents: readiness.rows.filter((row) => row.status === "warning").length,
      blockedOrOrphanedEvents: readiness.rows.filter((row) => row.status === "blocked").length + orphans.length,
      totalSimulatedDispatches: rows.length,
      metaDispatches: rows.filter((row) => row.platformName === "meta").length,
      tiktokDispatches: rows.filter((row) => row.platformName === "tiktok").length,
      googleDispatches: rows.filter((row) => GOOGLE_PLATFORM_NAMES.has(row.platformName)).length,
      gtmWebhookDispatches: rows.filter((row) => ["gtm_server", "crm_webhook"].includes(row.platformName)).length,
      orphanedNoActiveConfig: orphans.filter((row) => row.reasons.includes("no_active_platform_config")).length,
    },
  };
}
