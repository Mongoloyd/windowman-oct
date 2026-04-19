import SectionEyebrow from "./SectionEyebrow";
import SectionHeading from "./SectionHeading";
import { useTickerStats } from "@/hooks/useTickerStats";

interface StatItem {
  label: string;
  value: string;
}

interface TrustProofSectionProps {
  stats?: StatItem[];
}

const proofItems = [
  "Scope Detail",
  "Material Assumptions",
  "Glass Specifications",
  "Price Position",
  "Per-Opening Cost",
  "County Baseline Match",
  "Warranty Posture",
  "Exclusion Language",
  "Change-Order Exposure",
  "Permit Handling",
  "DP Rating Disclosure",
  "Install Scope Clarity",
];

export default function TrustProofSection({ stats }: TrustProofSectionProps) {
  const { total } = useTickerStats();
  const defaultStats: StatItem[] = [
    { label: "Quotes Analyzed", value: `${total.toLocaleString()}+` },
    { label: "Counties Tracked", value: "38" },
    { label: "Hidden Risks Flagged", value: "6,100+" },
  ];
  const displayStats = stats ?? defaultStats;

  return (
    <section className="relative overflow-hidden px-6 py-16 md:px-8 md:py-24" style={{ background: "transparent" }}>
      {/* Depth L1 — strong cyan-blue radial, behind stat strip */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          top: "15%",
          left: "50%",
          transform: "translateX(-50%)",
          width: "85%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(6,182,212,0.10) 0%, rgba(30,80,180,0.07) 50%, transparent 72%)",
          filter: "blur(48px)",
        }}
      />
      {/* Depth L2 — deep blue flanks */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          bottom: "0%",
          right: "-8%",
          width: "55%",
          height: "70%",
          background: "radial-gradient(ellipse at 65% 55%, rgba(14,40,100,0.08) 0%, transparent 70%)",
          filter: "blur(44px)",
        }}
      />
      <div className="relative mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="mb-12 text-center md:mb-16">
          <SectionEyebrow className="mb-4">THE PROOF LAYER</SectionEyebrow>
          <SectionHeading className="mb-6">Data, Not Promises.</SectionHeading>
          <p className="mx-auto max-w-3xl text-base leading-relaxed text-foreground/80 md:text-lg">
            We do not rely on vague claims or empty reassurance. We rely on contract structure, county baselines,
            normalized quote comparison, and repeatable detection of weak pricing and weak scope.
          </p>
        </div>

        {/* A) StatStrip — flex with automatic dividers, adapts to any stat count */}
        <div
          className="mb-10 flex divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-200 bg-white"
          style={{
            boxShadow:
              "0 4px 8px rgba(10,25,60,0.10), 0 16px 48px rgba(10,25,80,0.14), 0 0 0 1px rgba(6,182,212,0.07), inset 0 1px 0 rgba(255,255,255,0.95)",
          }}
        >
          {displayStats.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-1 flex-col items-center gap-1 px-4 py-6 text-center md:px-8 md:py-8"
            >
              <span
                className="font-display text-2xl font-extrabold tracking-tight md:text-3xl"
                style={{ color: "#06B6D4", textShadow: "0 0 20px rgba(6,182,212,0.3)" }}
              >
                {stat.value}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                {stat.label}
              </span>
            </div>
          ))}
        </div>

        {/* B) ProofPanel */}
        <div
          className="mb-8 rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8"
          style={{
            boxShadow: "inset 0 2px 6px rgba(10,25,55,0.04), inset 0 1px 2px rgba(10,25,55,0.03)",
          }}
        >
          <p className="mb-6 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            What We Actually Inspect
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {proofItems.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span
                  className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                  style={{ background: "#06B6D4" }}
                  aria-hidden="true"
                />
                <span className="text-sm font-medium text-foreground/80">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* C) SampleFindingCard */}
        <div
          className="rounded-2xl bg-white p-8"
          style={{
            boxShadow:
              "0 4px 8px rgba(10,25,60,0.10), 0 16px 48px rgba(10,25,80,0.14), 0 0 0 1px rgba(6,182,212,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
            borderLeft: "3px solid #06B6D4",
          }}
        >
          <div className="mb-4 flex items-center gap-3">
            <span
              className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
              style={{
                background: "#06B6D4",
                boxShadow: "0 0 6px #06B6D4",
              }}
              aria-hidden="true"
            />
            <span className="font-mono text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Sample Finding
            </span>
          </div>
          <p className="mb-4 text-base leading-relaxed text-foreground/85 md:text-lg">
            County Baseline Suggests This Quote Sits Above Expected Range For Comparable Scope. Three Structural Gaps
            Increase The Risk That The Homeowner Is Paying More While Seeing Less on Paper.
          </p>
          <p className="text-sm italic text-sky-600">
            This is the Kind of Signal WindowMan is Designed to Surface Before Commitment.
          </p>
        </div>
      </div>
    </section>
  );
}
