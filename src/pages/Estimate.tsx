/**
 * /estimate — Post-report conversion page.
 *
 * Single job: convert a homeowner who has just received their Snapshot Receipt
 * (or just unlocked their full report) into a request for a vetted
 * second-opinion estimate from WindowMan.
 *
 * Scope guard:
 *   - one primary CTA only
 *   - no broad navigation
 *   - no dashboards
 *   - no scheduling system
 *   - reuses request-callback edge function for callback intent
 *
 * Context handoff:
 *   - reads `?session=<scan_session_id>` from the URL
 *   - hydrates lead identity (lead_id, phone, county, grade) server-side via
 *     existing canonical reads — no extra schema introduced
 */

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ShieldCheck, Search, Hammer, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { trackEvent } from "@/lib/trackEvent";
import { trackGtmEvent } from "@/lib/trackConversion";
import { buildCanonicalEventId } from "@/lib/tracking/canonicalEventId";
import { toast } from "sonner";

type LeadSnapshot = {
  leadId: string;
  firstName: string | null;
  county: string | null;
  phoneE164: string | null;
};
function firstRpcRow<T>(data: T[] | T | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

export default function Estimate() {
  const [searchParams] = useSearchParams();
  const scanSessionId = searchParams.get("session");

  const [snapshot, setSnapshot] = useState<LeadSnapshot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const rpc = supabase.rpc as unknown as (
    fnName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;

  // ── Hydrate lead context from scan_session via safe RPC ──
  // Uses get_lead_context_for_session (SECURITY DEFINER) to avoid direct
  // browser SELECTs on scan_sessions and leads. grade and phone_verified
  // are intentionally not returned by this RPC.
  useEffect(() => {
    if (!scanSessionId) return;
    let cancelled = false;
    (async () => {
      type LeadContextForSessionRow = {
        lead_id: string;
        first_name: string | null;
        county: string | null;
        phone_e164: string | null;
      };
      const { data } = await rpc("get_lead_context_for_session", {
        p_scan_session_id: scanSessionId,
      });
      const row = firstRpcRow<LeadContextForSessionRow>(
        data as LeadContextForSessionRow[] | LeadContextForSessionRow | null | undefined,
      );
      if (cancelled || !row?.lead_id) return;

      setSnapshot({
        leadId: row.lead_id,
        firstName: row.first_name ?? null,
        county: row.county ?? null,
        phoneE164: row.phone_e164 ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [scanSessionId]);

  useEffect(() => {
    trackEvent({
      event_name: "estimate_page_viewed",
      session_id: scanSessionId ?? undefined,
      route: "/estimate",
      metadata: { has_session: !!scanSessionId },
    });
  }, [scanSessionId]);

  const headline = useMemo(() => {
    if (snapshot?.firstName) {
      return `${snapshot.firstName}, get a vetted second opinion`;
    }
    return "Get a vetted second opinion on your window quote";
  }, [snapshot?.firstName]);

  const handleRequestEstimate = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      // Canonical business event — single owner.
      const eventId = buildCanonicalEventId({
        eventName: "contractor_match_requested",
        leadId: snapshot?.leadId,
        scanSessionId: scanSessionId ?? undefined,
      });
      trackGtmEvent("contractor_match_requested", {
        event_id: eventId,
        scan_session_id: scanSessionId ?? undefined,
        lead_id: snapshot?.leadId ?? undefined,
        county: snapshot?.county ?? undefined,
        cta_source: "estimate_page",
      });

      // If we have a lead with a phone number, route a callback intent
      // through the existing voice-followup pipe. Otherwise we still mark the
      // page as a conversion event in our operational log.
      if (scanSessionId && snapshot?.phoneE164) {
        const { error } = await supabase.functions.invoke("voice-followup", {
          body: {
            scan_session_id: scanSessionId,
            phone_e164: snapshot.phoneE164,
            call_intent: "contractor_intro",
            cta_source: "estimate_page",
          },
        });
        if (error) {
          console.warn("[estimate] voice-followup invoke failed:", error);
        }
      }

      trackEvent({
        event_name: "estimate_requested",
        session_id: scanSessionId ?? undefined,
        route: "/estimate",
        metadata: {
          lead_id: snapshot?.leadId ?? null,
        },
      });

      setSubmitted(true);
    } catch (err) {
      console.error("[estimate] submit error", err);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      className="relative min-h-screen overflow-hidden pb-24"
      style={{
        background:
          "linear-gradient(170deg, #0a0f1a 0%, #0e1828 35%, #0a1322 70%, #07101c 100%)",
      }}
    >
      <Helmet>
        <title>Request a Vetted Second Opinion | WindowMan</title>
        <meta
          name="description"
          content="Get a clean, same-scope estimate from a WindowMan-vetted contractor based on what your scan found."
        />
        <link rel="canonical" href="https://wmmvp.lovable.app/estimate" />
      </Helmet>

      <section className="mx-auto max-w-2xl px-5 pt-16 md:pt-24">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.22em] text-[#49A5FF]">
          WindowMan • Post-Report
        </p>
        <h1 className="text-3xl font-black leading-tight tracking-tight text-white md:text-5xl">
          {headline}
        </h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-white/75 md:text-lg">
          Your scan found issues worth correcting. WindowMan can generate a{" "}
          <strong className="text-white">cleaner, same-scope estimate</strong>{" "}
          from a vetted contractor — so you finally have an honest baseline to
          compare against.
        </p>

        {/* Why this estimate is different */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Card
            icon={<Search className="h-5 w-5 text-[#49A5FF]" />}
            title="Informed by your scan"
            body="We use the gaps, missing line items, and red flags we found in your quote to scope the new estimate."
          />
          <Card
            icon={<ShieldCheck className="h-5 w-5 text-[#10B981]" />}
            title="Vetted contractor only"
            body="No directory roulette. We only route to contractors who agreed to our forensic transparency standard."
          />
          <Card
            icon={<Hammer className="h-5 w-5 text-[#E2B04A]" />}
            title="Apples-to-apples"
            body="Same scope, same products, same warranty terms — so price actually means something this time."
          />
        </div>

        {/* CTA */}
        <div className="mt-12">
          {submitted ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <p className="text-lg font-bold text-white">Request received.</p>
              <p className="mt-2 text-sm text-white/75">
                A WindowMan advisor will reach out shortly to confirm scope and
                connect you with a vetted contractor for your second opinion.
              </p>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={handleRequestEstimate}
                disabled={submitting}
                className="inline-flex w-full items-center justify-center rounded-md bg-gradient-to-r from-[#C8952A] to-[#E2B04A] px-8 py-4 text-base font-extrabold uppercase tracking-wider text-[#0D0D0D] shadow-lg transition-opacity hover:opacity-95 disabled:opacity-60 md:w-auto"
              >
                {submitting ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Sending request…
                  </span>
                ) : (
                  "Request My WindowMan Estimate"
                )}
              </button>
              <p className="mt-3 text-xs text-white/55">
                One request. No spam. We will not share your contact with
                anyone until you tell us to.
              </p>
            </>
          )}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs text-white/50">
          Questions about your report?{" "}
          <Link to="/contact" className="text-[#49A5FF] underline-offset-2 hover:underline">
            Contact us
          </Link>
          .
        </div>
      </section>
    </main>
  );
}

function Card({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-white/5">
        {icon}
      </div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="mt-1.5 text-[13px] leading-6 text-white/70">{body}</p>
    </div>
  );
}
