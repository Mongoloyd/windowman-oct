import { readLateFbCookies } from "@/lib/attribution/fbCookies";
import {
  getOpenAiAdsCaptureContext,
  trackOpenAiAdsLeadCreated,
} from "@/lib/openAiAdsPixel";
import { pushLeadMagnetCaptured } from "@/lib/tracking/dataLayer";
import { captureUtmFromUrl, getAttributionPayload } from "@/lib/useUtmCapture";
import { normalizeTruthGatePhoneToE164 } from "@/lib/validation/truthGateContact";
import { supabase } from "@/integrations/supabase/client";

export const TRUTH_GATE_SOURCE = "truth-gate";

const SAFE_CAPTURE_MESSAGE =
  "We couldn't save your details yet. Check them and try again.";

export type BuildTruthGateLeadPayloadInput = {
  sessionId: string;
  firstName: string;
  email: string;
  phoneE164: string | null;
  funnelClientSlug?: string | null;
};

export type SubmitTruthGateLeadInput = {
  sessionId: string;
  firstName: string;
  email: string;
  phone: string;
  funnelClientSlug?: string | null;
};

export type TruthGateLeadResult =
  | {
      ok: true;
      leadId: string;
      sessionId: string;
      reused?: boolean;
      openAiAdsEventId?: string;
      phoneE164: string | null;
      clientSlug?: string | null;
    }
  | {
      ok: false;
      code: string;
      message: string;
      sessionId?: string;
    };

export function resolveTruthGateClientSlug(
  funnelClientSlug: string | null | undefined,
  utmClientSlug: string | null | undefined,
): string | null {
  const queryClientSlug =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("client")
      : null;

  const lsClientSlug =
    typeof window !== "undefined"
      ? localStorage.getItem("wm_client_slug")
      : null;

  const effectiveClientSlug =
    funnelClientSlug ?? queryClientSlug ?? utmClientSlug ?? lsClientSlug ?? null;

  if (effectiveClientSlug && typeof window !== "undefined") {
    try {
      localStorage.setItem("wm_client_slug", effectiveClientSlug);
    } catch {
      // preserve existing swallow behavior
    }
  }

  return effectiveClientSlug;
}

/** Builds the capture-truth-gate-lead body (exported for tests). */
export function buildTruthGateLeadPayload(
  input: BuildTruthGateLeadPayloadInput,
): Record<string, unknown> {
  const utm = captureUtmFromUrl();
  const fb = readLateFbCookies(
    { fbp: utm.fbp, fbc: utm.fbc },
    { surface: "truth_gate_flow", sessionId: input.sessionId },
  );

  const effectiveClientSlug = resolveTruthGateClientSlug(
    input.funnelClientSlug,
    utm.client_slug,
  );

  const landingPageUrl =
    utm.landing_page_url ??
    (typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null);

  // Capture-page fields record where THIS submit happened, independent of
  // the (possibly stale) first-touch landing_page_url. See B1 in the live
  // CTA audit: first-touch scalars can point to an old route when
  // localStorage attribution predates the current paid click. These live
  // in query_params/attribution only — no schema change, no scalar override.
  const capturePagePath =
    typeof window !== "undefined" ? window.location.pathname : null;
  const capturePageUrl =
    typeof window !== "undefined"
      ? `${window.location.pathname}${window.location.search}`
      : null;

  const attributionPayload = getAttributionPayload();
  const baseQueryParams =
    (attributionPayload.query_params as Record<string, string | string[]>) ??
    {};
  const { query_params: _queryParams, ...attributionBody } = attributionPayload;

  const queryParams = {
    ...baseQueryParams,
    ...(capturePagePath ? { capture_page_path: capturePagePath } : {}),
    ...(capturePageUrl ? { capture_page_url: capturePageUrl } : {}),
  };

  return {
    session_id: input.sessionId,
    first_name: input.firstName,
    email: input.email,
    phone_e164: input.phoneE164,
    county: null,
    project_type: null,
    window_count: null,
    quote_range: null,
    source: TRUTH_GATE_SOURCE,
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
      capture_page_path: capturePagePath,
      capture_page_url: capturePageUrl,
    },
    query_params: queryParams,
  };
}

export async function submitTruthGateLead(
  input: SubmitTruthGateLeadInput,
): Promise<TruthGateLeadResult> {
  const phoneE164 = normalizeTruthGatePhoneToE164(input.phone);

  try {
    const body = buildTruthGateLeadPayload({
      sessionId: input.sessionId,
      firstName: input.firstName,
      email: input.email,
      phoneE164,
      funnelClientSlug: input.funnelClientSlug,
    });

    const openAiAdsContext = getOpenAiAdsCaptureContext();
    if (openAiAdsContext) {
      body.openai_ads = openAiAdsContext;
    }

    const { data: captureData, error: captureError } =
      await supabase.functions.invoke("capture-truth-gate-lead", { body });

    if (captureError || !captureData?.success) {
      const errBody = (captureData ?? {}) as {
        code?: string;
        message?: string;
      };
      const code = errBody.code || captureError?.name || "lead_capture_failed";
      const message =
        errBody.message ||
        captureError?.message ||
        SAFE_CAPTURE_MESSAGE;

      if (import.meta.env.DEV) {
        console.error("[truthGateLeadCapture] contact capture failed", {
          code,
          message,
          session_id: input.sessionId,
        });
      }

      return { ok: false, code, message, sessionId: input.sessionId };
    }

    const resolvedSessionId =
      (typeof captureData.session_id === "string" && captureData.session_id) ||
      input.sessionId;

    if (!captureData.lead_id) {
      return {
        ok: false,
        code: "lead_capture_failed",
        message: SAFE_CAPTURE_MESSAGE,
        sessionId: resolvedSessionId,
      };
    }

    const clientSlug = (body.client_slug as string | null | undefined) ?? null;
    const reused = captureData.reused === true;
    const openAiAdsEventId =
      !reused &&
      typeof captureData.openai_ads_event_id === "string" &&
      captureData.openai_ads_event_id.trim().length > 0
        ? captureData.openai_ads_event_id
        : undefined;

    if (import.meta.env.DEV) {
      console.info("[truthGateLeadCapture] capture-truth-gate-lead success", {
        sessionId: resolvedSessionId,
        leadId: (captureData.lead_id as string | null) ?? null,
        phoneStatus: phoneE164 ? "screened_valid" : "none",
        clientSlug,
      });
    }

    const attribution = body.attribution as Record<string, unknown> | undefined;
    pushLeadMagnetCaptured({
      leadId: captureData.lead_id as string,
      sessionId: resolvedSessionId,
      captureSource: (body.source as string) || TRUTH_GATE_SOURCE,
      capturePagePath: (attribution?.capture_page_path as string | null) ?? null,
      capturePageUrl: (attribution?.capture_page_url as string | null) ?? null,
      clientSlug,
    });

    if (openAiAdsContext && openAiAdsEventId) {
      trackOpenAiAdsLeadCreated(openAiAdsEventId);
    }

    return {
      ok: true,
      leadId: captureData.lead_id as string,
      sessionId: resolvedSessionId,
      reused,
      ...(openAiAdsEventId ? { openAiAdsEventId } : {}),
      phoneE164,
      clientSlug,
    };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error("[truthGateLeadCapture] unexpected error", {
        session_id: input.sessionId,
        name: err instanceof Error ? err.name : "unknown",
      });
    }

    return {
      ok: false,
      code: "lead_capture_failed",
      message: SAFE_CAPTURE_MESSAGE,
      sessionId: input.sessionId,
    };
  }
}
