/**
 * mapToTikTok — Pure CRM/canonical → TikTok event-ladder mapping contract.
 *
 * SCOPE (Sprint 1): This is the FOUNDATIONAL translation layer only. It maps a
 * WindowMan canonical/CRM source event name to a TikTok-ready internal mapping
 * contract. It is NOT a live TikTok Events API payload and performs NO dispatch.
 *
 * INTENTIONALLY ABSENT (do not add here):
 *   - No `fetch` / TikTok Events API endpoint calls.
 *   - No browser pixel (`ttq`) calls.
 *   - No PII hashing (the sender/worker layer owns hashing later).
 *   - No final API payload assembly with secrets / pixel IDs / tokens.
 *   - No outbox enqueue, no CRM or paid-media table mutation.
 *   - No `console.log` or other side effects.
 *
 * LOCKSTEP: This file is duplicated verbatim at
 * `src/lib/tracking/canonical/mapToTikTok.ts`. The two copies exist because the
 * Supabase edge bundler does not ship arbitrary `src/` paths to deployed
 * functions (same rationale as the canonical dispatch worker mirror). Keep the
 * types and mapping table byte-identical between the two. Runtime wiring is
 * intentionally absent from BOTH copies in this sprint.
 *
 * DEDUPE / DISPATCH POLICY (future work, documented in
 * `docs/tracking/TIKTOK_EVENT_LADDER.md`):
 *   - Future live dispatch must reuse the canonical `wm_event_log.event_id` for
 *     TikTok deduplication — never a randomly generated id.
 *   - Future live dispatch must extend the existing outbox/worker pattern, not
 *     dispatch directly from capture Edge Functions.
 *   - `lead_events` is CRM truth; `wm_event_log` is paid-media dispatch truth.
 */

/** Canonical / CRM source event names that participate in the TikTok ladder. */
export type WindowManTikTokSourceEvent =
  | "truth_gate_captured"
  | "lead_captured"
  | "quote_uploaded"
  | "report_revealed"
  | "report_unlocked"
  | "contractor_match_requested"
  | "contractor_intro_requested"
  | "appointment_booked"
  | "appointment_scheduled"
  | "sold"
  | "won";

/**
 * Whether the resolved TikTok event name is a TikTok standard event
 * (recognized by TikTok's optimization models) or a WindowMan custom event.
 */
export type TikTokEventKind = "standard" | "custom";

/**
 * Funnel optimization tier — a WindowMan-internal severity/intent ordering used
 * to reason about which events are worth optimizing toward. Not a TikTok field.
 */
export type TikTokOptimizationTier =
  | "lead"
  | "high_intent"
  | "verified_demand"
  | "sales_ready"
  | "scheduled"
  | "revenue";

export interface TikTokMappedEvent {
  /** The originating WindowMan canonical/CRM event name. */
  sourceEvent: WindowManTikTokSourceEvent;
  /** The TikTok event name this maps to (standard or custom). */
  tiktokEventName: string;
  /** Standard vs custom TikTok event classification. */
  kind: TikTokEventKind;
  /** WindowMan-internal optimization tier for this funnel moment. */
  recommendedOptimizationTier: TikTokOptimizationTier;
  /**
   * Always true: every event in this ladder represents a server-confirmed
   * business moment and must only ever be dispatched after backend success.
   */
  requiresServerConfirmation: true;
  /** Optional human-readable note about the mapping decision. */
  notes?: string;
}

interface LadderEntry {
  tiktokEventName: string;
  kind: TikTokEventKind;
  recommendedOptimizationTier: TikTokOptimizationTier;
  notes?: string;
}

/**
 * Canonical CRM/source → TikTok ladder.
 *
 * Standard TikTok events: SubmitForm, Contact, Schedule, CompletePayment.
 * Custom WindowMan events:  UploadQuote, UnlockReport.
 *
 * `report_revealed` is the canonical PAID-MEDIA truth for the unlock moment
 * (it is the server-issued canonical event in `verify-otp`), while
 * `report_unlocked` is an internal telemetry alias kept here for completeness.
 * Both map to UnlockReport.
 */
const TIKTOK_EVENT_LADDER: Record<WindowManTikTokSourceEvent, LadderEntry> = {
  truth_gate_captured: {
    tiktokEventName: "SubmitForm",
    kind: "standard",
    recommendedOptimizationTier: "lead",
    notes: "Front-door contact capture (truth gate).",
  },
  lead_captured: {
    tiktokEventName: "SubmitForm",
    kind: "standard",
    recommendedOptimizationTier: "lead",
    notes: "Canonical lead capture alias of the truth-gate moment.",
  },
  quote_uploaded: {
    tiktokEventName: "UploadQuote",
    kind: "custom",
    recommendedOptimizationTier: "high_intent",
    notes: "Custom event: homeowner uploaded a quote for scanning.",
  },
  report_revealed: {
    tiktokEventName: "UnlockReport",
    kind: "custom",
    recommendedOptimizationTier: "verified_demand",
    notes:
      "Custom event: preferred paid-media truth for the unlock moment (server-issued canonical event).",
  },
  report_unlocked: {
    tiktokEventName: "UnlockReport",
    kind: "custom",
    recommendedOptimizationTier: "verified_demand",
    notes:
      "Internal telemetry alias of report_revealed; prefer report_revealed for paid-media truth.",
  },
  contractor_match_requested: {
    tiktokEventName: "Contact",
    kind: "standard",
    recommendedOptimizationTier: "sales_ready",
    notes: "Homeowner requested a contractor match / counter-quote.",
  },
  contractor_intro_requested: {
    tiktokEventName: "Contact",
    kind: "standard",
    recommendedOptimizationTier: "sales_ready",
    notes: "Alias of contractor_match_requested for intro-request phrasing.",
  },
  appointment_booked: {
    tiktokEventName: "Schedule",
    kind: "standard",
    recommendedOptimizationTier: "scheduled",
    notes: "Appointment confirmed for the lead.",
  },
  appointment_scheduled: {
    tiktokEventName: "Schedule",
    kind: "standard",
    recommendedOptimizationTier: "scheduled",
    notes: "Alias of appointment_booked.",
  },
  sold: {
    tiktokEventName: "CompletePayment",
    kind: "standard",
    recommendedOptimizationTier: "revenue",
    notes: "Deal closed / sold — revenue moment.",
  },
  won: {
    tiktokEventName: "CompletePayment",
    kind: "standard",
    recommendedOptimizationTier: "revenue",
    notes: "Alias of sold (deal_status = won).",
  },
};

function isKnownSourceEvent(
  value: string,
): value is WindowManTikTokSourceEvent {
  return Object.prototype.hasOwnProperty.call(TIKTOK_EVENT_LADDER, value);
}

/**
 * Map a WindowMan canonical/CRM source event name to its TikTok ladder entry.
 *
 * Pure: returns a fresh object for known events, or `null` for any unknown
 * event. NEVER throws.
 */
export function mapToTikTok(sourceEvent: string): TikTokMappedEvent | null {
  if (!isKnownSourceEvent(sourceEvent)) {
    return null;
  }

  const entry = TIKTOK_EVENT_LADDER[sourceEvent];

  return {
    sourceEvent,
    tiktokEventName: entry.tiktokEventName,
    kind: entry.kind,
    recommendedOptimizationTier: entry.recommendedOptimizationTier,
    requiresServerConfirmation: true,
    notes: entry.notes,
  };
}

/** Read-only list of source events this mapper knows about (for tests/tools). */
export const TIKTOK_LADDER_SOURCE_EVENTS = Object.keys(
  TIKTOK_EVENT_LADDER,
) as WindowManTikTokSourceEvent[];
