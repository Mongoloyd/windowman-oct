/**
 * Server-side consent request validation for capture-truth-gate-lead and related paths.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_VERSION_LEN = 32;
const MAX_SOURCE_LEN = 64;
const MAX_DISCLOSURE_LEN = 32;

const PURPOSES = new Set([
  "service_communications",
  "advertising_measurement",
  "marketing_communications",
  "contractor_sharing",
]);

const DECISIONS = new Set(["granted", "declined", "withdrawn"]);

/** Sources that collect first-party contact and require service authorization. */
export const SERVICE_COMMUNICATIONS_REQUIRED_SOURCES = new Set<string>([
  "truth-gate",
  "nextdoor",
  "windowman-first-quote",
  "google_window_prices",
  "nextdoor_truth_report",
  "window_price_audit",
  "truth_report_demo",
  "ai_demo",
  "google_quote_check",
]);

export type ParsedConsentRequest = {
  schemaVersion: "1";
  submissionId: string;
  privacyPolicyVersion: string;
  termsVersion: string;
  source: string;
  events: Array<{
    purpose: string;
    decision: string;
    disclosureVersion: string;
  }>;
};

export type AdvertisingMeasurementConsentState =
  | "granted"
  | "denied"
  | "unknown";

export function resolveAdvertisingMeasurementConsent(
  consent: ParsedConsentRequest,
): AdvertisingMeasurementConsentState {
  const event = consent.events.find(
    (candidate) => candidate.purpose === "advertising_measurement",
  );
  if (event?.decision === "granted") return "granted";
  if (event?.decision === "declined" || event?.decision === "withdrawn") {
    return "denied";
  }
  return "unknown";
}

export function validateConsentRequest(
  raw: unknown,
  expectedSource: string,
):
  | { ok: true; consent: ParsedConsentRequest }
  | { ok: false; code: string; message: string } {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {
      ok: false,
      code: "invalid_consent",
      message: "Consent envelope is required.",
    };
  }

  const c = raw as Record<string, unknown>;

  if (c.schemaVersion !== "1") {
    return {
      ok: false,
      code: "invalid_consent_schema",
      message: "Unsupported consent schema version.",
    };
  }

  const submissionId = typeof c.submissionId === "string" ? c.submissionId : "";
  if (!UUID_RE.test(submissionId)) {
    return {
      ok: false,
      code: "invalid_submission_id",
      message: "submissionId must be a valid UUID.",
    };
  }

  const source = trimMax(c.source, MAX_SOURCE_LEN);
  if (!source || source !== expectedSource) {
    return {
      ok: false,
      code: "invalid_consent_source",
      message: "Consent source does not match capture source.",
    };
  }

  const privacyPolicyVersion = trimMax(c.privacyPolicyVersion, MAX_VERSION_LEN);
  const termsVersion = trimMax(c.termsVersion, MAX_VERSION_LEN);
  if (!privacyPolicyVersion || !termsVersion) {
    return {
      ok: false,
      code: "invalid_consent_versions",
      message: "Policy version fields are required.",
    };
  }

  if (!Array.isArray(c.events) || c.events.length === 0) {
    return {
      ok: false,
      code: "invalid_consent_events",
      message: "At least one consent event is required.",
    };
  }

  const purposesSeen = new Set<string>();
  const events: ParsedConsentRequest["events"] = [];

  for (const item of c.events) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        ok: false,
        code: "invalid_consent_event",
        message: "Malformed consent event.",
      };
    }
    const ev = item as Record<string, unknown>;
    const purpose = trimMax(ev.purpose, 64);
    const decision = trimMax(ev.decision, 32);
    const disclosureVersion = trimMax(ev.disclosureVersion, MAX_DISCLOSURE_LEN);

    if (!purpose || !PURPOSES.has(purpose)) {
      return {
        ok: false,
        code: "invalid_consent_purpose",
        message: "Unknown consent purpose.",
      };
    }
    if (!decision || !DECISIONS.has(decision)) {
      return {
        ok: false,
        code: "invalid_consent_decision",
        message: "Unknown consent decision.",
      };
    }
    if (!disclosureVersion) {
      return {
        ok: false,
        code: "invalid_disclosure_version",
        message: "Disclosure version is required.",
      };
    }
    if (purposesSeen.has(purpose)) {
      return {
        ok: false,
        code: "duplicate_consent_purpose",
        message: "Duplicate purpose in consent batch.",
      };
    }
    purposesSeen.add(purpose);
    events.push({ purpose, decision, disclosureVersion });
  }

  if (
    SERVICE_COMMUNICATIONS_REQUIRED_SOURCES.has(expectedSource) &&
    !events.some(
      (e) =>
        e.purpose === "service_communications" && e.decision === "granted",
    )
  ) {
    return {
      ok: false,
      code: "service_consent_required",
      message: "Service communications authorization is required.",
    };
  }

  const consent: ParsedConsentRequest = {
    schemaVersion: "1",
    submissionId,
    privacyPolicyVersion,
    termsVersion,
    source,
    events,
  };

  return { ok: true, consent };
}

export const CONTRACTOR_REQUESTING_HANDOFF_STATUSES = new Set<string>([
  "accepted_today",
  "accepted_tomorrow",
  "text_or_email_first",
]);

export function validateHandoffContractorConsentConsistency(
  handoffConsentStatus: string | null,
  consent: ParsedConsentRequest | null,
):
  | { ok: true }
  | { ok: false; code: string; message: string } {
  const contractorEvent = consent?.events.find(
    (e) => e.purpose === "contractor_sharing",
  );
  const contractorGranted = contractorEvent?.decision === "granted";

  if (
    handoffConsentStatus &&
    CONTRACTOR_REQUESTING_HANDOFF_STATUSES.has(handoffConsentStatus)
  ) {
    if (!contractorGranted) {
      return {
        ok: false,
        code: "contractor_consent_mismatch",
        message:
          "Contractor sharing authorization is required for this handoff choice.",
      };
    }
  }

  if (handoffConsentStatus === "report_only" && contractorGranted) {
    return {
      ok: false,
      code: "contractor_consent_mismatch",
      message:
        "Contractor sharing cannot be granted when report only was selected.",
    };
  }

  if (
    contractorGranted &&
    (!handoffConsentStatus ||
      !CONTRACTOR_REQUESTING_HANDOFF_STATUSES.has(handoffConsentStatus))
  ) {
    return {
      ok: false,
      code: "contractor_consent_mismatch",
      message:
        "Contractor sharing grant requires an accepted contractor handoff choice.",
    };
  }

  return { ok: true };
}

export function consentEventsToRpcJson(
  events: ParsedConsentRequest["events"],
): Array<{ purpose: string; decision: string; disclosure_version: string }> {
  return events.map((e) => ({
    purpose: e.purpose,
    decision: e.decision,
    disclosure_version: e.disclosureVersion,
  }));
}

function trimMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

export async function persistConsentBatch(
  admin: { rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ error: { code?: string; message?: string } | null }> },
  args: {
    leadId: string;
    sessionId: string;
    consent: ParsedConsentRequest;
  },
): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const { error } = await admin.rpc("persist_lead_consent_batch", {
    p_lead_id: args.leadId,
    p_session_id: args.sessionId,
    p_submission_id: args.consent.submissionId,
    p_consent_schema_version: args.consent.schemaVersion,
    p_privacy_policy_version: args.consent.privacyPolicyVersion,
    p_terms_version: args.consent.termsVersion,
    p_source: args.consent.source,
    p_events: consentEventsToRpcJson(args.consent.events),
  });

  if (error) {
    // The RPC raises 'consent_submission_conflict' when the same
    // (lead_id, submission_id, purpose) key arrives with a different
    // decision/version/source payload. Identical duplicates are idempotent.
    if (
      typeof error.message === "string" &&
      error.message.includes("consent_submission_conflict")
    ) {
      return {
        ok: false,
        code: "consent_submission_conflict",
        message:
          "This consent submission conflicts with an already recorded decision.",
      };
    }

    return {
      ok: false,
      code: "consent_persist_failed",
      message: "Could not save consent records.",
    };
  }

  return { ok: true };
}

/**
 * Required consent persistence must succeed BEFORE any success side effect
 * (canonical lead_captured, CRM activity, conversions, success response).
 * When persistence fails, no success effect runs and the failure is returned
 * so callers emit no success signal.
 */
export async function persistConsentThenRunSuccessEffects(args: {
  persist: () => Promise<
    { ok: true } | { ok: false; code: string; message: string }
  >;
  runSuccessEffects: () => Promise<void>;
}): Promise<{ ok: true } | { ok: false; code: string; message: string }> {
  const persisted = await args.persist();
  if (!persisted.ok) {
    return persisted;
  }

  await args.runSuccessEffects();
  return { ok: true };
}

/** HTTP status for a consent persistence failure code. */
export function consentPersistFailureStatus(code: string): number {
  return code === "consent_submission_conflict" ? 409 : 500;
}
