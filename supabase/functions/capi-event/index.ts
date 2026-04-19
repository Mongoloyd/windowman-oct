/**
 * capi-event — Facebook Conversions API Edge Function
 *
 * Production-grade, multi-pixel, white-label ready.
 *
 * Routing Priority:
 *   1. clientSlug → look up meta_configurations for that client
 *   2. is_default = true row in meta_configurations (platform default)
 *   3. META_PIXEL_ID + META_CAPI_TOKEN env vars (hardcoded fallback)
 *
 * Features:
 *   - SHA-256 hashing of PII (em, ph) before sending to Meta
 *   - Multi-pixel routing via clientSlug
 *   - Signal logging to capi_signal_logs table
 *   - test_event_code support via env var (no code changes to toggle)
 *   - IP extraction from Cloudflare/proxy headers
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface CAPIEvent {
  event_name: "CompleteRegistration" | "ViewContent" | "Lead" | "PageView";
  event_id: string;
  event_time?: number;
  event_source_url: string;
  action_source: "website";
  client_slug?: string; // Used to resolve which pixel to fire to
  user_data: {
    em?: string; // Raw email — will be hashed here
    ph?: string; // Raw phone — will be normalized and hashed here
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

// --- UTILITY: SHA-256 hash any string ---
// Exported for regression testing (see index.test.ts). Behavior unchanged.
export async function sha256(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// --- UTILITY: Normalize phone (strip all non-digits) then hash ---
// Exported for regression testing. Behavior unchanged.
export async function hashPhone(phone: string): Promise<string> {
  const normalized = phone.replace(/\D/g, "");
  return sha256(normalized);
}

// --- UTILITY: Detect already-hashed SHA-256 hex (64 lowercase hex chars) ---
// The canonical server-side dispatch lane (mapToMeta) hashes em/ph/external_id
// before calling this function. Without this guard we would double-hash those
// values and silently destroy match quality. Raw input from any other caller
// continues to be normalized + hashed below.
// Exported for regression testing. Behavior unchanged.
export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

// --- UTILITY: Build hashed user_data block from raw payload + request headers ---
// Extracted from the request handler verbatim so it can be exercised by tests.
// MUST behave identically to the inline implementation it replaces.
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

  // Preserve client_user_agent: prefer payload value, fall back to request header.
  if (!hashedUserData.client_user_agent && headers.userAgent) {
    hashedUserData.client_user_agent = headers.userAgent;
  }

  return hashedUserData;
}

// --- UTILITY: Extract client IP from proxy/CDN headers ---
// Priority: cf-connecting-ip → first x-forwarded-for hop → x-real-ip → fallback.
// Exported so regression tests can pin the header precedence.
export function extractClientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ||
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "0.0.0.0"
  );
}

// --- UTILITY: Resolve which pixel config to use ---
// Priority: clientSlug → default row → env vars
// Returns source label for observability (never logs raw secrets)
// Exported for routing-matrix regression testing. Behavior unchanged.
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

  console.warn("[CAPI:RESOLVE] No pixel configuration found in DB or environment. Signal will be dropped gracefully.");
  return null; // Nothing configured — abort gracefully
}

// --- DIAGNOSTIC: Dry-run resolver for admin route preview ---
// Reuses resolvePixelConfig() as the source of truth for routing precedence,
// then traces *why* the chosen tier was selected by inspecting the same DB
// state the controller would see. NEVER calls Meta. NEVER logs to capi_signal_logs.
//
// This is the single shared brain for the preview action — operators must not
// build a parallel routing implementation. Reasons are deterministic enums so
// downstream tooling can branch on them.
//
// Reason codes (stable contract — do not rename without updating tests + docs):
//   client_resolved              client_slug matched an active client with a complete config
//   client_slug_not_provided     no slug supplied; fell straight through to default tier
//   client_not_found             slug did not match any clients row
//   client_inactive              slug matched but clients.is_active = false
//   client_config_missing        client row exists but no meta_configurations row
//   client_config_missing_pixel  config row exists but pixel_id is null/empty
//   client_config_missing_token  config row exists but access_token is null/empty
//   default_resolved             fell through to is_default = true row
//   default_missing              no default row present
//   env_resolved                 fell through to META_PIXEL_ID + META_CAPI_TOKEN
//   env_missing_pixel            META_PIXEL_ID not set
//   env_missing_token            META_CAPI_TOKEN not set
//   env_missing                  neither env var set
//   degraded_no_route            no tier resolved — events would be HTTP 202 no-send
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for DB lookups and logging
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let resolvedPixelId: string | undefined;
  let body: CAPIEvent | undefined;

  try {
    body = (await req.json()) as CAPIEvent;

    // Resolve pixel config
    const config = await resolvePixelConfig(supabase as any, body.client_slug);

    if (!config) {
      // Graceful degradation: accept the event but don't fire it
      return new Response(JSON.stringify({ success: false, error: "CAPI not configured", degraded: true }), {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[CAPI:FIRE] event=${body.event_name} source=${config.source} pixel=…${config.pixelId.slice(-4)}`);
    resolvedPixelId = config.pixelId;

    // Extract client IP via shared header-precedence helper
    const clientIp = extractClientIp(req.headers);

    // Hash PII — NEVER send raw email or phone to Meta.
    // Behavior is identical to the previous inline block; logic lives in
    // buildHashedUserData() so it can be exercised by regression tests.
    const hashedUserData = await buildHashedUserData(body.user_data, {
      clientIp,
      userAgent: req.headers.get("user-agent"),
    });

    // Build final CAPI payload
    const eventData: Record<string, unknown> = {
      event_name: body.event_name,
      event_time: body.event_time || Math.floor(Date.now() / 1000),
      event_id: body.event_id,
      event_source_url: body.event_source_url,
      action_source: "website",
      user_data: hashedUserData,
    };

    if (body.custom_data) {
      eventData.custom_data = body.custom_data;
    }

    // Build the top-level payload
    // test_event_code comes from DB config or env var — never hardcoded
    const capiPayload: Record<string, unknown> = {
      data: [eventData],
    };

    if (config.testEventCode) {
      capiPayload.test_event_code = config.testEventCode;
    }

    // Fire to Meta
    const capiUrl = `https://graph.facebook.com/v19.0/${config.pixelId}/events?access_token=${config.accessToken}`;

    const response = await fetch(capiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(capiPayload),
    });

    const result = await response.json();

    // Log to capi_signal_logs — always, success or failure
    // Payload logged with PII already hashed (hashedUserData, not raw body.user_data)
    await supabase.from("capi_signal_logs").insert({
      client_slug: body.client_slug ?? "default",
      pixel_id: config.pixelId,
      event_name: body.event_name,
      status_code: response.status,
      payload: capiPayload, // Already hashed — safe to log
      response: result,
      fired_at: new Date().toISOString(),
    });

    if (!response.ok) {
      console.error("CAPI error:", JSON.stringify(result));
      return new Response(JSON.stringify({ success: false, error: result }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, events_received: result.events_received }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("CAPI function error:", err);

    // Still attempt to log the failure if we have enough context
    if (resolvedPixelId && body) {
      await (supabase
        .from("capi_signal_logs")
        .insert({
          client_slug: body.client_slug ?? "default",
          pixel_id: resolvedPixelId,
          event_name: body.event_name ?? "unknown",
          status_code: 500,
          payload: {},
          response: { error: String(err) },
          fired_at: new Date().toISOString(),
        }) as unknown as Promise<unknown>)
        .catch(() => {}); // Don't let logging failure crash the handler
    }

    return new Response(JSON.stringify({ success: false, error: "Internal error" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
