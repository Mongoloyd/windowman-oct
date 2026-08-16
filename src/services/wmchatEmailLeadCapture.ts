import { supabase } from "@/integrations/supabase/client";
import { readLateFbCookies } from "@/lib/attribution/fbCookies";
import { buildLeadCaptureConsentRequest } from "@/lib/consent/buildConsentRequest";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import { getAttributionPayload, getUtmData } from "@/lib/useUtmCapture";
import type {
  WmChatEmailSubmitInput,
  WmChatIntakeV1,
  WmChatSubmitResult,
} from "@/pages/WmChat/wmChatTypes";
import { isValidEmail } from "@/utils/formatPhone";
import {
  buildWmChatQueryParams,
  WM_CHAT_SOURCE,
  WM_CHAT_SOURCE_PATH,
} from "./wmchatLeadCapture";

export const WM_CHAT_EMAIL_CAPTURE_KIND = "protection_kit" as const;
export const WM_CHAT_EMAIL_ENTRY_POINT = "wm_chat" as const;
export const WM_CHAT_EMAIL_SESSION_STORAGE_KEY =
  "wm_wmchat_protection_kit_session_id";
export const WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY =
  "wm_wmchat_protection_kit_submission_id";

const SAFE_CAPTURE_MESSAGE =
  "I couldn’t save that yet. Your email is still here—please try again.";

const PROTECTION_KIT_PATH = [
  "entry:entry_learn_powers",
  "power_1:power_next_2",
  "power_2:power_next_3",
  "power_3:power_next_4",
  "power_4:power_next_5",
  "power_5:power_not_ready",
  "not_ready:not_ready_protection_kit",
] as const;

const inFlightCaptures = new Map<string, Promise<WmChatSubmitResult>>();

type CaptureIdentity = {
  readonly sessionId: string;
  readonly submissionId: string;
};

function getOrCreateStoredUuid(key: string): string {
  if (typeof window === "undefined") return crypto.randomUUID();
  try {
    const existing = sessionStorage.getItem(key);
    if (isValidLeadSessionUuid(existing)) return existing;
    const created = crypto.randomUUID();
    sessionStorage.setItem(key, created);
    return created;
  } catch {
    return crypto.randomUUID();
  }
}

export function getOrCreateWmChatEmailCaptureIdentity(): CaptureIdentity {
  return {
    sessionId: getOrCreateStoredUuid(WM_CHAT_EMAIL_SESSION_STORAGE_KEY),
    submissionId: getOrCreateStoredUuid(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY),
  };
}

export function clearWmChatEmailCaptureIdentity(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(WM_CHAT_EMAIL_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(WM_CHAT_EMAIL_SUBMISSION_STORAGE_KEY);
  } catch {
    // Storage is optional. A future capture will generate fresh in-memory IDs.
  }
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

export function isProtectionKitWmChatIntake(intake: WmChatIntakeV1): boolean {
  return (
    intake.entry_intent === "learn_powers" &&
    intake.schema_version === "1" &&
    intake.intake_version === "wmchat_v1" &&
    intake.continuation === "email_only" &&
    intake.answer_path.length === PROTECTION_KIT_PATH.length &&
    intake.answer_path.every(
      (entry, index) => entry === PROTECTION_KIT_PATH[index],
    ) &&
    intake.answers.entry_intent === "learn_powers" &&
    intake.answers.powers === "power_not_ready" &&
    intake.answers.hesitation_action === "not_ready_protection_kit" &&
    intake.other_text === undefined
  );
}

export function buildWmChatEmailLeadPayload(
  input: WmChatEmailSubmitInput,
  identity: CaptureIdentity,
): Record<string, unknown> {
  const email = input.email.trim().toLowerCase();
  const attributionPayload = getAttributionPayload();
  const utm = getUtmData();
  const baseQueryParams =
    (attributionPayload.query_params as Record<string, string | string[]>) ??
    {};
  const { query_params: _queryParams, ...attributionBody } = attributionPayload;
  const fb = readLateFbCookies(
    { fbp: utm.fbp, fbc: utm.fbc },
    { surface: "wmchat_protection_kit", sessionId: identity.sessionId },
  );
  const landingPageUrl =
    utm.landing_page_url ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null);

  return {
    session_id: identity.sessionId,
    first_name: null,
    email,
    phone_e164: null,
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
    attribution: { ...attributionBody, wm_intent: "no_quote" },
    query_params: buildWmChatQueryParams(baseQueryParams, {
      wm_intent: "no_quote",
      source_path: WM_CHAT_SOURCE_PATH,
      intake_version: "wmchat_v1",
      capture_kind: WM_CHAT_EMAIL_CAPTURE_KIND,
      entry_point: WM_CHAT_EMAIL_ENTRY_POINT,
    }),
    wmchat_capture_kind: WM_CHAT_EMAIL_CAPTURE_KIND,
    consent: buildLeadCaptureConsentRequest({
      submissionId: identity.submissionId,
      source: WM_CHAT_SOURCE,
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
      marketingCommunicationsGranted: false,
    }),
    wmchat_intake: input.wmchatIntake,
  };
}

export async function submitWmChatEmailLead(
  input: WmChatEmailSubmitInput,
): Promise<WmChatSubmitResult> {
  const email = input.email.trim().toLowerCase();
  if (
    !email ||
    email.length > 255 ||
    !isValidEmail(email) ||
    !isProtectionKitWmChatIntake(input.wmchatIntake)
  ) {
    return { ok: false, message: SAFE_CAPTURE_MESSAGE };
  }

  const identity = getOrCreateWmChatEmailCaptureIdentity();
  const identityKey = `${identity.sessionId}:${identity.submissionId}`;
  const existing = inFlightCaptures.get(identityKey);
  if (existing) return existing;

  const capturePromise = (async (): Promise<WmChatSubmitResult> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "capture-truth-gate-lead",
        { body: buildWmChatEmailLeadPayload({ ...input, email }, identity) },
      );
      const response = (data ?? null) as {
        success?: boolean;
        lead_id?: unknown;
        session_id?: unknown;
        reused?: boolean;
      } | null;

      if (
        error ||
        response?.success !== true ||
        !isValidLeadSessionUuid(response.lead_id) ||
        !isValidLeadSessionUuid(response.session_id) ||
        response.session_id !== identity.sessionId
      ) {
        return { ok: false, message: SAFE_CAPTURE_MESSAGE };
      }

      clearWmChatEmailCaptureIdentity();
      return {
        ok: true,
        leadId: response.lead_id,
        sessionId: response.session_id,
        reused: response.reused === true,
      };
    } catch {
      return { ok: false, message: SAFE_CAPTURE_MESSAGE };
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
