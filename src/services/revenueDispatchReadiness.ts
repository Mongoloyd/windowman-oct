import { supabase } from "@/integrations/supabase/client";

export type ReadinessStatus = "ready" | "warning" | "blocked";
export type AttributionStrength = "strong" | "medium" | "weak";

export type ReadinessReasonCode =
  | "missing_event_id"
  | "unknown_event_name"
  | "missing_lead_id"
  | "missing_value"
  | "missing_client_slug"
  | "destination_not_configured"
  | "token_missing"
  | "required_destination_id_missing"
  | "tenant_not_resolved"
  | "malformed_payload"
  | "client_slug_direct"
  | "attribution_weak"
  | "no_contractor_context"
  | "gross_value_used_not_true_margin"
  | "no_platform_enabled"
  | "missing_optional_click_id"
  | "historical_payload_missing_integrity_metadata";

export interface PlatformConfigSummary {
  platform_name: string;
  is_active: boolean;
  token_present: boolean;
  pixel_id_present: boolean;
  dataset_id_present: boolean;
  conversion_id_present: boolean;
  conversion_label_present: boolean;
  endpoint_url_present: boolean;
}

interface RpcReadinessRow {
  event_row_id: string;
  event_id: string | null;
  event_name: string | null;
  event_timestamp: string | null;
  created_at: string | null;
  lead_id: string | null;
  scan_session_id: string | null;
  analysis_id: string | null;
  client_slug: string | null;
  payload_is_object: boolean | null;
  payload_metadata: Record<string, unknown> | null;
  raw_payload_metadata: Record<string, unknown> | null;
  optimization_value_usd: number | string | null;
  final_value_cents: number | string | null;
  final_value_usd: number | string | null;
  disposition_state: string | null;
  revenue_truth_source: string | null;
  revenue_rollup_target: string | null;
  source_system: string | null;
  optimization_value_basis: string | null;
  true_margin_available: boolean | null;
  margin_model_version: string | null;
  contractor_outcome_id: string | null;
  opportunity_id: string | null;
  contractor_id: string | null;
  has_fbclid: boolean | null;
  has_fbc: boolean | null;
  has_fbp: boolean | null;
  has_gclid: boolean | null;
  has_wbraid: boolean | null;
  has_gbraid: boolean | null;
  has_ttclid: boolean | null;
  has_ttp: boolean | null;
  has_msclkid: boolean | null;
  has_utm_source: boolean | null;
  has_utm_campaign: boolean | null;
  tenant_resolved: boolean | null;
  active_platform_config_count: number | null;
  active_destination_configs_total: number | null;
  platform_configs: unknown;
}

export interface RevenueReadinessRow {
  id: string;
  eventId: string | null;
  eventName: string | null;
  timestamp: string | null;
  createdAt: string | null;
  leadId: string | null;
  scanSessionId: string | null;
  analysisId: string | null;
  clientSlug: string | null;
  status: ReadinessStatus;
  reasons: ReadinessReasonCode[];
  valueUsd: number | null;
  finalValueCents: number | null;
  finalValueUsd: number | null;
  optimizationValueUsd: number | null;
  attributionStrength: AttributionStrength;
  attributionPresence: Record<string, boolean>;
  payloadIntegrity: {
    payloadIsObject: boolean;
    revenueTruthSource: string | null;
    revenueRollupTarget: string | null;
    sourceSystem: string | null;
    dispositionState: string | null;
    optimizationValueBasis: string | null;
    trueMarginAvailable: boolean | null;
    marginModelVersion: string | null;
  };
  context: {
    contractorOutcomeId: string | null;
    opportunityId: string | null;
    contractorId: string | null;
  };
  config: {
    tenantResolved: boolean;
    activePlatformConfigCount: number;
    activeDestinationConfigsTotal: number;
    platformConfigs: PlatformConfigSummary[];
  };
}

export interface RevenueReadinessResult {
  rows: RevenueReadinessRow[];
  kpis: {
    totalRevenueEvents: number;
    ready: number;
    warning: number;
    blocked: number;
    activeDestinationConfigs: number;
    missingClientSlug: number;
    weakAttribution: number;
    grossValueProxyCount: number;
  };
}

const SOLD_EVENT_ALIASES = new Set(["sold", "sold_closed", "purchase", "Purchase", "wm_sold", "sale_confirmed"]);

function toNumber(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function maskId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function isRevenueEvent(eventName: string | null, dispositionState: string | null): boolean {
  const value = eventName ?? "";
  return SOLD_EVENT_ALIASES.has(value) || /sold|purchase/i.test(value) || dispositionState === "sold_closed";
}

function addReason(reasons: Set<ReadinessReasonCode>, code: ReadinessReasonCode) {
  reasons.add(code);
}

function platformNeedsServerToken(platform: string): boolean {
  const p = platform.toLowerCase();
  return p.includes("meta") || p.includes("tiktok") || p.includes("google");
}

function platformDestinationReady(config: PlatformConfigSummary, reasons: Set<ReadinessReasonCode>) {
  const platform = config.platform_name.toLowerCase();
  if (platformNeedsServerToken(platform) && !config.token_present) addReason(reasons, "token_missing");

  if (platform.includes("meta")) {
    if (!config.pixel_id_present && !config.dataset_id_present) addReason(reasons, "required_destination_id_missing");
    return;
  }
  if (platform.includes("tiktok")) {
    if (!config.pixel_id_present) addReason(reasons, "required_destination_id_missing");
    return;
  }
  if (platform.includes("google")) {
    if (!config.conversion_id_present && !config.conversion_label_present) addReason(reasons, "required_destination_id_missing");
    return;
  }
  if (platform.includes("gtm") || platform.includes("webhook") || platform.includes("crm") || platform.includes("other")) {
    if (!config.endpoint_url_present) addReason(reasons, "required_destination_id_missing");
    if (!config.token_present) addReason(reasons, "missing_optional_click_id");
  }
}

function computeAttributionStrength(attribution: Record<string, boolean>, leadId: string | null): AttributionStrength {
  const clickOrBrowser = ["fbclid", "fbc", "fbp", "gclid", "wbraid", "gbraid", "ttclid", "ttp", "msclkid"].some((key) => attribution[key]);
  if (clickOrBrowser && leadId) return "strong";
  if ((attribution.utm_source || attribution.utm_campaign) && leadId) return "medium";
  return "weak";
}

function computeValue(row: RpcReadinessRow): { valueUsd: number | null; finalValueCents: number | null; finalValueUsd: number | null; optimizationValueUsd: number | null } {
  const finalValueCents = toNumber(row.final_value_cents);
  const finalValueUsd = toNumber(row.final_value_usd) ?? (finalValueCents != null ? finalValueCents / 100 : null);
  const optimizationValueUsd = toNumber(row.optimization_value_usd);
  return {
    finalValueCents,
    finalValueUsd,
    optimizationValueUsd,
    valueUsd: finalValueUsd ?? optimizationValueUsd,
  };
}

function normalizePlatformConfigs(value: unknown): PlatformConfigSummary[] {
  if (!Array.isArray(value)) return [];
  return value.map((config) => ({
    platform_name: String(config.platform_name ?? "other"),
    is_active: Boolean(config.is_active),
    token_present: Boolean(config.token_present),
    pixel_id_present: Boolean(config.pixel_id_present),
    dataset_id_present: Boolean(config.dataset_id_present),
    conversion_id_present: Boolean(config.conversion_id_present),
    conversion_label_present: Boolean(config.conversion_label_present),
    endpoint_url_present: Boolean(config.endpoint_url_present),
  }));
}

function mapReadinessRow(row: RpcReadinessRow): RevenueReadinessRow {
  const reasons = new Set<ReadinessReasonCode>();
  const platformConfigs = normalizePlatformConfigs(row.platform_configs);
  const value = computeValue(row);
  const attributionPresence = {
    fbclid: Boolean(row.has_fbclid),
    fbc: Boolean(row.has_fbc),
    fbp: Boolean(row.has_fbp),
    gclid: Boolean(row.has_gclid),
    wbraid: Boolean(row.has_wbraid),
    gbraid: Boolean(row.has_gbraid),
    ttclid: Boolean(row.has_ttclid),
    ttp: Boolean(row.has_ttp),
    msclkid: Boolean(row.has_msclkid),
    utm_source: Boolean(row.has_utm_source),
    utm_campaign: Boolean(row.has_utm_campaign),
  };
  const attributionStrength = computeAttributionStrength(attributionPresence, row.lead_id);

  if (!row.payload_is_object) addReason(reasons, "malformed_payload");
  if (!row.event_id) addReason(reasons, "missing_event_id");
  if (!isRevenueEvent(row.event_name, row.disposition_state)) addReason(reasons, "unknown_event_name");
  if (!row.lead_id) addReason(reasons, "missing_lead_id");
  if (!value.valueUsd || value.valueUsd <= 0) addReason(reasons, "missing_value");
  if (!row.client_slug) addReason(reasons, "missing_client_slug");
  if (row.client_slug === "direct") addReason(reasons, "client_slug_direct");
  if (row.client_slug && !row.tenant_resolved) addReason(reasons, "tenant_not_resolved");
  if (attributionStrength === "weak") addReason(reasons, "attribution_weak");
  if (!row.contractor_outcome_id && !row.opportunity_id && !row.contractor_id) addReason(reasons, "no_contractor_context");
  if (row.optimization_value_basis === "gross_sale_value" || row.true_margin_available === false) addReason(reasons, "gross_value_used_not_true_margin");

  const outcomeSignalSource = row.source_system === "partner-update-disposition" || row.source_system === "admin-sync-revenue-signals";
  const integrityMetadataPresent = row.revenue_truth_source === "contractor_outcomes"
    && row.revenue_rollup_target === "leads"
    && outcomeSignalSource
    && row.disposition_state === "sold_closed";
  if (!integrityMetadataPresent) addReason(reasons, "historical_payload_missing_integrity_metadata");

  if (platformConfigs.length === 0) {
    addReason(reasons, "no_platform_enabled");
  } else {
    for (const config of platformConfigs) platformDestinationReady(config, reasons);
  }

  const hardBlocks: ReadinessReasonCode[] = [
    "missing_event_id",
    "unknown_event_name",
    "missing_lead_id",
    "missing_value",
    "missing_client_slug",
    "destination_not_configured",
    "token_missing",
    "required_destination_id_missing",
    "tenant_not_resolved",
    "malformed_payload",
  ];
  const reasonList = Array.from(reasons);
  const status: ReadinessStatus = reasonList.some((code) => hardBlocks.includes(code))
    ? "blocked"
    : reasonList.length > 0
      ? "warning"
      : "ready";

  return {
    id: row.event_row_id,
    eventId: row.event_id,
    eventName: row.event_name,
    timestamp: row.event_timestamp,
    createdAt: row.created_at,
    leadId: row.lead_id,
    scanSessionId: row.scan_session_id,
    analysisId: row.analysis_id,
    clientSlug: row.client_slug,
    status,
    reasons: reasonList,
    valueUsd: value.valueUsd,
    finalValueCents: value.finalValueCents,
    finalValueUsd: value.finalValueUsd,
    optimizationValueUsd: value.optimizationValueUsd,
    attributionStrength,
    attributionPresence,
    payloadIntegrity: {
      payloadIsObject: Boolean(row.payload_is_object),
      revenueTruthSource: row.revenue_truth_source,
      revenueRollupTarget: row.revenue_rollup_target,
      sourceSystem: row.source_system,
      dispositionState: row.disposition_state,
      optimizationValueBasis: row.optimization_value_basis,
      trueMarginAvailable: row.true_margin_available,
      marginModelVersion: row.margin_model_version,
    },
    context: {
      contractorOutcomeId: row.contractor_outcome_id,
      opportunityId: row.opportunity_id,
      contractorId: row.contractor_id,
    },
    config: {
      tenantResolved: Boolean(row.tenant_resolved),
      activePlatformConfigCount: row.active_platform_config_count ?? 0,
      activeDestinationConfigsTotal: row.active_destination_configs_total ?? 0,
      platformConfigs,
    },
  };
}

export async function fetchRevenueDispatchReadiness(): Promise<RevenueReadinessResult> {
  const { data, error } = await supabase.rpc("admin_revenue_dispatch_readiness");
  if (error) throw error;

  const rows = ((data ?? []) as RpcReadinessRow[]).map(mapReadinessRow);
  const activeDestinationConfigs = rows[0]?.config.activeDestinationConfigsTotal ?? 0;
  return {
    rows,
    kpis: {
      totalRevenueEvents: rows.length,
      ready: rows.filter((row) => row.status === "ready").length,
      warning: rows.filter((row) => row.status === "warning").length,
      blocked: rows.filter((row) => row.status === "blocked").length,
      activeDestinationConfigs,
      missingClientSlug: rows.filter((row) => !row.clientSlug).length,
      weakAttribution: rows.filter((row) => row.attributionStrength === "weak").length,
      grossValueProxyCount: rows.filter((row) => row.reasons.includes("gross_value_used_not_true_margin")).length,
    },
  };
}
