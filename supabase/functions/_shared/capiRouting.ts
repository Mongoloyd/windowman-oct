/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CAPI ROUTING SHARED MODULE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Shared routing, diagnostic, and dispatch logic for Meta CAPI.
 * Used by both capi-event (live controller) and admin-data (admin tools).
 *
 * This module contains NO Deno.serve() entrypoint logic — it is safe to
 * import from multiple edge functions.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface CAPIEvent {
  event_name: "CompleteRegistration" | "ViewContent" | "Lead" | "PageView";
  event_id: string;
  event_time?: number;
  event_source_url: string;
  action_source: "website";
  client_slug?: string;
  user_data: {
    em?: string;
    ph?: string;
    fbc?: string;
    fbp?: string;
    external_id?: string;
    client_ip_address?: string;
    client_user_agent?: string;
    fn?: string;
    st?: string;
    country?: string;
  };
  custom_data?: Record<string, unknown>;
}

export type RouteDiagnosticTier = "client" | "default" | "env" | "degraded";

export interface RouteDiagnostic {
  tier: RouteDiagnosticTier;
  resolved: boolean;
  is_send_safe: boolean;
  client_slug: string | null;
  resolved_pixel_id: string | null;
  source: string | null;
  uses_default: boolean;
  uses_env_fallback: boolean;
  degraded: boolean;
  reasons: string[];
  missing_fields: string[];
}

export interface DispatchOptions {
  clientIp: string;
  userAgent: string | null;
  forceTestEventCode?: string;
}

export interface DispatchResult {
  ok: boolean;
  status: number;
  response: unknown;
  capiPayload: Record<string, unknown>;
  masked_pixel_id: string;
  mode: "live" | "test";
  test_event_code_used: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════════════════

export async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashPhone(phone: string): Promise<string> {
  const normalized = phone.replace(/\D/g, "");
  return sha256(normalized);
}

export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export async function buildHashedUserData(
  userData: CAPIEvent["user_data"],
  headers: { clientIp: string; userAgent: string | null },
): Promise<Record<string, unknown>> {
  const hashedUserData: Record<string, unknown> = {
    ...userData,
    client_ip_address: headers.clientIp,
  };

  if (userData.em) {
    const em = userData.em;
    hashedUserData.em = [isSha256Hex(em) ? em.toLowerCase() : await sha256(em)];
  }
  if (userData.ph) {
    const ph = userData.ph;
    hashedUserData.ph = [isSha256Hex(ph) ? ph.toLowerCase() : await hashPhone(ph)];
  }
  if (userData.external_id) {
    const ext = userData.external_id;
    hashedUserData.external_id = isSha256Hex(ext) ? ext.toLowerCase() : await sha256(ext);
  }

  if (!hashedUserData.client_user_agent && headers.userAgent) {
    hashedUserData.client_user_agent = headers.userAgent;
  }

  return hashedUserData;
}

export function extractClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Token Hygiene Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mask an access token for safe display in admin UI / logs / API responses.
 * Returns null for empty inputs. Never returns raw token bytes.
 */
export function redactToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const t = String(token);
  if (t.length <= 8) return "****";
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/**
 * Stable failure-class enum for token/Meta dispatch outcomes. Operators use
 * this to distinguish a token problem from a routing problem from a Meta-side
 * rejection. Never includes raw token bytes.
 */
export type MetaFailureClass =
  | "ok"
  | "token_invalid_or_revoked"   // OAuthException 190 / 102 / 463
  | "token_permission_denied"    // OAuthException 200 / 10
  | "pixel_token_mismatch"       // pixel ID does not match token's app/asset
  | "rate_limited"               // 4 / 17 / 32 / 613
  | "meta_rejected_payload"      // schema/event-data rejection (non-token)
  | "meta_server_error"          // 5xx from Meta
  | "network_error"              // local fetch failed (DNS/TLS/etc)
  | "unknown_failure";

/**
 * Classify a Meta CAPI response (or local network error) into a stable
 * failure-class enum. Reads only Meta's documented `error.code` /
 * `error.message` fields. Does NOT read or echo the access token.
 *
 * Reference: https://developers.facebook.com/docs/marketing-api/error-reference
 */
export function classifyMetaError(
  status: number,
  response: unknown,
): { class: MetaFailureClass; subcode: number | null; hint: string } {
  if (status >= 200 && status < 300) {
    return { class: "ok", subcode: null, hint: "Accepted by Meta." };
  }

  const err = (response as { error?: { code?: number; error_subcode?: number; message?: string; type?: string } })?.error;
  const code = typeof err?.code === "number" ? err.code : null;
  const subcode = typeof err?.error_subcode === "number" ? err.error_subcode : null;
  const message = typeof err?.message === "string" ? err.message.toLowerCase() : "";

  // Token-revocation / invalidation family
  if (code === 190 || code === 102 || code === 463 || /access token|session has expired|token is invalid/.test(message)) {
    return {
      class: "token_invalid_or_revoked",
      subcode,
      hint: "Rotate the token via create_meta_client_config and re-run smoke_send_meta_event.",
    };
  }

  // Permission-scope problems (token alive but lacks ads_management / capi)
  if (code === 200 || code === 10) {
    return {
      class: "token_permission_denied",
      subcode,
      hint: "Token lacks required scopes. Generate a system-user token with the correct asset permissions.",
    };
  }

  // Pixel/asset mismatch — token doesn't own this pixel
  if (/pixel|dataset/i.test(message) && /(permission|access|not\s+(allowed|authorized))/i.test(message)) {
    return {
      class: "pixel_token_mismatch",
      subcode,
      hint: "The access token does not own this pixel_id. Verify the pixel belongs to the token's Business Manager asset group.",
    };
  }

  if (code === 4 || code === 17 || code === 32 || code === 613) {
    return { class: "rate_limited", subcode, hint: "Back off and retry; investigate volume." };
  }

  if (status >= 500) {
    return { class: "meta_server_error", subcode, hint: "Transient Meta-side issue; safe to retry." };
  }

  if (status >= 400) {
    return {
      class: "meta_rejected_payload",
      subcode,
      hint: "Payload rejected by Meta (not a token issue). Check event_data / user_data schema.",
    };
  }

  return { class: "unknown_failure", subcode, hint: "Unclassified failure — inspect raw response." };
}

/**
 * Lightweight presence check used by the admin token-health diagnostic.
 * Returns booleans only — never values. Safe to expose to operator/viewer roles.
 */
export interface TokenPresence {
  pixel_id_present: boolean;
  access_token_present: boolean;
  test_event_code_present: boolean;
  pixel_id_masked: string | null;
  access_token_masked: string | null;
}

export function summarizeTokenPresence(row: {
  pixel_id?: string | null;
  access_token?: string | null;
  test_event_code?: string | null;
} | null | undefined): TokenPresence {
  const pixel = row?.pixel_id ?? null;
  const tok = row?.access_token ?? null;
  return {
    pixel_id_present: !!pixel,
    access_token_present: !!tok,
    test_event_code_present: !!row?.test_event_code,
    pixel_id_masked: pixel ? `…${String(pixel).slice(-4)}` : null,
    access_token_masked: redactToken(tok),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Routing Logic
// ═══════════════════════════════════════════════════════════════════════════

export async function resolvePixelConfig(
  supabase: ReturnType<typeof createClient>,
  clientSlug?: string,
): Promise<{ pixelId: string; accessToken: string; testEventCode?: string; source: string } | null> {
  // Tier 1: Client-specific pixel
  if (clientSlug) {
    const { data: client } = (await supabase
      .from("clients")
      .select("id")
      .eq("slug", clientSlug)
      .eq("is_active", true)
      .single()) as { data: { id: string } | null };

    if (client) {
      const { data: secureConfig } = (await supabase
        .from("client_configs")
        .select("meta_pixel_id, capi_token_secret_id")
        .eq("client_id", client.id)
        .maybeSingle()) as { data: { meta_pixel_id: string | null; capi_token_secret_id: string | null } | null };

      if (secureConfig?.meta_pixel_id && secureConfig?.capi_token_secret_id) {
        const { data: secureToken } = (await (supabase as any).rpc("get_client_capi_token_by_secret_id", { p_secret_id: secureConfig.capi_token_secret_id })) as { data: string | null };
        if (secureToken) {
          console.log(`[CAPI:RESOLVE] Using secure client_config for slug="${clientSlug}"`);
          return { pixelId: secureConfig.meta_pixel_id, accessToken: secureToken, source: `client:${clientSlug}` };
        }
      }

      const { data: config } = (await supabase
        .from("meta_configurations")
        .select("pixel_id, access_token, test_event_code")
        .eq("client_id", client.id)
        .single()) as { data: { pixel_id: string; access_token: string; test_event_code: string | null } | null };

      if (config?.pixel_id && config?.access_token) {
        console.log(`[CAPI:RESOLVE] Using client-specific pixel for slug="${clientSlug}"`);
        return {
          pixelId: config.pixel_id,
          accessToken: config.access_token,
          testEventCode: config.test_event_code ?? undefined,
          source: `client:${clientSlug}`,
        };
      }
    }
    console.warn(`[CAPI:RESOLVE] Client slug="${clientSlug}" not found or missing pixel config — falling through`);
  }

  // Tier 2: Platform default pixel
  const { data: defaultConfig } = (await supabase
    .from("meta_configurations")
    .select("id, pixel_id, access_token, test_event_code")
    .eq("is_default", true)
    .single()) as {
      data: {
        id: string;
        pixel_id: string;
        access_token: string;
        test_event_code: string | null;
      } | null;
    };

  if (defaultConfig?.pixel_id && defaultConfig?.access_token) {
    console.log(`[CAPI:RESOLVE] Loaded default meta_configuration id=${defaultConfig.id}`);
    return {
      pixelId: defaultConfig.pixel_id,
      accessToken: defaultConfig.access_token,
      testEventCode: defaultConfig.test_event_code ?? undefined,
      source: "db:default",
    };
  }

  // Tier 3: Environment variable fallback (graceful safety net)
  const pixelId = Deno.env.get("META_PIXEL_ID");
  const accessToken = Deno.env.get("META_CAPI_TOKEN");
  const testEventCode = Deno.env.get("META_TEST_EVENT_CODE");

  if (pixelId && accessToken) {
    console.log("[CAPI:RESOLVE] Using fallback META_PIXEL_ID from environment secrets");
    return { pixelId, accessToken, testEventCode: testEventCode ?? undefined, source: "env:fallback" };
  }

  console.warn("[CAPI:RESOK:RESOLVE] No pixel configuration found in DB or environment. Signal will be dropped gracefully.");
  return null;
}

// --- DIAGNOSTIC: Dry-run resolver for admin route preview ---
// Reuses resolvePixelConfig() as the source of truth for routing precedence,
// then traces *why* the chosen tier was selected by utilities the same DB
// state the controller would see. NEVER calls Meta. NEVER logs to capi_signal_logs.
export async function diagnoseRoute(
  supabase: ReturnType<typeof createClient>,
  clientSlug?: string,
): Promise<RouteDiagnostic> {
  const reasons: string[] = [];
  const missing_fields: string[] = [];

  // Step 1 — explain the client tier outcome (passive inspection, no fetch retry).
  if (!clientSlug || typeof clientSlug !== "string") {
    reasons.push("client_slug_not_provided");
  } else {
    const { data: client } = (await supabase
      .from("clients")
      .select("id, is_active")
      .eq("slug", clientSlug)
      .maybeSingle()) as { data: { id: string; is_active: boolean } | null };

    if (!client) {
      reasons.push("client_not_found");
    } else if (!client.is_active) {
      reasons.push("client_inactive");
    } else {
      const { data: cfg } = (await supabase
        .from("meta_configurations")
        .select("pixel_id, access_token")
        .eq("client_id", client.id)
        .maybeSingle()) as { data: { pixel_id: string | null; access_token: string | null } | null };

      if (!cfg) {
        reasons.push("client_config_missing");
        missing_fields.push("meta_configurations.pixel_id", "meta_configurations.access_token");
      } else {
        if (!cfg.pixel_id) {
          reasons.push("client_config_missing_pixel");
          missing_fields.push("meta_configurations.pixel_id");
        }
        if (!cfg.access_token) {
          reasons.push("client_config_missing_token");
          missing_fields.push("meta_configurations.access_token");
        }
      }
    }
  }

  // Step 2 — delegate to the canonical resolver to get the actual chosen tier.
  // This guarantees preview can never disagree with capi-event in production.
  const config = await resolvePixelConfig(supabase, clientSlug);

  if (config) {
    let tier: RouteDiagnosticTier;
    if (config.source.startsWith("client:")) {
      tier = "client";
      reasons.push("client_resolved");
    } else if (config.source === "db:default") {
      tier = "default";
      reasons.push("default_resolved");
    } else {
      tier = "env";
      reasons.push("env_resolved");
    }

    return {
      tier,
      resolved: true,
      is_send_safe: true,
      client_slug: clientSlug ?? null,
      resolved_pixel_id: config.pixelId,
      source: config.source,
      uses_default: tier === "default",
      uses_env_fallback: tier === "env",
      degraded: false,
      reasons,
      missing_fields,
    };
  }

  // Degraded — explain *which* fallback tiers were also empty.
  // We re-inspect to give operators a precise checklist of what to fix.
  const { data: defaultRow } = (await supabase
    .from("meta_configurations")
    .select("pixel_id, access_token")
    .eq("is_default", true)
    .maybeSingle()) as { data: { pixel_id: string | null; access_token: string | null } | null };

  if (!defaultRow) {
    reasons.push("default_missing");
    missing_fields.push("meta_configurations.is_default_row");
  } else {
    if (!defaultRow.pixel_id) missing_fields.push("meta_configurations(default).pixel_id");
    if (!defaultRow.access_token) missing_fields.push("meta_configurations(default).access_token");
  }

  const envPixel = Deno.env.get("META_PIXEL_ID");
  const envToken = Deno.env.get("META_CAPI_TOKEN");
  if (!envPixel && !envToken) {
    reasons.push("env_missing");
    missing_fields.push("env.META_PIXEL_ID", "env.META_CAPI_TOKEN");
  } else {
    if (!envPixel) {
      reasons.push("env_missing_pixel");
      missing_fields.push("env.META_PIXEL_ID");
    }
    if (!envToken) {
      reasons.push("env_missing_token");
      missing_fields.push("env.META_CAPI_TOKEN");
    }
  }

  reasons.push("degraded_no_route");

  return {
    tier: "degraded",
    resolved: false,
    is_send_safe: false,
    client_slug: clientSlug ?? null,
    resolved_pixel_id: null,
    source: null,
    uses_default: false,
    uses_env_fallback: false,
    degraded: true,
    reasons,
    missing_fields,
  };
}

// --- DISPATCH: Shared sender used by both the live controller and the
// admin smoke-send action. Centralizing the Meta call here guarantees the
// admin smoke-send tool exercises the EXACT same payload shape, headers,
// URL, and response handling as production. There must be only one sender.
export async function dispatchCapiEvent(
  body: CAPIEvent,
  config: { pixelId: string; accessToken: string; testEventCode?: string },
  opts: DispatchOptions,
): Promise<DispatchResult> {
  const hashedUserData = await buildHashedUserData(body.user_data, {
    clientIp: opts.clientIp,
    userAgent: opts.userAgent,
  });

  const eventData: Record<string, unknown> = {
    event_name: body.event_name,
    event_time: body.event_time || Math.floor(Date.now() / 1000),
    event_id: body.event_id,
    event_source_url: body.event_source_url,
    action_source: "website",
    user_data: hashedUserData,
  };
  if (body.custom_data) eventData.custom_data = body.custom_data;

  const capiPayload: Record<string, unknown> = { data: [eventData] };

  const effectiveTestCode = opts.forceTestEventCode ?? config.testEventCode ?? null;
  if (effectiveTestCode) capiPayload.test_event_code = effectiveTestCode;

  const url = `https://graph.facebook.com/v19.0/${config.pixelId}/events?access_token=${config.accessToken}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(capiPayload),
  });
  const result = await response.json().catch(() => ({}));

  return {
    ok: response.ok,
    status: response.status,
    response: result,
    capiPayload,
    masked_pixel_id: `…${config.pixelId.slice(-4)}`,
    mode: opts.forceTestEventCode ? "test" : (config.testEventCode ? "test" : "live"),
    test_event_code_used: effectiveTestCode,
  };
}
