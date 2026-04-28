import { useState, useEffect, useRef } from "react";
import { AlertTriangle, Zap, CheckCircle2 } from "lucide-react";

const REPORTS = [
  {
    grade: "C",
    percent: 55,
    delta: 4800,
    gradeColor: "hsl(var(--color-vivid-orange))",
    gradientStops: ["#F97316", "#DC2626"],
    subtitle: "GRADE C — REVIEW BEFORE SIGNING",
    flags: [
      {
        stripe: "#DC2626",
        icon: AlertTriangle,
        color: "#F97316",
        label: "No Window Brand Specified",
        sub: "Contractor can install any quality level",
      },
      {
        stripe: "#F59E0B",
        icon: Zap,
        color: "#F59E0B",
        label: "Labor Warranty: 1 Year Only",
        sub: "Industry standard is 2–5 years",
      },
      {
        stripe: "#2563EB",
        icon: CheckCircle2,
        color: "#2563EB",
        label: "Permit Cost Included",
        sub: "This is correctly structured",
      },
    ],
  },
  {
    grade: "F",
    percent: 20,
    delta: 12500,
    gradeColor: "hsl(var(--color-danger))",
    gradientStops: ["#DC2626", "#991B1B"],
    subtitle: "GRADE F — DO NOT SIGN",
    flags: [
      {
        stripe: "#DC2626",
        icon: AlertTriangle,
        color: "#F97316",
        label: "Missing NOA Codes",
        sub: "Cannot verify product approval",
      },
      {
        stripe: "#DC2626",
        icon: AlertTriangle,
        color: "#F97316",
        label: "Permit Fees Listed as TBD",
        sub: "Open-ended cost exposure",
      },
      {
        stripe: "#F59E0B",
        icon: Zap,
        color: "#F59E0B",
        label: "No Disposal Terms",
        sub: "Hidden cost risk on removal",
      },
    ],
  },
  {
    grade: "B",
    percent: 85,
    delta: 800,
    gradeColor: "hsl(var(--primary))",
    gradientStops: ["#2563EB", "#1D4ED8"],
    subtitle: "GRADE B — MOSTLY FAIR",
    flags: [
      {
        stripe: "#2563EB",
        icon: CheckCircle2,
        color: "#2563EB",
        label: "Quality Brand Specified",
        sub: "PGT WinGuard series confirmed",
      },
      {
        stripe: "#2563EB",
        icon: CheckCircle2,
        color: "#2563EB",
        label: "Permit Cost Included",
        sub: "This is correctly structured",
      },
      {
        stripe: "#F59E0B",
        icon: Zap,
        color: "#F59E0B",
        label: "Unclear Disposal Terms",
        sub: "Ask for written confirmation",
      },
    ],
  },
];

const ANIM_DURATION = 1500;

const GradeRing = ({
  percent,
  gradeColor,
  gradientStops,
  grade,
  id,
}: {
  percent: number;
  gradeColor: string;
  gradientStops: string[];
  grade: string;
  id: number;
}) => {
  const radius = 52;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  const gradId = `gradeGradient-${id}`;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
      <svg width={140} height={140} className="absolute -rotate-90">
        <circle cx={70} cy={70} r={radius} fill="none" className="stroke-border" strokeWidth={stroke} />
        <circle
          cx={70}
          cy={70}
          r={radius}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={stroke}
          strokeLinecap="butt"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="wm-grade-ring-progress"
        />
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={gradientStops[0]} />
            <stop offset="100%" stopColor={gradientStops[1]} />
          </linearGradient>
        </defs>
      </svg>
      <span
        className="font-display leading-none wm-grade-letter"
        style={{
          fontSize: 64,
          fontWeight: 900,
          color: gradeColor,
          textShadow: `2px 2px 0px rgba(0,0,0,0.15), 3px 3px 6px ${gradeColor}44`,
        }}
      >
        {grade}
      </span>
    </div>
  );
};

const AnimatedCounter = ({ target }: { target: number }) => {
  const [value, setValue] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    startRef.current = null;
    const animate = (timestamp: number) => {
      if (!startRef.current) startRef.current = timestamp;
      const progress = Math.min((timestamp - startRef.current) / ANIM_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target]);
  return <span className="font-mono font-bold text-xl text-destructive">${value.toLocaleString()}</span>;
};

const SampleGradeCard = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  useEffect(() => {
    inView.current = true;
    const interval = setInterval(() => setCurrentIndex((i) => (i + 1) % REPORTS.length), 5000);
    return () => clearInterval(interval);
  }, []);
  const report = REPORTS[currentIndex];

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden card-raised-hero wm-sample-card-float"
      style={{
        padding: 28,
        maxWidth: 420,
        width: "100%",
        boxShadow: "var(--shadow-elevated), 0 24px 48px rgba(10,25,55,0.12), 0 0 0 1px rgba(37,99,235,0.06)",
      }}
    >
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        style={{ transform: "rotate(-12deg)" }}
      >
        <span className="font-mono text-[22px] md:text-[28px] font-bold tracking-[0.3em] text-primary/10 uppercase border-2 border-primary/10 px-4 py-1 rounded-sm whitespace-nowrap">
          CONFIDENTIAL
        </span>
      </div>
      <div className="flex items-center justify-between mb-5 relative">
        <p className="font-mono tracking-[0.12em] font-bold text-sm text-[#005ef5]">WINDOW TRUTH REPORT</p>
        <span
          className="inline-flex items-center font-mono text-[9px] font-bold tracking-[0.08em] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5"
          style={{ borderRadius: "var(--radius-input)" }}
        >
          SAMPLE
        </span>
      </div>
      <div key={currentIndex} className="wm-fade-in-soft">
          <div className="flex flex-col items-center relative mb-5">
            <GradeRing
              key={currentIndex}
              percent={report.percent}
              gradeColor={report.gradeColor}
              gradientStops={report.gradientStops}
              grade={report.grade}
              id={currentIndex}
            />
            <p className="font-mono text-[11px] text-muted-foreground mt-2">{report.subtitle}</p>
          </div>
          <div
            className="relative mb-5 bg-destructive/5 border border-destructive/15 p-3.5"
            style={{ borderRadius: "var(--radius-input)" }}
          >
            <div className="flex items-baseline gap-2">
              <AnimatedCounter key={currentIndex} target={report.delta} />
              <span className="font-body text-[13px] font-semibold text-destructive/80">Above Fair Market</span>
            </div>
            <p className="font-mono text-[10px] text-muted-foreground mt-1">Broward County Benchmark · Q1 2025</p>
          </div>
          <div className="flex flex-col gap-2 relative">
            {report.flags.map((flag, i) => {
              const Icon = flag.icon;
              return (
                <div
                  key={i}
                  className="flex overflow-hidden bg-muted/50 border border-border"
                  style={{ borderRadius: "var(--radius-input)" }}
                >
                  <div style={{ width: 3, backgroundColor: flag.stripe, flexShrink: 0 }} />
                  <div className="flex items-start gap-2.5 p-2.5">
                    <Icon size={15} color={flag.color} strokeWidth={2.5} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-body text-[13px] font-bold" style={{ color: flag.color }}>
                        {flag.label}
                      </p>
                      <p className="font-body text-[11px] text-muted-foreground mt-0.5">{flag.sub}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
      </div>
      <div className="text-center relative border-t border-border mt-3 pt-3.5">
        <p className="font-body text-xs italic text-muted-foreground">
          Sample View. Your Scan Reveals What To Do With Your Grade
        </p>
      </div>
    </div>
  );
};

export default SampleGradeCard;
