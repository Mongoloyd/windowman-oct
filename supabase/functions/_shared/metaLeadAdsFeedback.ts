import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  classifyMetaError,
  resolvePixelConfigForDispatch,
  sha256,
} from "./capiRouting.ts";

function makeServiceClient(url: string, key: string) {
  return createClient(url, key);
}
type Supabase = ReturnType<typeof makeServiceClient>;

export type MetaQualifiedSignal = {
  clientSlug: string;
  eventId: string;
  qualifiedAt: string;
  platformLeadId: string;
  email: string | null;
  phone: string | null;
};

export type MetaFeedbackResult =
  | { ok: true; status: number }
  | { ok: false; code: string; status: number | null; retryable: boolean };

export async function buildMetaQualifiedPayload(
  signal: MetaQualifiedSignal,
  testEventCode?: string,
): Promise<Record<string, unknown> | null> {
  const eventTime = Math.floor(Date.parse(signal.qualifiedAt) / 1000);
  if (
    !Number.isFinite(eventTime) || !signal.platformLeadId || !signal.eventId
  ) {
    return null;
  }
  const userData: Record<string, unknown> = { lead_id: signal.platformLeadId };
  if (signal.email) {
    userData.em = [await sha256(signal.email.trim().toLowerCase())];
  }
  const phone = signal.phone?.trim();
  if (phone && /^\+[1-9][0-9]{7,14}$/.test(phone)) {
    userData.ph = [await sha256(phone.slice(1))];
  }
  const payload: Record<string, unknown> = {
    data: [{
      event_name: "QualifiedLead",
      event_time: eventTime,
      event_id: signal.eventId,
      action_source: "system_generated",
      user_data: userData,
      custom_data: {
        event_source: "crm",
        lead_event_source: "WindowMan",
      },
    }],
  };
  if (testEventCode) payload.test_event_code = testEventCode;
  return payload;
}

export async function sendMetaQualifiedSignal(
  supabase: Supabase,
  signal: MetaQualifiedSignal,
  options: {
    apiVersion: string;
    testEventCode?: string;
    liveEnabled: boolean;
    fetchImpl?: typeof fetch;
  },
): Promise<MetaFeedbackResult> {
  const configResult = await resolvePixelConfigForDispatch({
    // capiRouting currently imports a different supabase-js URL. The cast is
    // only at this existing shared-routing boundary; runtime client is the same.
    supabase: supabase as unknown as Parameters<
      typeof resolvePixelConfigForDispatch
    >[0]["supabase"],
    routeClass: "tenant_required",
    verifiedClientSlug: signal.clientSlug,
  });
  if (!configResult.ok || !configResult.config) {
    return {
      ok: false,
      code: "meta_client_config_missing",
      status: null,
      retryable: false,
    };
  }
  const config = configResult.config;
  const version = options.apiVersion.trim();
  if (!/^v\d{1,3}\.\d{1,2}$/.test(version)) {
    return {
      ok: false,
      code: "meta_api_version_invalid",
      status: null,
      retryable: false,
    };
  }
  // The CRM feedback lane has its own Test Events switch; do not inherit a
  // website Pixel test code from the shared destination configuration.
  const testEventCode = options.testEventCode?.trim() || undefined;
  if (!testEventCode && !options.liveEnabled) {
    return {
      ok: false,
      code: "meta_live_send_disabled",
      status: null,
      retryable: false,
    };
  }
  const payload = await buildMetaQualifiedPayload(signal, testEventCode);
  if (!payload) {
    return {
      ok: false,
      code: "meta_event_invalid",
      status: null,
      retryable: false,
    };
  }
  const url = new URL(
    `https://graph.facebook.com/${version}/${
      encodeURIComponent(config.pixelId)
    }/events`,
  );
  url.searchParams.set("access_token", config.accessToken);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (_error) {
    return {
      ok: false,
      code: "meta_network_error",
      status: null,
      retryable: true,
    };
  } finally {
    clearTimeout(timeout);
  }
  const responseBody = await response.json().catch(() => ({}));
  const classified = classifyMetaError(response.status, responseBody);
  const eventCount = responseBody && typeof responseBody === "object"
    ? (responseBody as Record<string, unknown>).events_received
    : null;
  const accepted = response.ok && eventCount === 1;
  const { error: logError } = await supabase.from("capi_signal_logs").insert({
    client_slug: signal.clientSlug,
    pixel_id: config.pixelId,
    event_name: "QualifiedLead",
    status_code: response.status,
    payload: {
      event_name: "QualifiedLead",
      event_id: signal.eventId,
      event_time: Math.floor(Date.parse(signal.qualifiedAt) / 1000),
      has_email: Boolean(signal.email),
      has_phone: Boolean(signal.phone),
      test_event: Boolean(testEventCode),
    },
    response: {
      accepted,
      error_class: classified.class,
      error_subcode: classified.subcode,
    },
  });
  if (logError) {
    return {
      ok: false,
      code: "meta_signal_log_failed",
      status: response.status,
      retryable: true,
    };
  }
  if (accepted) return { ok: true, status: response.status };
  return {
    ok: false,
    code: classified.class === "ok"
      ? "meta_zero_events_received"
      : classified.class,
    status: response.status,
    retryable: response.status === 429 || response.status >= 500 ||
      classified.class === "network_error",
  };
}
