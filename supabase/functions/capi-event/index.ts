/**
 * capi-event — Facebook Conversions API Edge Function
 *
 * Internal-only authenticated secure sender (Wave C).
 * dispatch-platform-events resolves ownership; capi-event sends after auth.
 *
 * Features:
 *   - Service-role / dispatch-secret auth before body parse
 *   - Tenant-only pixel resolution (no public fallback)
 *   - SHA-256 hashing of PII (em, ph) before sending to Meta
 *   - Signal logging to capi_signal_logs table
 *   - Sanitized HTTP responses (no raw Meta / token / pixel leaks)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type CAPIEvent,
  classifyMetaError,
  dispatchCapiEvent,
  extractClientIp,
  type InternalCAPIEvent,
  isInternalCapiAuthorized,
  parseInternalRouteContext,
  resolvePixelConfig,
  resolvePixelConfigForDispatch,
} from "../_shared/capiRouting.ts";

// Re-export for backward compatibility with any tests importing from this file
export {
  buildHashedUserData,
  classifyMetaError,
  constantTimeEqual,
  diagnoseRoute,
  dispatchCapiEvent,
  extractClientIp,
  hashPhone,
  isInternalCapiAuthorized,
  isSha256Hex,
  parseInternalRouteContext,
  resolvePixelConfig,
  resolvePixelConfigForDispatch,
  sha256,
} from "../_shared/capiRouting.ts";
export type {
  CAPIEvent,
  CapiRouteClass,
  DispatchOptions,
  DispatchResult,
  DispatchRouteResolution,
  InternalCAPIEvent,
  RouteDiagnostic,
  RouteDiagnosticTier,
} from "../_shared/capiRouting.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-capi-dispatch-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function routingDegradedResponse(reason: string): Response {
  return jsonResponse(202, {
    success: false,
    degraded: true,
    reason,
    failure_class: "routing",
  });
}

export async function processAuthorizedCapiRequest(
  body: InternalCAPIEvent,
  req: Request,
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<Response> {
  let resolvedPixelId: string | undefined;
  let metaEvent: CAPIEvent | undefined;

  try {
    const routeContext = parseInternalRouteContext(body);
    metaEvent = routeContext.metaEvent;

    if (routeContext.routeClass === "unresolved") {
      console.warn(
        `[CAPI:ROUTE] unresolved route reason=${routeContext.routeReason ?? "none"}`,
      );
      return routingDegradedResponse("unresolved_route");
    }

    const resolution = await resolvePixelConfigForDispatch({
      supabase,
      routeClass: routeContext.routeClass,
      verifiedClientSlug: routeContext.verifiedClientSlug,
      eventName: routeContext.metaEvent.event_name,
    });

    if (!resolution.ok || !resolution.config) {
      console.warn(
        `[CAPI:ROUTE] dispatch routing failed reason=${resolution.reason ?? "unknown"}`,
      );
      return routingDegradedResponse(resolution.reason ?? "routing_failed");
    }

    const config = resolution.config;
    console.log(
      `[CAPI:FIRE] event=${metaEvent.event_name} source=${config.source}`,
    );
    resolvedPixelId = config.pixelId;

    const dispatch = await dispatchCapiEvent(metaEvent, config, {
      clientIp: extractClientIp(req.headers),
      userAgent: req.headers.get("user-agent"),
    });

    const logClientSlug = routeContext.verifiedClientSlug ?? "unknown";

    await supabase.from("capi_signal_logs").insert({
      client_slug: logClientSlug,
      pixel_id: config.pixelId,
      event_name: metaEvent.event_name,
      status_code: dispatch.status,
      payload: dispatch.capiPayload,
      response: dispatch.response,
      fired_at: new Date().toISOString(),
    });

    try {
      const externalId = typeof metaEvent.user_data?.external_id === "string"
        ? metaEvent.user_data.external_id
        : null;
      const looksLikeUuid = externalId !== null &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          externalId,
        );

      await supabase.from("event_logs").insert({
        event_name: `capi_${metaEvent.event_name.toLowerCase()}_dispatched`,
        lead_id: looksLikeUuid ? externalId : null,
        flow_type: "capi",
        route: "capi-event",
        metadata: {
          event_id: metaEvent.event_id,
          client_slug: logClientSlug,
          masked_pixel_id: dispatch.masked_pixel_id,
          status_code: dispatch.status,
          ok: dispatch.ok,
          mode: dispatch.mode,
          test_event_code_used: dispatch.test_event_code_used,
        },
      });
    } catch (logErr) {
      console.warn("[CAPI:EVENT_LOG_FAIL]", logErr);
    }

    if (!dispatch.ok) {
      const failure = classifyMetaError(dispatch.status, dispatch.response);
      console.error(
        `[CAPI:FAIL] class=${failure.class} status=${dispatch.status}`,
      );
      return jsonResponse(200, {
        success: false,
        degraded: true,
        reason: failure.class,
        failure_class: failure.class,
        failure_subcode: failure.subcode,
      });
    }

    return jsonResponse(200, {
      success: true,
      events_received: (dispatch.response as { events_received?: number })
        ?.events_received,
    });
  } catch (err) {
    console.error("CAPI function error:", err);

    if (resolvedPixelId && metaEvent) {
      await (supabase
        .from("capi_signal_logs")
        .insert({
          client_slug: metaEvent.client_slug ?? "unknown",
          pixel_id: resolvedPixelId,
          event_name: metaEvent.event_name ?? "unknown",
          status_code: 500,
          payload: {},
          response: { error: "internal_error" },
          fired_at: new Date().toISOString(),
        }) as unknown as Promise<unknown>)
        .catch(() => {});
    }

    return jsonResponse(500, {
      success: false,
      reason: "internal_error",
    });
  }
}

export async function handleCapiEventRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isInternalCapiAuthorized(req)) {
    return jsonResponse(401, { success: false, reason: "unauthorized" });
  }

  let body: InternalCAPIEvent;
  try {
    body = (await req.json()) as InternalCAPIEvent;
  } catch {
    return jsonResponse(400, { success: false, reason: "invalid_json" });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  return processAuthorizedCapiRequest(body, req, supabase);
}

if (import.meta.main) {
  Deno.serve(handleCapiEventRequest);
}
