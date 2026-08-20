import { readLateFbCookies } from "@/lib/attribution/fbCookies";
import { buildLeadCaptureConsentRequest } from "@/lib/consent/buildConsentRequest";
import { CONSENT_DISCLOSURE_VERSION } from "@/lib/consent/consentVersions";
import { getAttributionPayload, getUtmData } from "@/lib/useUtmCapture";
import {
  isValidTruthGatePhone,
  normalizeTruthGatePhoneToE164,
} from "@/lib/validation/truthGateContact";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import { supabase } from "@/integrations/supabase/client";
import {
  WM_CHAT_INTAKE_VERSION,
  WM_CHAT_SCHEMA_VERSION,
  isWmChatNodeId,
  isWmChatOptionId,
  type WmChatIntakeV1,
  type WmChatSubmitInput,
  type WmChatSubmitResult,
} from "@/pages/WmChat/wmChatTypes";
export {
  getOrCreateWmChatSessionId,
  getOrCreateWmChatSubmissionId,
  WM_CHAT_SESSION_STORAGE_KEY,
  WM_CHAT_SUBMISSION_STORAGE_KEY,
} from "@/pages/WmChat/wmChatIdentity";

export const WM_CHAT_SOURCE = "windowman-first-quote";
export const WM_CHAT_SOURCE_PATH = "/wmchat";

const SAFE_CAPTURE_MESSAGE =
  "I couldn’t save that yet. Your answers are still here—please try again.";
const INVALID_PHONE_MESSAGE =
  "That number could not be validated. Check it and enter a valid US number.";
const LOOKUP_UNAVAILABLE_MESSAGE =
  "I couldn’t check that number right now. Your answers are still here—please try again.";
const IDENTITY_CONFLICT_MESSAGE =
  "Let me start a fresh conversation for those details—one moment.";

const inFlightCaptures = new Map<string, Promise<WmChatSubmitResult>>();

const SAFE_ANSWER_KEYS = new Set([
  "entry_intent",
  "need_reason",
  "need_detail",
  "priorities",
  "stakes",
  "trust_concern",
  "zip",
  "project_scope",
  "openings",
  "budget_posture",
  "timing",
  "have_concern",
  "have_detail",
  "powers",
  "power_route",
  "hesitation_action",
]);

const ENTRY_INTENTS = new Set(["have_quote", "need_quote", "learn_powers"]);

const MAX_CANONICAL_QUERY_PARAM_KEYS = 50;

function captureFailureForCode(code: unknown): WmChatSubmitResult {
  if (code === "wmchat_phone_invalid") {
    return {
      ok: false,
      code: "invalid_phone",
      message: INVALID_PHONE_MESSAGE,
    };
  }
  if (code === "wmchat_phone_lookup_unavailable") {
    return {
      ok: false,
      code: "lookup_unavailable",
      message: LOOKUP_UNAVAILABLE_MESSAGE,
    };
  }
  // The session already owns a lead captured under different contact details.
  // Retrying this session can never succeed — the caller must rotate identity.
  if (code === "wmchat_lead_mismatch" || code === "invalid_reused_lead_id") {
    return {
      ok: false,
      code: "identity_conflict",
      message: IDENTITY_CONFLICT_MESSAGE,
    };
  }
  return { ok: false, code: "capture_failed", message: SAFE_CAPTURE_MESSAGE };
}

async function readEdgeFailureCode(error: unknown): Promise<unknown> {
  if (!error || typeof error !== "object") return null;
  const context = (error as { context?: unknown }).context;
  if (!context || typeof context !== "object") return null;
  const readJson = (context as { json?: unknown }).json;
  if (typeof readJson !== "function") return null;
  try {
    const body = await readJson.call(context);
    if (!body || typeof body !== "object" || Array.isArray(body)) return null;
    return (body as { code?: unknown }).code;
  } catch {
    return null;
  }
}

/**
 * Keeps server-authoritative flow markers inside the bounded query map even
 * when a landing URL contains many arbitrary attribution keys.
 */
export function buildWmChatQueryParams(
  base: Record<string, string | string[]>,
  required: Readonly<Record<string, string>>,
): Record<string, string> {
  const merged: Record<string, string> = { ...required };
  const requiredKeys = new Set(Object.keys(required));

  for (const [rawKey, value] of Object.entries(base)) {
    if (Object.keys(merged).length >= MAX_CANONICAL_QUERY_PARAM_KEYS) break;

    const key = rawKey.trim().slice(0, 128);
    if (!key || requiredKeys.has(key)) continue;

    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim();
    } else if (Array.isArray(value) && value[0]?.trim()) {
      merged[key] = value[0].trim();
    }
  }
  return merged;
}

function resolveClientSlug(utmClientSlug: string | null): string | null {
  if (typeof window === "undefined") return utmClientSlug;

  const queryClientSlug = new URLSearchParams(window.location.search).get(
    "client",
  );
  let storedClientSlug: string | null = null;
  try {
    storedClientSlug = localStorage.getItem("wm_client_slug");
  } catch {
    storedClientSlug = null;
  }

  return queryClientSlug ?? utmClientSlug ?? storedClientSlug ?? null;
}

function answerPathIsValid(path: readonly string[]): boolean {
  return (
    path.length > 0 &&
    path.length <= 64 &&
    path.every((entry) => {
      if (typeof entry !== "string" || entry.length > 120) return false;
      const separator = entry.indexOf(":");
      if (separator <= 0 || separator !== entry.lastIndexOf(":")) return false;
      return (
        isWmChatNodeId(entry.slice(0, separator)) &&
        isWmChatOptionId(entry.slice(separator + 1))
      );
    })
  );
}

export function isValidWmChatIntake(intake: WmChatIntakeV1): boolean {
  if (
    intake.schema_version !== WM_CHAT_SCHEMA_VERSION ||
    intake.intake_version !== WM_CHAT_INTAKE_VERSION ||
    !ENTRY_INTENTS.has(intake.entry_intent) ||
    intake.continuation !== "sms_then_voice" ||
    !answerPathIsValid(intake.answer_path)
  ) {
    return false;
  }

  if (
    intake.other_text !== undefined &&
    (!intake.other_text.trim() ||
      intake.other_text.length > 160 ||
      /[\r\n]/.test(intake.other_text) ||
      /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(intake.other_text) ||
      (intake.other_text.match(/\d/g) ?? []).length >= 7)
  ) {
    return false;
  }

  const entries = Object.entries(intake.answers);
  if (entries.length > 24) return false;

  for (const [key, value] of entries) {
    if (!SAFE_ANSWER_KEYS.has(key)) return false;
    if (key === "entry_intent") {
      if (value !== intake.entry_intent) return false;
      continue;
    }
    if (key === "zip") {
      if (typeof value !== "string" || !/^\d{5}$/.test(value)) return false;
      continue;
    }

    const values = Array.isArray(value) ? value : [value];
    if (values.length === 0 || values.length > 2) return false;
    if (values.some((answer) => !isWmChatOptionId(answer))) return false;
  }

  const expectedEntryOption = {
    have_quote: "entry_have_quote",
    need_quote: "entry_need_quote",
    learn_powers: "entry_learn_powers",
  }[intake.entry_intent];

  return (
    intake.answer_path[0] === `entry:${expectedEntryOption}` &&
    intake.answers.entry_intent === intake.entry_intent
  );
}

function resolveWmIntent(intake: WmChatIntakeV1): "has_quote" | "no_quote" {
  if (intake.entry_intent === "have_quote") return "has_quote";
  if (
    intake.answer_path.some(
      (entry) =>
        entry.endsWith(":power_route_have_quote") ||
        entry.endsWith(":not_ready_have_quote"),
    )
  ) {
    return "has_quote";
  }
  return "no_quote";
}

/** Builds the canonical capture Edge body. Exported for focused contract tests. */
export function buildWmChatLeadPayload(
  input: WmChatSubmitInput,
): Record<string, unknown> {
  const attributionPayload = getAttributionPayload();
  const utm = getUtmData();
  const baseQueryParams =
    (attributionPayload.query_params as Record<string, string | string[]>) ??
    {};
  const { query_params: _queryParams, ...attributionBody } = attributionPayload;
  const wmIntent = resolveWmIntent(input.wmchatIntake);
  const consent = buildLeadCaptureConsentRequest({
    submissionId: input.submissionId,
    source: WM_CHAT_SOURCE,
    serviceCommunicationsGranted: input.serviceCommunicationsGranted,
    marketingConsentPresented: input.marketingConsentPresented,
    marketingCommunicationsGranted: input.marketingCommunicationsGranted,
    extraEvents: input.advertisingMeasurementDecision
      ? [
          {
            purpose: "advertising_measurement",
            decision: input.advertisingMeasurementDecision,
            disclosureVersion: CONSENT_DISCLOSURE_VERSION,
          },
        ]
      : undefined,
  });
  const fb = readLateFbCookies(
    { fbp: utm.fbp, fbc: utm.fbc },
    { surface: "wmchat_intake", sessionId: input.sessionId },
  );
  const landingPageUrl =
    utm.landing_page_url ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null);

  return {
    session_id: input.sessionId,
    first_name: input.firstName?.trim() || null,
    email: null,
    phone_e164: input.phoneE164,
    county: null,
    project_type: null,
    window_count: null,
    quote_range: null,
    source: WM_CHAT_SOURCE,
    client_slug: resolveClientSlug(utm.client_slug || null),
    utm_source: utm.utm_source,
    utm_medium: utm.utm_medium,
    utm_campaign: utm.utm_campaign,
    utm_term: utm.utm_term,
    utm_content: utm.utm_content,
    fbclid: utm.fbclid,
    gclid: utm.gclid,
    fbc: fb.fbc,
    fbp: fb.fbp,
    landing_page_url: landingPageUrl,
    first_page_path: utm.landing_page,
    initial_referrer:
      typeof document !== "undefined" ? document.referrer || null : null,
    attribution: {
      ...attributionBody,
      wm_intent: wmIntent,
    },
    query_params: buildWmChatQueryParams(baseQueryParams, {
      wm_intent: wmIntent,
      source_path: WM_CHAT_SOURCE_PATH,
      intake_version: WM_CHAT_INTAKE_VERSION,
    }),
    consent,
    wmchat_intake: input.wmchatIntake,
  };
}

export async function submitWmChatLead(
  input: WmChatSubmitInput,
): Promise<WmChatSubmitResult> {
  const firstName = input.firstName?.trim() ?? null;
  if (
    !isValidLeadSessionUuid(input.sessionId) ||
    !isValidLeadSessionUuid(input.submissionId) ||
    !input.serviceCommunicationsGranted ||
    input.marketingConsentPresented ||
    input.marketingCommunicationsGranted ||
    (input.advertisingMeasurementDecision !== null &&
      input.advertisingMeasurementDecision !== "granted" &&
      input.advertisingMeasurementDecision !== "declined") ||
    !isValidTruthGatePhone(input.phoneE164) ||
    normalizeTruthGatePhoneToE164(input.phoneE164) !== input.phoneE164 ||
    (firstName !== null && (firstName.length < 2 || firstName.length > 100)) ||
    !isValidWmChatIntake(input.wmchatIntake)
  ) {
    return { ok: false, message: SAFE_CAPTURE_MESSAGE };
  }

  const identityKey = `${input.sessionId}:${input.submissionId}`;
  const existing = inFlightCaptures.get(identityKey);
  if (existing) return existing;

  const capturePromise = (async (): Promise<WmChatSubmitResult> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "capture-truth-gate-lead",
        { body: buildWmChatLeadPayload(input) },
      );
      const response = (data ?? null) as {
        success?: boolean;
        lead_id?: unknown;
        session_id?: unknown;
        reused?: boolean;
        code?: unknown;
      } | null;

      if (error) {
        return captureFailureForCode(await readEdgeFailureCode(error));
      }
      if (
        response?.success !== true ||
        !isValidLeadSessionUuid(response.lead_id) ||
        !isValidLeadSessionUuid(response.session_id) ||
        response.session_id !== input.sessionId
      ) {
        return captureFailureForCode(response?.code);
      }

      return {
        ok: true,
        leadId: response.lead_id,
        sessionId: response.session_id,
        reused: response.reused === true,
      };
    } catch {
      return captureFailureForCode(null);
    }
  })();

  inFlightCaptures.set(identityKey, capturePromise);
  try {
    return await capturePromise;
  } finally {
    if (inFlightCaptures.get(identityKey) === capturePromise) {
      inFlightCaptures.delete(identityKey);
    }
  }
}
