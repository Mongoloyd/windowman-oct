
import React from "react";
import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";

export default function EconomicsSection({ onOpenQualification }) {
  return (
    <section className="mx-auto w-full max-w-5xl py-24">
      <div className="mb-16 flex flex-col items-center text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-white lg:text-4xl">
          Fewer Leads. Better Timing. More Closed Jobs.
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8 mb-12">
        <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}
          className="flex flex-col items-center rounded-2xl border border-white/[0.05] bg-[#111008] p-8 text-center">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-widest text-white/50">Typical Contractor Funnel</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-white">100</span><span className="text-sm font-medium text-white/60">Unqualified Leads</span></div>
            <ArrowDown className="text-white/20" size={20} />
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-white">12</span><span className="text-sm font-medium text-white/60">Conversations</span></div>
            <ArrowDown className="text-white/20" size={20} />
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-white/40">3</span><span className="text-sm font-medium text-white/40">Closed Jobs</span></div>
          </div>
          <div className="mt-8 rounded bg-white/[0.03] px-4 py-2">
            <p className="text-xs font-medium text-white/60">High volume. Low signal. Low close rate.</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}
          className="flex flex-col items-center rounded-2xl border border-emerald-500/10 bg-[#080d11] p-8 text-center">
          <h3 className="mb-8 text-sm font-bold uppercase tracking-widest text-emerald-400/80">WindowMan Opportunity Flow</h3>
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-emerald-400">30</span><span className="text-sm font-medium text-emerald-400/70">Decision-Stage Ops</span></div>
            <ArrowDown className="text-emerald-400/30" size={20} />
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-white">8–12</span><span className="text-sm font-medium text-white/80">Serious Conversations</span></div>
            <ArrowDown className="text-emerald-400/30" size={20} />
            <div className="flex flex-col items-center"><span className="text-5xl font-bold text-white">5–7</span><span className="text-sm font-medium text-white/80">Closed Jobs</span></div>
          </div>
          <div className="mt-8 rounded bg-emerald-500/[0.05] px-4 py-2">
            <p className="text-xs font-medium text-emerald-400/80">Fewer opportunities. Higher context. Better close rate.</p>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ delay: 0.3 }}
        className="w-full rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 lg:p-10">
        <div className="mx-auto flex max-w-xl flex-col gap-6">
          <span className="text-center text-xs font-bold uppercase tracking-widest text-white/40">Conservative Math</span>
          <div className="flex w-full items-center justify-between border-b border-white/[0.05] pb-4">
            <span className="text-sm font-medium text-white/60">Average job value</span>
            <span className="text-base font-bold text-white">$15,000</span>
          </div>
          <div className="flex w-full items-center justify-between border-b border-white/[0.05] pb-4">
            <span className="text-sm font-medium text-white/60">Estimated gross margin</span>
            <span className="text-base font-bold text-white">$4,000</span>
          </div>
          <div className="flex w-full items-center justify-between pt-2">
            <span className="text-sm font-medium text-white/80">+3 additional closes per month</span>
            <span className="text-lg font-extrabold text-emerald-400">+$12,000 gross profit</span>
          </div>
          <div className="mt-6 text-center">
            <span className="text-lg font-bold text-white">Same market. Same service. Different timing.</span>
          </div>
        </div>
      </motion.div>

      <div className="mt-12 flex justify-center">
        <button
          type="button"
          onClick={onOpenQualification}
          className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98]"
        >
          Access Higher-Intent Buyers
        </button>
      </div>
    </section>
  );
}