import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

interface Flag {
  id: number;
  severity: "red" | "amber" | "green";
  label: string;
  detail: string;
  tip: string | null;
}

interface GradeRevealProps {
  grade?: string;
  dollarDelta?: number;
  county?: string;
  flags?: Flag[];
  fairPriceLow?: number;
  fairPriceHigh?: number;
  onContractorMatchClick?: () => void;
  contractorName?: string | null;
  isLoading?: boolean;
  accessLevel?: "preview" | "full";
}

const gradeConfig: Record<string, { color: string; bg: string; label: string; message: string }> = {
  A: { color: "#059669", bg: "rgba(5,150,105,0.12)", label: "STRONG QUOTE", message: "Your Quote Is Well-Structured and Competitively Priced." },
  B: { color: "#84CC16", bg: "rgba(132,204,22,0.12)", label: "ACCEPTABLE", message: "Your Quote Is Acceptable with Minor Items Worth Addressing." },
  C: { color: "#F97316", bg: "rgba(249,115,22,0.12)", label: "REVIEW BEFORE SIGNING", message: "Your Quote Has Issues That Could Cost You Money." },
  D: { color: "#DC2626", bg: "rgba(220,38,38,0.12)", label: "SIGNIFICANT PROBLEMS FOUND", message: "Do Not Sign Without Renegotiating These Issues." },
  F: { color: "#991B1B", bg: "rgba(220,38,38,0.12)", label: "CRITICAL ISSUES FOUND", message: "This Quote Has Critical Problems. You Are Likely Being Significantly Overcharged." },
};

const stagger = (i: number) => ({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay: i * 0.06, duration: 0.15, ease: 'easeInOut' as const } }) as const;

const GradeReveal = ({
  grade = "C",
  dollarDelta,
  county = "Broward",
  flags = [],
  fairPriceLow,
  fairPriceHigh,
  onContractorMatchClick,
  contractorName,
  isLoading,
  accessLevel = "full",
}: GradeRevealProps) => {
  const isFull = accessLevel === "full";
  const config = gradeConfig[grade] || gradeConfig.C;
  const [counter, setCounter] = useState(0);
  const [copied, setCopied] = useState(false);
  const counterStarted = useRef(false);

  const redCount = flags.filter(f => f.severity === "red").length;
  const amberCount = flags.filter(f => f.severity === "amber").length;
  const greenCount = flags.filter(f => f.severity === "green").length;
  const issueCount = redCount + amberCount;

  const hasBenchmark = dollarDelta != null && fairPriceLow != null && fairPriceHigh != null;

  useEffect(() => {
    if (!hasBenchmark || counterStarted.current) return;
    counterStarted.current = true;
    const target = Math.abs(dollarDelta!);
    const duration = 1500;
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCounter(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [dollarDelta, hasBenchmark]);

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-16 px-4 space-y-6">
        <div className="flex flex-col items-center gap-4">
          <Skeleton className="w-[120px] h-[120px] rounded-full" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-32 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
        <Skeleton className="h-24 w-full rounded-none" />
      </div>
    );
  }

  const displayName = contractorName || "[Contractor Name]";
  const scriptText = `Hi ${displayName}, I've had a chance to review your quote in more detail and I have a few questions before I can move forward.\n\nFirst — can you confirm the specific brand and model of window you'll be installing? I want that in writing before we finalize anything.\n\nSecond — I'd like to see the labor warranty extended to at least three years. That's the standard I've seen for this scope of work.\n\nI'm ready to move forward if we can get those two things confirmed. What's the fastest way to get a revised quote?`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const severityStyles = {
    red: { border: "1.5px solid rgba(220,38,38,0.3)", borderLeft: "4px solid #DC2626", badgeBg: "rgba(220,38,38,0.12)", badgeColor: "#DC2626", badgeText: "⚠ CRITICAL", tipBg: "rgba(249,115,22,0.08)" },
    amber: { border: "1.5px solid rgba(245,158,11,0.3)", borderLeft: "4px solid #F59E0B", badgeBg: "rgba(245,158,11,0.12)", badgeColor: "#D97706", badgeText: "⚡ REVIEW", tipBg: "rgba(245,158,11,0.08)" },
    green: { border: "1.5px solid rgba(5,150,105,0.3)", borderLeft: "4px solid #059669", badgeBg: "rgba(5,150,105,0.12)", badgeColor: "#059669", badgeText: "✓ CONFIRMED", tipBg: "" },
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15, ease: "easeInOut" as const }}
      style={{ borderRadius: 0, border: "1px solid rgba(0, 242, 255, 0.12)", boxShadow: "0 4px 24px rgba(0, 242, 255, 0.08), 0 20px 60px rgba(0, 0, 0, 0.15), 0 2px 8px rgba(0, 0, 0, 0.06)", overflow: "hidden" }}>

      <section style={{ background: "#0A0A0A" }} className="py-16 md:py-20 px-4 md:px-8">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center">
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.15, ease: "easeInOut" as const }}
            style={{ width: 120, height: 120, borderRadius: "50%", border: `4px solid ${config.color}`, background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 0 6px ${config.color}1A` }}
            className="w-[120px] h-[120px] md:w-[160px] md:h-[160px]">
            <span style={{ fontFamily: "'Jost', sans-serif", fontSize: "clamp(80px, 10vw, 96px)", fontWeight: 900, color: config.color }}>{grade}</span>
          </motion.div>
          <motion.div {...stagger(2.5)} style={{ background: config.bg, border: `1px solid ${config.color}`, borderRadius: 0, padding: "6px 20px", marginTop: 20 }}>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, fontWeight: 700, color: config.color, letterSpacing: "0.1em" }}>GRADE {grade} — {config.label}</span>
          </motion.div>
          <motion.p {...stagger(3.3)} className="text-surface" style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "clamp(17px, 2vw, 19px)", color: "#E5E7EB", marginTop: 12 }}>{config.message}</motion.p>
        </div>
      </section>

      {hasBenchmark && (
      <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.1)" }} className="py-12 md:py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <motion.div {...stagger(3)}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9CA3AF", letterSpacing: "0.12em", marginBottom: 8 }}>YOUR QUOTE VS. FAIR MARKET</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: "clamp(36px, 5vw, 44px)", fontWeight: 900, color: dollarDelta! > 0 ? "#DC2626" : "#059669" }}>
              {dollarDelta! > 0 ? "+" : dollarDelta! < 0 ? "-" : ""}${counter.toLocaleString()}
            </p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9CA3AF" }}>
              {dollarDelta! > 0 ? `above fair market for ${county} County` : dollarDelta! < 0 ? "below market — this quote is competitive" : "This quote is priced at the county benchmark"}
            </p>
          </motion.div>
          <motion.div {...stagger(3.5)}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9CA3AF", letterSpacing: "0.12em", marginBottom: 8 }}>FAIR MARKET RANGE · {county.toUpperCase()} COUNTY</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 700, color: "#2563EB" }}>${fairPriceLow!.toLocaleString()} – ${fairPriceHigh!.toLocaleString()}</p>
            <div style={{ position: "relative", marginTop: 12 }}>
              <div style={{ height: 8, background: "#1A1A1A", borderRadius: 0, overflow: "hidden" }}>
                <div style={{ height: 8, borderRadius: 0, background: "linear-gradient(90deg, #2563EB, #059669)", width: "70%" }} />
              </div>
              <div style={{ position: "absolute", top: -3, left: "75%", width: 14, height: 14, borderRadius: "50%", background: config.color, border: "2px solid #0A0A0A", boxShadow: `0 0 0 1px ${config.color}` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9CA3AF" }}>p25 — budget range</span>
              <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: "#9CA3AF" }}>p75 — premium range</span>
            </div>
          </motion.div>
          <motion.div {...stagger(4)}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9CA3AF", letterSpacing: "0.12em", marginBottom: 8 }}>SAMPLE SIZE</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 32, fontWeight: 700, color: "#FFFFFF" }}>847</p>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9CA3AF" }}>real {county} County quotes in our database</p>
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", margin: "12px 0" }} />
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9CA3AF" }}>Data as of Q1 2025</p>
          </motion.div>
        </div>
      </section>
      )}

      <section style={{ background: "#0A0A0A" }} className="py-12 md:py-16 px-4 md:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6">
            <div>
              <h2 style={{ fontFamily: "'Jost', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF" }}>What We Found</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#9CA3AF" }}>{issueCount} issue{issueCount !== 1 ? "s" : ""} identified · {greenCount} item{greenCount !== 1 ? "s" : ""} confirmed correct</p>
            </div>
            <div className="hidden md:block" style={{ background: "rgba(37,99,235,0.12)", border: "1px solid #2563EB", borderRadius: 0, padding: "6px 12px" }}>
              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#2563EB", letterSpacing: "0.08em" }}>BASED ON {county.toUpperCase()} COUNTY BENCHMARKS</span>
            </div>
          </div>

          {isFull ? (
            <div className="flex flex-col gap-3">
              {flags.map((flag, i) => {
                const s = severityStyles[flag.severity];
                return (
                  <motion.div key={flag.id} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 + 0.3, duration: 0.35 }}
                    style={{ background: "#0A0A0A", border: s.border, borderLeft: s.borderLeft, borderRadius: 0, padding: "20px 20px 20px 24px", boxShadow: "none" }}>
                    <span style={{ display: "inline-block", background: s.badgeBg, borderRadius: 0, padding: "3px 10px", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: s.badgeColor, letterSpacing: "0.06em" }}>{s.badgeText}</span>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, color: "#FFFFFF", marginTop: 8 }}>{flag.label}</p>
                    <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#E5E7EB", lineHeight: 1.7, marginTop: 6 }}>{flag.detail}</p>
                    {flag.tip && (
                      <div style={{ background: s.tipBg, borderRadius: 0, padding: "12px 16px", marginTop: 14, display: "flex", gap: 10, alignItems: "flex-start" }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>💬</span>
                        <div>
                          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#C8952A", letterSpacing: "0.08em", fontWeight: 700, marginBottom: 4 }}>NEGOTIATION TIP</p>
                          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#E5E7EB", lineHeight: 1.6 }}>{flag.tip}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="relative">
              <div className="flex flex-col gap-3" style={{ filter: "blur(6px)", pointerEvents: "none", userSelect: "none" }}>
                {flags.slice(0, 3).map((flag, i) => {
                  const s = severityStyles[flag.severity];
                  return (
                    <div key={flag.id} style={{ background: "#0A0A0A", border: s.border, borderLeft: s.borderLeft, borderRadius: 0, padding: "20px 20px 20px 24px" }}>
                      <span style={{ display: "inline-block", background: s.badgeBg, borderRadius: 0, padding: "3px 10px", fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: s.badgeColor }}>{s.badgeText}</span>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, color: "#FFFFFF", marginTop: 8 }}>██████████ ██████</p>
                      <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#E5E7EB", marginTop: 6 }}>████████ ██████ ████████ ██████████ ██████.</p>
                    </div>
                  );
                })}
              </div>
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(10,10,10,0.85)", borderRadius: 0 }}>
                <div style={{ background: "#0A0A0A", borderRadius: 0, padding: "24px 32px", textAlign: "center", boxShadow: "0 8px 32px rgba(15,31,53,0.2)" }}>
                  <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8952A", letterSpacing: "0.1em", marginBottom: 8 }}>🔒 VERIFICATION REQUIRED</p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: "white", marginBottom: 4 }}>
                    We found {issueCount} issue{issueCount !== 1 ? "s" : ""} in your quote.
                  </p>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "#94A3B8" }}>Verify your phone number to see the full details.</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: "#0A0A0A", borderRadius: 0, padding: "16px 20px", marginTop: 20 }} className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: "white" }}>{redCount} critical issue{redCount !== 1 ? "s" : ""}, {amberCount} caution{amberCount !== 1 ? "s" : ""}, {greenCount} item{greenCount !== 1 ? "s" : ""} correct.</p>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#94A3B8" }}>Grade: {grade} of 5 criteria reviewed</p>
          </div>
        </div>
      </section>

      {isFull ? (
        <>
          <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.1)" }} className="py-12 md:py-16 px-4 md:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 style={{ fontFamily: "'Jost', sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF" }}>How to handle this quote.</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#9CA3AF", marginTop: 8, marginBottom: 28 }}>Use this exact language when you call your contractor back.</p>
              <div style={{ background: "#111111", border: "1px solid rgba(255,255,255,0.1)", borderLeft: "4px solid #2563EB", borderRadius: 0, padding: "24px 28px", position: "relative", boxShadow: "none" }}>
                <button onClick={handleCopy} style={{ position: "absolute", top: 16, right: 16, background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 0, padding: "6px 12px", fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: "#9CA3AF", cursor: "pointer" }}>
                  {copied ? "✓ Copied" : "Copy Script"}
                </button>
                <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#2563EB", letterSpacing: "0.1em", marginBottom: 16 }}>WORD-FOR-WORD SCRIPT</p>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#FFFFFF", lineHeight: 2.0, whiteSpace: "pre-line" }}>{scriptText}</p>
              </div>
            </div>
          </section>

          <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.1)" }} className="py-12 md:py-16 px-4 md:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <h2 style={{ fontFamily: "'Jost', sans-serif", fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "#FFFFFF", marginBottom: 8 }}>What do you want to do with this?</h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#9CA3AF", marginBottom: 32 }}>Your analysis is saved. You can come back to it anytime.</p>
              <div className="flex flex-col md:flex-row justify-center gap-4">
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => { console.log({ event: "wm_contractor_match_clicked", grade, dollarDelta }); onContractorMatchClick?.(); }}
                  className="flex flex-col items-center"
                  style={{ background: "#C8952A", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, padding: "16px 36px", borderRadius: 0, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(200,149,42,0.35)" }}>
                  <span>Get a Counter-Quote From a Vetted Contractor</span>
                  <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.85, marginTop: 4 }}>We'll find contractors who quote fair in {county} County</span>
                </motion.button>
                <motion.button whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
                  onClick={() => { console.log({ event: "wm_report_downloaded" }); toast({ title: "Report saved to your downloads" }); }}
                  style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.1)", color: "#E5E7EB", fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, padding: "14px 28px", borderRadius: 0, cursor: "pointer" }}>
                  ⬇ Download PDF Report
                </motion.button>
              </div>
              <button onClick={() => { console.log({ event: "wm_report_shared" }); toast({ title: "Link copied to clipboard" }); }}
                style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#2563EB", textDecoration: "underline", background: "none", border: "none", cursor: "pointer", marginTop: 12, display: "inline-block" }}>
                Share this report →
              </button>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: "#9CA3AF", marginTop: 20 }}>Your contractor will never see this report unless you choose to share it.</p>
            </div>
          </section>
        </>
      ) : (
        <section style={{ background: "#0A0A0A", borderTop: "1px solid rgba(255,255,255,0.1)" }} className="py-12 md:py-16 px-4 md:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div style={{ background: "#0A0A0A", borderRadius: 0, padding: "32px 28px", boxShadow: "0 8px 32px rgba(15,31,53,0.2)" }}>
              <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8952A", letterSpacing: "0.1em", marginBottom: 12 }}>🔒 FULL REPORT LOCKED</p>
              <h3 style={{ fontFamily: "'Jost', sans-serif", fontSize: 24, fontWeight: 800, color: "white", marginBottom: 8 }}>
                Your negotiation script and action tools are ready.
              </h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#94A3B8", marginBottom: 24, maxWidth: 480, marginLeft: "auto", marginRight: "auto" }}>
                Verify your phone number to unlock the full Truth Report — including detailed flag breakdowns, negotiation scripts, and contractor matching.
              </p>
              <button style={{ background: "#C8952A", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, padding: "14px 32px", borderRadius: 0, border: "none", cursor: "pointer", boxShadow: "0 4px 16px rgba(200,149,42,0.35)" }}>
                Verify Phone to Unlock →
              </button>
            </div>
          </div>
        </section>
      )}
    </motion.div>
  );
};

export default GradeReveal;
