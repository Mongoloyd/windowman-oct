/**
 * Derive follow-up readiness for CRM activity metadata (Sprint 1).
 * Stored in lead_events.metadata only — no new columns or queue tables.
 */

export type FollowupReadiness =
  | "follow_up_ready"
  | "high_intent_contact_missing"
  | "not_follow_up_ready";

const CONTACT_FORM_EVENTS = new Set([
  "truth_gate_captured",
  "nextdoor_lead_captured",
  "arbitrage_completed",
  "power_demo_submitted",
  "ai_demo_submitted",
]);

export function computeFollowupReadiness(args: {
  eventName: string;
  hasContact: boolean;
}): FollowupReadiness {
  const { eventName, hasContact } = args;

  if (eventName === "quote_uploaded") {
    return hasContact ? "follow_up_ready" : "high_intent_contact_missing";
  }

  if (CONTACT_FORM_EVENTS.has(eventName)) {
    return hasContact ? "follow_up_ready" : "not_follow_up_ready";
  }

  return "not_follow_up_ready";
}

export function hasLeadContact(args: {
  phone_e164?: string | null;
  email?: string | null;
}): boolean {
  const phone = typeof args.phone_e164 === "string"
    ? args.phone_e164.trim()
    : "";
  const email = typeof args.email === "string" ? args.email.trim() : "";
  return phone.length > 0 || email.length > 0;
}
