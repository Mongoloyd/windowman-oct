import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { normalizePayload } from "../_shared/facebook-normalizer.ts";
import {
  type InboxRow,
  prepareMetaLeadCompletion,
} from "../process-meta-lead/index.ts";
import {
  isMetaWebhookTestMode,
  type JsonRecord,
  resolveMetaVerification,
  verifyMetaWebhookSignature,
} from "./metaWebhook.ts";

export { normalizePayload };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-import-secret, x-hub-signature-256",
};

const MAX_REQUEST_BYTES = 1_000_000;

type FunctionSupabaseClient = ReturnType<typeof createClient>;
type EnvReader = (name: string) => string | undefined;
export type FacebookLeadAdHandlerDependencies = {
  env?: EnvReader;
  supabase?: FunctionSupabaseClient;
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function authOk(req: Request, env: EnvReader): boolean {
  const expected = env("FACEBOOK_LEAD_AD_IMPORT_SECRET");
  if (!expected) return false;
  const importSecret = req.headers.get("x-import-secret");
  const authHeader = req.headers.get("authorization");
  const bearer = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  return importSecret === expected || bearer === expected;
}

async function persistTrustedImport(
  supabase: FunctionSupabaseClient,
  body: JsonRecord,
): Promise<Response> {
  const rawId = body.platform_lead_id ?? body.leadgen_id ?? body.id;
  const leadgenId = typeof rawId === "string" || typeof rawId === "number"
    ? String(rawId).trim()
    : "";
  if (!leadgenId || leadgenId.length > 255) {
    return jsonResponse(
      { success: false, error: "platform_lead_id_required" },
      400,
    );
  }
  const isTest = body.is_test === true;
  const row: InboxRow = {
    id: crypto.randomUUID(),
    platform_lead_id: leadgenId,
    page_id: typeof body.page_id === "string" ? body.page_id : null,
    form_id: typeof body.form_id === "string" ? body.form_id : null,
    ad_id: typeof body.ad_id === "string" ? body.ad_id : null,
    platform_created_time: typeof body.created_time === "string"
      ? body.created_time
      : null,
    graph_payload: body,
    is_test: isTest,
    lease_token: "",
    received_at: new Date().toISOString(),
  };
  const prepared = await prepareMetaLeadCompletion(supabase, row, body);
  if (!prepared.ok) {
    return jsonResponse(
      { success: false, error: prepared.code },
      prepared.retryable ? 503 : 422,
    );
  }
  const { data, error } = await supabase.rpc("meta_import_trusted_lead", {
    p_platform_lead_id: leadgenId,
    p_graph_payload: body,
    p_is_test: isTest,
    p_lead: prepared.leadInput,
    p_attribution: prepared.attributionInput,
    p_mapping_revision_id: prepared.revisionId,
    p_consents: prepared.consentRows,
  });
  if (error) {
    return jsonResponse(
      { success: false, error: "trusted_import_failed" },
      503,
    );
  }
  const result = Array.isArray(data) ? data[0] : data;
  if (
    !result || result.error_code || !result.lead_id || !result.attribution_id
  ) {
    return jsonResponse(
      { success: false, error: result?.error_code ?? "trusted_import_failed" },
      result?.error_code === "classification_conflict" ||
        result?.error_code === "trusted_import_quarantined"
        ? 409
        : 503,
    );
  }
  return jsonResponse({
    success: true,
    lead_id: result.lead_id,
    attribution_id: result.attribution_id,
    reused: result.reused === true,
  });
}

function parseJsonObject(
  rawBytes: Uint8Array,
): { ok: true; body: JsonRecord } | {
  ok: false;
  error: "invalid_json" | "payload_must_be_object";
} {
  let rawBody: unknown;
  try {
    rawBody = JSON.parse(
      new TextDecoder("utf-8", { fatal: true }).decode(rawBytes),
    );
  } catch (_error) {
    return { ok: false, error: "invalid_json" };
  }

  const body = asRecord(rawBody);
  return body
    ? { ok: true, body }
    : { ok: false, error: "payload_must_be_object" };
}

function resolveSupabaseClient(
  dependencies: FacebookLeadAdHandlerDependencies,
  env: EnvReader,
): FunctionSupabaseClient | null {
  if (dependencies.supabase) return dependencies.supabase;

  const supabaseUrl = env("SUPABASE_URL");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey);
}

function parseIdentifierList(
  value: string | undefined,
): { ids: string[]; valid: boolean } {
  if (!value?.trim()) return { ids: [], valid: true };
  const ids = value.split(",").map((id) => id.trim());
  const valid = ids.length <= 100 &&
    ids.every((id) => id.length >= 1 && id.length <= 255);
  return { ids: valid ? [...new Set(ids)] : [], valid };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function recordMetaWebhookReceipt(
  supabase: FunctionSupabaseClient,
  rawBytes: Uint8Array,
  testMode: boolean,
  env: EnvReader,
): Promise<boolean> {
  const digest = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new Uint8Array(rawBytes).buffer,
    ),
  );
  const sha256 = Array.from(
    digest,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  const forms = parseIdentifierList(env("META_TEST_FORM_IDS"));
  const pages = parseIdentifierList(env("META_TEST_PAGE_IDS"));
  const { data, error } = await supabase.rpc("meta_receive_webhook_receipt", {
    p_body_base64: bytesToBase64(rawBytes),
    p_body_sha256: sha256,
    p_global_test_mode: testMode,
    p_test_form_ids: forms.ids,
    p_test_page_ids: pages.ids,
    p_routing_config_valid: forms.valid && pages.valid,
  });
  return !error && typeof data === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      data,
    );
}

async function handleNativeMetaWebhook(
  rawBytes: Uint8Array,
  signatureHeader: string,
  appSecret: string,
  dependencies: FacebookLeadAdHandlerDependencies,
  env: EnvReader,
): Promise<Response> {
  const signatureValid = await verifyMetaWebhookSignature(
    rawBytes,
    signatureHeader,
    appSecret,
  );
  if (!signatureValid) {
    return jsonResponse({ success: false, error: "unauthorized" }, 401);
  }

  const testMode = isMetaWebhookTestMode(env("META_WEBHOOK_TEST_MODE"));
  const supabase = resolveSupabaseClient(dependencies, env);
  if (!supabase) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  const receiptsStored = await recordMetaWebhookReceipt(
    supabase,
    rawBytes,
    testMode,
    env,
  );
  if (!receiptsStored) {
    return jsonResponse(
      { success: false, error: "webhook_receipt_failed" },
      500,
    );
  }

  return jsonResponse({ success: true, queued: true });
}

export async function handleImportFacebookLeadAdRequest(
  req: Request,
  dependencies: FacebookLeadAdHandlerDependencies = {},
): Promise<Response> {
  const env = dependencies.env ?? ((name: string) => Deno.env.get(name));

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method === "GET") {
    const verification = resolveMetaVerification(
      new URL(req.url),
      env("META_WEBHOOK_VERIFY_TOKEN"),
    );
    if (!verification.ok) {
      const status = verification.error === "not_configured" ? 503 : 403;
      return jsonResponse(
        { success: false, error: `meta_webhook_${verification.error}` },
        status,
      );
    }

    return new Response(verification.challenge, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "method_not_allowed" }, 405);
  }

  const signatureHeader = req.headers.get("x-hub-signature-256");
  const hasNativeSignature = req.headers.has("x-hub-signature-256");
  const trustedImportAuthorized = authOk(req, env);
  if (!trustedImportAuthorized && !hasNativeSignature) {
    return jsonResponse({ success: false, error: "unauthorized" }, 401);
  }

  const appSecret = env("META_APP_SECRET");
  if (hasNativeSignature && !appSecret) {
    return jsonResponse(
      { success: false, error: "meta_webhook_not_configured" },
      503,
    );
  }

  const contentLength = Number(req.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ success: false, error: "payload_too_large" }, 413);
  }

  const rawBytes = new Uint8Array(await req.arrayBuffer());
  if (rawBytes.byteLength > MAX_REQUEST_BYTES) {
    return jsonResponse({ success: false, error: "payload_too_large" }, 413);
  }

  if (hasNativeSignature) {
    return handleNativeMetaWebhook(
      rawBytes,
      signatureHeader!,
      appSecret!,
      dependencies,
      env,
    );
  }

  const parsed = parseJsonObject(rawBytes);
  if (!parsed.ok) {
    return jsonResponse({ success: false, error: parsed.error }, 400);
  }

  const supabase = resolveSupabaseClient(dependencies, env);
  if (!supabase) {
    return jsonResponse(
      { success: false, error: "server_not_configured" },
      500,
    );
  }

  return persistTrustedImport(
    supabase,
    parsed.body,
  );
}

if (import.meta.main) {
  Deno.serve((req) => handleImportFacebookLeadAdRequest(req));
}
