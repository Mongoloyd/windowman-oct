/**
 * events.ts — Canonical Business Event Definitions
 *
 * Single source of truth for all business events pushed to window.dataLayer.
 * GTM consumes these and routes to vendor tags (Meta, GA4, Google Ads, etc.).
 *
 * The frontend NEVER calls vendor SDKs directly — only these canonical events.
 */

export const BUSINESS_EVENTS = {
  /** SPA route change (fired by AppTrackingProvider) */
  virtual_page_view: "virtual_page_view",

  /** Truth Gate section visible after quote-ready handoff (#truth-gate) */
  truth_gate_viewed: "truth_gate_viewed",

  /** /windowman quote-ready CTA before homepage handoff */
  windowman_handoff_has_quote: "windowman_handoff_has_quote",

  /** /windowman first-quote intake modal opened */
  first_quote_modal_opened: "first_quote_modal_opened",

  /** User selects a file in UploadZone (before upload begins) */
  scan_initiated: "scan_initiated",

  /** Quote file successfully uploaded and scan session created */
  quote_uploaded: "quote_uploaded",

  /** User submits phone number to begin OTP flow */
  otp_started: "otp_started",

  /** OTP SMS successfully dispatched by backend */
  otp_sent: "otp_sent",

  /** User completes SMS OTP verification */
  phone_verified: "phone_verified",

  /** Locked/teaser report preview rendered on screen */
  teaser_viewed: "teaser_viewed",

  /** Full Truth Report unlocked and displayed post-OTP */
  report_revealed: "report_revealed",

  /** User clicks "Get a Counter-Quote" / contractor match CTA */
  contractor_match_requested: "contractor_match_requested",

  /** Lead status changed to appointment (admin action) */
  appointment_booked: "appointment_booked",

  /** Deal closed (admin action) */
  sold: "sold",
} as const;

/** Union type of all canonical event names */
export type BusinessEventName =
  (typeof BUSINESS_EVENTS)[keyof typeof BUSINESS_EVENTS];

/** Shape of every payload pushed to window.dataLayer */
export interface BusinessEventPayload {
  /** The canonical event name */
  event: BusinessEventName;
  /** Unique ID for cross-platform deduplication (GTM → Meta eventID, GA4 transaction_id, etc.) */
  event_id: string;
  /** Persistent visitor UUID from useLeadId */
  lead_id: string;
  /** Current route path at time of event */
  route: string;
  /** UTM / click-ID attribution snapshot */
  utm: Record<string, string>;
  /** ISO-8601 timestamp */
  wm_timestamp: string;
  /** Extensible metadata (scan_session_id, grade, county, etc.) */
  [key: string]: unknown;
}
