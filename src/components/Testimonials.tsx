import { useRef } from "react";
import { useTickerStats } from "../hooks/useTickerStats";
import { motion, useInView } from "framer-motion";

const stories = [
  {
    initial: "M",
    name: "Maria",
    location: "Pembroke Pines, FL",
    grade: "C",
    gradeColor: "#F97316",
    narrative: [
      "She got three quotes. They all looked similar. She uploaded the highest one to WindowMan before calling the contractor back.",
      "The scan flagged the window brand as unspecified.",
      "She called back and asked one question. The contractor revised the quote.",
    ],
    result: "Contractor revised quote after one phone call.",
    flag: "Red flag caught: Unspecified window brand",
  },
  {
    initial: "D",
    name: "David",
    location: "Coral Springs, FL",
    grade: "D",
    gradeColor: "#DC2626",
    narrative: [
      "His quote was $17,400. He uploaded it because he wasn't sure the price was right.",
      "The scan put his quote at 26% above fair market for Broward County.",
      "He didn't negotiate. He walked away and found a contractor whose quote came in $5,200 lower.",
    ],
    result: "Found a contractor $5,200 lower for the same scope.",
    flag: "Red flag caught: 26% above Broward County benchmark",
  },
];

interface TestimonialsProps {
  onScanClick?: () => void;
}

const Testimonials = ({ onScanClick }: TestimonialsProps) => {
  const { total } = useTickerStats();
  const sectionRef = useRef<HTMLElement>(null);
  const inView = useInView(sectionRef, { once: true, margin: "-80px" });

  return (
    <section ref={sectionRef} className="py-16 md:py-24 bg-transparent">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-center mb-10 md:mb-12"
        >
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
            Real Homeowner Results
          </p>
          <h2 className="font-display text-4xl md:text-5xl font-extrabold uppercase tracking-tight text-foreground">
            What Homeowners Are Saying
          </h2>
        </motion.div>

        {/* Narrative Story Cards */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-10 md:mb-12"
        >
          {stories.map((story, i) => (
            <div
              key={i}
              className="card-raised flex flex-col gap-5 p-6 md:p-7 shadow-sm transition-shadow duration-200 hover:shadow-md"
            >
              <div className="flex justify-between items-start gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="flex shrink-0 items-center justify-center w-10 h-10 bg-primary/10 ring-1 ring-primary/15"
                    style={{ borderRadius: "var(--radius-btn)" }}
                  >
                    <span className="font-body text-base font-bold text-primary">{story.initial}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="font-body text-base font-bold text-foreground truncate">{story.name}</p>
                    <p className="font-body text-[13px] text-muted-foreground">{story.location}</p>
                  </div>
                </div>
                <div
                  className="flex shrink-0 items-center justify-center w-11 h-11 shadow-sm"
                  style={{
                    border: `2px solid ${story.gradeColor}`,
                    background: `${story.gradeColor}15`,
                    borderRadius: "var(--radius-btn)",
                  }}
                >
                  <span className="font-mono text-xl font-bold" style={{ color: story.gradeColor }}>
                    {story.grade}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {story.narrative.map((p, j) => (
                  <p
                    key={j}
                    className="text-sm md:text-[15px] leading-relaxed text-foreground/85"
                  >
                    {p}
                  </p>
                ))}
              </div>
              <div
                className="flex items-start gap-3 bg-primary/5 border border-primary/20 p-4 shadow-sm"
                style={{ borderRadius: "var(--radius-btn)" }}
              >
                <span className="text-primary text-lg leading-none mt-0.5" aria-hidden="true">✓</span>
                <p className="font-body text-sm md:text-[15px] text-primary font-semibold leading-snug">{story.result}</p>
              </div>
              <div>
                <span
                  className="inline-flex bg-destructive/10 border border-destructive/20 px-3 py-1.5 font-body text-xs text-destructive font-semibold tracking-wide"
                  style={{ borderRadius: "var(--radius-btn)" }}
                >
                  {story.flag}
                </span>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Stats Strip */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.2, ease: "easeOut" }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10 md:mb-12"
        >
          <div className="card-raised p-5 md:p-6 text-center shadow-sm">
            <p className="font-display font-extrabold text-3xl md:text-4xl text-[hsl(var(--color-emerald))] mb-1.5 tabular-nums">
              ${((total * 3800) / 1000000).toFixed(1)}M+
            </p>
            <p className="font-body text-sm text-muted-foreground leading-snug">Total Saved This Year</p>
          </div>
          <div className="card-raised p-5 md:p-6 text-center shadow-sm">
            <p className="font-display font-extrabold text-3xl md:text-4xl text-primary mb-1.5 tabular-nums">
              {total.toLocaleString()}
            </p>
            <p className="font-body text-sm text-muted-foreground leading-snug">Quotes Analyzed</p>
          </div>
          <div className="card-raised p-5 md:p-6 text-center shadow-sm">
            <p className="font-display font-extrabold text-3xl md:text-4xl text-[hsl(var(--color-vivid-orange))] mb-1.5 tabular-nums">
              94%
            </p>
            <p className="font-body text-sm text-muted-foreground leading-snug">Had Hidden Red Flags</p>
          </div>
        </motion.div>

        {/* Bottom CTA */}
        {onScanClick && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.4, delay: 0.3, ease: "easeOut" }}
            className="card-dominant p-8 text-center"
          >
            <h3 className="font-display font-extrabold text-xl md:text-2xl text-foreground mb-3 uppercase tracking-wide">
              See What's Hiding in Your Quote
            </h3>
            <p className="font-body text-sm text-muted-foreground mb-6 max-w-md mx-auto">
              Upload Your Estimate And Get A Free Forensic Grade In Under 60 Seconds.
            </p>
            <button onClick={onScanClick} className="btn-depth-primary py-4 px-8 text-[16px]">
              Show Me My Grade →
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
};

export default Testimonials;
