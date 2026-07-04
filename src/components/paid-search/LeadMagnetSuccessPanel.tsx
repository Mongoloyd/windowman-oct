// src/components/paid-search/LeadMagnetSuccessPanel.tsx
//
// Shared success panel for paid-search lead magnets.
//
// CRO purpose:
// - Keep the lead-magnet promise immediately with a public PDF download.
// - Make quote upload the dominant next action.
// - Use the existing ScanFunnel identity bridge so captured leads do NOT
//   re-enter name/email on /quote-check.
//
// Security/product boundary:
// - No backend calls.
// - No scanner calls.
// - No OTP/report calls.
// - No email/SMS calls.
// - Only writes the already-returned leadId/sessionId into ScanFunnel state,
//   matching the existing PricingSearchLanding handoff pattern.

import { useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  paidSearchPrimaryButtonClass,
} from "@/components/paid-search/PaidSearchLandingShell";
import { useScanFunnelSafe } from "@/state/scanFunnel";

const PDF_URL = "/lead-magnets/window-price-audit.pdf";
const UPLOAD_HANDOFF_URL = "/?post_capture=upload&source=quote-check";

export type LeadMagnetSuccessVariant =
  | "window_price_audit"
  | "truth_report_demo"
  | "ai_demo"
  | "window_prices";

interface LeadMagnetSuccessPanelProps {
  firstName?: string;
  email?: string;
  leadId?: string | null;
  sessionId?: string | null;
  variant: LeadMagnetSuccessVariant;
}

const VARIANT_COPY: Record<
  LeadMagnetSuccessVariant,
  {
    eyebrow: string;
    headline: string;
    body: string;
    primaryCta: string;
  }
> = {
  window_price_audit: {
    eyebrow: "Step 1 complete",
    headline: "Your Window Price Audit is unlocked.",
    body:
      "Use the audit to understand the traps. Then upload your actual quote to see which risks may apply to your contract.",
    primaryCta: "Upload My Quote for a Free AI Scan",
  },
  truth_report_demo: {
    eyebrow: "Preview unlocked",
    headline: "Your Truth Report preview is unlocked.",
    body:
      "The sample shows the framework. Your own quote scan shows the actual missing specs, price risks, and questions to ask.",
    primaryCta: "Scan My Actual Quote",
  },
  ai_demo: {
    eyebrow: "AI demo unlocked",
    headline: "The AI demo is unlocked.",
    body:
      "The demo shows how WindowMan reads a quote. Upload yours to get plain-English risk signals from your actual estimate.",
    primaryCta: "Run the AI on My Quote",
  },
  window_prices: {
    eyebrow: "Pricing report unlocked",
    headline: "Your pricing report is unlocked.",
    body:
      "Benchmarks help. Your quote tells the real story. Upload your estimate to check the actual scope, specs, and red flags.",
    primaryCta: "Check My Actual Quote",
  },
};

export function LeadMagnetSuccessPanel({
  firstName,
  email,
  leadId,
  sessionId,
  variant,
}: LeadMagnetSuccessPanelProps) {
  const navigate = useNavigate();
  const funnel = useScanFunnelSafe();
  const copy = VARIANT_COPY[variant];
  const displayName = firstName?.trim() || "neighbor";
  const displayEmail = email?.trim();

  useEffect(() => {
    if (typeof document === "undefined") return;

    const existing = document.querySelector<HTMLLinkElement>(
      `link[rel="prefetch"][href="${PDF_URL}"]`,
    );
    if (existing) return;

    const link = document.createElement("link");
    link.rel = "prefetch";
    link.href = PDF_URL;
    link.as = "document";
    document.head.appendChild(link);

    return () => {
      link.remove();
    };
  }, []);

  const handleUploadClick = useCallback(() => {
    if (funnel && leadId && sessionId) {
      funnel.setLeadId(leadId);
      funnel.setSessionId(sessionId);
    } else if (import.meta.env.DEV) {
      console.warn(
        "[LeadMagnetSuccessPanel] Missing ScanFunnel or identity pair; falling back to quote-check path.",
        {
          hasFunnel: Boolean(funnel),
          hasLeadId: Boolean(leadId),
          hasSessionId: Boolean(sessionId),
        },
      );
    }

    navigate(UPLOAD_HANDOFF_URL);
  }, [funnel, leadId, navigate, sessionId]);

  return (
    <div className="text-center" role="status" aria-live="polite">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[#49A5FF]/40 bg-[#49A5FF]/10">
        <span aria-hidden="true" className="text-2xl text-[#49A5FF]">
          ✓
        </span>
      </div>

      <p className="mt-4 text-xs font-bold uppercase tracking-widest text-[#49A5FF]">
        {copy.eyebrow}
      </p>

      <h2 className="mt-2 text-2xl font-extrabold leading-tight text-white">
        {copy.headline}
      </h2>

      <p className="mt-3 text-sm leading-relaxed text-white/80">
        You&apos;re in,{" "}
        <span className="font-semibold text-white">{displayName}</span>
        {displayEmail ? (
          <>
            . We saved this request for{" "}
            <span className="font-semibold text-[#49A5FF]">{displayEmail}</span>
          </>
        ) : null}
        .
      </p>

      <div className="mt-4 rounded-xl border border-[#C8952A]/30 bg-[#C8952A]/10 px-4 py-3 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-[#C8952A]">
          Most homeowners stop too early
        </p>
        <p className="mt-1 text-sm leading-relaxed text-white/80">
          {copy.body}
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={handleUploadClick}
          className={`w-full ${paidSearchPrimaryButtonClass}`}
        >
          {copy.primaryCta} →
        </button>

        <a
          href={PDF_URL}
          download
          className="block w-full rounded-lg border border-white/15 bg-white/[0.04] px-6 py-3 text-sm font-bold text-white transition hover:border-[#49A5FF]/40 hover:bg-white/[0.07] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#49A5FF]/40"
        >
          Download the Window Price Audit PDF
        </a>
      </div>

      <div className="mt-5 grid gap-2 text-left text-xs leading-relaxed text-white/65">
        <div className="flex gap-2">
          <span className="mt-0.5 text-[#49A5FF]" aria-hidden="true">
            ✓
          </span>
          <span>No contractor is contacted unless you ask.</span>
        </div>
        <div className="flex gap-2">
          <span className="mt-0.5 text-[#49A5FF]" aria-hidden="true">
            ✓
          </span>
          <span>Your quote scan is free for homeowners.</span>
        </div>
        <div className="flex gap-2">
          <span className="mt-0.5 text-[#49A5FF]" aria-hidden="true">
            ✓
          </span>
          <span>The upload step uses the contact identity you already submitted.</span>
        </div>
      </div>
    </div>
  );
}

export default LeadMagnetSuccessPanel;