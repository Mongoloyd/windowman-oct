/**
 * HowWeBeatWindowQuotes — Market-maker manifesto and trust/SEO page.
 * Route: /how-we-beat-window-quotes
 */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, TrendingDown, Users, FileCheck, ArrowRight, Phone } from "lucide-react";
import { trackEvent } from "@/lib/trackEvent";

const steps = [
  {
    icon: <FileCheck size={28} />,
    title: "You upload your quote",
    body: "Our scanner reads every line item, every spec, every price point. In under 60 seconds, we know exactly what you're being charged — and whether it's fair.",
  },
  {
    icon: <TrendingDown size={28} />,
    title: "We grade it against the market",
    body: "Your quote is scored across 5 pillars — safety compliance, scope clarity, price fairness, fine print transparency, and warranty value. Every red flag gets a name.",
  },
  {
    icon: <Users size={28} />,
    title: "We find a contractor who can beat it",
    body: "If your quote has problems, we match you with a vetted contractor in your county who quotes fair-market prices with full scope and warranty clarity.",
  },
  {
    icon: <Phone size={28} />,
    title: "We call you to explain everything",
    body: "A WindowMan specialist walks you through your report, answers your questions, and — if you're ready — introduces you to a contractor who will do the job right.",
  },
];

const trustPoints = [
  "WindowMan exists to make sure you don't overpay for impact windows.",
  "If a better price exists for the same job, WindowMan is built to find it.",
  "Our network is built to beat overpriced window quotes — on equal scope and value.",
  "Contractors in our network compete on quality, not on hiding costs.",
  "You see the grade before you talk to anyone. No pressure. No obligation.",
];

export default function HowWeBeatWindowQuotes() {
  useEffect(() => {
    trackEvent({ event_name: "manifesto_page_opened", route: "/how-we-beat-window-quotes" });
  }, []);

  return (
    <div style={{ background: "#0A0A0A", minHeight: "100vh" }}>
      {/* ── HERO ── */}
      <section className="py-20 md:py-28 px-4 md:px-8">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
            <p style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8952A", letterSpacing: "0.12em", marginBottom: 16 }}>
              THE WINDOWMAN PROCESS
            </p>
            <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(32px, 6vw, 48px)", fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", letterSpacing: "-0.01em", lineHeight: 1.1 }}>
              How WindowMan Beats<br />Overpriced Window Quotes
            </h1>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, color: "#D1D5DB", lineHeight: 1.75, maxWidth: 560, margin: "20px auto 0" }}>
              Most homeowners sign their first quote because they don't know what fair looks like. WindowMan changes that — in under 60 seconds.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── PROCESS STEPS ── */}
      <section className="py-16 px-4 md:px-8" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="flex flex-col gap-0">
            {steps.map((step, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1, duration: 0.2 }}
                className="flex gap-6 items-start" style={{ padding: "28px 0", borderBottom: i < steps.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none" }}>
                <div style={{ width: 56, height: 56, background: "rgba(200,149,42,0.08)", border: "1.5px solid rgba(200,149,42,0.25)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#C8952A" }}>
                  {step.icon}
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#C8952A", fontWeight: 700 }}>STEP {i + 1}</span>
                  </div>
                  <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, color: "#FFFFFF", textTransform: "uppercase", marginBottom: 6 }}>{step.title}</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#D1D5DB", lineHeight: 1.7 }}>{step.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MARKET MAKER PRINCIPLES ── */}
      <section className="py-16 px-4 md:px-8" style={{ background: "rgba(200,149,42,0.03)", borderTop: "1px solid rgba(200,149,42,0.15)" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <ShieldCheck size={48} color="#C8952A" strokeWidth={1.5} className="mx-auto mb-4" />
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: "clamp(24px, 4vw, 32px)", fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase" }}>
              Why Contractors Compete Harder Through WindowMan
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            {trustPoints.map((point, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.08 }}
                className="flex items-start gap-3" style={{ padding: "14px 20px", background: "rgba(200,149,42,0.05)", border: "1px solid rgba(200,149,42,0.12)" }}>
                <ArrowRight size={16} color="#C8952A" style={{ marginTop: 3, flexShrink: 0 }} />
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: "#E5E7EB", lineHeight: 1.6 }}>{point}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-4 md:px-8 text-center">
        <div className="max-w-lg mx-auto">
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 28, fontWeight: 800, color: "#FFFFFF", textTransform: "uppercase", marginBottom: 12 }}>
            Ready to find out what your quote is really worth?
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: "#D1D5DB", lineHeight: 1.7, marginBottom: 28 }}>
            Upload your quote. Get your grade. It takes 60 seconds and it's free.
          </p>
          <a href="/" style={{ display: "inline-block", background: "#C8952A", color: "white", fontFamily: "'DM Sans', sans-serif", fontSize: 17, fontWeight: 700, padding: "16px 40px", borderRadius: 0, textDecoration: "none", boxShadow: "0 4px 16px rgba(200,149,42,0.35)" }}>
            Scan My Quote Free →
          </a>
        </div>
      </section>
    </div>
  );
}
