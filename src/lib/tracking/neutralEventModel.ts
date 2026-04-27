/**
 * neutralEventModel.ts — Platform-neutral event contract (Task 1 foundation).
 *
 * This file is intentionally vendor-agnostic. It does NOT import Meta /
 * Google / TikTok / GTM helpers, does NOT call Supabase, does NOT touch
 * `window.dataLayer`, and does NOT read secrets. It only defines a
 * platform-neutral TypeScript view of the WindowMan canonical event so the
 * future dispatch / admin / attribution layers can consume one shape and
 * vendor-specific mappers stay isolated downstream.
 *
 * Relationship to existing canonical types:
 *   - `WMCanonicalEvent` (./canonical/types.ts) is the persisted shape that
 *     `wm_event_log` already mirrors. It carries platform-specific booleans
 *     (`shouldSendMeta`, `shouldSendGoogle`).
 *   - `NeutralEvent` (this file) is a downstream view that drops the
 *     per-platform booleans and replaces them with a single neutral
 *     `dispatchEligible` + `dispatchBlockReason` pair plus an explicit
 *     `clientSlug` / `sourcePlatform` / `sourceChannel` axis.
 *
 * Why a facade and not a rename?
 *   - The canonical persisted shape is in production via `wm_event_log` +
 *     `wm_platform_dispatch_log`. Renaming columns or types would require
 *     migrations and dispatcher rewrites — explicitly out of scope for
 *     Task 1.
 *   - Future tasks (admin Event Inspector, TikTok / GTM-Server dispatchers,
 *     attribution model exporter) will build on top of this facade so they
 *     never have to import a vendor-specific helper to reason about the
 *     event itself.
 */

// ── Event names ─────────────────────────────────────────────────────────────

/**
 * The canonical event-name ladder for WindowMan. Mirrors the union accepted
 * by `wm_event_name` (DB) and `WM_EVENT_NAMES` (canonical TS constants), but
 * is intentionally *not* imported from there — this module is the public
 * neutral contract surface and must not depend on the persisted/legacy
 * identifiers.
 *
 * IMPORTANT: this list is the *recommended* ladder for future dispatch.
 * Live producers continue to fire the existing legacy names for now; the
 * canonical layer absorbs the duplicates (see `QUOTE_EVENTS` in
 * `createCanonicalEvent.ts`). Renaming is a future task.
 */
export const NEUTRAL_EVENT_NAMES = [
  "lead_captured",
  "phone_verified",
  "quote_uploaded",
  "scan_completed",
  "report_revealed",
  "contractor_match_requested",
  "appointment_booked",
  "sold_closed",
] as const;

export type NeutralEventName = (typeof NEUTRAL_EVENT_NAMES)[number];

/**
 * Aliases observed in the existing canonical/legacy ladder. Mapped here so
 * future dispatch resolution can collapse duplicates without renaming live
 * producers.
 *
 *   - `quote_validation_passed` and `quote_upload_completed` collapse to
 *     `quote_uploaded` because they describe the same business moment.
 *   - `lead_identified` / `lead_qualified` collapse to `lead_captured`.
 *   - `sale_confirmed` / `sold` collapse to `sold_closed`.
 *
 * Anything not listed here is treated as an unknown alias and surfaced via
 * `normalizeNeutralEventName` returning `null`.
 */
const NEUTRAL_EVENT_ALIASES: Record<string, NeutralEventName> = {
  lead_captured: "lead_captured",
  lead_identified: "lead_captured",
  lead_qualified: "lead_captured",
  phone_verified: "phone_verified",
  quote_uploaded: "quote_uploaded",
  quote_upload_completed: "quote_uploaded",
  quote_validation_passed: "quote_uploaded",
  scan_completed: "scan_completed",
  report_revealed: "report_revealed",
  contractor_match_requested: "contractor_match_requested",
  appointment_booked: "appointment_booked",
  sold: "sold_closed",
  sale_confirmed: "sold_closed",
  sold_closed: "sold_closed",
};

// ── Categorization axis ─────────────────────────────────────────────────────

/**
 * Coarse grouping used by future dispatchers and the admin Event Inspector
 * to decide *where* an event matters. Independent of platform.
 *
 *   - `funnel`     — homeowner-facing milestones (lead_captured, sold_closed)
 *   - `attribution`— signals carried only for matching/identity (rare)
 *   - `audit`      — internal lifecycle/admin actions
 *   - `traffic`    — page-view / surface engagement
 */
export type NeutralEventCategory = "funnel" | "attribution" | "audit" | "traffic";

const NEUTRAL_EVENT_CATEGORY: Record<NeutralEventName, NeutralEventCategory> = {
  lead_captured: "funnel",
  phone_verified: "funnel",
  quote_uploaded: "funnel",
  scan_completed: "funnel",
  report_revealed: "funnel",
  contractor_match_requested: "funnel",
  appointment_booked: "funnel",
  sold_closed: "funnel",
};

// ── Source platform / channel ───────────────────────────────────────────────

/**
 * Where the *upstream signal* originated. This is independent of any
 * destination platform — it captures the surface that produced the
 * canonical event so attribution code does not have to re-derive it.
 */
export type NeutralEventSource =
  | "browser"
  | "edge_function"
  | "internal_admin"
  | "webhook"
  | "import"
  | "unknown";

// ── Dispatch eligibility ────────────────────────────────────────────────────

/**
 * Reasons a neutral event should NOT be forwarded to any external
 * destination. Mirrors but is intentionally broader than the per-platform
 * suppression reasons currently in `mapToMeta` / `mapToGoogle`.
 *
 * The string values are stable identifiers — admin surfaces / dashboards
 * may key on them.
 */
export type NeutralDispatchBlockReason =
  | "identity_too_weak"
  | "anomaly_unsafe"
  | "trust_below_threshold"
  | "missing_event_id"
  | "missing_client_slug"
  | "manual_review_required"
  | "destination_not_configured"
  | "non_dispatchable_event"
  | "unknown_event_name";

// ── Neutral event contract ──────────────────────────────────────────────────

/**
 * Platform-neutral view of one canonical business event. Every field is
 * intentionally typed to be safe to render in an admin surface or to log
 * to internal storage; no field carries raw Meta/Google/TikTok/GTM-specific
 * payloads.
 */
export interface NeutralEvent {
  /** Stable, deterministic event id — used downstream as Meta `eventID`,
   *  GA4 `transaction_id`, TikTok `event_id`, etc. Caller is responsible
   *  for producing this via `buildCanonicalEventId`. */
  canonicalEventId: string;

  /** Normalized neutral event name (one of `NEUTRAL_EVENT_NAMES`). */
  eventName: NeutralEventName;

  /** Coarse category for routing/UI grouping. */
  eventCategory: NeutralEventCategory;

  /** Where the event originated upstream (browser / server / admin / etc.). */
  eventSource: NeutralEventSource;

  /** ISO-8601 occurrence timestamp. */
  eventTime: string;

  /** Tenant ownership. NULL only when pre-attribution / unknown traffic. */
  clientSlug: string | null;

  /** Optional originating ad/traffic platform label captured from UTM/clicks
   *  (e.g. "meta", "google", "tiktok", "organic"). Independent of the
   *  *destination* platform list — that's resolved later via `client_configs`. */
  sourcePlatform: string | null;
  /** Channel within the source platform (e.g. "paid", "organic", "email"). */
  sourceChannel: string | null;

  /** Foreign keys into the WM data model — all optional. */
  leadId: string | null;
  scanSessionId: string | null;
  analysisId: string | null;
  quoteFileId: string | null;

  /** UTM snapshot — already platform-neutral by definition. */
  utm: {
    source: string | null;
    medium: string | null;
    campaign: string | null;
    term: string | null;
    content: string | null;
  };

  /** Click/cookie attribution flags. Booleans only — the actual values are
   *  carried inside the canonical identity payload, never bubbled up here. */
  attribution: {
    fbclidPresent: boolean;
    gclidPresent: boolean;
    fbcPresent: boolean;
    fbpPresent: boolean;
  };

  /** Optimization economics. Integer cents to avoid float drift. */
  valueCents: number | null;
  currency: string | null;

  /** Single neutral dispatch flag computed without consulting any platform
   *  destination config. `false` means *no* destination should send it,
   *  regardless of vendor configuration. */
  dispatchEligible: boolean;
  dispatchBlockReason: NeutralDispatchBlockReason | null;

  /** Free-form context, must NOT contain raw PII, raw quote files, partner
   *  commission terms, or any internal resale logic. */
  metadata: Record<string, unknown>;
}

// ── Pure helpers ────────────────────────────────────────────────────────────

/**
 * Map a legacy / canonical event name to its neutral ladder name. Returns
 * null for unknown identifiers so callers can decide whether to surface a
 * `unknown_event_name` dispatch block reason vs ignore the event entirely.
 */
export function normalizeNeutralEventName(input: string | null | undefined): NeutralEventName | null {
  if (!input || typeof input !== "string") return null;
  const key = input.trim().toLowerCase();
  if (key.length === 0) return null;
  return NEUTRAL_EVENT_ALIASES[key] ?? null;
}

/**
 * Produce the neutral category for a normalized event name. Always falls
 * back to `"audit"` so the dispatcher never operates on `undefined`.
 */
export function neutralEventCategoryOf(name: NeutralEventName): NeutralEventCategory {
  return NEUTRAL_EVENT_CATEGORY[name] ?? "audit";
}

/**
 * Inputs accepted by `buildNeutralEventDraft`. Intentionally tolerant of
 * partial information — callers may stitch the draft together from
 * separate sources (UTM capture, server canonical row, admin form).
 */
export interface BuildNeutralEventInput {
  canonicalEventId: string;
  eventName: string;
  eventTime?: string | Date;
  eventSource?: NeutralEventSource;
  clientSlug?: string | null;
  leadId?: string | null;
  scanSessionId?: string | null;
  analysisId?: string | null;
  quoteFileId?: string | null;
  utm?: {
    source?: string | null;
    medium?: string | null;
    campaign?: string | null;
    term?: string | null;
    content?: string | null;
  } | null;
  attribution?: {
    fbclid?: string | null;
    gclid?: string | null;
    fbc?: string | null;
    fbp?: string | null;
  } | null;
  sourcePlatform?: string | null;
  sourceChannel?: string | null;
  valueCents?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Pure constructor: no I/O, no randomness beyond Date.now() fallback for
 * `eventTime`. Returns the neutral event contract pre-eligibility-check.
 *
 * Caller is responsible for invoking `evaluateDispatchEligibilityDraft`
 * separately so the eligibility decision is auditable and testable in
 * isolation from the assembly step.
 */
export function buildNeutralEventDraft(input: BuildNeutralEventInput): NeutralEvent {
  const normalizedName = normalizeNeutralEventName(input.eventName);

  const eventTimeIso = (() => {
    if (!input.eventTime) return new Date().toISOString();
    if (input.eventTime instanceof Date) return input.eventTime.toISOString();
    const parsed = Date.parse(input.eventTime);
    return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
  })();

  const utm = input.utm ?? null;
  const attribution = input.attribution ?? null;

  // Use a sentinel "unknown" name path so the rest of the contract still
  // type-checks. Eligibility evaluation will mark this as
  // `unknown_event_name` and block dispatch.
  const safeName: NeutralEventName = normalizedName ?? "lead_captured";

  return {
    canonicalEventId: input.canonicalEventId,
    eventName: safeName,
    eventCategory: normalizedName ? neutralEventCategoryOf(safeName) : "audit",
    eventSource: input.eventSource ?? "unknown",
    eventTime: eventTimeIso,
    clientSlug: input.clientSlug ?? null,
    sourcePlatform: input.sourcePlatform ?? null,
    sourceChannel: input.sourceChannel ?? null,
    leadId: input.leadId ?? null,
    scanSessionId: input.scanSessionId ?? null,
    analysisId: input.analysisId ?? null,
    quoteFileId: input.quoteFileId ?? null,
    utm: {
      source: utm?.source ?? null,
      medium: utm?.medium ?? null,
      campaign: utm?.campaign ?? null,
      term: utm?.term ?? null,
      content: utm?.content ?? null,
    },
    attribution: {
      fbclidPresent: Boolean(attribution?.fbclid),
      gclidPresent: Boolean(attribution?.gclid),
      fbcPresent: Boolean(attribution?.fbc),
      fbpPresent: Boolean(attribution?.fbp),
    },
    valueCents:
      typeof input.valueCents === "number" && Number.isFinite(input.valueCents)
        ? Math.trunc(input.valueCents)
        : null,
    currency: input.currency ?? null,
    // Dispatch eligibility is computed in a separate pass so it can be
    // audited / tested in isolation. Default optimistic; the evaluator
    // will tighten this down using the inputs below.
    dispatchEligible: true,
    dispatchBlockReason: normalizedName ? null : "unknown_event_name",
    metadata: input.metadata ?? {},
  };
}

/**
 * Inputs to `evaluateDispatchEligibilityDraft`. Intentionally narrow:
 * eligibility cares about identity quality, anomaly status, manual-review
 * flags, and tenant configuration — not about the event payload itself.
 */
export interface EvaluateDispatchEligibilityInput {
  identityQuality: "high" | "medium" | "low" | "unknown";
  anomalyStatus?: "safe" | "review" | "quarantine" | "reject" | null;
  trustScore?: number | null;
  manualReviewRequired?: boolean;
  hasClientSlug: boolean;
  hasConfiguredDestination: boolean;
  /** Set true for events whose neutral category is not dispatchable
   *  (e.g. `traffic` page-view fires that should never be forwarded
   *  server-side). */
  isDispatchableCategory: boolean;
  /** Pre-computed: the normalized neutral event name was unknown. */
  unknownEventName?: boolean;
  /** Pre-computed: caller did not supply a stable canonical event id. */
  missingEventId?: boolean;
  /** Trust threshold — defaults to the canonical 0.78 used by the existing
   *  Meta/Google mappers. Pass through for testability. */
  trustMin?: number;
}

export interface EvaluateDispatchEligibilityResult {
  dispatchEligible: boolean;
  dispatchBlockReason: NeutralDispatchBlockReason | null;
}

/**
 * Pure eligibility evaluator. Returns the *neutral* dispatch flag — it does
 * NOT decide which destinations actually receive the event. Per-destination
 * suppression (vendor mapping, missing pixel/conversion ID, etc.) stays in
 * the existing `mapToMeta` / `mapToGoogle` (and future `mapToTikTok` /
 * `mapToGtmServer`) helpers.
 *
 * Order of checks is deliberate: structural problems (missing id, unknown
 * name) before policy problems (identity weak, anomaly unsafe) before
 * configuration problems (no destination configured). The first failing
 * check wins so the surfaced reason is the *root* block.
 */
export function evaluateDispatchEligibilityDraft(
  input: EvaluateDispatchEligibilityInput,
): EvaluateDispatchEligibilityResult {
  if (input.missingEventId) {
    return { dispatchEligible: false, dispatchBlockReason: "missing_event_id" };
  }
  if (input.unknownEventName) {
    return { dispatchEligible: false, dispatchBlockReason: "unknown_event_name" };
  }
  if (!input.isDispatchableCategory) {
    return { dispatchEligible: false, dispatchBlockReason: "non_dispatchable_event" };
  }
  if (!input.hasClientSlug) {
    return { dispatchEligible: false, dispatchBlockReason: "missing_client_slug" };
  }
  if (input.identityQuality === "low" || input.identityQuality === "unknown") {
    return { dispatchEligible: false, dispatchBlockReason: "identity_too_weak" };
  }
  if (input.anomalyStatus && input.anomalyStatus !== "safe") {
    return { dispatchEligible: false, dispatchBlockReason: "anomaly_unsafe" };
  }
  if (input.manualReviewRequired) {
    return { dispatchEligible: false, dispatchBlockReason: "manual_review_required" };
  }
  const minTrust = input.trustMin ?? 0.78;
  if (typeof input.trustScore === "number" && input.trustScore < minTrust) {
    return { dispatchEligible: false, dispatchBlockReason: "trust_below_threshold" };
  }
  if (!input.hasConfiguredDestination) {
    return { dispatchEligible: false, dispatchBlockReason: "destination_not_configured" };
  }
  return { dispatchEligible: true, dispatchBlockReason: null };
}

// ── Attribution masking (logging-safe) ──────────────────────────────────────

/**
 * Shape of attribution identifiers the neutral logger may receive. All
 * fields optional. Raw values are *only* used to derive presence + length;
 * the function never echoes them back.
 */
export interface AttributionMaskInput {
  email?: string | null;
  phone?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  externalId?: string | null;
}

export interface MaskedAttribution {
  emailPresent: boolean;
  emailLength: number;
  phonePresent: boolean;
  phoneLength: number;
  fbclidPresent: boolean;
  gclidPresent: boolean;
  fbcPresent: boolean;
  fbpPresent: boolean;
  externalIdPresent: boolean;
}

/**
 * Convert an attribution bundle into a logging-safe, PII-free description.
 * Use this *before* writing any attribution context into admin surfaces or
 * structured logs. Keeps the platform-neutral plane honest about what
 * leaves the trust boundary.
 */
export function maskAttributionIds(input: AttributionMaskInput): MaskedAttribution {
  const lenOf = (value: string | null | undefined): number =>
    typeof value === "string" ? value.length : 0;
  return {
    emailPresent: Boolean(input.email),
    emailLength: lenOf(input.email),
    phonePresent: Boolean(input.phone),
    phoneLength: lenOf(input.phone),
    fbclidPresent: Boolean(input.fbclid),
    gclidPresent: Boolean(input.gclid),
    fbcPresent: Boolean(input.fbc),
    fbpPresent: Boolean(input.fbp),
    externalIdPresent: Boolean(input.externalId),
  };
}
