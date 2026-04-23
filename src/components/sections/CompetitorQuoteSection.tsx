import { motion } from "framer-motion";
import { Check, AlertCircle } from "lucide-react";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];

const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease },
};

const homeownerBrings = [
  "Existing contractor quote",
  "Pricing confusion",
  "Trust uncertainty",
];

const windowmanDoes = [
  "Breaks down pricing",
  "Identifies missing scope",
  "Surfaces risks and red flags",
];

interface CompetitorQuoteSectionProps {
  onOpenQualification?: () => void;
}

const CompetitorQuoteSection = ({ onOpenQualification }: CompetitorQuoteSectionProps) => (
  <section className="py-24">
    <div className="max-w-6xl mx-auto px-6">
      <motion.h2
        {...fadeUp}
        className="text-3xl md:text-4xl font-bold text-white tracking-tight text-center mb-14"
      >
        We Don't Generate Demand. We Intercept It.
      </motion.h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.05 }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8"
        >
          <p className="text-xs font-medium tracking-widest uppercase text-slate-300 mb-6">
            What the Homeowner Brings
          </p>
          <ul className="space-y-4">
            {homeownerBrings.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-400/70" />
                <span className="text-sm text-slate-200">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Right column */}
        <motion.div
          {...fadeUp}
          transition={{ ...fadeUp.transition, delay: 0.1 }}
          className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-8"
        >
          <p className="text-xs font-medium tracking-widest uppercase text-slate-300 mb-6">
            What WindowMan Does
          </p>
          <ul className="space-y-4">
            {windowmanDoes.map((item) => (
              <li key={item} className="flex items-start gap-3">
                <Check className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400/70" />
                <span className="text-sm text-slate-200">{item}</span>
              </li>
            ))}
          </ul>
        </motion.div>
      </div>

      {/* Conclusion */}
      <motion.div
        {...fadeUp}
        transition={{ ...fadeUp.transition, delay: 0.15 }}
        className="mt-12 rounded-xl border border-white/[0.06] bg-white/[0.02] px-8 py-6 text-center"
      >
        <p className="text-base text-slate-200 leading-relaxed max-w-2xl mx-auto">
          WindowMan meets the buyer at the exact moment they start questioning
          what they've been sold.
        </p>
        {onOpenQualification && (
          <button
            type="button"
            onClick={onOpenQualification}
            className="inline-flex items-center justify-center rounded-xl bg-white text-slate-950 font-semibold text-sm px-7 py-3.5 hover:bg-white/90 transition-colors mt-5"
          >
            Intercept Active Buyers
          </button>
        )}
      </motion.div>
    </div>
  </section>
);

export default CompetitorQuoteSection;
