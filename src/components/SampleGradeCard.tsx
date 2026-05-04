import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { motion, useAnimationControls } from "framer-motion";
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
const SCAN_MS = 2000;
const REVEAL_MS = 4000;
const CYCLE_MS = SCAN_MS + REVEAL_MS;

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

type Phase = "scanning" | "reveal";

const SampleGradeCard = () => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("reveal");
  const [cardHeight, setCardHeight] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const laserControls = useAnimationControls();
  const overlayControls = useAnimationControls();
  const gradeControls = useAnimationControls();

  const timersRef = useRef<number[]>([]);
  const startedRef = useRef(false);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  // Measure card height + observe resize
  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    setCardHeight(el.offsetHeight);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const h = (entry.target as HTMLElement).offsetHeight;
        if (h > 0) setCardHeight(h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const clearAllTimers = () => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  };

  const pushTimer = (id: number) => {
    timersRef.current.push(id);
  };

  // Reduced-motion branch: simple 6s rotation, content always visible
  useEffect(() => {
    if (!reducedMotion) return;
    setPhase("reveal");
    const interval = window.setInterval(() => {
      setCurrentIndex((i) => (i + 1) % REPORTS.length);
    }, CYCLE_MS);
    return () => window.clearInterval(interval);
  }, [reducedMotion]);

  // Kick off the first loop after 500ms (idle if available)
  useEffect(() => {
    if (reducedMotion) return;
    if (startedRef.current) return;
    if (cardHeight <= 0) return;

    startedRef.current = true;

    const start = () => setPhase("scanning");

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };

    if (typeof w.requestIdleCallback === "function") {
      const idleId = w.requestIdleCallback(
        () => {
          const t = window.setTimeout(start, 0);
          pushTimer(t);
        },
        { timeout: 800 },
      );
      // Safety fallback in case idle never fires
      const safety = window.setTimeout(start, 800);
      pushTimer(safety);
      return () => {
        const wAny = window as Window & { cancelIdleCallback?: (id: number) => void };
        wAny.cancelIdleCallback?.(idleId);
      };
    }

    const t = window.setTimeout(start, 500);
    pushTimer(t);
  }, [cardHeight, reducedMotion]);

  // Phase machine
  useEffect(() => {
    if (reducedMotion) return;
    if (cardHeight <= 0) return;
    if (!startedRef.current) return;

    let cancelled = false;

    if (phase === "scanning") {
      // Hide grade, show overlay + laser
      gradeControls.set({ opacity: 0, scale: 0.96 });
      overlayControls.set({ opacity: 0 });
      overlayControls.start({ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } });

      laserControls.set({ y: 0, opacity: 1 });
      laserControls.start({
        y: cardHeight,
        transition: { duration: SCAN_MS / 1000, ease: "easeInOut", type: "tween" },
      });

      const t = window.setTimeout(() => {
        if (cancelled) return;
        setPhase("reveal");
      }, SCAN_MS);
      pushTimer(t);
    } else {
      // Reveal: hide laser/overlay, spring grade in
      laserControls.start({ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } });
      overlayControls.start({ opacity: 0, transition: { duration: 0.2, ease: "easeOut" } });
      gradeControls.start({
        opacity: 1,
        scale: 1,
        transition: { type: "spring", stiffness: 200, damping: 20 },
      });

      const t = window.setTimeout(() => {
        if (cancelled) return;
        setCurrentIndex((i) => (i + 1) % REPORTS.length);
        setPhase("scanning");
      }, REVEAL_MS);
      pushTimer(t);
    }

    return () => {
      cancelled = true;
    };
  }, [phase, cardHeight, reducedMotion, laserControls, overlayControls, gradeControls]);

  // Final cleanup on unmount
  useEffect(() => {
    return () => {
      clearAllTimers();
      laserControls.stop();
      overlayControls.stop();
      gradeControls.stop();
    };
  }, [laserControls, overlayControls, gradeControls]);

  const report = REPORTS[currentIndex];
  const showScanChrome = !reducedMotion && phase === "scanning";

  return (
    <div
      ref={cardRef}
      className="relative overflow-hidden card-raised-hero wm-sample-card-float"
      style={{
        padding: 28,
        maxWidth: 420,
        width: "100%",
        border: "1px solid rgba(37, 99, 235, 0.22)",
        background: "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.96))",
        boxShadow:
          "var(--shadow-elevated), 0 28px 64px rgba(10,25,55,0.18), 0 0 0 1px rgba(37,99,235,0.14), 0 0 36px rgba(0,217,255,0.10)",
      }}
    >
      {/* CONFIDENTIAL watermark — existing low layer */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden"
        style={{ transform: "rotate(-12deg)", zIndex: 0 }}
      >
        <span className="font-mono text-[22px] md:text-[28px] font-bold tracking-[0.3em] text-primary/10 uppercase border-2 border-primary/10 px-4 py-1 rounded-sm whitespace-nowrap">
          CONFIDENTIAL
        </span>
      </div>

      {/* Cyan scan overlay (z 20) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          initial={{ opacity: 0 }}
          animate={overlayControls}
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 20,
            pointerEvents: "none",
            background: "rgba(0,255,255,0.05)",
          }}
        />
      )}

      {/* Laser line (z 30) */}
      {!reducedMotion && (
        <motion.div
          aria-hidden
          initial={{ y: 0, opacity: 0 }}
          animate={laserControls}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: 2,
            zIndex: 30,
            pointerEvents: "none",
            background: "#00FFFF",
            boxShadow: "0 0 15px 2px rgba(0,255,255,0.7)",
            willChange: "transform, opacity",
            transform: "translateZ(0)",
          }}
        />
      )}

      {/* SCANNING… label (z 40) */}
      {showScanChrome && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 40,
            pointerEvents: "none",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.14em",
            color: "#00FFFF",
          }}
        >
          SCANNING…
        </span>
      )}

      {/* CASE-ID watermark (z 40) */}
      {showScanChrome && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            bottom: 12,
            right: 12,
            zIndex: 40,
            pointerEvents: "none",
            fontFamily: "'DM Mono', monospace",
            fontSize: 10,
            opacity: 0.15,
            color: "#0A0A0A",
          }}
        >
          CASE-ID: 4N0M-22X
        </span>
      )}

      {/* Header row — promoted to z 40 so SAMPLE chip sits above the laser */}
      <div
        className="flex items-center justify-between mb-5"
        style={{ position: "relative", zIndex: 40 }}
      >
        <p className="font-mono tracking-[0.12em] font-bold text-sm text-[#005ef5]">WINDOW TRUTH REPORT</p>
        <span
          className="inline-flex items-center font-mono text-[9px] font-bold tracking-[0.08em] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5"
          style={{ borderRadius: "var(--radius-input)" }}
        >
          SAMPLE
        </span>
      </div>

      {/* Main report content — wrapped in motion.div for spring reveal (z 10) */}
      <motion.div
        key={currentIndex}
        className="wm-fade-in-soft"
        initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
        animate={gradeControls}
        style={{ position: "relative", zIndex: 10 }}
      >
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
      </motion.div>

      <div
        className="text-center border-t border-border mt-3 pt-3.5"
        style={{ position: "relative", zIndex: 10 }}
      >
        <p className="font-body text-xs italic text-muted-foreground">
          Sample View. Your Scan Reveals What To Do With Your Grade
        </p>
      </div>
    </div>
  );
};

export default SampleGradeCard;
