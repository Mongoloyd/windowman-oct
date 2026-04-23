import { motion } from "framer-motion";

const ease: [number, number, number, number] = [0.22, 1, 0.36, 1];
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease },
};

const points = [
  "Fewer partners per territory",
  "Focus on quality over volume",
  "Controlled intake",
] as const;

interface ExclusivitySectionProps {
  onOpenQualification?: () => void;
}

const ExclusivitySection = ({ onOpenQualification }: ExclusivitySectionProps) => (
  <section className="py-24 bg-black">
    <div className="max-w-4xl mx-auto px-6 text-center">
      <motion.h2 {...fadeUp} className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-6">
        Not Every Contractor Is a Fit
      </motion.h2>
      <motion.p {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.05 }} className="text-lg text-slate-200 leading-relaxed mb-10 max-w-2xl mx-auto">
        WindowMan is structured to work with a limited number of contractors per area to maintain quality and consistency.
      </motion.p>
      <motion.ul {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }} className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
        {points.map((p) => (
          <li key={p} className="text-sm text-slate-300 font-medium tracking-wide uppercase">{p}</li>
        ))}
      </motion.ul>
      <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.15 }}>
        <motion.button
          onClick={onOpenQualification}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="inline-flex items-center justify-center bg-white text-black px-8 py-4 rounded-full font-bold text-lg hover:bg-zinc-200 transition-colors"
        >
          See If You Qualify
        </motion.button>
      </motion.div>
    </div>
  </section>
);

export default ExclusivitySection;
