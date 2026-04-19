import React from "react";
import { motion } from "framer-motion";
import { PAGE_CONFIG } from "../../config/page.config.js";

export default function HeroSection() {
  return (
    <section className="relative flex min-h-[100dvh] w-full flex-col justify-center py-20 lg:py-0">
      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-800/20 mix-blend-screen blur-[120px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
      </div>

      <div className="grid grid-cols-1 gap-16 lg:grid-cols-2 lg:items-center lg:gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring", stiffness: 280, damping: 28 }}
          className="flex flex-col items-start gap-8"
        >
          <div className="space-y-4">
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-white/80">
              Exclusive Territory Access &middot; One Contractor Per Market
            </span>
            <h1 className="text-5xl font-extrabold leading-[1.1] tracking-tight lg:text-6xl">
              Stop Losing Jobs to Worse Contractors.
            </h1>
            <p className="max-w-[65ch] text-lg leading-relaxed text-white/60 lg:text-xl">
              WindowMan gets homeowners after they've already received quotes from your competitors. They upload those
              estimates, we show them what's wrong, and when they want a better option — that opportunity can become
              yours.
            </p>
            <p className="max-w-[65ch] text-sm text-white/70">
              These are not random leads. These are active buyers already comparing quotes and trying to decide who to
              trust.
            </p>
          </div>

          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-center">
            <a
              href={PAGE_CONFIG.calendly.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              Book a 10-Minute Walkthrough
            </a>
            <a
              href={PAGE_CONFIG.phone.href}
              className="inline-flex items-center justify-center rounded-full border border-white/20 bg-transparent px-8 py-4 text-base font-semibold text-white transition-all hover:bg-white/5 active:scale-[0.98]"
            >
              Call or Text {PAGE_CONFIG.phone.display}
            </a>
          </div>
          <p className="text-xs text-white/40">Or request territory access below — takes under 20 seconds.</p>

          <div className="mt-8 flex w-full flex-col gap-6 border-t border-white/10 pt-8 sm:flex-row sm:justify-between lg:gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-white">Under 60 seconds</span>
              <span className="text-xs text-white/60">Quote upload &rarr; diagnosis</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-white">Exclusive access</span>
              <span className="text-xs text-white/60">One contractor per territory</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-bold text-white">High intent</span>
              <span className="text-xs text-white/60">Buyers arrive with estimates</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2, type: "spring", stiffness: 280, damping: 28 }}
          className="relative lg:ml-auto w-full max-w-md"
        >
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-b from-white/10 to-transparent opacity-60 blur-xl" />

          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c0e] shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-6 py-4">
              <h3 className="font-semibold text-white">Quote Analysis</h3>
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <span className="text-xs font-medium tracking-wide text-emerald-400 uppercase">Scanning</span>
              </div>
            </div>

            <motion.div
              animate={{ y: [0, 260, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute left-0 right-0 top-[60px] h-[1px] w-full bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent shadow-[0_0_10px_rgba(52,211,153,0.5)] z-10"
            />

            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Labor &amp; Installation</span>
                </div>
                <div className="flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Vague Scope</span>
                  <span className="text-xs text-red-400">&#9888;</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Hurricane Impact Rating</span>
                </div>
                <div className="flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Unverified</span>
                  <span className="text-xs text-amber-400">&#9888;</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-red-500/20 bg-red-500/5 p-4">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-white">Permit Handling</span>
                </div>
                <div className="flex items-center gap-1.5 rounded bg-red-500/10 px-2 py-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Missing</span>
                  <span className="text-xs text-red-400">&#10005;</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/[0.06] bg-black/40 px-6 py-3">
              <p className="text-xs text-white/70">Source: Competitor Estimate</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
