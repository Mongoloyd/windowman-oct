/**
 * qa-google-attribution-event — staging-only Google click-ID attribution proof helper.
 *
 * Creates one synthetic lead + Google-mapped canonical event with fake gclid/gbraid/wbraid.
 * Does NOT invoke workers, senders, OTP, scanner, upload, or report reveal paths.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  promoteLeadScalarFields,
  sanitizeAttributionInput,
  sanitizeQueryParamsInput,
} from "../_shared/attributionMerge.ts";
import { normalizePhone } from "../_shared/normalizePhone.ts";
import {
  evaluateQaHelperGuard,
  readQaHelperGuardEnv,
} from "../_shared/qaHelperGuard.ts";
import { createCanonicalEvent } from "../_shared/tracking/canonical/createCanonicalEvent.ts";
import type {
  CreateCanonicalEventInput,
  WMEventName,
} from "../_shared/tracking/canonical/types.ts";

const FUNCTION_NAME = "qa-google-attribution-event";
const QA_LEAD_SOURCE = "qa_google_4h_clickid_proof";
const DEFAULT_CLIENT_SLUG = "direct";

const ALLOWED_EVENT_NAMES = new Set<WMEventName>([
  "lead_identified",
  "lead_qualified",
  "phone_verified",
  "report_revealed",
  "appointment_booked",
  "sale_confirmed",
]);

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid"] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-qa-helper-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DbResult = { data?: unknown; error?: { message?: string } | null };
type DbSingleResult = {
  data?: Record<string, unknown> | null;
  error?: { message?: string } | null;
};

interface RequestLead {
  email: string;
  phone: string;
}

interface ParsedRequest {
  eventName: WMEventName;
  lead: RequestLead;
  attribution: Record<string, unknown>;
  queryParams: Record<string, string | string[]>;
  clientSlug: string;
  eventId: string;
}

function json(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pickAttributionString(
  attribution: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = attribution[key];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function mirrorAttributionToQueryParams(
  attribution: Record<string, unknown>,
): Record<string, string | string[]> {
  const mirrored: Record<string, string> = {};
  for (const key of [
    ...CLICK_ID_KEYS,
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
  ]) {
    const value = pickAttributionString(attribution, key);
    if (value) mirrored[key] = value;
  }
  return sanitizeQueryParamsInput(mirrored);
}

function parseRequestBody(input: unknown): ParsedRequest | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { error: "invalid_json_body" };
  }

  const body = input as Record<string, unknown>;
  const eventNameRaw = typeof body.event_name === "string"
    ? body.event_name.trim()
    : "lead_identified";

  if (!ALLOWED_EVENT_NAMES.has(eventNameRaw as WMEventName)) {
    return { error: "invalid_event_name" };
  }

  const leadRaw = body.lead;
  if (!leadRaw || typeof leadRaw !== "object" || Array.isArray(leadRaw)) {
    return { error: "invalid_lead" };
  }

  const leadObj = leadRaw as Record<string, unknown>;
  const email = typeof leadObj.email === "string"
    ? leadObj.email.trim().toLowerCase()
    : "";
  const phone = typeof leadObj.phone === "string" ? leadObj.phone.trim() : "";

  if (!email || !EMAIL_REGEX.test(email)) {
    return { error: "invalid_email" };
  }

  const phoneE164 = normalizePhone(phone);
  if (!/^\+1\d{10}$/.test(phoneE164)) {
    return { error: "invalid_phone" };
  }

  const attribution = sanitizeAttributionInput(body.attribution);
  const queryParams = body.query_params !== undefined
    ? sanitizeQueryParamsInput(body.query_params)
    : mirrorAttributionToQueryParams(attribution);

  const clientSlug = typeof body.client_slug === "string" &&
      body.client_slug.trim().length > 0
    ? body.client_slug.trim().toLowerCase()
    : DEFAULT_CLIENT_SLUG;

  const eventId = typeof body.event_id === "string" &&
      body.event_id.trim().length > 0
    ? body.event_id.trim()
    : `wmc_qa_4hg_${crypto.randomUUID()}`;

  return {
    eventName: eventNameRaw as WMEventName,
    lead: { email, phone: phoneE164 },
    attribution,
    queryParams,
    clientSlug,
    eventId,
  };
}

function buildCanonicalDb(supabase: ReturnType<typeof createClient>) {
  return {
    from(table: string) {
      const query = supabase.from(table);
      return {
        async insert(
          payload: Record<string, unknown> | Record<string, unknown>[],
        ): Promise<DbResult> {
          const { data, error } = await query.insert(payload as never).select();
          return { data, error: error ? { message: error.message } : null };
        },
        async upsert(
          payload: Record<string, unknown> | Record<string, unknown>[],
          options?: { onConflict?: string },
        ): Promise<DbResult> {
          const { data, error } = await query
            .upsert(payload as never, options as never)
            .select();
          return { data, error: error ? { message: error.message } : null };
        },
        select(columns: string) {
          return {
            eq(column: string, value: string) {
              return {
                async maybeSingle(): Promise<DbSingleResult> {
                  const { data, error } = await query
                    .select(columns)
                    .eq(column, value)
                    .maybeSingle();
                  return {
                    data: (data as Record<string, unknown> | null) ?? null,
                    error: error ? { message: error.message } : null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

function collectAttributionKeys(
  attribution: Record<string, unknown>,
): string[] {
  return CLICK_ID_KEYS.filter((key) => pickAttributionString(attribution, key));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ success: false, error: "method_not_allowed" }, 405);
  }

  const guard = evaluateQaHelperGuard({
    providedSecret: req.headers.get("x-qa-helper-secret"),
    env: readQaHelperGuardEnv(),
  });

  if (!guard.allowed) {
    if (guard.httpStatus === 404) {
      return json({ error: "Not found" }, 404);
    }
    if (guard.httpStatus === 500) {
      console.error(`[${FUNCTION_NAME}] guard config error`, {
        reason: guard.reason,
      });
      return json({ success: false, error: "config_error" }, 500);
    }
    return json({ success: false, error: "forbidden" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    console.error(`[${FUNCTION_NAME}] missing supabase env`);
    return json({ success: false, error: "config_error" }, 500);
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return json({ success: false, error: "invalid_json" }, 400);
  }

  const parsed = parseRequestBody(rawBody);
  if ("error" in parsed) {
    return json({ success: false, error: parsed.error }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const sessionId = crypto.randomUUID();
  const promoted = promoteLeadScalarFields(parsed.attribution, {
    client_slug: parsed.clientSlug,
  });

  const leadInsertRow: Record<string, unknown> = {
    session_id: sessionId,
    email: parsed.lead.email,
    phone_e164: parsed.lead.phone,
    source: QA_LEAD_SOURCE,
    lead_source: QA_LEAD_SOURCE,
    client_slug: parsed.clientSlug,
    attribution: parsed.attribution,
    query_params: parsed.queryParams,
    status: "new",
    phone_verified: false,
    phone_verified_at: null,
    ...promoted,
  };

  const { data: insertedLead, error: leadError } = await supabase
    .from("leads")
    .insert(leadInsertRow)
    .select("id")
    .single();

  if (leadError || !insertedLead?.id) {
    console.error(`[${FUNCTION_NAME}] lead insert failed`, {
      code: leadError?.code,
      message: leadError?.message,
    });
    return json({ success: false, error: "lead_insert_failed" }, 500);
  }

  const leadId = insertedLead.id as string;

  const canonicalInput: CreateCanonicalEventInput = {
    eventId: parsed.eventId,
    eventName: parsed.eventName,
    leadId,
    clientSlug: parsed.clientSlug,
    payload: {
      identity: {
        leadId,
        email: parsed.lead.email,
        phone: parsed.lead.phone,
        gclid: pickAttributionString(parsed.attribution, "gclid"),
        gbraid: pickAttributionString(parsed.attribution, "gbraid"),
        wbraid: pickAttributionString(parsed.attribution, "wbraid"),
      },
      journey: {
        route: "/qa/google-4h-clickid-proof",
        flow: "public",
        sessionId,
      },
      source: {
        sourceSystem: "qa_helper",
        utmSource: pickAttributionString(parsed.attribution, "utm_source"),
        utmMedium: pickAttributionString(parsed.attribution, "utm_medium"),
        utmCampaign: pickAttributionString(parsed.attribution, "utm_campaign"),
      },
      metadata: {
        qa_helper: "google_4h_g",
        qa_flow: "qa_google_4h",
        synthetic: true,
      },
    },
  };

  let canonicalResult;
  try {
    canonicalResult = await createCanonicalEvent(canonicalInput, {
      db: buildCanonicalDb(supabase),
    });
  } catch (error) {
    console.error(`[${FUNCTION_NAME}] canonical event failed`, {
      message: error instanceof Error ? error.message : String(error),
    });
    return json({
      success: false,
      error: "canonical_event_failed",
      lead_id: leadId,
    }, 500);
  }

  const eventLogId = canonicalResult.eventLogId;
  if (!eventLogId) {
    return json({
      success: false,
      error: "event_log_missing",
      lead_id: leadId,
    }, 500);
  }

  if (!canonicalResult.dispatchPlatforms.includes("google_ads")) {
    return json({
      success: false,
      error: "google_ads_not_enqueued",
      lead_id: leadId,
      event_log_id: eventLogId,
    }, 500);
  }

  const { data: dispatchRow, error: dispatchError } = await supabase
    .from("wm_platform_dispatch_log")
    .select("id, dispatch_status, platform_name")
    .eq("event_log_id", eventLogId)
    .eq("platform_name", "google_ads")
    .maybeSingle();

  if (dispatchError || !dispatchRow?.id) {
    console.error(`[${FUNCTION_NAME}] google_ads dispatch row missing`, {
      message: dispatchError?.message,
    });
    return json({
      success: false,
      error: "google_ads_dispatch_missing",
      lead_id: leadId,
      event_log_id: eventLogId,
    }, 500);
  }

  return json({
    success: true,
    lead_id: leadId,
    event_log_id: eventLogId,
    event_id: parsed.eventId,
    dispatch_id: dispatchRow.id,
    platform_name: dispatchRow.platform_name ?? "google_ads",
    dispatch_status: dispatchRow.dispatch_status ?? "pending",
    attribution_keys: collectAttributionKeys(parsed.attribution),
  }, 200);
});
