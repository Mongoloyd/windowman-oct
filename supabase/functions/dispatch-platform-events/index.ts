import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  fetchWithTimeout,
  runDispatchWorker,
  type VendorSendResult,
} from "../_shared/tracking/dispatchWorkerBridge.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TIMEOUT_MS = 7000;

function buildErrorResult(
  error: unknown,
  requestPayload: Record<string, unknown>,
): VendorSendResult {
  const message = error instanceof Error ? error.message : "Unknown error";
  const isAbort = message.toLowerCase().includes("abort") ||
    message.toLowerCase().includes("timeout");

  return {
    ok: false,
    retryable: true,
    errorMessage: message,
    requestPayload,
    responseBody: { error: message },
    statusCode: isAbort ? 504 : 503,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Require a pre-shared secret so only the scheduler/cron caller can trigger
  // dispatch.  Set DISPATCH_WORKER_SECRET in the edge-function environment and
  // pass it as the `x-dispatch-secret` header from the caller.
  const expectedSecret = Deno.env.get("DISPATCH_WORKER_SECRET");
  if (!expectedSecret) {
    return new Response(
      JSON.stringify({ error: "DISPATCH_WORKER_SECRET is not configured" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const providedSecret = req.headers.get("x-dispatch-secret");
  if (providedSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const capiUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/capi-event`;
    const googleDispatchUrl = Deno.env.get("GOOGLE_ADS_DISPATCH_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleDispatchAuthToken = Deno.env.get(
      "GOOGLE_ADS_DISPATCH_AUTH_TOKEN",
    );
    const eventSourceUrl = Deno.env.get("WM_EVENT_SOURCE_URL") ??
      "https://windowman.app";

    const workerResult = await runDispatchWorker({
      // The real SupabaseClient runtime shape (`<any, "public", any>`) is
      // structurally compatible with the narrower DBLike contract used by the
      // canonical worker, but TS cannot prove it through Promise return-type
      // variance on rpc(). Cast through unknown to keep runtime behavior
      // identical without weakening the worker's DBLike contract.
      db: supabase as unknown as Parameters<typeof runDispatchWorker>[0]["db"],
      metaEventSourceUrl: eventSourceUrl,
      sendToMeta: async (payload) => {
        try {
          const response = await fetchWithTimeout(
            capiUrl,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${serviceRoleKey}`,
              },
              body: JSON.stringify(payload),
            },
            DEFAULT_TIMEOUT_MS,
          );

          const body = await response.json().catch(() => ({}));
          const ok = response.ok && Boolean(body?.success);

          return {
            ok,
            retryable: !ok &&
              (response.status === 429 || response.status >= 500),
            statusCode: response.status,
            responseBody: body,
            errorMessage: ok ? undefined : JSON.stringify(body),
            requestPayload: payload,
          } satisfies VendorSendResult;
        } catch (error) {
          return buildErrorResult(error, payload);
        }
      },
      sendToGoogle: async (payload) => {
        if (!googleDispatchUrl) {
          return {
            ok: false,
            retryable: false,
            statusCode: 400,
            errorMessage: "GOOGLE_ADS_DISPATCH_URL is not configured",
            responseBody: {
              error: "GOOGLE_ADS_DISPATCH_URL is not configured",
            },
            requestPayload: payload,
          } satisfies VendorSendResult;
        }

        try {
          const googleHeaders: Record<string, string> = {
            "Content-Type": "application/json",
          };

          if (googleDispatchAuthToken) {
            googleHeaders.Authorization = `Bearer ${googleDispatchAuthToken}`;
          }

          const response = await fetchWithTimeout(
            googleDispatchUrl,
            {
              method: "POST",
              headers: googleHeaders,
              body: JSON.stringify(payload),
            },
            DEFAULT_TIMEOUT_MS,
          );

          const body = await response.json().catch(() => ({}));

          return {
            ok: response.ok,
            retryable: response.status === 429 || response.status >= 500,
            statusCode: response.status,
            responseBody: body,
            errorMessage: response.ok ? undefined : JSON.stringify(body),
            requestPayload: payload,
          } satisfies VendorSendResult;
        } catch (error) {
          return buildErrorResult(error, payload);
        }
      },
    });

    return new Response(JSON.stringify({ success: true, ...workerResult }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
