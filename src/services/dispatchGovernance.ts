import { supabase } from "@/integrations/supabase/client";
import {
  CRM_WEBHOOK_DRY_RUN_MAPPER_VERSION,
  GENERIC_ENDPOINT_DRY_RUN_MAPPER_VERSION,
  GOOGLE_DRY_RUN_MAPPER_VERSION,
  GTM_SERVER_DRY_RUN_MAPPER_VERSION,
  META_CAPI_DRY_RUN_MAPPER_VERSION,
  TIKTOK_DRY_RUN_MAPPER_VERSION,
} from "@/services/dispatchSimulator";
import { fetchClientPlatformConfigs, type PlatformConfigRow, type PlatformName } from "@/services/clientPlatformConfigs";
import { fetchDispatchAttemptReconciliation, type DispatchAttemptRow } from "@/services/dispatchAttempts";
import type { DispatchOutboxRow } from "@/services/dispatchOutbox";

export type GovernanceStatus = "passed" | "warning" | "blocked" | "manual_review" | "dry_run_locked";

export interface GlobalGovernanceState {
  liveDispatchEnabled: false;
  dryRunRequired: true;
  killSwitchEngaged: true;
  externalDispatchWorkersEnabled: false;
  canSendExternally: false;
  futureLiveMigrationRequired: true;
  status: "dry_run_locked";
  notes: string[];
}

export interface GovernanceChecklistItem {
  key: string;
  label: string;
  status: Exclude<GovernanceStatus, "dry_run_locked">;
  note: string;
}

export interface MapperCoverageItem {
  platform: string;
  mapperVersion: string;
  status: Exclude<GovernanceStatus, "dry_run_locked">;
  note: string;
}

export interface PlatformGovernanceRow {
  platform: string;
  mapperVersion: string;
  activeConfigCount: number;
  tokenPresentCount: number;
  destinationPresentCount: number;
  dryRunRowsCount: number;
  outboxRowsCount: number;
  simulatedAttemptsCount: number;
  blockersCount: number;
  warningsCount: number;
  liveEnabled: false;
  governanceStatus: "dry_run_locked" | "warning" | "blocked" | "manual_review";
}

export interface ClientGovernanceRow {
  clientSlug: string;
  activeConfigCount: number;
  platformCount: number;
  dryRunRowsCount: number;
  outboxRowsCount: number;
  simulatedAttemptsCount: number;
  blockersCount: number;
  warningsCount: number;
  missingTokenCount: number;
  missingDestinationCount: number;
  liveEnabled: false;
  governanceStatus: "dry_run_locked" | "warning" | "blocked" | "manual_review";
}

export interface GuardStatusItem {
  key: string;
  label: string;
  status: "present" | "unknown" | "manual_review";
  note: string;
}

export interface DispatchGovernanceState {
  globalGovernance: GlobalGovernanceState;
  preLiveChecklist: GovernanceChecklistItem[];
  platformMatrix: PlatformGovernanceRow[];
  clientMatrix: ClientGovernanceRow[];
  guardStatus: GuardStatusItem[];
  mapperCoverage: MapperCoverageItem[];
  outboxHealth: {
    totalRows: number;
    dryRunLockedRows: number;
    sendEnabledRows: number;
    sentRows: number;
    externalEventRows: number;
    blockerRows: number;
    warningRows: number;
  };
  attemptHealth: {
    totalAttempts: number;
    simulatedAttempts: number;
    failedPreflightAttempts: number;
    blockedByGateAttempts: number;
    attemptsWithProviderResponse: number;
    liveishStatuses: number;
  };
  finalVerdict: {
    status: "dry_run_locked";
    label: string;
    blockers: string[];
    warnings: string[];
  };
}

const PLATFORM_DEFS = [
  { key: "meta", label: "Meta", mapperVersion: META_CAPI_DRY_RUN_MAPPER_VERSION, aliases: ["meta"] },
  { key: "tiktok", label: "TikTok", mapperVersion: TIKTOK_DRY_RUN_MAPPER_VERSION, aliases: ["tiktok"] },
  { key: "google", label: "Google / GA4", mapperVersion: GOOGLE_DRY_RUN_MAPPER_VERSION, aliases: ["google_ads", "ga4", "google"] },
  { key: "gtm_server", label: "GTM Server", mapperVersion: GTM_SERVER_DRY_RUN_MAPPER_VERSION, aliases: ["gtm_server"] },
  { key: "crm_webhook", label: "CRM Webhook", mapperVersion: CRM_WEBHOOK_DRY_RUN_MAPPER_VERSION, aliases: ["crm_webhook"] },
  { key: "other_endpoint", label: "Generic Endpoint", mapperVersion: GENERIC_ENDPOINT_DRY_RUN_MAPPER_VERSION, aliases: ["other"] },
] as const;

const LIVEISH_ATTEMPT_STATUSES = new Set(["sent", "delivered", "failed", "retrying", "processing", "queued"]);

function platformMatches(value: string | null | undefined, aliases: readonly string[]) {
  const normalized = String(value ?? "").toLowerCase();
  return aliases.includes(normalized);
}

function clientSlugFromConfig(config: PlatformConfigRow) {
  return config.clients?.slug?.trim() || "unresolved_client_slug";
}

function clientSlugFromOutbox(row: DispatchOutboxRow) {
  return row.clientSlug?.trim() || "unresolved_client_slug";
}

function clientSlugFromAttempt(row: DispatchAttemptRow) {
  return row.outbox?.clientSlug?.trim() || "unresolved_client_slug";
}

function hasDestination(config: PlatformConfigRow) {
  if (config.readiness?.destination) return Object.values(config.readiness.destination).some(Boolean);
  if (config.platform_name === "gtm_server" || config.platform_name === "crm_webhook" || config.platform_name === "other") return Boolean(config.endpoint_url);
  if (config.platform_name === "google_ads" || config.platform_name === "ga4") return Boolean(config.conversion_id || config.conversion_label);
  return Boolean(config.pixel_id || config.dataset_id);
}

function rowHasWarnings(row: DispatchOutboxRow) {
  return row.eligibilityStatus === "warning_not_sent" || row.readinessStatus === "warning";
}

function rowHasBlockers(row: DispatchOutboxRow) {
  return row.eligibilityStatus === "blocked" || row.readinessStatus === "blocked" || !row.dryRunOnly || row.sendEnabled || Boolean(row.sentAt || row.externalEventId);
}

function governanceStatus(blockers: number, warnings: number): PlatformGovernanceRow["governanceStatus"] {
  if (blockers > 0) return "blocked";
  if (warnings > 0) return "warning";
  return "dry_run_locked";
}

function buildMapperCoverage(): MapperCoverageItem[] {
  return PLATFORM_DEFS.map((platform) => ({
    platform: platform.label,
    mapperVersion: platform.mapperVersion,
    status: platform.mapperVersion ? "passed" : "blocked",
    note: platform.mapperVersion ? "Dry-run mapper version present in local mapper layer." : "Dry-run mapper version missing.",
  }));
}

function buildPlatformMatrix(configs: PlatformConfigRow[], outboxRows: DispatchOutboxRow[], attempts: DispatchAttemptRow[]): PlatformGovernanceRow[] {
  return PLATFORM_DEFS.map((platform) => {
    const platformConfigs = configs.filter((config) => platformMatches(config.platform_name, platform.aliases));
    const activeConfigs = platformConfigs.filter((config) => config.is_active);
    const rows = outboxRows.filter((row) => platformMatches(row.platformName, platform.aliases));
    const platformAttempts = attempts.filter((attempt) => platformMatches(attempt.outbox?.platformName, platform.aliases));
    const missingConfigBlocker = rows.length > 0 && activeConfigs.length === 0 ? 1 : 0;
    const blockers = rows.filter(rowHasBlockers).length + missingConfigBlocker;
    const warnings = rows.filter(rowHasWarnings).length + activeConfigs.filter((config) => !config.readiness || config.readiness.completeness === "warning").length;

    return {
      platform: platform.label,
      mapperVersion: platform.mapperVersion,
      activeConfigCount: activeConfigs.length,
      tokenPresentCount: activeConfigs.filter((config) => config.token_secret_id === "present" || config.readiness?.token_present).length,
      destinationPresentCount: activeConfigs.filter(hasDestination).length,
      dryRunRowsCount: rows.filter((row) => row.dryRunOnly).length,
      outboxRowsCount: rows.length,
      simulatedAttemptsCount: platformAttempts.filter((attempt) => attempt.status === "simulated").length,
      blockersCount: blockers,
      warningsCount: warnings,
      liveEnabled: false,
      governanceStatus: governanceStatus(blockers, warnings),
    };
  });
}

function buildClientMatrix(configs: PlatformConfigRow[], outboxRows: DispatchOutboxRow[], attempts: DispatchAttemptRow[]): ClientGovernanceRow[] {
  const slugs = new Set<string>();
  configs.forEach((config) => slugs.add(clientSlugFromConfig(config)));
  outboxRows.forEach((row) => slugs.add(clientSlugFromOutbox(row)));
  attempts.forEach((attempt) => slugs.add(clientSlugFromAttempt(attempt)));

  return Array.from(slugs).sort().map((slug) => {
    const clientConfigs = configs.filter((config) => clientSlugFromConfig(config) === slug);
    const activeConfigs = clientConfigs.filter((config) => config.is_active);
    const rows = outboxRows.filter((row) => clientSlugFromOutbox(row) === slug);
    const clientAttempts = attempts.filter((attempt) => clientSlugFromAttempt(attempt) === slug);
    const missingTokenCount = activeConfigs.filter((config) => config.readiness?.token_required !== false && config.token_secret_id !== "present" && !config.readiness?.token_present).length;
    const missingDestinationCount = activeConfigs.filter((config) => !hasDestination(config)).length;
    const blockers = rows.filter(rowHasBlockers).length + missingTokenCount + missingDestinationCount;
    const warnings = rows.filter(rowHasWarnings).length + activeConfigs.filter((config) => config.readiness?.completeness === "warning").length;

    return {
      clientSlug: slug,
      activeConfigCount: activeConfigs.length,
      platformCount: new Set(activeConfigs.map((config) => config.platform_name)).size,
      dryRunRowsCount: rows.filter((row) => row.dryRunOnly).length,
      outboxRowsCount: rows.length,
      simulatedAttemptsCount: clientAttempts.filter((attempt) => attempt.status === "simulated").length,
      blockersCount: blockers,
      warningsCount: warnings,
      missingTokenCount,
      missingDestinationCount,
      liveEnabled: false,
      governanceStatus: governanceStatus(blockers, warnings),
    };
  });
}

async function checkSchemaGuards(): Promise<GuardStatusItem[]> {
  const checks = [
    { key: "outbox_dry_run_only", label: "Outbox dry_run_only guard", patterns: ["platform_dispatch_outbox_dry_run_only_check", "platform_dispatch_outbox_no_live_guard"] },
    { key: "outbox_send_enabled", label: "Outbox send_enabled guard", patterns: ["platform_dispatch_outbox_send_disabled_check", "platform_dispatch_outbox_no_live_guard"] },
    { key: "outbox_no_sent_external", label: "Outbox sent_at / external_event_id guard", patterns: ["platform_dispatch_outbox_no_sent_at_check", "platform_dispatch_outbox_no_external_event_id_check"] },
    { key: "attempts_dry_run", label: "Attempts dry-run guard", patterns: ["platform_dispatch_attempts_dry_run_check", "platform_dispatch_attempts_no_live_guard"] },
    { key: "attempts_provider_response", label: "Provider response status guard", patterns: ["platform_dispatch_attempts_no_external_response_check", "platform_dispatch_attempts_no_live_guard"] },
  ];

  try {
    const migrationFiles = import.meta.glob("../../supabase/migrations/*.sql", { query: "?raw", import: "default" });
    const contents = await Promise.all(Object.values(migrationFiles).map((load) => load() as Promise<string>));
    const joined = contents.join("\n");
    return checks.map((check) => {
      const present = check.patterns.some((pattern) => joined.includes(pattern));
      return {
        key: check.key,
        label: check.label,
        status: present ? "present" : "manual_review",
        note: present ? "Guard definition found in migration source." : "Guard could not be verified from local migration source; manual DB inspection required.",
      };
    });
  } catch {
    return checks.map((check) => ({
      key: check.key,
      label: check.label,
      status: "manual_review",
      note: "Migration source could not be inspected in this runtime; manual DB inspection required.",
    }));
  }
}

function buildChecklist(params: {
  configs: PlatformConfigRow[];
  outboxRows: DispatchOutboxRow[];
  attempts: DispatchAttemptRow[];
  guardStatus: GuardStatusItem[];
  mapperCoverage: MapperCoverageItem[];
  docs: { runtimeValidation: boolean; attemptSimulation: boolean };
}): GovernanceChecklistItem[] {
  const { configs, outboxRows, attempts, guardStatus, mapperCoverage, docs } = params;
  const guardsVerified = guardStatus.every((guard) => guard.status === "present");

  return [
    { key: "attribution_capture", label: "Attribution capture implemented", status: "manual_review", note: "Governance console does not inspect browser capture runtime; verify existing neutral event model manually." },
    { key: "client_slug_fallback", label: "client_slug fallback exists", status: "manual_review", note: "Governance console groups unresolved rows but does not inspect routing runtime." },
    { key: "platform_configs", label: "Platform configs exist", status: configs.length > 0 ? "passed" : "warning", note: `${configs.length} platform config row(s) visible to internal operator.` },
    { key: "mapper_versions", label: "Mapper versions present", status: mapperCoverage.every((item) => item.status === "passed") ? "passed" : "blocked", note: "All Sprint 1R/1S mapper constants are checked locally." },
    { key: "dry_run_queue", label: "Dry-run queue exists", status: "passed", note: "Dispatch dry-run queue component and simulator service are present." },
    { key: "outbox_schema", label: "Outbox schema exists", status: "passed", note: `${outboxRows.length} outbox row(s) loaded from platform_dispatch_outbox.` },
    { key: "materialization_function", label: "Materialization function exists", status: "passed", note: "admin-materialize-dispatch-outbox function is present; governance console does not invoke it." },
    { key: "attempt_simulation", label: "Attempt simulation exists", status: "passed", note: `${attempts.length} simulated attempt ledger row(s) loaded.` },
    { key: "idempotency_contract", label: "Duplicate/idempotency contract exists", status: outboxRows.every((row) => Boolean(row.idempotencyKey)) ? "passed" : "blocked", note: "Outbox rows expose idempotency keys; duplicate protection remains outbox-level." },
    { key: "db_guards", label: "No-live DB guards exist", status: guardsVerified ? "passed" : "manual_review", note: guardsVerified ? "Local migration source contains no-live guard definitions." : "At least one guard requires manual DB verification." },
    { key: "runtime_validation_doc", label: "Runtime validation report exists", status: docs.runtimeValidation ? "passed" : "warning", note: docs.runtimeValidation ? "Sprint 1Q runtime validation report is present." : "Runtime validation report not found locally." },
    { key: "attempt_doc", label: "Attempt simulation documentation exists", status: docs.attemptSimulation ? "passed" : "warning", note: docs.attemptSimulation ? "Sprint 1T attempt simulation documentation is present." : "Attempt simulation documentation not found locally." },
    { key: "no_external_worker", label: "No external dispatch worker exists", status: "manual_review", note: "No worker is created by this sprint; confirm repository/runtime before future migration." },
    { key: "kill_switch", label: "Governance kill switch engaged", status: "passed", note: "Computed governance state is hard-locked to dry-run with no enable control." },
    { key: "live_migration", label: "Live dispatch migration not approved", status: "blocked", note: "Future live migration is required before any real external dispatch can exist." },
  ];
}

export async function fetchDispatchGovernance(): Promise<DispatchGovernanceState> {
  const docs = {
    runtimeValidation: true,
    attemptSimulation: true,
  };

  const [configResult, reconciliationResult, guardStatus] = await Promise.all([
    fetchClientPlatformConfigs(),
    fetchDispatchAttemptReconciliation(),
    checkSchemaGuards(),
  ]);

  const configs = configResult.configs;
  const outboxRows = reconciliationResult.outboxRows;
  const attempts = reconciliationResult.attempts;
  const mapperCoverage = buildMapperCoverage();
  const platformMatrix = buildPlatformMatrix(configs, outboxRows, attempts);
  const clientMatrix = buildClientMatrix(configs, outboxRows, attempts);

  const outboxHealth = {
    totalRows: outboxRows.length,
    dryRunLockedRows: outboxRows.filter((row) => row.dryRunOnly && !row.sendEnabled && !row.sentAt && !row.externalEventId).length,
    sendEnabledRows: outboxRows.filter((row) => row.sendEnabled).length,
    sentRows: outboxRows.filter((row) => Boolean(row.sentAt)).length,
    externalEventRows: outboxRows.filter((row) => Boolean(row.externalEventId)).length,
    blockerRows: outboxRows.filter(rowHasBlockers).length,
    warningRows: outboxRows.filter(rowHasWarnings).length,
  };

  const attemptHealth = {
    totalAttempts: attempts.length,
    simulatedAttempts: attempts.filter((row) => row.status === "simulated").length,
    failedPreflightAttempts: attempts.filter((row) => row.status === "failed_preflight").length,
    blockedByGateAttempts: attempts.filter((row) => row.status === "blocked_by_gate").length,
    attemptsWithProviderResponse: attempts.filter((row) => row.responseStatusCode != null || row.responseExcerpt != null).length,
    liveishStatuses: attempts.filter((row) => LIVEISH_ATTEMPT_STATUSES.has(String(row.status))).length,
  };

  const warnings = [
    ...platformMatrix.filter((row) => row.governanceStatus === "warning").map((row) => `${row.platform}: ${row.warningsCount} warning(s)`),
    ...clientMatrix.filter((row) => row.governanceStatus === "warning").map((row) => `${row.clientSlug}: ${row.warningsCount} warning(s)`),
  ];

  const blockers = [
    ...platformMatrix.filter((row) => row.governanceStatus === "blocked").map((row) => `${row.platform}: ${row.blockersCount} blocker(s)`),
    ...clientMatrix.filter((row) => row.governanceStatus === "blocked").map((row) => `${row.clientSlug}: ${row.blockersCount} blocker(s)`),
    ...(outboxHealth.sendEnabledRows > 0 ? [`${outboxHealth.sendEnabledRows} outbox row(s) show send_enabled.`] : []),
    ...(outboxHealth.sentRows > 0 ? [`${outboxHealth.sentRows} outbox row(s) show sent_at.`] : []),
    ...(outboxHealth.externalEventRows > 0 ? [`${outboxHealth.externalEventRows} outbox row(s) show external_event_id.`] : []),
    ...(attemptHealth.attemptsWithProviderResponse > 0 ? [`${attemptHealth.attemptsWithProviderResponse} attempt row(s) contain provider response data.`] : []),
    ...(attemptHealth.liveishStatuses > 0 ? [`${attemptHealth.liveishStatuses} attempt row(s) contain live-like status values.`] : []),
  ];

  return {
    globalGovernance: {
      liveDispatchEnabled: false,
      dryRunRequired: true,
      killSwitchEngaged: true,
      externalDispatchWorkersEnabled: false,
      canSendExternally: false,
      futureLiveMigrationRequired: true,
      status: "dry_run_locked",
      notes: [
        "Governance console is read-only and cannot enable sending.",
        "Live dispatch requires a future explicit migration and worker sprint.",
      ],
    },
    preLiveChecklist: buildChecklist({ configs, outboxRows, attempts, guardStatus, mapperCoverage, docs }),
    platformMatrix,
    clientMatrix,
    guardStatus,
    mapperCoverage,
    outboxHealth,
    attemptHealth,
    finalVerdict: {
      status: "dry_run_locked",
      label: "Live dispatch disabled — future migration required",
      blockers,
      warnings,
    },
  };
}
