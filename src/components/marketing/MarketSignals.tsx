// src/components/marketing/MarketSignals.tsx
//
// Static CRO support section for paid-traffic landing pages.
// UI-only. No Supabase. No fetch. No Edge Functions. No tracking.
// No report data. No analyses.full_json. No localStorage.

import {
  paidSearchEyebrowClass,
  paidSearchPrimaryButtonClass,
  paidSearchSectionTitleClass,
} from "@/components/paid-search/PaidSearchLandingShell";

type MarketSignalsProps = {
  targetFormId: string;
  ctaText?: string;
  ctaMicrocopy?: string;
  className?: string;
};

type MarketSignalVisual = "scope" | "product" | "payment" | "baseline";

type MarketSignalCard = {
  readonly code: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly body: string;
  readonly visual: MarketSignalVisual;
  readonly visualLabel: string;
};

const MARKET_SIGNAL_CARDS = [
  {
    code: "01",
    eyebrow: "Scope Omissions",
    title: "Missing scope turns into surprise charges.",
    body:
      "Stucco repair, buck work, trim, demolition, debris removal, disposal, permit handling, and final inspection language are easy to leave vague. A cheaper quote can become the expensive one if the missing work shows up later as a change order.",
    visual: "scope",
    visualLabel:
      "Line item audit diagram comparing included scope items against one hidden fee warning.",
  },
  {
    code: "02",
    eyebrow: "Product Verification",
    title: "\u201CImpact window\u201D is not enough detail.",
    body:
      "A real quote should identify the product series, glass system, approval details, design pressure, opening type, and install method. Without those specifics, you are not comparing products \u2014 you are comparing sales language.",
    visual: "product",
    visualLabel:
      "Specification gauge diagram showing verified impact details versus missing product-code fields.",
  },
  {
    code: "03",
    eyebrow: "Payment Risk",
    title: "Bad payment timing shifts risk onto you.",
    body:
      "Large deposits, front-loaded progress payments, and final balances due before inspection can weaken your leverage. The safest quote is not only about price \u2014 it is about when money changes hands and what must be completed first.",
    visual: "payment",
    visualLabel:
      "Risk timeline diagram contrasting front-loaded payments against inspection-backed milestones.",
  },
  {
    code: "04",
    eyebrow: "Bid Baseline",
    title: "A clean baseline makes outliers obvious.",
    body:
      "Once you know what a normal quote should include, every next bid becomes easier to read. You can spot suspiciously low omissions, inflated anchors, vague allowances, and pricing that does not match the actual scope.",
    visual: "baseline",
    visualLabel:
      "Baseline anchor overlay diagram showing a normal bid band exposing low and high outlier estimates.",
  },
] as const satisfies readonly MarketSignalCard[];

const SCOPE_ROWS = [
  { label: "Permit handling", state: "checked" },
  { label: "Debris removal", state: "checked" },
  { label: "Stucco repair", state: "warning" },
] as const;

const PRODUCT_SPECS = [
  { label: "Series", value: "listed", state: "verified" },
  { label: "NOA", value: "missing", state: "missing" },
  { label: "DP", value: "not shown", state: "missing" },
] as const;

const PAYMENT_MILESTONES = [
  { label: "Deposit", risky: 72, safer: 20 },
  { label: "Install", risky: 22, safer: 45 },
  { label: "Inspect", risky: 6, safer: 35 },
] as const;

const BID_MARKERS = [
  { label: "Low", x: 16, tone: "warning" },
  { label: "Baseline", x: 50, tone: "baseline" },
  { label: "High", x: 84, tone: "warning" },
] as const;

export default function MarketSignals({
  targetFormId,
  ctaText = "Check my quote \u2191",
  ctaMicrocopy =
    "Want your ZIP-level baseline? Use the form above and WindowMan will show you what to question before you compare bids.",
  className = "",
}: MarketSignalsProps) {
  const handleCtaClick = () => {
    const target = document.getElementById(targetFormId);
    if (!target) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const focusFirstField = () => {
      const firstFocusable = target.querySelector<HTMLElement>(
        [
          "input:not([disabled])",
          "select:not([disabled])",
          "textarea:not([disabled])",
          "button:not([disabled])",
          "a[href]",
          '[tabindex]:not([tabindex="-1"])',
        ].join(", "),
      );

      firstFocusable?.focus({ preventScroll: true });
    };

    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "start",
    });

    let didFocus = false;
    const focusOnce = () => {
      if (didFocus) return;
      didFocus = true;
      focusFirstField();
    };

    if (!reduceMotion && typeof window !== "undefined" && "onscrollend" in window) {
      const onScrollEnd = () => {
        window.removeEventListener("scrollend", onScrollEnd);
        focusOnce();
      };

      window.addEventListener("scrollend", onScrollEnd, { once: true });
      window.setTimeout(() => {
        window.removeEventListener("scrollend", onScrollEnd);
        focusOnce();
      }, 700);
      return;
    }

    window.setTimeout(focusOnce, reduceMotion ? 0 : 450);
  };

  return (
    <section
      aria-labelledby="market-signals-heading"
      className={`relative isolate overflow-hidden border-y border-white/10 bg-[#0B1728] ${className}`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(73,165,255,0.13),transparent_58%),radial-gradient(ellipse_at_bottom_right,rgba(200,149,42,0.08),transparent_52%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(to_right,rgba(255,255,255,0.65)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.65)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.75),rgba(0,0,0,0.28),rgba(0,0,0,0.65))]"
      />

      <div className="relative mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="max-w-3xl">
          <p className={paidSearchEyebrowClass}>Market Signals</p>

          <h2
            id="market-signals-heading"
            className={`mt-2 max-w-3xl ${paidSearchSectionTitleClass}`}
          >
            <span className="block">The price is not the proof.</span>
            <span className="block">The details behind it are.</span>
          </h2>

          <p className="mt-4 max-w-2xl text-[15px] leading-7 text-white/80 sm:text-base">
            WindowMan looks for the quote patterns homeowners usually miss:
            vague scope, unclear product specs, risky payment timing, and bid
            numbers that do not match the work. Before you compare contractors,
            get a baseline for what should be checked.
          </p>

          <p className="mt-4 inline-flex rounded-full border border-[#49A5FF]/25 bg-[#49A5FF]/10 px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-[#49A5FF]">
            What WindowMan checks before a quote number means anything.
          </p>
        </div>

        <div className="mt-9 grid gap-5 lg:grid-cols-2 lg:items-start">
          {MARKET_SIGNAL_CARDS.map((card) => (
            <MarketSignalCardView key={card.code} card={card} />
          ))}
        </div>

        <div className="mt-9 overflow-hidden rounded-2xl border border-[#49A5FF]/20 bg-white/[0.045] shadow-[0_8px_40px_rgba(73,165,255,0.14)] backdrop-blur-md">
          <div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
            <div>
              <p className="text-sm leading-relaxed text-white/75 sm:text-base">
                {ctaMicrocopy}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-white/45">
                Static market-signal examples. Your specific report depends on
                your quote, project details, and location.
              </p>
            </div>

            <button
              type="button"
              onClick={handleCtaClick}
              className={`${paidSearchPrimaryButtonClass} justify-center whitespace-nowrap px-5 py-3 text-sm sm:text-base`}
            >
              {ctaText}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function MarketSignalCardView({ card }: { card: MarketSignalCard }) {
  return (
    <article className="group rounded-[1.35rem] border border-white/10 bg-white/[0.025] p-[1px] shadow-[0_8px_40px_rgba(0,0,0,0.34)] transition hover:border-[#49A5FF]/35">
      <div className="rounded-[1.28rem] border border-white/[0.06] bg-[#0F1F35]/80 p-5 backdrop-blur-md sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#49A5FF]">
              {card.eyebrow}
            </p>
            <h3 className="mt-2 text-xl font-extrabold leading-tight tracking-tight text-white">
              {card.title}
            </h3>
          </div>

          <span className="rounded-md border border-[#49A5FF]/35 bg-[#49A5FF]/10 px-2 py-1 text-xs font-bold text-[#49A5FF]">
            {card.code}
          </span>
        </div>

        <div
          role="img"
          aria-label={card.visualLabel}
          className="mt-5 min-h-[144px] overflow-hidden rounded-2xl border border-white/10 bg-[#071120] p-4 sm:min-h-[156px]"
        >
          {renderVisual(card.visual)}
        </div>

        <p className="mt-5 text-[13.5px] leading-6 text-white/76 sm:text-sm">
          {card.body}
        </p>
      </div>
    </article>
  );
}

function renderVisual(visual: MarketSignalVisual) {
  switch (visual) {
    case "scope":
      return <ScopeOmissionsVisual />;
    case "product":
      return <ProductVerificationVisual />;
    case "payment":
      return <PaymentRiskVisual />;
    case "baseline":
      return <BidBaselineVisual />;
    default:
      return null;
  }
}

function ScopeOmissionsVisual() {
  return (
    <div className="min-h-[144px]">
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <span className="text-xs font-bold uppercase tracking-widest text-white/55">
          Line item audit
        </span>
        <span className="rounded-full border border-[#C8952A]/35 bg-[#C8952A]/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-[#C8952A]">
          Review
        </span>
      </div>

      <div className="mt-3 space-y-2.5">
        {SCOPE_ROWS.map((row) => (
          <div
            key={row.label}
            className="grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5"
          >
            <span className="text-sm font-semibold text-white/78">
              {row.label}
            </span>
            {row.state === "checked" ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#49A5FF]/35 bg-[#49A5FF]/10 text-sm font-black text-[#49A5FF]">
                {"\u2713"}
              </span>
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[#C8952A]/45 bg-[#C8952A]/10 text-sm font-black text-[#C8952A]">
                !
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ProductVerificationVisual() {
  return (
    <div className="grid min-h-[144px] gap-4 sm:grid-cols-[0.9fr_1.1fr]">
      <div className="flex items-center justify-center">
        <svg
          viewBox="0 0 160 110"
          className="h-32 w-full max-w-[180px]"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M24 92a58 58 0 1 1 112 0"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M24 92a58 58 0 0 1 31-51"
            stroke="#C8952A"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M55 41a58 58 0 0 1 81 51"
            stroke="#49A5FF"
            strokeWidth="12"
            strokeLinecap="round"
          />
          <path
            d="M80 84 118 54"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <circle cx="80" cy="84" r="7" fill="#49A5FF" />
          <text
            x="80"
            y="105"
            textAnchor="middle"
            className="fill-white/65 text-[11px] font-bold"
          >
            SPEC CLARITY
          </text>
        </svg>
      </div>

      <div className="space-y-2">
        {PRODUCT_SPECS.map((spec) => (
          <div
            key={spec.label}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/[0.035] px-3 py-2"
          >
            <span className="text-xs font-bold uppercase tracking-widest text-white/45">
              {spec.label}
            </span>
            <span
              className={
                spec.state === "verified"
                  ? "rounded-full border border-[#49A5FF]/35 bg-[#49A5FF]/10 px-2 py-1 text-[11px] font-bold text-[#49A5FF]"
                  : "rounded-full border border-[#C8952A]/40 bg-[#C8952A]/10 px-2 py-1 text-[11px] font-bold text-[#C8952A]"
              }
            >
              {spec.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaymentRiskVisual() {
  return (
    <div className="min-h-[144px]">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-white/55">
          Payment timing
        </span>
        <span className="text-[11px] font-semibold text-white/45">
          before final inspection
        </span>
      </div>

      <div className="space-y-4">
        {PAYMENT_MILESTONES.map((item) => (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-xs font-semibold text-white/70">
                {item.label}
              </span>
              <span className="text-[11px] text-white/40">
                risky vs safer
              </span>
            </div>

            <div className="grid gap-1.5">
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#C8952A]"
                  style={{ width: `${item.risky}%` }}
                />
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[#49A5FF]"
                  style={{ width: `${item.safer}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-4 text-[11px] font-semibold text-white/45">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#C8952A]" />
          front-loaded
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#49A5FF]" />
          milestone-backed
        </span>
      </div>
    </div>
  );
}

function BidBaselineVisual() {
  return (
    <div className="flex min-h-[144px] flex-col justify-center">
      <div className="relative mx-2 h-24">
        <div className="absolute left-[18%] right-[18%] top-1/2 h-5 -translate-y-1/2 rounded-full border border-[#49A5FF]/20 bg-[#49A5FF]/10" />
        <div className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-white/15" />

        {BID_MARKERS.map((marker) => (
          <div
            key={marker.label}
            className="absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2"
            style={{ left: `${marker.x}%` }}
          >
            <span
              className={
                marker.tone === "baseline"
                  ? "h-8 w-8 rounded-full border border-[#49A5FF]/45 bg-[#49A5FF]/20 shadow-[0_0_24px_rgba(73,165,255,0.28)]"
                  : "h-6 w-6 rounded-full border border-[#C8952A]/45 bg-[#C8952A]/20"
              }
            />
            <span
              className={
                marker.tone === "baseline"
                  ? "text-xs font-bold uppercase tracking-widest text-[#49A5FF]"
                  : "text-xs font-bold uppercase tracking-widest text-[#C8952A]"
              }
            >
              {marker.label}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-white/45">
        <span>too thin</span>
        <span className="text-[#49A5FF]">normal band</span>
        <span>too high</span>
      </div>
    </div>
  );
}
