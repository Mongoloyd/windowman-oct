/**
 * google-ads-conversion-event — internal Google Ads conversion sender (Sprint 4C).
 *
 * Dry-run only. Validates mapToGoogle-shaped payloads and returns masked proof.
 * Does NOT call Google Ads API.
 */

import { isInternalCapiAuthorized } from "../_shared/capiRouting.ts";
import {
  buildGoogleDryRunSuccessResponse,
  getGoogleAdsConfigPresence,
  parseGoogleConversionRequestBody,
  rejectLiveGoogleDispatch,
  validateGoogleConversionPayload,
} from "../_shared/googleAdsConversionValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-capi-dispatch-secret, x-google-ads-dispatch-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function isGoogleAdsDispatchAuthorized(req: Request): boolean {
  if (isInternalCapiAuthorized(req)) {
    return true;
  }

  const dispatchSecret = Deno.env.get("GOOGLE_ADS_DISPATCH_AUTH_TOKEN") ??
    Deno.env.get("CAPI_DISPATCH_SECRET");
  const providedSecret = req.headers.get("x-google-ads-dispatch-secret") ??
    req.headers.get("x-capi-dispatch-secret");

  if (!dispatchSecret || !providedSecret) {
    return false;
  }

  if (dispatchSecret.length !== providedSecret.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < dispatchSecret.length; i++) {
    diff |= dispatchSecret.charCodeAt(i) ^ providedSecret.charCodeAt(i);
  }
  return diff === 0;
}

export async function handleGoogleAdsConversionEventRequest(
  req: Request,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isGoogleAdsDispatchAuthorized(req)) {
    return jsonResponse(401, { success: false, reason: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, reason: "invalid_json" });
  }

  const parsed = parseGoogleConversionRequestBody(body);
  if (parsed.error) {
    return jsonResponse(400, {
      success: false,
      dry_run: parsed.dryRun ?? undefined,
      retryable: false,
      error: parsed.error,
    });
  }

  if (parsed.dryRun === false) {
    return jsonResponse(403, rejectLiveGoogleDispatch());
  }

  if (!parsed.payload) {
    return jsonResponse(400, {
      success: false,
      dry_run: true,
      retryable: false,
      error: "missing_payload",
    });
  }

  const validation = validateGoogleConversionPayload(parsed.payload);
  if (!validation.ok) {
    console.info("[google-ads-conversion-event] dry_run validation failed", {
      dry_run: true,
      error: validation.error,
    });
    return jsonResponse(400, {
      success: false,
      dry_run: true,
      retryable: validation.retryable,
      error: validation.error,
    });
  }

  const responseBody = buildGoogleDryRunSuccessResponse(
    validation,
    getGoogleAdsConfigPresence(),
  );

  console.info("[google-ads-conversion-event] dry_run validation passed", {
    dry_run: true,
    match_identifier_types: responseBody.match_identifier_types,
    masked_transaction_id: responseBody.masked_transaction_id,
    has_value: responseBody.has_value,
    config_presence: responseBody.config_presence,
  });

  return jsonResponse(200, responseBody as unknown as Record<string, unknown>);
}

if (import.meta.main) {
  Deno.serve(handleGoogleAdsConversionEventRequest);
}
