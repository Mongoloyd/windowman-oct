import { supabase } from "@/integrations/supabase/client";
import { isValidLeadSessionUuid } from "@/lib/leadSession";
import {
  isCompleteWmChatPropertyAddress,
} from "@/pages/WmChat/wmChatPostCapturePayload";
import {
  WM_CHAT_INTAKE_VERSION,
  type WmChatPostCaptureSubmitInput,
  type WmChatPostCaptureSubmitResult,
  type WmChatPropertyAddressDraft,
} from "@/pages/WmChat/wmChatTypes";

import { WM_CHAT_SOURCE, WM_CHAT_SOURCE_PATH } from "./wmchatLeadCapture";

export const WM_CHAT_POST_CAPTURE_MODE = "wmchat_post_capture_v1" as const;

const INVALID_REQUEST_MESSAGE = "Review this next step and try again.";
const SAFE_FAILURE_MESSAGE =
  "That next step did not save safely. Please try again.";
const CONFLICT_MESSAGE =
  "A different next step is already saved for this project. Your original project request remains safe.";

const CONVERSATION_TIME_PREFERENCES = new Set([
  "asap",
  "weekday_morning",
  "weekday_afternoon",
  "weekday_evening",
]);

const CALLBACK_PREFERENCES = new Set([
  "next_week",
  "one_month",
  "three_months",
  "self_return",
]);

type WmChatPostCaptureAddressPayload = {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly region: string;
  readonly postal_code: string;
};

export type WmChatPostCaptureRequestBody = {
  readonly mode: typeof WM_CHAT_POST_CAPTURE_MODE;
  readonly source: typeof WM_CHAT_SOURCE;
  readonly lead_id: string;
  readonly session_id: string;
  readonly submission_id: string;
  readonly action: WmChatPostCaptureSubmitInput["action"];
  readonly property_address: WmChatPostCaptureAddressPayload | null;
  readonly conversation_time_preference: WmChatPostCaptureSubmitInput["conversationTimePreference"];
  readonly quote_readiness: WmChatPostCaptureSubmitInput["quoteReadiness"];
  readonly callback_preference: WmChatPostCaptureSubmitInput["callbackPreference"];
  readonly query_params: {
    readonly source_path: typeof WM_CHAT_SOURCE_PATH;
    readonly intake_version: typeof WM_CHAT_INTAKE_VERSION;
  };
};

type InFlightSubmission = {
  readonly fingerprint: string;
  readonly promise: Promise<WmChatPostCaptureSubmitResult>;
};

const inFlightSubmissions = new Map<string, InFlightSubmission>();

function normalizePropertyAddress(
  value: unknown,
): WmChatPostCaptureAddressPayload | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.line1 !== "string" ||
    typeof candidate.line2 !== "string" ||
    typeof candidate.city !== "string" ||
    typeof candidate.region !== "string" ||
    typeof candidate.postalCode !== "string"
  ) {
    return null;
  }

  const normalized: WmChatPropertyAddressDraft = {
    line1: candidate.line1.trim(),
    line2: candidate.line2.trim(),
    city: candidate.city.trim(),
    region: candidate.region.trim().toUpperCase(),
    postalCode: candidate.postalCode.trim(),
  };
  if (!isCompleteWmChatPropertyAddress(normalized)) return null;

  return {
    line1: normalized.line1,
    line2: normalized.line2,
    city: normalized.city,
    region: normalized.region,
    postal_code: normalized.postalCode,
  };
}

function isConversationTimePreference(value: unknown): boolean {
  return typeof value === "string" && CONVERSATION_TIME_PREFERENCES.has(value);
}

function isCallbackPreference(value: unknown): boolean {
  return typeof value === "string" && CALLBACK_PREFERENCES.has(value);
}

export function buildWmChatPostCapturePayload(
  input: WmChatPostCaptureSubmitInput,
): WmChatPostCaptureRequestBody | null {
  if (
    !input ||
    typeof input !== "object" ||
    !isValidLeadSessionUuid(input.leadId) ||
    !isValidLeadSessionUuid(input.sessionId) ||
    !isValidLeadSessionUuid(input.submissionId)
  ) {
    return null;
  }

  const propertyAddress =
    input.propertyAddress === null
      ? null
      : normalizePropertyAddress(input.propertyAddress);
  if (input.propertyAddress !== null && !propertyAddress) return null;

  switch (input.action) {
    case "quote_request_game_plan":
      if (
        input.conversationTimePreference !== null ||
        input.quoteReadiness !== null ||
        input.callbackPreference !== null
      ) {
        return null;
      }
      break;

    case "schedule_windowman_conversation":
      if (
        !isConversationTimePreference(input.conversationTimePreference) ||
        input.quoteReadiness !== null ||
        input.callbackPreference !== null
      ) {
        return null;
      }
      break;

    case "review_quote_when_ready":
      if (
        input.propertyAddress !== null ||
        input.conversationTimePreference !== null ||
        input.quoteReadiness !== "not_yet" ||
        !isCallbackPreference(input.callbackPreference)
      ) {
        return null;
      }
      break;

    default:
      return null;
  }

  return {
    mode: WM_CHAT_POST_CAPTURE_MODE,
    source: WM_CHAT_SOURCE,
    lead_id: input.leadId,
    session_id: input.sessionId,
    submission_id: input.submissionId,
    action: input.action,
    property_address: propertyAddress,
    conversation_time_preference: input.conversationTimePreference,
    quote_readiness: input.quoteReadiness,
    callback_preference: input.callbackPreference,
    query_params: {
      source_path: WM_CHAT_SOURCE_PATH,
      intake_version: WM_CHAT_INTAKE_VERSION,
    },
  };
}

function failureForCode(code: unknown): WmChatPostCaptureSubmitResult {
  return {
    ok: false,
    message:
      code === "wmchat_post_capture_conflict"
        ? CONFLICT_MESSAGE
        : SAFE_FAILURE_MESSAGE,
  };
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

export async function submitWmChatPostCapture(
  input: WmChatPostCaptureSubmitInput,
): Promise<WmChatPostCaptureSubmitResult> {
  const body = buildWmChatPostCapturePayload(input);
  if (!body) return { ok: false, message: INVALID_REQUEST_MESSAGE };

  const identityKey = `${body.lead_id}:${body.session_id}:${body.submission_id}`;
  const fingerprint = JSON.stringify(body);
  const existing = inFlightSubmissions.get(identityKey);
  if (existing) {
    if (existing.fingerprint !== fingerprint) {
      return { ok: false, message: CONFLICT_MESSAGE };
    }
    return existing.promise;
  }

  const requestPromise = (async (): Promise<WmChatPostCaptureSubmitResult> => {
    try {
      const { data, error } = await supabase.functions.invoke(
        "capture-truth-gate-lead",
        { body, timeout: 15_000 },
      );
      const response = (data ?? null) as {
        success?: unknown;
        lead_id?: unknown;
        session_id?: unknown;
        code?: unknown;
      } | null;

      if (error) return failureForCode(await readEdgeFailureCode(error));
      if (
        response?.success !== true ||
        !isValidLeadSessionUuid(response.lead_id) ||
        !isValidLeadSessionUuid(response.session_id) ||
        response.lead_id !== input.leadId ||
        response.session_id !== input.sessionId
      ) {
        return failureForCode(response?.code);
      }

      return {
        ok: true,
        leadId: response.lead_id,
        sessionId: response.session_id,
      };
    } catch {
      return failureForCode(null);
    }
  })();

  const inFlight = { fingerprint, promise: requestPromise };
  inFlightSubmissions.set(identityKey, inFlight);
  try {
    return await requestPromise;
  } finally {
    if (inFlightSubmissions.get(identityKey) === inFlight) {
      inFlightSubmissions.delete(identityKey);
    }
  }
}
