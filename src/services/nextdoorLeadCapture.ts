import type { NextdoorWmIntent, QuoteReadiness } from "@/components/nextdoor/types";
import type { NextdoorNextRoute } from "@/lib/nextdoor/pathRouter";
import { supabase } from "@/integrations/supabase/client";
import { getAttributionPayload, getUtmData } from "@/lib/useUtmCapture";

const SAFE_ERROR = "We couldn't save this yet. Check your details and try again.";

export type SubmitNextdoorLeadInput = {
  sessionId: string;
  firstName: string;
  email: string;
  zip?: string | null;
  lastName?: string;
  phoneE164?: string | null;
  quoteReadiness: QuoteReadiness;
  nextRoute: NextdoorNextRoute;
  wmIntent: NextdoorWmIntent;
  /**
   * Optional extra query_params keys (e.g. Track C qualification). Folded into
   * the lead's query_params bag. The Edge merge is per-key non-destructive, so
   * these only ever ADD missing keys — they never overwrite prior values.
   */
  extraQueryParams?: Record<string, string>;
};

export type SubmitNextdoorLeadResult =
  | { ok: true; reused?: boolean; leadId?: string }
  | { ok: false; message: string };

function mergeQueryParams(
  base: Record<string, string | string[]>,
  input: SubmitNextdoorLeadInput,
): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const [key, value] of Object.entries(base)) {
    if (typeof value === "string" && value.trim()) {
      merged[key] = value.trim();
    } else if (Array.isArray(value) && value[0]?.trim()) {
      merged[key] = value[0].trim();
    }
  }

  merged.quote_readiness = input.quoteReadiness;
  merged.next_route = input.nextRoute;
  merged.wm_intent = input.wmIntent;

  const zip = input.zip?.trim();
  if (zip) {
    merged.zip = zip;
  }

  const lastName = input.lastName?.trim();
  if (lastName) {
    merged.last_name = lastName;
  }

  if (input.extraQueryParams) {
    for (const [key, value] of Object.entries(input.extraQueryParams)) {
      const trimmed = value?.trim();
      if (key && trimmed) {
        merged[key] = trimmed;
      }
    }
  }

  return merged;
}

export async function submitNextdoorLead(
  input: SubmitNextdoorLeadInput,
): Promise<SubmitNextdoorLeadResult> {
  if (!input.sessionId) {
    return { ok: false, message: SAFE_ERROR };
  }

  try {
    const utm = getUtmData();
    const attributionPayload = getAttributionPayload();
    const baseQueryParams =
      (attributionPayload.query_params as Record<string, string | string[]>) ?? {};
    const { query_params: _queryParams, ...attributionBody } = attributionPayload;

    const landingPageUrl =
      utm.landing_page_url ??
      (typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : null);

    const body = {
      session_id: input.sessionId,
      first_name: input.firstName.trim(),
      email: input.email.trim().toLowerCase(),
      // Phone only persists on the first lead insert for a session.
      // Subsequent submits on the same session do not update PII because the edge capture path is idempotent.
      phone_e164: input.phoneE164 ?? null,
      source: "nextdoor",
      client_slug: null,
      utm_source: utm.utm_source,
      utm_medium: utm.utm_medium,
      utm_campaign: utm.utm_campaign,
      utm_term: utm.utm_term,
      utm_content: utm.utm_content,
      fbclid: utm.fbclid,
      gclid: utm.gclid,
      fbc: (attributionPayload.fbc as string | null) ?? null,
      fbp: (attributionPayload.fbp as string | null) ?? null,
      landing_page_url: landingPageUrl,
      first_page_path: utm.landing_page,
      initial_referrer: typeof document !== "undefined" ? document.referrer || null : null,
      attribution: attributionBody,
      query_params: mergeQueryParams(baseQueryParams, input),
    };

    const { data, error } = await supabase.functions.invoke("capture-truth-gate-lead", {
      body,
    });

    if (error || !data?.success) {
      if (import.meta.env.DEV) {
        console.error("[nextdoorLeadCapture] capture failed", {
          code: (data as { code?: string } | null)?.code ?? error?.name,
          session_id: input.sessionId,
        });
      }
      return { ok: false, message: SAFE_ERROR };
    }

    const result = data as { lead_id?: string | null; reused?: boolean };
    return {
      ok: true,
      reused: result.reused === true,
      leadId: result.lead_id ?? undefined,
    };
  } catch {
    return { ok: false, message: SAFE_ERROR };
  }
}
