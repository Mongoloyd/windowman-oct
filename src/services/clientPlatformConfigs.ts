import { supabase } from "@/integrations/supabase/client";
import { peekDevSecret } from "@/lib/devSecret";

export type PlatformName = "meta" | "tiktok" | "google_ads" | "ga4" | "gtm_server" | "crm_webhook" | "internal" | "other";
export type ConfigState = "draft" | "incomplete" | "pending_validation" | "validated" | "active" | "paused" | "retired" | "invalid";
export type ValidationStatus = "not_tested" | "validation_passed" | "validation_failed" | "validation_stale" | "requires_revalidation";
export type CompletenessStatus = "complete" | "warning" | "incomplete";

export type ConfigReasonCode =
  | "missing_token"
  | "token_present"
  | "token_not_validated"
  | "token_validation_stale"
  | "token_validation_failed"
  | "missing_pixel_id"
  | "missing_dataset_id"
  | "missing_conversion_id"
  | "missing_conversion_label"
  | "missing_endpoint_url"
  | "missing_client"
  | "missing_client_slug"
  | "inactive_config"
  | "paused_config"
  | "retired_config"
  | "unknown_platform"
  | "validation_required"
  | "validation_passed"
  | "validation_failed"
  | "config_complete"
  | "config_incomplete"
  | "config_warning";

export interface PlatformClient {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface PlatformConfigRow {
  id: string;
  client_id: string;
  platform_name: PlatformName;
  pixel_id: string | null;
  dataset_id: string | null;
  conversion_id: string | null;
  conversion_label: string | null;
  endpoint_url: string | null;
  token_secret_id: "present" | null;
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
  clients: PlatformClient | null;
  readiness?: {
    platform: PlatformName;
    completeness: CompletenessStatus;
    reasons: ConfigReasonCode[];
    required: Record<string, boolean>;
    destination: Record<string, boolean>;
    token_required: boolean;
    token_present: boolean;
    endpoint_valid: boolean;
    validation_ready: boolean;
  };
}

export interface PlatformConfigPayload {
  id?: string | null;
  client_id: string;
  platform_name: PlatformName;
  pixel_id?: string | null;
  dataset_id?: string | null;
  conversion_id?: string | null;
  conversion_label?: string | null;
  endpoint_url?: string | null;
  config_state: ConfigState;
  is_active: boolean;
  token_present?: boolean;
}

export interface PlatformConfigListResult {
  clients: PlatformClient[];
  configs: PlatformConfigRow[];
}

async function invokePlatformConfig(action: string, payload: Record<string, unknown> = {}) {
  const devSecret = peekDevSecret();
  if (devSecret) {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const resp = await fetch(`${supabaseUrl}/functions/v1/admin-client-platform-config`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-dev-secret": devSecret },
      body: JSON.stringify({ action, payload }),
    });
    const body = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(body.error || `Platform config request failed (${resp.status})`);
    return body.data;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) throw new Error("User is not authenticated or session has expired.");

  const { data, error } = await supabase.functions.invoke("admin-client-platform-config", {
    body: { action, payload },
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (error) throw new Error(error.message || "Failed to contact platform config service");
  return data.data;
}

export async function fetchClientPlatformConfigs(): Promise<PlatformConfigListResult> {
  return invokePlatformConfig("list");
}

export async function saveClientPlatformConfig(payload: PlatformConfigPayload): Promise<{ id: string }> {
  return invokePlatformConfig("upsert_metadata", payload as unknown as Record<string, unknown>);
}

export async function setClientPlatformToken(id: string, token: string): Promise<{ token_present: boolean; token_last_rotated_at: string; token_fingerprint_prefix: string }> {
  return invokePlatformConfig("set_token", { id, token });
}

export async function runClientPlatformValidation(id: string): Promise<{ validation_status: ValidationStatus; config_state: ConfigState; validation_summary: Record<string, unknown> }> {
  return invokePlatformConfig("run_validation", { id });
}

export async function setClientPlatformState(id: string, config_state: ConfigState): Promise<{ id: string; config_state: ConfigState }> {
  return invokePlatformConfig("set_state", { id, config_state });
}

export function maskConfigId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}
