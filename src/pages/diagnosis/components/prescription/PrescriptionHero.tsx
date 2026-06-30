import {
  bodyMuted,
  fieldValue,
  heroCard,
  sectionGap,
  sectionHeadline,
  sectionLabel,
} from "./prescriptionTokens";

interface PrescriptionHeroProps {
  reportGrade?: string | null;
  prescriptionSubhead?: string | null;
}

export function PrescriptionHero({ reportGrade, prescriptionSubhead }: PrescriptionHeroProps) {
  const subcopy =
    prescriptionSubhead?.trim() ||
    "WindowMan matched your quote risks and preferences into a safer path forward.";

  const gradeBadge =
    typeof reportGrade === "string" && reportGrade.trim()
      ? reportGrade.trim().toUpperCase()
      : null;

  return (
    <div className={`${heroCard} ${sectionGap} p-8 md:p-12 lg:p-14 text-center relative overflow-hidden`}>
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[32rem] max-w-full -translate-x-1/2 rounded-full bg-blue-400/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
      />
      <div className="relative">
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-7">
          <span className="inline-flex items-center rounded-full border border-blue-300/50 bg-white px-5 py-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700 shadow-[0_4px_16px_rgba(37,99,235,0.12)]">
            Better Quote Path
          </span>
          {gradeBadge ? (
            <span className="inline-flex items-center rounded-full border border-slate-200/90 bg-white/95 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-600 shadow-sm">
              Report Grade · {gradeBadge}
            </span>
          ) : null}
        </div>
        <h1
          className={`${sectionHeadline} text-[2rem] sm:text-4xl md:text-[2.75rem] lg:text-5xl leading-[1.08] mb-5`}
        >
          Your Better Quote Path Is Ready.
        </h1>
        <p className={`${bodyMuted} text-base md:text-lg max-w-2xl mx-auto`}>{subcopy}</p>
      </div>
    </div>
  );
}
