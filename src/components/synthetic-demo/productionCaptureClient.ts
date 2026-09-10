import { captureQuoteEducationDemoLead } from "@/lib/captureQuoteEducationDemoLead";
import { getAttributionPayload } from "@/lib/useUtmCapture";
import { CAPTURE_ERROR, trustedDemoLead } from "./captureValidation";
import { isSyntheticDemoVariant, SAMPLE_QUOTE } from "./fixture";
import type { SyntheticDemoCaptureClient, SyntheticDemoCreateInput, SyntheticDemoIntake } from "./types";

const QUOTE_EDUCATION_DEMO_SOURCE = "quote-education-demo" as const;
const ATTRIBUTION_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
  "fbclid", "gclid", "ttclid", "wbraid", "gbraid", "msclkid", "ndclid",
  "nd_lead_id", "nd_form_id", "nd_ad_id", "nd_ad_group_id", "nd_campaign_id",
  "fbc", "fbp", "ttp", "client_slug", "wm_intent",
] as const;
const URL_KEYS = ["landing_page_url", "current_page_url", "latest_touch_page_url", "referrer"] as const;
const FAILURE = { ok: false, code: "capture_failed", message: CAPTURE_ERROR } as const;
const EMAIL_LIKE = /[^\s/@]+@[^\s/@]+\.[^\s/@]+/;

function scalar(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim() || value.length > 500 || EMAIL_LIKE.test(value)) return undefined;
  return value.trim();
}
function safeUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value) return undefined;
  try {
    const url = new URL(value, "https://windowman.invalid");
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return undefined;
    const query = new URLSearchParams();
    for (const key of ATTRIBUTION_KEYS) {
      const selected = scalar(url.searchParams.get(key));
      if (selected) query.set(key, selected);
    }
    const path = url.pathname;
    if (EMAIL_LIKE.test(decodeURIComponent(path))) return undefined;
    const suffix = query.size ? `?${query}` : "";
    return `${value.startsWith("/") ? "" : url.origin}${path}${suffix}`.slice(0, 1000);
  } catch { return undefined; }
}
/** Explicit projection: raw queries and extra props never cross this boundary. */
export function buildDemoAttribution(input: SyntheticDemoCreateInput): Record<string, unknown> {
  if (!isSyntheticDemoVariant(input.variant) || input.fixtureId !== SAMPLE_QUOTE.id) {
    throw new Error("Invalid synthetic demo fixture");
  }
  const captured = getAttributionPayload();
  const fields: Record<string, string> = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = scalar(captured[key]);
    if (value) fields[key] = value;
  }
  for (const key of URL_KEYS) {
    const value = safeUrl(captured[key]);
    if (value) fields[key] = value;
  }
  for (const key of ["landing_page", "latest_touch_page"] as const) {
    const value = safeUrl(captured[key]);
    if (value) fields[key] = value.split("?")[0];
  }
  for (const key of ["first_touch_at", "latest_touch_at", "captured_at"] as const) {
    const value = scalar(captured[key]);
    if (value) fields[key] = value;
  }
  const query: Record<string, string> = {};
  const sourceQuery = captured.query_params;
  if (sourceQuery && typeof sourceQuery === "object" && !Array.isArray(sourceQuery)) {
    for (const key of ATTRIBUTION_KEYS) {
      const value = scalar((sourceQuery as Record<string, unknown>)[key]);
      if (value) query[key] = value;
    }
  }
  const demo = {
    synthetic_demo_variant: input.variant,
    synthetic_demo_host_path: input.attribution.sourcePath.split(/[?#]/)[0],
    synthetic_demo_entry_point: input.attribution.entryPoint,
    synthetic_demo_fixture_id: input.fixtureId,
  };
  if (!/^\/[a-zA-Z0-9/_-]*$/.test(demo.synthetic_demo_host_path) ||
      !/^[a-zA-Z0-9_-]{1,100}$/.test(demo.synthetic_demo_entry_point)) {
    throw new Error("Invalid synthetic demo attribution");
  }
  return {
    utm_source: fields.utm_source, utm_medium: fields.utm_medium,
    utm_campaign: fields.utm_campaign, utm_term: fields.utm_term, utm_content: fields.utm_content,
    fbclid: fields.fbclid, gclid: fields.gclid, fbc: fields.fbc, fbp: fields.fbp,
    client_slug: fields.client_slug || "direct",
    landing_page_url: fields.landing_page_url,
    first_page_path: fields.landing_page,
    initial_referrer: fields.referrer,
    query_params: { ...query, ...demo },
    attribution: { ...fields, ...demo },
  };
}

function secureSessionId(): string {
  if (typeof crypto === "undefined") throw new Error("Secure session unavailable");
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const productionCaptureClient: SyntheticDemoCaptureClient = {
  startSession() {
    const sessionId = secureSessionId();
    let inFlight: Promise<unknown> | null = null;
    let saved: ReturnType<typeof trustedDemoLead> = null;
    async function update(leadId: string, action: "update_zip" | "update_phone" | "update_intake", fields: Record<string, unknown>) {
      if (!saved || saved.leadId !== leadId) return FAILURE;
      try {
        const result = await captureQuoteEducationDemoLead({
          ...fields, action, session_id: sessionId, lead_id: leadId, source: QUOTE_EDUCATION_DEMO_SOURCE,
        });
        const trusted = trustedDemoLead(result, sessionId);
        return trusted?.leadId === leadId ? result : FAILURE;
      } catch { return FAILURE; }
    }
    return {
      sessionId,
      create(input) {
        if (inFlight) return inFlight;
        if (saved) return Promise.resolve({ ok: true, ...saved });
        inFlight = (async () => {
          try {
            const result = await captureQuoteEducationDemoLead({
              ...buildDemoAttribution(input), action: "create", session_id: sessionId,
              source: QUOTE_EDUCATION_DEMO_SOURCE,
              variant: input.variant,
              host_page: input.attribution.sourcePath.split(/[?#]/)[0],
              entry_point: input.attribution.entryPoint,
              fixture_id: input.fixtureId,
              first_name: input.contact.firstName.trim(), email: input.contact.email.trim().toLowerCase(),
            });
            saved = trustedDemoLead(result, sessionId);
            return saved ? result : FAILURE;
          } catch { return FAILURE; }
        })().finally(() => { inFlight = null; });
        return inFlight;
      },
      updateZip: (leadId, zip) => update(leadId, "update_zip", { zip_code: zip }),
      updatePhone: (leadId, phone) => update(leadId, "update_phone", { phone }),
      updateIntake: (leadId, intake: SyntheticDemoIntake) => update(leadId, "update_intake", {
        intake_status: intake.status, intake_property: intake.property, intake_scope: intake.scope,
        intake_logistics: intake.logistics, intake_timeline: intake.timeline,
      }),
    };
  },
};
