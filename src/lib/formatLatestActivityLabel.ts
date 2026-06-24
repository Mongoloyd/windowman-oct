/**
 * Human-readable labels for leads.latest_activity_type in the admin Lead Inbox.
 */

const KNOWN_ACTIVITY_LABELS: Record<string, string> = {
  truth_gate_captured: "TruthGate submitted",
  nextdoor_lead_captured: "Nextdoor lead captured",
  arbitrage_completed: "Arbitrage intake completed",
  power_demo_submitted: "Power demo submitted",
  ai_demo_submitted: "AI demo submitted",
  quote_uploaded: "Quote uploaded",
  demo_viewed: "Demo viewed",
  scan_completed: "Scan completed",
  report_unlocked: "Report unlocked",
  appointment_booked: "Appointment booked",
  crm_handoff_queued: "CRM handoff queued",
  lead_captured: "Lead captured",
  otp_verified: "Phone verified",
};

function titleCaseFallback(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function formatLatestActivityLabel(
  latestActivityType: string | null | undefined,
): string {
  if (!latestActivityType?.trim()) return "No activity yet";
  const known = KNOWN_ACTIVITY_LABELS[latestActivityType];
  if (known) return known;
  return titleCaseFallback(latestActivityType);
}
