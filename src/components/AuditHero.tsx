import React, { useState } from "react";
import { TrustBullets } from "./TrustBullets";
import SampleGradeCard from "./SampleGradeCard";
import { useTickerStats } from "@/hooks/useTickerStats";
import { Shield, TrendingDown, BarChart3 } from "lucide-react";
import scanOcrImg from "@/assets/scan_ocr_hero.avif";
import PowerToolButton from "./PowerToolButton";

const PowerToolFlow = React.lazy(() => import("./PowerToolDemo"));

const MASCOT_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/87108037/YjBTWCdi7jZwa5GFcxbLnp/windowmanwithtruthreportonthephone_be309c26.avif";

interface AuditHeroProps {
  onUploadQuote?: () => void;
  triggerPowerTool?: boolean;
  onPowerToolClose?: () => void;
  variantHeadline?: string;
  variantSubheadline?: string;
  variantBadgeText?: string;
}

const AuditHero = ({
  onUploadQuote,
  triggerPowerTool,
  onPowerToolClose,
  variantHeadline,
  variantSubheadline,
  variantBadgeText,
}: AuditHeroProps) => {
  const { total } = useTickerStats();
  const savingsFound = ((total * 3800) / 1_000_000).toFixed(1);
  const [mounted, setMounted] = useState(false);

  const trustPillContent = (
    <>
      <span className="text-primary text-sm">🛡️</span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">{variantBadgeText || "FORENSIC QUOTE INTELLIGENCE"}</span>
    </>
  );

  const statsStrip = (
    <div className="flex items-center justify-center lg:justify-start gap-6 mt-8 pt-6 border-t border-border/40 w-full min-h-[73px]">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
          <Shield className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-mono text-sm font-bold tabular-nums text-foreground min-w-[58px]">
            {total.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">Quotes Scanned</p>
        </div>
      </div>

      <div className="w-px h-8 bg-border/50" />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-destructive/10">
          <TrendingDown className="w-4 h-4 text-destructive" />
        </div>
        <div>
          <p className="font-mono text-sm font-bold tabular-nums text-foreground min-w-[64px]">
            ${savingsFound}M+
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">Overcharges Found</p>
        </div>
      </div>

      <div className="w-px h-8 bg-border/50" />

      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary/10">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="font-mono text-sm font-bold tabular-nums text-foreground min-w-[52px]">
            $3,100
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">Avg. Savings</p>
        </div>
      </div>
    </div>
  );

  return (
    <section
      className="relative bg-background min-h-[860px] sm:min-h-[980px] lg:min-h-[860px]"
      style={{
        background: "linear-gradient(168deg, hsl(214 35% 95%) 0%, hsl(216 38% 93%) 40%, hsl(218 32% 94%) 100%)",
      }}
    >
      <div className="relative z-10 max-w-7xl mx-auto px-4 lg:px-8 pb-16 lg:pb-24">
        <div className="flex flex-col lg:flex-row items-center lg:items-start gap-8 text-center lg:text-left">
          {/* ── ORDER 1 (mobile/tablet): Trust Pill ── */}
          <div className="order-1 lg:hidden z-10 mt-4 inline-flex items-center gap-2 card-raised px-3 py-1 bg-primary/5">
            {trustPillContent}
          </div>

          {/* ── ORDER 2 (mobile/tablet) / right column (lg+): Mascot + GradeCard ── */}
          <div className="order-2 lg:order-last lg:flex-1 flex w-full min-w-0 flex-col items-center pt-0 lg:pt-16">
            <div className="mascot-float flex w-full min-w-0 max-w-[420px] flex-col items-center sm:max-w-[460px] lg:max-w-[480px]">
              <div className="relative z-20 flex w-full justify-center pointer-events-none aspect-[3/4] min-w-0">
                  <img
                    src={MASCOT_URL}
                    alt="WindowMan holding a Truth Report"
                    fetchPriority="high"
                    loading="eager"
                    decoding="async"
                    width={480}
                    height={640}
                    className="absolute inset-0 w-full h-full object-contain"
                  />
              </div>

              <div className="relative z-10 -mt-10 w-full min-w-0 max-w-[390px] px-1 sm:-mt-14 sm:max-w-[420px] sm:px-0 lg:-mt-16">
                <SampleGradeCard />
              </div>

              <div className="hidden w-full max-w-lg sm:flex lg:hidden">
                {statsStrip}
              </div>
            </div>
          </div>

          {/* ── ORDER 3 (mobile/tablet) / left column (lg+): Text + CTAs ── */}
          <div
            className="order-3 lg:order-first lg:flex-1 mt-8 lg:mt-0 lg:pt-32 flex flex-col items-center lg:items-start"
          >
            <div className="hidden lg:inline-flex items-center gap-2 mb-5 card-raised px-3 py-1 bg-primary/5 lg:self-center lg:-translate-x-8">
              {trustPillContent}
            </div>

            <h1
              className="font-display text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-foreground mb-5"
            >
              {variantHeadline ? (
                variantHeadline
              ) : (
                <>
                  Your Quote Looks Legitimate.
                  <br />
                  That's Exactly What{" "}
                  <span className="text-destructive" style={{ textShadow: "0 0 20px hsla(25, 95%, 53%, 0.15)" }}>
                    They're Counting On.
                  </span>
                </>
              )}
            </h1>

            <p
              className="font-body max-w-[65ch] text-lg lg:text-xl leading-relaxed text-foreground/80 mb-8"
            >
              {variantSubheadline ? (
                variantSubheadline
              ) : (
                <>
                  The Impact Window Industry Has No Pricing Transparency Standard.
                  <br />
                  WindowMan Built One — and It Audits Your Quote In{" "}
                  <strong className="text-foreground">under 60 seconds</strong>.
                </>
              )}
            </p>

            {/* ── CTA ROW: side-by-side on sm+, stacked on xs ── */}
            <div className="flex flex-col sm:flex-row items-center lg:items-start gap-3 sm:gap-4 w-full sm:w-auto">
              <button
                onClick={() => onUploadQuote?.()}
                className="btn-depth-primary w-full sm:w-auto whitespace-nowrap"
                style={{ fontSize: 18, padding: "20px 40px" }}
              >
                Scan My Quote<span className="inline sm:hidden lg:inline"> — It's Free</span>
              </button>

              <PowerToolButton onClick={() => setMounted(true)} />
            </div>

            {(mounted || triggerPowerTool) && (
              <React.Suspense fallback={null}>
                <PowerToolFlow
                  onUploadQuote={onUploadQuote}
                  triggerOpen
                  onToolClose={() => {
                    setMounted(false);
                    onPowerToolClose?.();
                  }}
                />
              </React.Suspense>
            )}

            <TrustBullets />

            {/* ── Stats strip: desktop only (lg+) ── */}
            <div className="hidden lg:block w-full">
              {statsStrip}
            </div>

            {/* ── OCR screenshot: responsive, single img tag ── */}
            <div className="hidden sm:block mt-8 w-full max-w-3xl aspect-[7/4]">
              <img
                src={scanOcrImg}
                alt="WindowMan AI scanning a quote — extraction, context injection, anomaly detection"
                loading="lazy"
                decoding="async"
                width={700}
                height={400}
                className="w-full h-full object-cover rounded-xl shadow-lg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AuditHero;
