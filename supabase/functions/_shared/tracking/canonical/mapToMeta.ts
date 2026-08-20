import { WM_QUOTE_TRUST_MIN_FOR_DISPATCH } from "./constants.ts";
import type { WMCanonicalEvent } from "./types.ts";

const META_EVENT_MAP: Record<string, string> = {
  lead_captured: "Lead",
  lead_identified: "Lead",
  lead_qualified: "Lead",
  quote_uploaded: "SubmitApplication",
  quote_upload_completed: "SubmitApplication",
  quote_validation_passed: "CompleteRegistration",
  // Arc 1.5: phone_verified + report_revealed had no Meta mapping, which silently
  // suppressed every server canonical fire. Mapped to standard Meta events so the
  // server lane can actually dispatch (not to invent value, but to enable parity).
  phone_verified: "CompleteRegistration",
  report_revealed: "ViewContent",
  callback_requested: "Contact",
  appointment_booked: "Schedule",
  sale_confirmed: "Purchase",
};

const QUOTE_QUALITY_EVENTS = new Set(["quote_validation_passed"]);

export interface MetaMapperResult {
  suppressed: boolean;
  reason?: string;
  payload?: {
    event_name: string;
    event_time: number;
    event_id: string;
    action_source: "website";
    event_source_url: string;
    user_data: Record<string, string>;
    custom_data?: Record<string, unknown>;
  };
}

export function mapToMeta(
  canonical: WMCanonicalEvent,
  eventSourceUrl: string,
): MetaMapperResult {
  if (!canonical.shouldSendMeta) {
    return { suppressed: true, reason: "shouldSendMeta_false" };
  }

  const mappedEvent = META_EVENT_MAP[canonical.eventName];
  if (!mappedEvent) return { suppressed: true, reason: "no_meta_mapping" };

  const analytics = canonical.payload.analytics;
  if (QUOTE_QUALITY_EVENTS.has(canonical.eventName)) {
    if (analytics?.anomalyStatus !== "safe") {
      return { suppressed: true, reason: "unsafe_anomaly_status" };
    }
    if ((analytics?.trustScore ?? 0) < WM_QUOTE_TRUST_MIN_FOR_DISPATCH) {
      return { suppressed: true, reason: "trust_below_threshold" };
    }
  }

  if (
    canonical.identityQuality === "low" ||
    canonical.identityQuality === "unknown"
  ) {
    return { suppressed: true, reason: "identity_too_weak" };
  }

  const userData: Record<string, string> = {};
  const identity = canonical.payload.identity;

  if (identity.emailHash) userData.em = identity.emailHash;
  if (identity.phoneHash) userData.ph = identity.phoneHash;
  if (identity.fbc) userData.fbc = identity.fbc;
  if (identity.fbp) userData.fbp = identity.fbp;
  if (identity.leadId) userData.external_id = identity.leadId;
  if (identity.clientIp) userData.client_ip_address = identity.clientIp;
  if (identity.userAgent) userData.client_user_agent = identity.userAgent;

  if (!userData.em && !userData.ph && !userData.external_id && !userData.fbc) {
    return { suppressed: true, reason: "insufficient_user_data" };
  }

  return {
    suppressed: false,
    payload: {
      event_name: mappedEvent,
      event_time: Math.floor(
        new Date(canonical.eventTimestamp).getTime() / 1000,
      ),
      event_id: canonical.eventId,
      action_source: "website",
      event_source_url: eventSourceUrl,
      user_data: userData,
      custom_data: {
        value: canonical.payload.optimization?.valueUsd,
        currency: "USD",
        event_name_internal: canonical.eventName,
      },
    },
  };
}
