import { FileSearch, Lock, ShieldCheck } from "lucide-react";
import WindowManMark from "@/components/forensic-report/WindowManMark";
import { nextdoorCardElevatedClass } from "./nextdoorUi";

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

const REVIEW_AREAS = [
  { label: "Scope clarity", hint: "What work is actually included" },
  { label: "Permit language", hint: "Who pulls permits and inspections" },
  { label: "Warranty terms", hint: "Product vs. labor coverage" },
  { label: "Payment timing", hint: "Deposit and final-balance triggers" },
  { label: "Product / spec proof", hint: "DP ratings and approvals" },
] as const;

export function NextdoorHeroGradeCard({ subtitle }: Props) {
  return (
    <div
      className={[
        nextdoorCardElevatedClass,
        "group mx-auto w-full max-w-sm overflow-hidden p-0",
        "transition-[transform,box-shadow] duration-300 ease-out will-change-transform",
        "hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_36px_90px_-30px_rgba(8,47,73,0.55),0_0_44px_-12px_rgba(6,182,212,0.5)]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
      ].join(" ")}
    >
      {/* Dark navy forensic header */}
      <div className="relative overflow-hidden border-b border-[#06b6d4]/20 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] px-5 py-4">
        {/* cyan scan linework */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "linear-gradient(115deg, transparent 40%, rgba(6,182,212,0.12) 50%, transparent 60%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#22d3ee]/70 to-transparent"
        />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-[#5fd6ec]">
              Illustrative preview
            </p>
            <p className="font-display text-sm font-bold text-white">WindowMan Quote Check</p>
            <p className="mt-0.5 truncate text-[11px] text-slate-400">{subtitle}</p>
          </div>
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#06b6d4]/40 bg-[#06b6d4]/10 text-[#5fd6ec]"
            aria-hidden="true"
          >
            <FileSearch className="h-5 w-5 stroke-[1.6]" />
          </span>
        </div>
      </div>

      {/* Grade-pending motif */}
      <div className="relative flex items-center gap-4 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white px-5 py-4">
        <div className="relative shrink-0" style={{ width: 76, height: 76 }} aria-hidden="true">
          <svg width={76} height={76} viewBox="0 0 76 76" className="-rotate-90">
            <circle cx={38} cy={38} r={32} fill="none" stroke="hsl(214 28% 88%)" strokeWidth={5} />
            <circle
              cx={38}
              cy={38}
              r={32}
              fill="none"
              stroke="#06b6d4"
              strokeWidth={5}
              strokeLinecap="round"
              strokeDasharray="32 220"
              strokeOpacity={0.55}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center">
            <WindowManMark size={26} opacity={0.9} style={{ color: "#0e7490" }} />
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-display text-base font-extrabold leading-tight text-slate-900">
            Grade pending
          </p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Your quote grade appears here after you upload an estimate.
          </p>
          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-slate-500">
            <ShieldCheck className="h-3 w-3 text-[#0891b2]" aria-hidden="true" />
            Sample · Pre-upload
          </span>
        </div>
      </div>

      {/* Review areas */}
      <ul className="space-y-1.5 px-5 py-4" aria-label="Quote review areas WindowMan checks">
        {REVIEW_AREAS.map(({ label, hint }) => (
          <li
            key={label}
            className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#06b6d4] shadow-[0_0_8px_rgba(6,182,212,0.7)]"
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-slate-800">{label}</span>
              <span className="block truncate text-[11px] text-slate-500">{hint}</span>
            </span>
            <span className="shrink-0 font-mono text-[8px] font-semibold uppercase tracking-wide text-slate-400">
              On upload
            </span>
          </li>
        ))}

        {/* Lock row — orange accent */}
        <li className="mt-1 flex items-center gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5">
          <Lock className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
          <span className="text-[11px] font-semibold leading-snug text-amber-950">
            Preview first · upload when ready
          </span>
        </li>
      </ul>

      {/* Disclaimer footer */}
      <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-2.5">
        <p className="font-mono text-[9px] uppercase tracking-wide text-slate-400">
          Example only — your estimate is reviewed after upload
        </p>
      </div>
    </div>
  );
}
