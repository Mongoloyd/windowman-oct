import { motion } from "framer-motion";
import { PAGE_CONFIG } from "@/config/page.config";
import { AlertTriangle, DollarSign, ShieldAlert } from "lucide-react";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease },
};

interface HeroSectionProps {
  onOpenQualification?: () => void;
}

const HeroSection = ({ onOpenQualification }: HeroSectionProps) => (
  <section className="min-h-screen flex items-center py-24">
    <div className="max-w-[90rem] mx-auto px-6 w-full flex flex-col items-center">
      {/* Apex — character image */}
      <motion.img
        src="/images/flywheel-wman.avif"
        alt="WindowMan character"
        loading="lazy"
        {...fadeUp}
        className="w-96 md:w-[28rem] lg:w-[32rem] h-auto mb-16 lg:mb-24 mx-auto drop-shadow-2xl"
      />

      {/* Base — two columns spread wide */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-24 lg:gap-32 xl:gap-40 items-center">
        {/* LEFT */}
        <div>
          <motion.p {...fadeUp} className="text-sm font-medium tracking-widest uppercase text-slate-300 mb-4">
            WindowMan for Contractors
          </motion.p>

          <motion.h1
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.05 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight text-white mb-6"
          >
            Stop Losing Jobs to Worse Contractors.
          </motion.h1>

          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.1 }}
            className="text-lg text-slate-200 leading-relaxed mb-4"
          >
            WindowMan Gets Homeowners After They've Already Received Competitor Quotes. They Upload Those Estimates, We
            Show Them What's Wrong, and Offer Them A Better Option — That Option Can Be You.
          </motion.p>

          <motion.p
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.15 }}
            className="text-base text-slate-300 leading-relaxed mb-10"
          >
            These are not random leads. These are active buyers already comparing quotes and trying to decide who to
            trust.
          </motion.p>

          <motion.div
            {...fadeUp}
            transition={{ ...fadeUp.transition, delay: 0.2 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <button
              type="button"
              onClick={onOpenQualification}
              className="inline-flex items-center justify-center rounded-xl bg-white text-slate-950 font-semibold text-sm px-7 py-3.5 hover:bg-white/90 transition-colors"
            >
              Get Window Buyers
            </button>
            <a
              href={PAGE_CONFIG.calendly.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-xl border border-white/10 text-white font-medium text-sm px-7 py-3.5 hover:border-white/20 transition-colors"
            >
              Book a 10-Minute Walkthrough
            </a>
          </motion.div>
        </div>

        {/* RIGHT — single quote analysis card */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.15 }}
          className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <p className="text-xs font-medium tracking-widest uppercase text-slate-300">Quote Analysis</p>
            <span className="text-xs font-semibold tracking-wide uppercase px-2.5 py-1 rounded-md bg-red-500/15 text-red-400 border border-red-500/20">
              3 Issues Found
            </span>
          </div>

          <div className="space-y-5">
            {/* Issue 1 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/10">
                <DollarSign className="h-4 w-4 text-red-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Pricing Above Market</p>
                <p className="text-sm text-slate-300 mt-0.5">
                  Total is 28% above county median for this scope and window count.
                </p>
              </div>
            </div>

            {/* Issue 2 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Missing Scope Items</p>
                <p className="text-sm text-slate-300 mt-0.5">
                  No permit handling, no stucco repair, and no debris removal listed.
                </p>
              </div>
            </div>

            {/* Issue 3 */}
            <div className="flex gap-4 items-start">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
                <ShieldAlert className="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Warranty Gaps</p>
                <p className="text-sm text-slate-300 mt-0.5">
                  Labor warranty not specified. Manufacturer coverage unclear.
                </p>
              </div>
            </div>
          </div>

          {/* Summary bar */}
          <div className="mt-8 pt-5 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">Estimated Overcharge</p>
              <p className="text-lg font-bold text-red-400">$4,200 – $6,800</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

export default HeroSection;
