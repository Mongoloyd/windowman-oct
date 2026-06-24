/**
 * useIntakeCapture.ts — progressive-capture adapter for the WindowMan intake
 * router (live mode only).
 *
 * Boundaries:
 *   - Talks to the backend ONLY through the typed `captureArbitrageLead`
 *     transport. Never imports the supabase client directly.
 *   - The HMAC `capture_token` lives in a ref (memory) for the life of the
 *     funnel session. It is NEVER written to localStorage / sessionStorage and
 *     is cleared on completion or reset.
 *   - The post-completion handoff hint (sessionStorage) carries NO token and
 *     NO phone/email — only lead_id, event_id, zip, and a coarse qualification
 *     summary, mirroring (and tightening) the existing ArbitrageEngine hint.
 *   - No scanner / OTP / report / CAPI / GTM / tracking calls.
 */
import { useCallback, useRef } from "react";
import { captureArbitrageLead } from "@/lib/captureArbitrageLead";
import { getAttributionPayload, getUtmData } from "@/lib/useUtmCapture";
import { getLeadId } from "@/lib/useLeadId";
import { toE164 } from "@/utils/formatPhone";
import {
  CAPTURE_SESSION_ERROR_CODES,
  mapBucketToHasEstimate,
  mapCallIntent,
  mapProjectSizeToScope,
  mapThreatToDealBreaker,
  mapTimelineToTimeframe,
  safeArbError,
} from "./intakeCaptureMap";
import type {
  CallIntentChoice,
  IntakeBucket,
  IntakeFormState,
  ProjectSize,
  ThreatConcern,
  Timeline,
} from "./intakeTypes";

const HANDOFF_KEY = "wm_arbitrage_prefill";
const GENERIC_SUBMIT_ERROR = "Something went wrong. Please try again.";

export type IntakeCaptureResult =
  | { ok: true }
  | { ok: false; message: string; restart: boolean };

/** Resolve a non-PII routing slug. Mirrors ArbitrageEngine.resolveClientSlug. */
function resolveClientSlug(): string {
  if (typeof window === "undefined") return "direct";
  try {
    const utm = getUtmData();
    const queryClientSlug = new URLSearchParams(window.location.search).get(
      "client",
    );
    const lsClientSlug = (() => {
      try {
        return localStorage.getItem("wm_client_slug");
      } catch {
        return null;
      }
    })();
    const utmSlug = utm.client_slug !== "direct" ? utm.client_slug : null;
    const effective = queryClientSlug ?? utmSlug ?? lsClientSlug ?? null;
    if (effective) {
      try {
        localStorage.setItem("wm_client_slug", effective);
      } catch {
        /* ignore storage failures */
      }
      return effective;
    }
  } catch {
    /* fall through to direct */
  }
  return "direct";
}

/** Build the attribution object the backend promotes into scalar lead columns. */
function buildAttribution(): Record<string, unknown> {
  const attr = getAttributionPayload();
  return {
    ...attr,
    // Backend promotes these scalar aliases; map from the payload's own keys.
    first_page_path: attr.landing_page ?? null,
    initial_referrer: attr.referrer ?? null,
  };
}

export interface UseIntakeCaptureApi {
  /** Contact step → backend `create`. Requires bucket + projectSize for scope. */
  submitContact: (form: IntakeFormState) => Promise<IntakeCaptureResult>;
  /** Identity step → backend `update_identity`. */
  submitIdentity: (form: IntakeFormState) => Promise<IntakeCaptureResult>;
  /** Call-intent step → backend `update_call_intent` (best-effort, non-blocking). */
  submitCallIntent: (choice: CallIntentChoice) => void;
  /** Timeline step → backend `update_timeframe`; writes handoff hint on success. */
  submitTimeline: (timeline: Timeline) => Promise<IntakeCaptureResult>;
  /** Clear the in-memory capture session (token, ids). */
  reset: () => void;
}

export function useIntakeCapture(): UseIntakeCaptureApi {
  const sessionIdRef = useRef<string | null>(null);
  const eventIdRef = useRef<string | null>(null);
  const leadIdRef = useRef<string | null>(null);
  const captureTokenRef = useRef<string | null>(null);

  // Coarse, non-PII qualification snapshot used only for the handoff hint.
  const qualRef = useRef<{
    bucket: IntakeBucket | null;
    threat: ThreatConcern | null;
    projectSize: ProjectSize | null;
    zip: string | null;
  }>({ bucket: null, threat: null, projectSize: null, zip: null });

  const reset = useCallback(() => {
    sessionIdRef.current = null;
    eventIdRef.current = null;
    leadIdRef.current = null;
    captureTokenRef.current = null;
    qualRef.current = { bucket: null, threat: null, projectSize: null, zip: null };
  }, []);

  const getSessionId = useCallback((): string => {
    if (!sessionIdRef.current) sessionIdRef.current = crypto.randomUUID();
    return sessionIdRef.current;
  }, []);

  const getEventId = useCallback((): string => {
    if (!eventIdRef.current) eventIdRef.current = crypto.randomUUID();
    return eventIdRef.current;
  }, []);

  /** Capture-session failure → drop the session so the router restarts at contact. */
  const sessionFailure = useCallback(
    (_code: string): IntakeCaptureResult => {
      reset();
      return {
        ok: false,
        message: "Your setup session expired. Please re-enter your contact details.",
        restart: true,
      };
    },
    [reset],
  );

  const submitContact = useCallback(
    async (form: IntakeFormState): Promise<IntakeCaptureResult> => {
      const phoneE164 = toE164(form.contact.phone);
      if (!phoneE164) {
        return { ok: false, message: "Please enter a valid 10-digit US phone number.", restart: false };
      }
      if (!/^\d{5}$/.test(form.contact.zip)) {
        return { ok: false, message: "Please enter a valid 5-digit ZIP code.", restart: false };
      }
      if (!form.contact.consent) {
        return { ok: false, message: "Please agree to be contacted to continue.", restart: false };
      }
      if (!form.bucket || !form.projectSize) {
        return { ok: false, message: GENERIC_SUBMIT_ERROR, restart: false };
      }

      qualRef.current = {
        bucket: form.bucket,
        threat: form.threat,
        projectSize: form.projectSize,
        zip: form.contact.zip,
      };

      let externalId: string | null = null;
      try {
        externalId = getLeadId();
      } catch {
        externalId = null;
      }

      try {
        const result = await captureArbitrageLead({
          action: "create",
          session_id: getSessionId(),
          event_id: getEventId(),
          source: "arbitrage-engine",
          client_slug: resolveClientSlug(),
          external_id: externalId,
          zip: form.contact.zip,
          phone_e164: phoneE164,
          hasConsent: true,
          route: typeof window !== "undefined" ? window.location.pathname : "/about",
          attribution: buildAttribution(),
          intake: {
            scope: mapProjectSizeToScope(form.projectSize),
            hasEstimate: mapBucketToHasEstimate(form.bucket),
            dealBreaker: form.threat ? mapThreatToDealBreaker(form.threat) : undefined,
          },
        });

        if (!result.ok) {
          if (CAPTURE_SESSION_ERROR_CODES.has(result.code)) return sessionFailure(result.code);
          return { ok: false, message: safeArbError(result.code), restart: false };
        }

        leadIdRef.current = result.leadId;
        captureTokenRef.current = result.captureToken;
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_SUBMIT_ERROR, restart: false };
      }
    },
    [getSessionId, getEventId, sessionFailure],
  );

  const submitIdentity = useCallback(
    async (form: IntakeFormState): Promise<IntakeCaptureResult> => {
      const name = form.identity.firstName.trim();
      const email = form.identity.email.trim().toLowerCase();
      if (name.length < 2) {
        return { ok: false, message: "Please enter your first name.", restart: false };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return { ok: false, message: "Please enter a valid email address.", restart: false };
      }

      const captureToken = captureTokenRef.current;
      if (!captureToken) return sessionFailure("capture_token_required");

      try {
        const result = await captureArbitrageLead({
          action: "update_identity",
          session_id: getSessionId(),
          source: "arbitrage-engine",
          lead_id: leadIdRef.current,
          capture_token: captureToken,
          name,
          email,
        });

        if (!result.ok) {
          if (CAPTURE_SESSION_ERROR_CODES.has(result.code)) return sessionFailure(result.code);
          return { ok: false, message: safeArbError(result.code), restart: false };
        }

        leadIdRef.current = result.leadId;
        captureTokenRef.current = result.captureToken;
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_SUBMIT_ERROR, restart: false };
      }
    },
    [getSessionId, sessionFailure],
  );

  const submitCallIntent = useCallback(
    (choice: CallIntentChoice): void => {
      const captureToken = captureTokenRef.current;
      if (!leadIdRef.current || !captureToken) return;
      void captureArbitrageLead({
        action: "update_call_intent",
        session_id: getSessionId(),
        source: "arbitrage-engine",
        lead_id: leadIdRef.current,
        capture_token: captureToken,
        call_intent: mapCallIntent(choice),
      }).then((result) => {
        if (result.ok) captureTokenRef.current = result.captureToken;
      });
    },
    [getSessionId],
  );

  const writeHandoffHint = useCallback(() => {
    if (typeof window === "undefined" || !leadIdRef.current) return;
    try {
      const { bucket, threat, projectSize, zip } = qualRef.current;
      sessionStorage.setItem(
        HANDOFF_KEY,
        JSON.stringify({
          lead_id: leadIdRef.current,
          event_id: getEventId(),
          source: "arbitrage-engine",
          client_slug: resolveClientSlug(),
          zip,
          qualification_summary: {
            has_estimate: bucket ? mapBucketToHasEstimate(bucket) : null,
            deal_breaker: threat ? mapThreatToDealBreaker(threat) : null,
            scope: projectSize ? mapProjectSizeToScope(projectSize) : null,
          },
          handoff_stage: "ready_for_quote_upload",
          issued_at: new Date().toISOString(),
        }),
      );
    } catch {
      /* ignore storage failures — handoff hint is best-effort */
    }
  }, [getEventId]);

  const submitTimeline = useCallback(
    async (timeline: Timeline): Promise<IntakeCaptureResult> => {
      if (!leadIdRef.current) {
        return { ok: false, message: GENERIC_SUBMIT_ERROR, restart: false };
      }
      const captureToken = captureTokenRef.current;
      if (!captureToken) return sessionFailure("capture_token_required");

      try {
        const result = await captureArbitrageLead({
          action: "update_timeframe",
          session_id: getSessionId(),
          source: "arbitrage-engine",
          lead_id: leadIdRef.current,
          capture_token: captureToken,
          timeframe: mapTimelineToTimeframe(timeline),
        });

        if (!result.ok) {
          if (CAPTURE_SESSION_ERROR_CODES.has(result.code)) return sessionFailure(result.code);
          return { ok: false, message: safeArbError(result.code), restart: false };
        }

        // Completion: persist the safe handoff hint, then drop the token.
        captureTokenRef.current = result.captureToken;
        writeHandoffHint();
        captureTokenRef.current = null;
        return { ok: true };
      } catch {
        return { ok: false, message: GENERIC_SUBMIT_ERROR, restart: false };
      }
    },
    [getSessionId, sessionFailure, writeHandoffHint],
  );

  return { submitContact, submitIdentity, submitCallIntent, submitTimeline, reset };
}
