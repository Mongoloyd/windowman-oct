import type {
  FirstQuoteContactFields,
  FirstQuoteProjectBasics,
  HelpNeeded,
  PreferredContact,
} from "@/components/landing/firstQuoteIntakeTypes";
import {
  FIRST_QUOTE_INTAKE_VERSION,
  FIRST_QUOTE_SAFE_ERROR,
  isValidZipCode,
  normalizeZipCode,
} from "@/components/landing/firstQuoteIntakeTypes";
import type { IntakeIntentChoice } from "@/components/intake/universal/intakeTypes";
import { readLateFbCookies } from "@/lib/attribution/fbCookies";
import { buildLeadCaptureConsentRequest } from "@/lib/consent/buildConsentRequest";
import { buildTruthGateLeadPayload } from "@/services/truthGateLeadCapture";
import { supabase } from "@/integrations/supabase/client";
import { getAttributionPayload, getUtmData } from "@/lib/useUtmCapture";

export const FIRST_QUOTE_SESSION_STORAGE_KEY = "wm_first_quote_session_id";
export const WINDOWMAN_FIRST_QUOTE_SOURCE = "windowman-first-quote";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let inMemoryFirstQuoteSessionId: string | null = null;

export type FirstQuoteSourcePath = "/windowman" | "/nq3" | "/nq4" | "/prophecy";

export type SubmitWindowmanFirstQuoteInput = {
  sessionId: string;
  submissionId: string;
  sourcePath?: FirstQuoteSourcePath;
  firstName: string;
  email: string;
  phoneE164: string;
  projectBasics: FirstQuoteProjectBasics;
  helpNeeded: HelpNeeded;
  preferredContact?: PreferredContact | "" | null;
  serviceCommunicationsGranted: boolean;
  marketingConsentPresented: boolean;
  marketingCommunicationsGranted?: boolean;
  /** The visitor's selected branch on a dual-intent intake. */
  wmIntent?: IntakeIntentChoice;
  /** Campaign-specific answers persisted inside query_params. */
  extraQueryParams?: Record<string, string>;
};

export type SubmitWindowmanFirstQuoteResult =
  | { ok: true; leadId?: string; reused?: boolean }
  | { ok: false; message: string };

function flattenQueryParams(
  base: Record<string, string | string[]>,
): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
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
  let lsClientSlug: string | null = null;
  try {
    if (typeof localStorage !== "undefined") {
      lsClientSlug = localStorage.getItem("wm_client_slug");
    }
  } catch {
    lsClientSlug = null;
  }

  return queryClientSlug ?? utmClientSlug ?? lsClientSlug ?? null;
}

export function getOrCreateFirstQuoteSessionId(): string {
  if (typeof window === "undefined") {
    return "00000000-0000-4000-8000-000000000001";
  }

  try {
    if (typeof sessionStorage !== "undefined") {
      const existing = sessionStorage.getItem(FIRST_QUOTE_SESSION_STORAGE_KEY);
      if (existing && UUID_RE.test(existing)) {
        inMemoryFirstQuoteSessionId = existing;
        return existing;
      }
      if (
        inMemoryFirstQuoteSessionId &&
        UUID_RE.test(inMemoryFirstQuoteSessionId)
      ) {
        sessionStorage.setItem(
          FIRST_QUOTE_SESSION_STORAGE_KEY,
          inMemoryFirstQuoteSessionId,
        );
        return inMemoryFirstQuoteSessionId;
      }
      const id = crypto.randomUUID();
      sessionStorage.setItem(FIRST_QUOTE_SESSION_STORAGE_KEY, id);
      inMemoryFirstQuoteSessionId = id;
      return id;
    }
  } catch {
    if (
      inMemoryFirstQuoteSessionId &&
      UUID_RE.test(inMemoryFirstQuoteSessionId)
    ) {
      return inMemoryFirstQuoteSessionId;
    }
  }

  const fallbackId = crypto.randomUUID();
  inMemoryFirstQuoteSessionId = fallbackId;
  return fallbackId;
}

/** Builds the capture-truth-gate-lead body (exported for tests). */
export function buildWindowmanFirstQuoteLeadPayload(
  input: SubmitWindowmanFirstQuoteInput,
): Record<string, unknown> {
  const utm = getUtmData();
  const attributionPayload = getAttributionPayload();
  const baseQueryParams =
    (attributionPayload.query_params as Record<string, string | string[]>) ??
    {};
  const { query_params: _queryParams, ...attributionBody } = attributionPayload;

  const fb = readLateFbCookies(
    { fbp: utm.fbp, fbc: utm.fbc },
    { surface: "windowman_first_quote_intake", sessionId: input.sessionId },
  );

  const effectiveClientSlug = resolveClientSlug(utm.client_slug || null);

  const landingPageUrl =
    utm.landing_page_url ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null);

  const zipCode = normalizeZipCode(input.projectBasics.zipOrCity);
  const wmIntent: IntakeIntentChoice = input.wmIntent ?? "no_quote";

  const queryParams: Record<string, string> = {
    ...flattenQueryParams(baseQueryParams),
    ...(input.extraQueryParams ?? {}),
    wm_intent: wmIntent,
    source_path: input.sourcePath ?? "/windowman",
    intake_version: FIRST_QUOTE_INTAKE_VERSION,
    zip_code: zipCode,
    zip_or_city: zipCode,
    property_type: input.projectBasics.propertyType,
    openings_bucket: input.projectBasics.openingsBucket,
    product_scope: input.projectBasics.productScope,
    timing: input.projectBasics.timing,
    help_needed: input.helpNeeded,
  };

  if (input.projectBasics.homeownerRole) {
    queryParams.homeowner_role = input.projectBasics.homeownerRole;
  }

  const preferred = input.preferredContact?.trim();
  if (preferred) {
    queryParams.preferred_contact = preferred;
  }

  const consent = buildLeadCaptureConsentRequest({
    submissionId: input.submissionId,
    source: WINDOWMAN_FIRST_QUOTE_SOURCE,
    serviceCommunicationsGranted: input.serviceCommunicationsGranted,
    marketingConsentPresented: input.marketingConsentPresented,
    marketingCommunicationsGranted: input.marketingCommunicationsGranted,
  });

  const base = buildTruthGateLeadPayload({
    sessionId: input.sessionId,
    firstName: input.firstName.trim(),
    email: input.email.trim().toLowerCase(),
    phoneE164: input.phoneE164,
    consent,
  });

  const payload: Record<string, unknown> = {
    ...base,
    source: WINDOWMAN_FIRST_QUOTE_SOURCE,
    client_slug: effectiveClientSlug,
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
    query_params: queryParams,
  };

  // Prophecy records a range bucket, not an exact count. The range remains in
  // query_params.openings_bucket and the canonical integer field is omitted.
  if (input.sourcePath === "/prophecy") {
    delete payload.window_count;
  }

  return payload;
}

export async function submitWindowmanFirstQuoteLead(
  input: SubmitWindowmanFirstQuoteInput,
): Promise<SubmitWindowmanFirstQuoteResult> {
  if (!input.sessionId || !UUID_RE.test(input.sessionId)) {
    return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
  }

  if (!isValidZipCode(input.projectBasics.zipOrCity)) {
    return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
  }

  try {
    const body = buildWindowmanFirstQuoteLeadPayload(input);

    const { data, error } = await supabase.functions.invoke(
      "capture-truth-gate-lead",
      {
        body,
      },
    );

    const response = (data ?? null) as {
      success?: boolean;
      lead_id?: string | null;
      reused?: boolean;
      code?: string;
      message?: string;
    } | null;

    if (error || response?.success !== true) {
      if (import.meta.env.DEV) {
        console.error("[windowmanFirstQuoteLeadCapture] capture failed", {
          code: response?.code ?? error?.name ?? "unknown",
          invoke_message: error?.message ?? response?.message ?? null,
          session_id: input.sessionId,
          success: response?.success ?? false,
        });
      }
      return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
    }

    if (!response.lead_id && import.meta.env.DEV) {
      console.warn("[windowmanFirstQuoteLeadCapture] success without lead_id", {
        session_id: input.sessionId,
        reused: response.reused === true,
      });
    }

    return {
      ok: true,
      reused: response.reused === true,
      leadId: response.lead_id ?? undefined,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[windowmanFirstQuoteLeadCapture] unexpected error", {
        session_id: input.sessionId,
        name: err instanceof Error ? err.name : "unknown",
      });
    }
    return { ok: false, message: FIRST_QUOTE_SAFE_ERROR };
  }
}
