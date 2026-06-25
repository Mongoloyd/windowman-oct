import { WM_QUOTE_TRUST_MIN_FOR_DISPATCH } from "./constants.ts";
import { resolveGoogleClickIdentifiers } from "./resolveGoogleClickIdentifiers.ts";
import type { WMCanonicalEvent } from "./types.ts";

const GOOGLE_ACTION_MAP: Record<string, string> = {
  lead_identified: "wm_lead_identified",
  lead_qualified: "wm_lead_qualified",
  quote_uploaded: "wm_quote_uploaded",
  quote_upload_completed: "wm_quote_uploaded",
  quote_validation_passed: "wm_quote_validation_passed",
  // Arc 1.5: phone_verified + report_revealed had no Google mapping, which
  // silently suppressed every server canonical fire. Add canonical conversion
  // actions so the server lane can dispatch (deferred event remains excluded).
  phone_verified: "wm_phone_verified",
  report_revealed: "wm_report_revealed",
  appointment_booked: "wm_appointment_booked",
  sale_confirmed: "wm_sale_confirmed",
};

const QUOTE_QUALITY_EVENTS = new Set(["quote_validation_passed"]);

export interface GoogleMapperResult {
  suppressed: boolean;
  reason?: string;
  payload?: {
    conversion_action: string;
    transaction_id: string;
    conversion_date_time: string;
    conversion_value: number;
    currency_code: "USD";
    gclid?: string;
    gbraid?: string;
    wbraid?: string;
    user_identifiers?: {
      hashed_email?: string;
      hashed_phone_number?: string;
    };
  };
}

export interface MapToGoogleContext {
  attribution?: Record<string, unknown> | null;
  queryParams?: Record<string, unknown> | null;
}

export function mapToGoogle(
  canonical: WMCanonicalEvent,
  context?: MapToGoogleContext,
): GoogleMapperResult {
  if (!canonical.shouldSendGoogle) {
    return { suppressed: true, reason: "shouldSendGoogle_false" };
  }

  const action = GOOGLE_ACTION_MAP[canonical.eventName];
  if (!action) {
    return { suppressed: true, reason: "no_google_mapping" };
  }

  if (QUOTE_QUALITY_EVENTS.has(canonical.eventName)) {
    if (canonical.payload.analytics?.anomalyStatus !== "safe") {
      return { suppressed: true, reason: "unsafe_anomaly_status" };
    }

    if ((canonical.payload.analytics?.trustScore ?? 0) < WM_QUOTE_TRUST_MIN_FOR_DISPATCH) {
      return { suppressed: true, reason: "trust_below_threshold" };
    }
  }

  const identity = canonical.payload.identity;
  const clickIds = resolveGoogleClickIdentifiers({
    identity,
    attribution: context?.attribution,
    queryParams: context?.queryParams,
  });
  const hasClickId = Boolean(clickIds.gclid || clickIds.gbraid || clickIds.wbraid);
  const hasHashedPii = Boolean(identity.emailHash || identity.phoneHash);

  if (!hasClickId && !hasHashedPii) {
    return { suppressed: true, reason: "missing_attribution_identifiers" };
  }

  const payload: GoogleMapperResult["payload"] = {
    conversion_action: action,
    transaction_id: canonical.eventId,
    conversion_date_time: canonical.eventTimestamp,
    conversion_value: canonical.payload.optimization?.valueUsd ?? 0,
    currency_code: "USD",
  };

  if (clickIds.gclid) payload.gclid = clickIds.gclid;
  if (clickIds.gbraid) payload.gbraid = clickIds.gbraid;
  if (clickIds.wbraid) payload.wbraid = clickIds.wbraid;

  if (hasHashedPii) {
    const userIdentifiers: { hashed_email?: string; hashed_phone_number?: string } = {};
    if (identity.emailHash) userIdentifiers.hashed_email = identity.emailHash;
    if (identity.phoneHash) userIdentifiers.hashed_phone_number = identity.phoneHash;
    payload.user_identifiers = userIdentifiers;
  }

  return { suppressed: false, payload };
}
