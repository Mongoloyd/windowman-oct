import { useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import { trackEvent } from "@/lib/trackEvent";

interface AboutCTASectionProps {
  onAnalyzeClick?: () => void;
  onCreateVaultClick?: () => void;
  onTrack?: (eventName: string) => void;
}

export default function AboutCTASection({
  onAnalyzeClick,
  onCreateVaultClick,
  onTrack,
}: AboutCTASectionProps) {
  const sectionRef = useRef<HTMLElement>(null);

  // Single tracking path: delegate to onTrack when provided (caller handles trackEvent),
  // otherwise call trackEvent directly. Prevents double-logging when About.tsx wires
  // onTrack → trackEvent.
  const track = useCallback(
    (eventName: string) => {
      if (onTrack) {
        onTrack(eventName);
      } else {
        try {
          trackEvent({ event_name: eventName, route: "/about" });
        } catch {
          // fail gracefully
        }
      }
    },
    [onTrack]
  );

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Guard for browsers that don't support IntersectionObserver
    if (!("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          track("about_cta_section_viewed");
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [track]);

  const handleAnalyze = () => {
    track("about_bottom_cta_analyze_clicked");
    if (onAnalyzeClick) onAnalyzeClick();
  };

  const handleVault = () => {
    track("about_bottom_cta_vault_clicked");
    if (onCreateVaultClick) onCreateVaultClick();
  };

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24"
      style={{ background: "transparent" }}
    >
      {/* Depth L1 — restrained orange pressure underglow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          bottom: "0%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "80%",
          height: "70%",
          background: "radial-gradient(ellipse at 50% 80%, rgba(249,115,22,0.10) 0%, rgba(234,88,12,0.05) 45%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />
      {/* Depth L2 — blue atmospheric crown */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "-10%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "70%",
          height: "60%",
          background: "radial-gradient(ellipse at 50% 20%, rgba(30,80,180,0.09) 0%, transparent 70%)",
          filter: "blur(44px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        <div
          className="mx-auto max-w-2xl rounded-2xl bg-white px-8 py-12 text-center"
          style={{
            boxShadow:
              "0 4px 8px rgba(10,25,60,0.10), 0 20px 60px rgba(10,25,80,0.16), 0 0 0 1px rgba(249,115,22,0.06), inset 0 1px 0 rgba(255,255,255,0.95)",
            border: "1px solid hsl(214 30% 82%)",
          }}
        >
          <SectionEyebrow className="mb-4 justify-center">
            THE NEXT MOVE
          </SectionEyebrow>

          <SectionHeading className="mb-4 text-3xl md:text-4xl">
            Start With Your First Quote.
          </SectionHeading>

          <p className="mx-auto mb-10 max-w-md text-base leading-relaxed text-foreground/75">
            Upload a quote and see how it compares before you make a decision.
            Or create your Vault now and come back when your estimate is ready.
          </p>

          {/* Primary CTA — tactile orange hardware button */}
          <div className="flex flex-col items-center gap-4">
            <Link
              to="/"
              onClick={handleAnalyze}
              className="inline-flex items-center justify-center rounded-lg px-10 py-4 text-base font-bold text-white transition-all active:translate-y-1"
              style={{
                background:
                  "linear-gradient(180deg, #ffb347 0%, #f97316 40%, #c2410c 100%)",
                border: "1px solid #9a3412",
                borderTop: "1px solid rgba(255,255,255,0.35)",
                boxShadow:
                  "0 2px 0 #7c2d12, 0 4px 12px rgba(249,115,22,0.4), inset 0 1px 0 rgba(255,255,255,0.25)",
                textShadow: "0 1px 2px rgba(0,0,0,0.25)",
                letterSpacing: "0.01em",
              }}
            >
              Analyze My Quote
            </Link>

            {/* Secondary CTA */}
            <Link
              to="/"
              onClick={handleVault}
              className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-8 py-3.5 text-sm font-semibold text-foreground transition-all hover:border-slate-400 hover:bg-slate-50 active:translate-y-px"
              style={{
                boxShadow: "0 1px 4px rgba(15,30,60,0.08)",
              }}
            >
              Create My Vault
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
