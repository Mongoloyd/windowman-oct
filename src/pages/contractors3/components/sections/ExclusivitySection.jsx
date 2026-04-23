
import React from "react";
import { motion } from "framer-motion";
import { PAGE_CONFIG } from "../../config/page.config.js";

export default function ExclusivitySection({ onOpenQualification }) {
  return (
    <section className="mx-auto w-full max-w-2xl py-20 text-center">
      <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} className="flex flex-col items-center">
        <span className="mb-4 block text-xs font-bold uppercase tracking-widest text-white/50">Territory Access</span>
        <h2 className="mb-6 text-3xl font-extrabold tracking-tight text-white lg:text-4xl">One Contractor Per Territory.</h2>
        <p className="mb-10 text-base leading-relaxed text-white/70">
          WindowMan partners with one contractor in a service territory. That territory is then closed. The opportunity is protected — not diluted, not re-sold, not shared.
        </p>

        <div className="relative mb-10 w-full overflow-hidden rounded-xl border border-white/[0.12] bg-[#111111] p-6 shadow-[0_0_30px_rgba(255,255,255,0.05)]">
          <div className="absolute inset-0 bg-white/[0.02] animate-[pulse_3s_ease-in-out_infinite]" />
          <div className="relative flex flex-col items-center gap-1 z-10">
            <span className="text-lg font-bold text-white">Exclusive Territory Access</span>
            <span className="text-sm text-white/60">Not shared with competing contractors</span>
            <span className="text-sm text-white/60">First confirmed — first protected</span>
          </div>
        </div>

        <p className="mb-8 text-sm text-white/50">Active territories fill and close permanently. Availability is confirmed on the call.</p>

        <button
          type="button"
          onClick={onOpenQualification}
          className="inline-flex items-center justify-center rounded-full bg-white px-8 py-4 text-base font-bold text-black transition-colors hover:bg-white/90 active:scale-[0.98]"
        >
          See If Your Territory Is Open
        </button>
      </motion.div>
    </section>
  );
}