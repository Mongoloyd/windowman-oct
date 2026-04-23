import React from "react";
import { motion } from "framer-motion";

export default function CompetitorQuoteSection({ onOpenQualification }) {
  const leftPanelVariants = {
    hidden: { opacity: 0, x: -30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut" } },
  };
  const rightPanelVariants = {
    hidden: { opacity: 0, x: 30 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.7, ease: "easeOut", delay: 0.2 } },
  };

  const uploadItems = [
    "Competitor's estimate",
    "Line item pricing",
    "Vague scope language",
    "Missing permit language",
    "Unverified product specs",
    "Fine print exclusions",
  ];
  const resolutionItems = [
    "Detects inflated or vague pricing",
    "Explains what feels wrong in plain language",
    "Flags missing impact rating verification",
    "Identifies scope gaps and exclusions",
    "Builds trust through transparent diagnosis",
    "Opens the door for a better contractor",
  ];

  return (
    <section className="w-full py-24 overflow-hidden">
      <div className="mb-16">
        <span className="mb-4 block text-sm font-bold uppercase tracking-widest text-white/50">
          The Core Opportunity
        </span>
        <h2 className="mb-6 max-w-3xl text-3xl font-extrabold tracking-tight lg:text-4xl">
          We Don't Generate Generic Demand. We Intercept Competitor Demand.
        </h2>
        <p className="max-w-[75ch] text-base leading-relaxed text-white/60 lg:text-lg">
          Homeowners Upload Real Quotes They Received From Other Contractors. WindowMan Analyzes Those Quotes, Flags
          Pricing Issues, Missing Protections, and Vague Scope — Then Turns That Distrust Into Buying Motivation.
        </p>
      </div>

      <div className="relative grid grid-cols-1 gap-8 lg:grid-cols-[1fr_auto_1fr] lg:gap-12 lg:items-center">
        <motion.div
          variants={leftPanelVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col rounded-2xl border border-white/[0.05] bg-black/50 p-6 shadow-xl lg:p-8"
        >
          <h3 className="mb-6 text-xl font-bold text-white border-b border-white/10 pb-4">
            What the Homeowner Uploads
          </h3>
          <ul className="flex flex-col gap-4">
            {uploadItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-4 rounded-lg bg-white/[0.02] p-4 border-l-2 border-l-rose-500"
              >
                <span className="text-sm font-medium text-white/80">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        <div className="hidden lg:flex flex-col items-center justify-center opacity-70">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-emerald-400">Buyer Motivation</div>
          <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M0 12H46M46 12L36 2M46 12L36 22"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-emerald-500"
            />
          </svg>
        </div>

        <motion.div
          variants={rightPanelVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
          className="flex flex-col rounded-2xl border border-white/[0.05] bg-black/50 p-6 shadow-xl lg:p-8"
        >
          <h3 className="mb-6 text-xl font-bold text-white border-b border-white/10 pb-4">What WindowMan Does</h3>
          <ul className="flex flex-col gap-4">
            {resolutionItems.map((item, idx) => (
              <li
                key={idx}
                className="flex items-center gap-4 rounded-lg bg-white/[0.02] p-4 border-l-2 border-l-emerald-500"
              >
                <span className="text-sm font-medium text-white/80">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      <div className="mt-20 text-center">
        <blockquote className="mx-auto max-w-4xl text-2xl font-medium leading-tight text-white/80 lg:text-3xl">
          "By The Time The Homeowner Wants a Better Option, WindowMan Has Already Shown Them Exactly Why."
        </blockquote>
        <div className="mt-10 flex justify-center">
          <button
            type="button"
            onClick={onOpenQualification}
            className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98]"
          >
            Intercept Active Buyers
          </button>
        </div>
      </div>
    </section>
  );
}
