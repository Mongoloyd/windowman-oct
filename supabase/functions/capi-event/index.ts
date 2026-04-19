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
import {
  buildHashedUserData,
  dispatchCapiEvent,
  extractClientIp,
  resolvePixelConfig,
  sha256,
  hashPhone,
  isSha256Hex,
  diagnoseRoute,
  type CAPIEvent,
  type DispatchOptions,
  type DispatchResult,
  type RouteDiagnostic,
  type RouteDiagnosticTier,
} from "../_shared/capiRouting.ts";

// Re-export for backward compatibility with any tests importing from this file
export {
  buildHashedUserData,
  dispatchCapiEvent,
  extractClientIp,
  resolvePixelConfig,
  sha256,
  hashPhone,
  isSha256Hex,
  diagnoseRoute,
} from "../_shared/capiRouting.ts";
export type { CAPIEvent, DispatchOptions, DispatchResult, RouteDiagnostic, RouteDiagnosticTier } from "../_shared/capiRouting.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // Delegate to the shared dispatcher so the live controller and the
    // admin smoke-send tool are guaranteed to use the same payload shape,
    // hashing, headers, URL, and response handling.
    const dispatch = await dispatchCapiEvent(body, config, {
      clientIp: extractClientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
      // No forceTestEventCode in production — only smoke-send injects one.
    });

    // Log to capi_signal_logs — always, success or failure
    // Payload logged with PII already hashed (lives inside dispatch.capiPayload).
    await supabase.from("capi_signal_logs").insert({
      client_slug: body.client_slug ?? "default",
      pixel_id: config.pixelId,
      event_name: body.event_name,
      status_code: dispatch.status,
      payload: dispatch.capiPayload,
      response: dispatch.response,
      fired_at: new Date().toISOString(),
    });

    if (!dispatch.ok) {
      console.error("CAPI error:", JSON.stringify(dispatch.response));
      return new Response(JSON.stringify({ success: false, error: dispatch.response }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, events_received: (dispatch.response as { events_received?: number })?.events_received }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
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