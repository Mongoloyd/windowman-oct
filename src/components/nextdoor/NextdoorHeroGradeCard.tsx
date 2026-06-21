import {
  Clock,
  FileSignature,
  FileText,
  FlaskConical,
  LineChart,
  Lock,
  ShieldCheck,
  Target,
  type LucideIcon,
} from "lucide-react";
import { NEXTDOOR_GRID_TEXTURE } from "./nextdoorUi";

type Props = {
  /** Area subtitle, e.g. "Your area · Impact window estimate". */
  subtitle: string;
};

/**
 * NextdoorHeroGradeCard — static, illustrative forensic proof module.
 *
 * Purely presentational. No data fetch, no analysis state, no scan session,
 * no protected report imports. Communicates: "WindowMan inspects quote
 * details, the full report stays locked until verification, and nothing is
 * analyzed until you upload." The grade ring is a deliberate placeholder
 * ("grade pending") — it never shows a fabricated score.
 */

type ReviewArea = {
  id: string;
  label: string;
  hint: string;
  icon: LucideIcon;
  iconClass: string;
};

const REVIEW_AREAS: ReviewArea[] = [
  {
    id: "scope",
    label: "Scope clarity",
    hint: "What work is actually included",
    icon: Target,
    iconClass: "text-cyan-400",
  },
  {
    id: "permits",
    label: "Permit language",
    hint: "Who pulls permits and inspections",
    icon: FileSignature,
    iconClass: "text-cyan-400",
  },
  {
    id: "warranty",
    label: "Warranty terms",
    hint: "Product vs. labor coverage",
    icon: ShieldCheck,
    iconClass: "text-cyan-400",
  },
  {
    id: "payment",
    label: "Payment timing",
    hint: "Deposit and final-balance triggers",
    icon: Clock,
    iconClass: "text-cyan-400",
  },
  {
    id: "spec",
    label: "Product / spec proof",
    hint: "DP ratings and approvals",
    icon: FlaskConical,
    iconClass: "text-orange-400",
  },
];

/** Dark-screen grid — same rhythm as NEXTDOOR_GRID_TEXTURE, tuned for navy HUD. */
const DARK_SCREEN_GRID = {
  backgroundImage:
    "linear-gradient(to right, rgba(148,163,184,0.10) 1px, transparent 1px)," +
    "linear-gradient(to bottom, rgba(148,163,184,0.10) 1px, transparent 1px)",
  backgroundSize: NEXTDOOR_GRID_TEXTURE.backgroundSize,
};

function WindowGridIcon({ className }: { className?: string }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M12 3V21M3 12H21" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function DeviceScrew({ className }: { className: string }) {
  return (
    <span
      className={`absolute h-1.5 w-1.5 rounded-full border border-slate-900 bg-slate-700 shadow-inner ${className}`}
      aria-hidden="true"
    />
  );
}

export function NextdoorHeroGradeCard({ subtitle }: Props) {
  return (
    <div
      className={[
        "group/device relative mx-auto w-full max-w-sm",
        "transition-[transform,box-shadow] duration-300 ease-out will-change-transform",
        "hover:-translate-y-1",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      ].join(" ")}
    >
      {/* Device bezel */}
      <div
        className={[
          "relative overflow-hidden rounded-[28px] border border-slate-700/60 p-2.5",
          "bg-gradient-to-b from-[#1c2d42] to-[#0c1420]",
          "shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85),0_0_40px_-12px_rgba(6,182,212,0.15)]",
          "group-hover/device:shadow-[0_24px_70px_-15px_rgba(0,0,0,0.9),0_0_48px_-10px_rgba(6,182,212,0.25)]",
        ].join(" ")}
      >
        <DeviceScrew className="left-3 top-3" />
        <DeviceScrew className="right-3 top-3" />
        <DeviceScrew className="bottom-3 left-3" />
        <DeviceScrew className="bottom-3 right-3" />

        {/* Neon edge strips */}
        <div
          className="pointer-events-none absolute left-0 top-[20%] h-48 w-[2px] bg-gradient-to-b from-transparent via-cyan-500 to-transparent opacity-70 blur-[1px]"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-[30%] h-48 w-[2px] bg-gradient-to-b from-transparent via-purple-500 to-transparent opacity-70 blur-[1px]"
          aria-hidden="true"
        />

        {/* Inner screen */}
        <div className="relative overflow-hidden rounded-[22px] border border-slate-800/80 bg-[#0c121d]">
          {/* Grid + ambient glow */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={DARK_SCREEN_GRID}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute left-10 top-16 h-40 w-40 rounded-full bg-cyan-500/10 blur-[50px]"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute bottom-16 right-10 h-40 w-40 rounded-full bg-purple-500/10 blur-[50px]"
            aria-hidden="true"
          />

          {/* Decorative laser sweep — hover only, motion-safe */}
          <div
            className={[
              "pointer-events-none absolute -left-[20%] -right-[20%] z-20 h-[2px]",
              "bg-cyan-300 opacity-0 shadow-[0_0_20px_4px_#22d3ee,0_0_40px_8px_rgba(6,182,212,0.35)]",
              "top-[30%] -rotate-[25deg] mix-blend-screen",
              "motion-safe:transition-all motion-safe:duration-1000 motion-safe:ease-in-out",
              "motion-safe:group-hover/device:top-[58%] motion-safe:group-hover/device:opacity-70",
              "motion-reduce:hidden",
            ].join(" ")}
            aria-hidden="true"
          />

          {/* Header */}
          <div className="relative z-10 border-b border-white/5 bg-gradient-to-b from-[#111827] to-[#0c121d] px-5 py-4">
            <div
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/50 to-transparent"
              aria-hidden="true"
            />
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-cyan-400">
                  Illustrative preview
                </p>
                <p className="font-display text-sm font-bold text-white">
                  WindowMan{" "}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-orange-300 to-amber-500">
                    Quote Check
                  </span>
                </p>
                <p className="mt-0.5 truncate text-[11px] font-medium tracking-wide text-slate-400">
                  {subtitle}
                </p>
              </div>

              {/* Radar icon */}
              <div className="relative flex h-11 w-11 shrink-0 items-center justify-center" aria-hidden="true">
                <div className="absolute inset-0 rounded-full border border-cyan-500/30 motion-safe:animate-[spin_4s_linear_infinite] motion-reduce:animate-none" />
                <div className="absolute inset-1 rounded-full border border-cyan-500/10 border-t-cyan-400 motion-safe:animate-[spin_3s_linear_infinite_reverse] motion-reduce:animate-none" />
                <FileText className="relative h-5 w-5 text-cyan-400" strokeWidth={1.5} />
              </div>
            </div>
          </div>

          {/* Grade-pending block */}
          <div className="relative z-10 flex items-center gap-4 border-b border-white/5 px-5 py-4">
            <div className="relative shrink-0" style={{ width: 76, height: 76 }} aria-hidden="true">
              <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
                <defs>
                  <linearGradient id="grade-ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#f59e0b" />
                  </linearGradient>
                </defs>
                <circle cx={38} cy={38} r={32} fill="none" stroke="#1e293b" strokeWidth={5} />
                <circle
                  cx={38}
                  cy={38}
                  r={32}
                  fill="none"
                  stroke="url(#grade-ring-gradient)"
                  strokeWidth={5}
                  strokeLinecap="round"
                  strokeDasharray="32 220"
                  strokeOpacity={0.85}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-cyan-400">
                <WindowGridIcon />
              </span>
            </div>
            <div className="min-w-0">
              <p className="font-display text-base font-extrabold leading-tight text-slate-100">
                Your grade appears after upload
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                WindowMan grades scope, permits, warranty, timing, and pricing.
              </p>
              <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-cyan-400">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                Sample · Pre-upload
              </span>
            </div>
          </div>

          {/* Review areas + illustrative callout */}
          <div className="relative z-10 px-5 py-4">
            <ul className="space-y-2" aria-label="Quote review areas WindowMan checks">
              {REVIEW_AREAS.map(({ id, label, hint, icon: Icon, iconClass }) => (
                <li
                  key={id}
                  className={[
                    "group/row flex items-center justify-between gap-3 rounded-xl",
                    "border border-white/5 bg-white/[0.03] p-3 backdrop-blur-sm",
                    "transition-colors duration-300",
                    "hover:border-white/10 hover:bg-white/[0.05]",
                  ].join(" ")}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div
                      className={[
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                        "border border-slate-800 bg-slate-900/50 shadow-inner",
                        "transition-colors group-hover/row:border-slate-700",
                      ].join(" ")}
                    >
                      <Icon className={`h-5 w-5 ${iconClass}`} strokeWidth={1.5} aria-hidden="true" />
                    </div>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold tracking-tight text-slate-200">
                        {label}
                      </span>
                      <span className="block truncate text-[11px] font-medium text-slate-500">{hint}</span>
                    </span>
                  </div>
                  <span className="shrink-0 rounded-md border border-slate-700/50 bg-slate-800/30 px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-500">
                    On upload
                  </span>
                </li>
              ))}
            </ul>

            {/* Static illustrative callout — tablet/desktop only */}
            <div
              className="pointer-events-none absolute right-0 top-[28%] z-30 hidden w-[190px] sm:block"
              aria-hidden="true"
            >
              <svg
                className="absolute -left-7 top-7 h-10 w-10"
                fill="none"
                stroke="#f97316"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path d="M0,0 L32,16" opacity={0.6} />
              </svg>
              <div className="rounded-xl border border-orange-500/40 bg-[#0f141e]/95 p-3 shadow-[0_10px_30px_-5px_rgba(249,115,22,0.2)] backdrop-blur-md">
                <div className="mb-1.5 flex items-start gap-2">
                  <div className="shrink-0 rounded-lg border border-orange-500/20 bg-orange-500/10 p-1.5">
                    <LineChart className="h-4 w-4 text-orange-400" strokeWidth={1.5} />
                  </div>
                  <h4 className="text-[11px] font-semibold leading-tight text-orange-400">
                    Pricing &amp; scope variance
                  </h4>
                </div>
                <p className="text-[10px] font-medium leading-relaxed text-slate-300">
                  Illustrative risk callout. Full findings appear after upload and verification.
                </p>
              </div>
            </div>
          </div>

          {/* Non-interactive unlock strip */}
          <div className="relative z-10 px-5 pb-4">
            <div
              className="relative overflow-hidden rounded-xl p-px"
              role="presentation"
              aria-hidden="true"
            >
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-amber-600/60 via-orange-500/60 to-amber-600/60 opacity-80" />
              <div className="relative flex items-center justify-center gap-2 rounded-xl bg-[#0a0f18]/95 px-4 py-3.5 backdrop-blur-sm">
                <Lock className="h-4 w-4 shrink-0 text-orange-400" strokeWidth={2} />
                <span className="text-center text-[11px] font-semibold leading-snug tracking-wide text-orange-50/90 sm:text-xs">
                  Unlock full analysis after secure verification
                </span>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
              Safe preview first · full details after a quick phone check
            </p>
          </div>

          {/* Footer disclaimer */}
          <div className="relative z-10 border-t border-slate-800/80 bg-[#0a0f18]/90 px-5 py-3 text-center">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Example only — your estimate is reviewed after upload
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
