
import React from "react";
import { motion } from "framer-motion";

export default function DifferentiationSection({ onOpenQualification }) {
  const notItems = [
    "Generic Facebook or Google leads", "Random homeowner traffic", "Shared lead marketplaces",
    "Volume-based tire-kicker lists", "Cold contacts with no intent signal"
  ];
  const isItems = [
    "Decision-stage buyer interception", "Buyers with competitor estimates already uploaded",
    "Exclusive territory routing — one contractor only", "Higher-context buyers with a clear problem",
    "Cleaner path from conversation to close"
  ];

  return (
    <section className="w-full bg-[#0d0d0d] py-24">
      <div className="mx-auto w-full max-w-6xl px-6 lg:px-8">
        <div className="mb-16 flex flex-col items-center text-center">
          <h2 className="mb-4 text-3xl font-extrabold tracking-tight text-white lg:text-4xl">This Is Not Shared Lead Gen.</h2>
          <p className="max-w-2xl text-base text-white/60 lg:text-lg">
            Most lead sources sell the same buyer to five contractors simultaneously. This is structurally different.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}
            className="flex flex-col rounded-t-2xl md:rounded-l-2xl md:rounded-tr-none border border-white/[0.05] bg-[#111008] p-8 md:border-r-0 lg:p-12">
            <h3 className="mb-8 text-sm font-bold uppercase tracking-widest text-red-400">This is NOT</h3>
            <ul className="flex flex-col gap-6">
              {notItems.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-lg font-bold leading-none text-red-500">✕</span>
                  <span className="text-base leading-relaxed text-white/80">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-50px" }}
            className="flex flex-col rounded-b-2xl md:rounded-r-2xl md:rounded-bl-none border border-white/[0.05] bg-[#080d11] p-8 md:border-l border-l-white/[0.07] lg:p-12">
            <h3 className="mb-8 text-sm font-bold uppercase tracking-widest text-emerald-400">This IS</h3>
            <ul className="flex flex-col gap-6">
              {isItems.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <span className="text-lg font-bold leading-none text-emerald-500">✓</span>
                  <span className="text-base leading-relaxed text-white/90">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        <div className="mt-16 text-center">
          <p className="mx-auto max-w-3xl text-lg font-medium leading-relaxed text-white/60 md:text-xl">
            "If you want volume, this is not for you. If you want timing, this might be the best decision you make."
          </p>
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={onOpenQualification}
              className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-black transition-all hover:bg-white/90 active:scale-[0.98]"
            >
              Stop Buying Shared Leads
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}