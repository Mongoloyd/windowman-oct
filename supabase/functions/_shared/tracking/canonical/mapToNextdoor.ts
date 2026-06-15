import { WM_QUOTE_TRUST_MIN_FOR_DISPATCH } from "./constants.ts";
import type { WMCanonicalEvent, WMIdentityPayload } from "./types.ts";

const NEXTDOOR_EVENT_MAP: Record<string, string> = {
  lead_captured: "lead",
  lead_identified: "lead",
  lead_qualified: "lead",
  contractor_match_requested: "lead",
  phone_verified: "sign_up",
  quote_validation_passed: "sign_up",
  appointment_booked: "sign_up",
  report_revealed: "view_content",
  quote_uploaded: "initiate_checkout",
  quote_upload_completed: "initiate_checkout",
  sold: "purchase",
  sale_confirmed: "purchase",
  virtual_page_view: "page_view",
};

const QUOTE_QUALITY_EVENTS = new Set(["quote_validation_passed"]);

const OPTIMIZATION_ELIGIBLE_EVENTS = new Set([
  "lead_captured",
  "lead_identified",
  "lead_qualified",
  "quote_uploaded",
  "quote_upload_completed",
  "quote_validation_passed",
  "phone_verified",
  "report_revealed",
  "contractor_match_requested",
  "appointment_booked",
  "sold",
  "sale_confirmed",
]);

export interface NextdoorCustomerPayload {
  email?: string;
  phone_number?: string;
  external_id?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  click_id?: string;
}

export interface NextdoorCapiPayload {
  event_name: string;
  event_id: string;
  event_time_epoch: number;
  action_source: "website";
  action_source_url: string;
  data_source_id: string;
  delivery_optimization: boolean;
  customer: NextdoorCustomerPayload;
  custom?: {
    order_value?: number;
  };
}

export interface NextdoorMapperResult {
  suppressed: boolean;
  reason?: string;
  payload?: NextdoorCapiPayload;
}

function resolveClickId(
  identity: WMIdentityPayload,
  metadata?: Record<string, unknown>,
): string | undefined {
  if (identity.clickId?.trim()) return identity.clickId.trim();

  const ndclid = metadata?.ndclid;
  if (typeof ndclid === "string" && ndclid.trim()) return ndclid.trim();

  return undefined;
}

function buildCustomer(
  identity: WMIdentityPayload,
  metadata?: Record<string, unknown>,
): NextdoorCustomerPayload {
  const customer: NextdoorCustomerPayload = {};

  if (identity.emailHash) customer.email = identity.emailHash;
  if (identity.phoneHash) customer.phone_number = identity.phoneHash;
  if (identity.leadId) customer.external_id = identity.leadId;
  if (identity.clientIp) customer.client_ip_address = identity.clientIp;
  if (identity.userAgent) customer.client_user_agent = identity.userAgent;

  const clickId = resolveClickId(identity, metadata);
  if (clickId) customer.click_id = clickId;

  return customer;
}

function hasUsableCustomerMatch(customer: NextdoorCustomerPayload): boolean {
  return Boolean(
    customer.email ||
      customer.phone_number ||
      customer.external_id ||
      customer.click_id,
  );
}

function isMalformedPayload(payload: NextdoorCapiPayload): boolean {
  if (!payload.event_name.trim()) return true;
  if (!payload.event_id.trim()) return true;
  if (!Number.isFinite(payload.event_time_epoch)) return true;
  if (!payload.action_source_url.trim()) return true;
  if (!payload.data_source_id.trim()) return true;
  if (!hasUsableCustomerMatch(payload.customer)) return true;
  return false;
}

export function mapToNextdoor(
  canonical: WMCanonicalEvent,
  actionSourceUrl: string,
  dataSourceId: string,
): NextdoorMapperResult {
  if (canonical.shouldSendNextdoor !== true) {
    return { suppressed: true, reason: "shouldSendNextdoor_false" };
  }

  if (!canonical.eventId?.trim()) {
    return { suppressed: true, reason: "missing_event_id" };
  }

  if (!actionSourceUrl?.trim()) {
    return { suppressed: true, reason: "missing_action_source_url" };
  }

  if (!dataSourceId?.trim()) {
    return { suppressed: true, reason: "missing_data_source_id" };
  }

  const mappedEventName = NEXTDOOR_EVENT_MAP[canonical.eventName];
  if (!mappedEventName) {
    return { suppressed: true, reason: "unsupported_nextdoor_event_name" };
  }

  const analytics = canonical.payload.analytics;
  if (QUOTE_QUALITY_EVENTS.has(canonical.eventName)) {
    if (analytics?.anomalyStatus !== "safe") {
      return { suppressed: true, reason: "anomaly_unsafe" };
    }

    if ((analytics?.trustScore ?? 0) < WM_QUOTE_TRUST_MIN_FOR_DISPATCH) {
      return { suppressed: true, reason: "trust_below_threshold" };
    }
  }

  if (
    OPTIMIZATION_ELIGIBLE_EVENTS.has(canonical.eventName) &&
    (canonical.identityQuality === "low" || canonical.identityQuality === "unknown")
  ) {
    return { suppressed: true, reason: "identity_too_weak" };
  }

  const customer = buildCustomer(
    canonical.payload.identity,
    canonical.payload.metadata,
  );

  if (!hasUsableCustomerMatch(customer)) {
    return { suppressed: true, reason: "missing_customer" };
  }

  const eventTimeEpoch = Math.floor(
    new Date(canonical.eventTimestamp).getTime() / 1000,
  );

  const deliveryOptimization =
    canonical.eventName !== "virtual_page_view" &&
    OPTIMIZATION_ELIGIBLE_EVENTS.has(canonical.eventName) &&
    (canonical.identityQuality === "medium" || canonical.identityQuality === "high") &&
    hasUsableCustomerMatch(customer);

  const valueUsd = canonical.payload.optimization?.valueUsd;
  const payload: NextdoorCapiPayload = {
    event_name: mappedEventName,
    event_id: canonical.eventId,
    event_time_epoch: eventTimeEpoch,
    action_source: "website",
    action_source_url: actionSourceUrl.trim(),
    data_source_id: dataSourceId.trim(),
    delivery_optimization: deliveryOptimization,
    customer,
    ...(typeof valueUsd === "number" && Number.isFinite(valueUsd)
      ? { custom: { order_value: valueUsd } }
      : {}),
  };

  if (isMalformedPayload(payload)) {
    return { suppressed: true, reason: "malformed_payload" };
  }

  return { suppressed: false, payload };
}
