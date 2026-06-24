/**
 * tiktok-capi-event — internal-only TikTok Events API sender.
 *
 * Accepts pre-built TikTok payloads from the canonical dispatch lane.
 * Resolves tenant platform config + Vault token server-side, overwrites
 * event_source_id from trusted config, and POSTs to TikTok Events API.
 *
 * Not wired to dispatchWorker in Sprint 3C-2.
 */

import { isInternalCapiAuthorized } from "../_shared/capiRouting.ts";
import {
  createTikTokServiceClient,
  processAuthorizedTikTokRequest,
} from "../_shared/tiktokCapiRouting.ts";

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

export async function handleTikTokCapiEventRequest(
  req: Request,
): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isInternalCapiAuthorized(req)) {
    return jsonResponse(401, { success: false, reason: "unauthorized" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonResponse(400, { success: false, reason: "invalid_json" });
  }

  const supabase = createTikTokServiceClient();
  const result = await processAuthorizedTikTokRequest(body, { supabase });

  return jsonResponse(result.status, result.body as unknown as Record<string, unknown>);
}

if (import.meta.main) {
  Deno.serve(handleTikTokCapiEventRequest);
}
