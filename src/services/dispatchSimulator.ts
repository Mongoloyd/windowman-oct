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
  | "payload_draft_ready";

export type TikTokMatchQuality = "strong" | "medium" | "weak" | "missing";

export const TIKTOK_DRY_RUN_MAPPER_VERSION = "tiktok-dry-run-v1";

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
  "tiktok_missing_pixel_id",
  "tiktok_missing_event_source_id",
  "tiktok_value_missing",
  "tiktok_event_id_missing",
  "tiktok_event_time_missing",
];

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
  if (platform === "google_ads" || platform === "ga4") return config.conversion_id ? `Conversion ${maskId(config.conversion_id)}` : config.conversion_label ? `Label ${maskId(config.conversion_label)}` : "Google destination missing";
  if (platform === "gtm_server" || platform === "crm_webhook") return config.endpoint_url ? "Endpoint present" : "Endpoint missing";
  return "Generic destination";
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
  return ["meta", "tiktok", "google_ads", "ga4"].includes(platform);
}

function addConfigReasons(config: PlatformConfigRow, reasons: Set<DryRunReasonCode>) {
  const platform = config.platform_name;
  if (platformRequiresToken(platform) && !config.token_secret_id) addReason(reasons, "token_missing");
  if ((platform === "meta" || platform === "tiktok") && !hasText(config.pixel_id) && !hasText(config.dataset_id)) addReason(reasons, "required_destination_id_missing");
  if ((platform === "google_ads" || platform === "ga4") && !hasText(config.conversion_id) && !hasText(config.conversion_label)) addReason(reasons, "required_destination_id_missing");
  if ((platform === "gtm_server" || platform === "crm_webhook") && !hasText(config.endpoint_url)) addReason(reasons, "required_destination_id_missing");
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

function buildMetaPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  return {
    event_name: "Purchase",
    event_time: unixSeconds(row.timestamp ?? row.createdAt),
    event_id: row.eventId,
    action_source: "website",
    user_data: {
      ...leadExternalId(row),
      fbc_present: presence(row, "fbc"),
      fbp_present: presence(row, "fbp"),
      client_ip_address_present: false,
      client_user_agent_present: false,
    },
    custom_data: {
      value: row.valueUsd,
      currency: "USD",
      content_name: "WindowMan sold lead",
    },
    windowman_debug: {
      platform_config_id: maskConfigId(config.id),
      mapper: "meta-draft-simulation",
    },
    dry_run: true,
  };
}

function buildTikTokPayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  const eventSourceId = tiktokEventSourceId(config);
  const eventTime = unixSeconds(row.timestamp ?? row.createdAt);
  const warnings: DryRunReasonCode[] = [];
  addTikTokReasons(row, config, { add: (code: DryRunReasonCode) => warnings.push(code) } as Set<DryRunReasonCode>);

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
      warnings,
    },
  };
}
        external_id_present: Boolean(row.leadId),
        ttclid_present: presence(row, "ttclid"),
        ttp_present: presence(row, "ttp"),
        ip_present: false,
        user_agent_present: false,
      },
    },
    properties: {
      value: row.valueUsd,
      currency: "USD",
      description: "WindowMan sold lead",
    },
    windowman_debug: {
      platform_config_id: maskConfigId(config.id),
      mapper: "tiktok-basic-draft-simulation",
    },
    dry_run: true,
  };
}

function buildGooglePayload(row: RevenueReadinessRow, config: PlatformConfigRow) {
  return {
    conversion_action: config.conversion_id ? maskId(config.conversion_id) : config.conversion_label ? maskId(config.conversion_label) : null,
    order_id: row.eventId,
    conversion_date_time: row.timestamp ?? row.createdAt,
    conversion_value: row.valueUsd,
    currency_code: "USD",
    gclid_present: presence(row, "gclid"),
    gbraid_present: presence(row, "gbraid"),
    wbraid_present: presence(row, "wbraid"),
    dry_run: true,
  };
}

function buildGtmPayload(row: RevenueReadinessRow) {
  return {
    event_name: "purchase",
    event_id: row.eventId,
    client_slug: row.clientSlug,
    value: row.valueUsd,
    currency: "USD",
    attribution_presence: row.attributionPresence,
    dry_run: true,
  };
}

function buildCrmPayload(row: RevenueReadinessRow) {
  return {
    event_type: "sold",
    event_id: row.eventId,
    lead_id: row.leadId ? maskId(row.leadId) : null,
    client_slug: row.clientSlug,
    value_usd: row.valueUsd,
    source: "windowman",
    dry_run: true,
  };
}

function buildGenericPayload(row: RevenueReadinessRow) {
  return {
    event_name: row.eventName,
    event_id: row.eventId,
    client_slug: row.clientSlug,
    value_usd: row.valueUsd,
    dry_run: true,
  };
}

function buildPayload(row: RevenueReadinessRow, config: PlatformConfigRow): Record<string, unknown> {
  switch (config.platform_name) {
    case "meta":
      return buildMetaPayload(row, config);
    case "tiktok":
      return buildTikTokPayload(row, config);
    case "google_ads":
    case "ga4":
      return buildGooglePayload(row, config);
    case "gtm_server":
      return buildGtmPayload(row);
    case "crm_webhook":
      return buildCrmPayload(row);
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
      addReason(reasons, "platform_mapper_basic");
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
      googleDispatches: rows.filter((row) => row.platformName === "google_ads" || row.platformName === "ga4").length,
      gtmWebhookDispatches: rows.filter((row) => ["gtm_server", "crm_webhook"].includes(row.platformName)).length,
      orphanedNoActiveConfig: orphans.filter((row) => row.reasons.includes("no_active_platform_config")).length,
    },
  };
}
