import { errorResponse, successResponse, validateAdminRequestWithRole, corsHeaders } from "../_shared/adminAuth.ts";
import { evaluatePlatformReadiness, normalizePlatformName } from "../_shared/platformReadinessMatrix.ts";

type ConfigState = "draft" | "incomplete" | "pending_validation" | "validated" | "active" | "paused" | "retired" | "invalid";
type ValidationStatus = "not_tested" | "validation_passed" | "validation_failed" | "validation_stale" | "requires_revalidation";
type CompletenessStatus = "complete" | "warning" | "incomplete";

type Action = "list" | "upsert_metadata" | "set_token" | "run_validation" | "set_state";

const PLATFORM_VALUES = new Set(["meta", "tiktok", "google_ads", "ga4", "gtm_server", "crm_webhook", "internal", "other"]);
const CONFIG_STATES = new Set(["draft", "incomplete", "pending_validation", "validated", "active", "paused", "retired", "invalid"]);
const VALIDATION_STATUSES = new Set(["not_tested", "validation_passed", "validation_failed", "validation_stale", "requires_revalidation"]);
const HTTPS_RE = /^https:\/\//i;

interface ClientRow {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

interface ConfigRow {
  id: string;
  client_id: string;
  platform_name: string;
  pixel_id: string | null;
  dataset_id: string | null;
  conversion_id: string | null;
  conversion_label: string | null;
  endpoint_url: string | null;
  token_secret_id: string | null;
  is_active: boolean;
  config_state: ConfigState;
  validation_status: ValidationStatus;
  validated_at: string | null;
  validation_summary: Record<string, unknown> | null;
  last_validation_error: string | null;
  token_last_rotated_at: string | null;
  token_fingerprint_prefix: string | null;
  last_operator_id: string | null;
  last_operator_action_at: string | null;
  created_at: string;
  updated_at: string;
  clients?: ClientRow | null;
}

function sanitizeText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function normalizePlatform(value: unknown): string {
  return normalizePlatformName(sanitizeText(value, 40)?.toLowerCase() ?? "other");
}

function destinationSummary(row: Partial<ConfigRow>) {
  return {
    pixel_id_present: Boolean(row.pixel_id),
    dataset_id_present: Boolean(row.dataset_id),
    conversion_id_present: Boolean(row.conversion_id),
    conversion_label_present: Boolean(row.conversion_label),
    endpoint_url_present: Boolean(row.endpoint_url),
    token_present: Boolean(row.token_secret_id),
  };
}

function validateCompleteness(row: Partial<ConfigRow>, client?: ClientRow | null) {
  const platform = normalizePlatform(row.platform_name);
  const reasons: string[] = [];
  const warnings: string[] = [];
  const required: Record<string, boolean> = {};

  const tokenPresent = Boolean(row.token_secret_id);
  const active = row.is_active === true;
  const endpoint = sanitizeText(row.endpoint_url);
  const endpointValid = !endpoint || HTTPS_RE.test(endpoint);

  required.client_exists = Boolean(client?.id ?? row.client_id);
  required.client_slug_present = Boolean(client?.slug);
  required.client_active = client?.is_active !== false;
  required.active_config = active;
  required.endpoint_shape_valid = endpointValid;

  if (!required.client_exists) reasons.push("missing_client");
  if (!required.client_slug_present) reasons.push("missing_client_slug");
  if (!required.client_active) warnings.push("inactive_client");
  if (!active) reasons.push("inactive_config");
  if (!endpointValid) reasons.push("missing_endpoint_url");

  const needsToken = platform === "meta" || platform === "tiktok" || platform === "google_ads" || platform === "ga4";
  const matrix = evaluatePlatformReadiness({
    platform_name: platform,
    is_active: active,
    token_present: tokenPresent,
    pixel_id_present: Boolean(row.pixel_id),
    dataset_id_present: Boolean(row.dataset_id),
    conversion_id_present: Boolean(row.conversion_id),
    conversion_label_present: Boolean(row.conversion_label),
    endpoint_url_present: Boolean(endpoint),
  });
  required.token_present = needsToken ? tokenPresent : true;
  required.destination_id_present = matrix.destinationReady;
  if (needsToken && !tokenPresent) reasons.push("missing_token");
  if (!needsToken && matrix.warningFields.includes("token_present")) warnings.push("token_not_validated");
  if (!matrix.destinationReady) {
    if (matrix.missingFields.includes("pixel_id_present")) reasons.push("missing_pixel_id");
    if (matrix.missingFields.includes("dataset_id_present")) reasons.push("missing_dataset_id");
    if (matrix.missingFields.includes("conversion_id_present")) reasons.push("missing_conversion_id");
    if (matrix.missingFields.includes("conversion_label_present")) reasons.push("missing_conversion_label");
    if (matrix.missingFields.includes("endpoint_url_present")) reasons.push("missing_endpoint_url");
  }

  if (row.config_state === "paused") reasons.push("paused_config");
  if (row.config_state === "retired") reasons.push("retired_config");
  if (row.validation_status === "validation_failed") reasons.push("validation_failed");
  if (row.validation_status === "requires_revalidation") warnings.push("validation_required");
  if (row.validation_status === "validation_stale") warnings.push("token_validation_stale");
  if (row.validation_status === "not_tested") warnings.push("validation_required");

  const completeness: CompletenessStatus = reasons.length > 0 ? "incomplete" : warnings.length > 0 ? "warning" : "complete";
  return {
    platform,
    completeness,
    reasons: [...new Set([...reasons, ...warnings])],
    required,
    destination: destinationSummary(row),
    token_required: needsToken,
    token_present: tokenPresent,
    endpoint_valid: endpointValid,
    matrix_version: "phase-3h-platform-readiness-v1",
    exact_platform_match: matrix.exactPlatformMatch,
    destination_ready: matrix.destinationReady,
    validation_ready: reasons.length === 0,
  };
}

async function sha256Prefix(token: string): Promise<string> {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `sha256:${hex.slice(0, 12)}`;
}

function rowForClient(data: unknown): ClientRow | null {
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    is_active: row.is_active !== false,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return errorResponse(405, "method_not_allowed", "Use POST");

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as Action;
    const payload = body.payload ?? {};

    if (!["list", "upsert_metadata", "set_token", "run_validation", "set_state"].includes(action)) {
      return errorResponse(400, "invalid_action", "Unknown platform config action");
    }

    const validation = await validateAdminRequestWithRole(req, ["super_admin", "operator", "viewer"]);
    if (!validation.ok) return validation.response;

    const { supabaseAdmin, userId, role } = validation;
    const canWrite = role === "super_admin" || role === "operator";
    const now = new Date().toISOString();

    if (action === "list") {
      const [clientsResult, configsResult] = await Promise.all([
        supabaseAdmin.from("clients").select("id, name, slug, is_active").order("name", { ascending: true }),
        supabaseAdmin
          .from("client_platform_configs")
          .select("id, client_id, platform_name, pixel_id, dataset_id, conversion_id, conversion_label, endpoint_url, token_secret_id, is_active, config_state, validation_status, validated_at, validation_summary, last_validation_error, token_last_rotated_at, token_fingerprint_prefix, last_operator_id, last_operator_action_at, created_at, updated_at, clients(id, name, slug, is_active)")
          .order("updated_at", { ascending: false }),
      ]);
      if (clientsResult.error) throw clientsResult.error;
      if (configsResult.error) throw configsResult.error;

      const rows = ((configsResult.data ?? []) as unknown as ConfigRow[]).map((row) => {
        const client = rowForClient(row.clients);
        const readiness = validateCompleteness(row, client);
        return { ...row, clients: client, token_secret_id: row.token_secret_id ? "present" : null, readiness };
      });

      return successResponse({ data: { clients: clientsResult.data ?? [], configs: rows } });
    }

    if (!canWrite) return errorResponse(403, "forbidden", "Viewer role cannot modify platform configs");

    if (action === "upsert_metadata") {
      const id = sanitizeText(payload.id, 80);
      const clientId = sanitizeText(payload.client_id, 80);
      const platform = normalizePlatform(payload.platform_name);
      const state = (sanitizeText(payload.config_state, 40) ?? "draft") as ConfigState;
      if (!CONFIG_STATES.has(state)) return errorResponse(400, "invalid_state", "Invalid config_state");
      if (!id && !clientId) return errorResponse(400, "missing_client", "client_id is required");

      const metadata = {
        client_id: clientId,
        platform_name: platform,
        pixel_id: sanitizeText(payload.pixel_id, 160),
        dataset_id: sanitizeText(payload.dataset_id, 160),
        conversion_id: sanitizeText(payload.conversion_id, 160),
        conversion_label: sanitizeText(payload.conversion_label, 160),
        endpoint_url: sanitizeText(payload.endpoint_url, 500),
        config_state: state,
        is_active: Boolean(payload.is_active),
        validation_status: "requires_revalidation" as ValidationStatus,
        last_operator_id: userId,
        last_operator_action_at: now,
      };

      if (metadata.endpoint_url && !HTTPS_RE.test(metadata.endpoint_url)) {
        return errorResponse(400, "invalid_endpoint_url", "Endpoint URL must use HTTPS");
      }

      const clientResult = await supabaseAdmin.from("clients").select("id, name, slug, is_active").eq("id", metadata.client_id).maybeSingle();
      if (clientResult.error) throw clientResult.error;
      if (!clientResult.data) return errorResponse(400, "missing_client", "Client does not exist");

      if (metadata.is_active || metadata.config_state === "active") {
        const simulated = validateCompleteness({ ...metadata, client_id: metadata.client_id ?? undefined, token_secret_id: payload.token_present ? "present" : null }, rowForClient(clientResult.data));
        if (!simulated.validation_ready) {
          return errorResponse(400, "activation_blocked", "Config is incomplete and cannot be activated", { reasons: simulated.reasons });
        }
      }

      const query = id
        ? supabaseAdmin.from("client_platform_configs").update(metadata).eq("id", id).select("id").single()
        : supabaseAdmin.from("client_platform_configs").insert(metadata).select("id").single();
      const { data, error } = await query;
      if (error) throw error;
      return successResponse({ data });
    }

    if (action === "set_token") {
      const configId = sanitizeText(payload.id, 80);
      const token = sanitizeText(payload.token, 10_000);
      if (!configId) return errorResponse(400, "missing_config", "Config id is required");
      if (!token || token.length < 20) return errorResponse(400, "invalid_token", "Token must be at least 20 characters");

      const { data: config, error: configError } = await supabaseAdmin
        .from("client_platform_configs")
        .select("id, client_id, platform_name")
        .eq("id", configId)
        .single();
      if (configError) throw configError;

      const [{ data: secretId, error: vaultError }, fingerprint] = await Promise.all([
        supabaseAdmin.rpc("vault_upsert_client_platform_token", {
          p_client_id: config.client_id,
          p_platform_name: config.platform_name,
          p_token: token,
        }),
        sha256Prefix(token),
      ]);
      if (vaultError) throw vaultError;
      if (!secretId) return errorResponse(500, "vault_secret_missing", "Vault did not return a secret reference");

      const { error: updateError } = await supabaseAdmin
        .from("client_platform_configs")
        .update({
          token_secret_id: secretId,
          token_last_rotated_at: now,
          token_fingerprint_prefix: fingerprint,
          validation_status: "requires_revalidation",
          last_operator_id: userId,
          last_operator_action_at: now,
        })
        .eq("id", configId);
      if (updateError) throw updateError;

      return successResponse({ data: { token_present: true, token_last_rotated_at: now, token_fingerprint_prefix: fingerprint } });
    }

    if (action === "run_validation") {
      const configId = sanitizeText(payload.id, 80);
      if (!configId) return errorResponse(400, "missing_config", "Config id is required");
      const { data: config, error } = await supabaseAdmin
        .from("client_platform_configs")
        .select("*, clients(id, name, slug, is_active)")
        .eq("id", configId)
        .single();
      if (error) throw error;
      const client = rowForClient((config as ConfigRow).clients);
      const readiness = validateCompleteness(config as ConfigRow, client);
      const passed = readiness.validation_ready;
      const status: ValidationStatus = passed ? "validation_passed" : "validation_failed";
      const nextState: ConfigState = passed ? "validated" : "invalid";
      const summary = {
        checked_at: now,
        local_only: true,
        external_api_called: false,
        dispatch_sent: false,
        platform: readiness.platform,
        completeness: readiness.completeness,
        required: readiness.required,
        destination: readiness.destination,
        token_required: readiness.token_required,
        token_present: readiness.token_present,
        endpoint_valid: readiness.endpoint_valid,
        reason_codes: readiness.reasons,
      };

      const { error: updateError } = await supabaseAdmin
        .from("client_platform_configs")
        .update({
          validation_status: status,
          validated_at: passed ? now : null,
          validation_summary: summary,
          last_validation_error: passed ? null : readiness.reasons.join(", "),
          config_state: nextState,
          last_operator_id: userId,
          last_operator_action_at: now,
        })
        .eq("id", configId);
      if (updateError) throw updateError;
      return successResponse({ data: { validation_status: status, config_state: nextState, validation_summary: summary } });
    }

    if (action === "set_state") {
      const configId = sanitizeText(payload.id, 80);
      const state = sanitizeText(payload.config_state, 40) as ConfigState | null;
      if (!configId || !state || !CONFIG_STATES.has(state)) return errorResponse(400, "invalid_state", "Valid id and config_state are required");

      const { data: config, error } = await supabaseAdmin
        .from("client_platform_configs")
        .select("*, clients(id, name, slug, is_active)")
        .eq("id", configId)
        .single();
      if (error) throw error;

      const update: Record<string, unknown> = { config_state: state, last_operator_id: userId, last_operator_action_at: now };
      if (state === "active") {
        const cfg = config as ConfigRow;
        if (cfg.validation_status !== "validation_passed") {
          return errorResponse(400, "validation_required", "Config must pass local validation before activation");
        }
        const readiness = validateCompleteness({ ...cfg, is_active: true }, rowForClient(cfg.clients));
        if (!readiness.validation_ready) {
          return errorResponse(400, "activation_blocked", "Config is incomplete and cannot be activated", { reasons: readiness.reasons });
        }
        update.is_active = true;
      }
      if (state === "paused" || state === "retired" || state === "draft" || state === "incomplete") update.is_active = false;
      if (state === "pending_validation") update.validation_status = "requires_revalidation";

      const { error: updateError } = await supabaseAdmin.from("client_platform_configs").update(update).eq("id", configId);
      if (updateError) throw updateError;
      return successResponse({ data: { id: configId, config_state: state } });
    }

    return errorResponse(400, "invalid_action", "Unhandled action");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResponse(500, "platform_config_error", message);
  }
});
