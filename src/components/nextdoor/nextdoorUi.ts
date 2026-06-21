/* ═══════════════════════════════════════════════════════════════════════
   WindowMan /nextdoor — light forensic surface system
   Brand accent: cobalt (--primary) for trust, cyan (#06b6d4) as the
   forensic "scan" accent, orange reserved for warnings/locks only.
   All tokens are Tailwind-utility / inline-style based (no index.css edits).
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Page surface — continuous soft blue desk with desaturated orange warmth.
 * Designed for a fixed full-viewport layer (no hero box clip).
 */
export const NEXTDOOR_PAGE_BG =
  "radial-gradient(ellipse 130% 85% at 50% -18%, hsl(204 58% 94% / 0.95) 0%, transparent 58%)," +
  "radial-gradient(ellipse 95% 65% at 0% 12%, hsl(214 48% 93% / 0.55) 0%, transparent 52%)," +
  "radial-gradient(ellipse 90% 60% at 100% 8%, hsl(28 42% 92% / 0.42) 0%, transparent 50%)," +
  "radial-gradient(ellipse 110% 75% at 50% 48%, hsl(210 35% 97% / 0.75) 0%, transparent 62%)," +
  "radial-gradient(ellipse 85% 55% at 78% 78%, hsl(32 38% 93% / 0.32) 0%, transparent 58%)," +
  "linear-gradient(180deg, hsl(210 45% 99%) 0%, hsl(213 38% 98%) 40%, hsl(216 36% 98%) 72%, hsl(214 38% 97%) 100%)";

/** Subtle dot pattern — page-wide, no hard section masks. */
export const NEXTDOOR_PAGE_PATTERN: { backgroundImage: string; backgroundSize: string } = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, hsl(214 22% 68% / 0.35) 0.65px, transparent 0)," +
    "linear-gradient(to right, hsl(214 28% 88% / 0.12) 1px, transparent 1px)," +
    "linear-gradient(to bottom, hsl(214 28% 88% / 0.12) 1px, transparent 1px)",
  backgroundSize: "32px 32px, 48px 48px, 48px 48px",
};

/** Forensic document-grid texture (CSS-only) — hero accent overlays only. */
export const NEXTDOOR_GRID_TEXTURE: { backgroundImage: string; backgroundSize: string } = {
  backgroundImage:
    "linear-gradient(to right, hsl(214 30% 86% / 0.28) 1px, transparent 1px)," +
    "linear-gradient(to bottom, hsl(214 30% 86% / 0.28) 1px, transparent 1px)",
  backgroundSize: "34px 34px",
};

/** Soft bottom vignette — navy depth under the fold (decorative). */
export const NEXTDOOR_VIGNETTE =
  "radial-gradient(ellipse 140% 70% at 50% 115%, hsl(217 40% 62% / 0.12) 0%, transparent 65%)";

/**
 * Base tactile card — raised report module. Layered shadow + inner top
 * highlight + hover lift with a controlled cyan glow.
 */
export const nextdoorCardClass =
  "relative rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50/85 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_8px_-3px_rgba(15,40,90,0.10),0_18px_44px_-24px_rgba(15,40,90,0.32)]";

/** Card + interactive lift/glow on hover and tap. */
export const nextdoorCardInteractiveClass =
  nextdoorCardClass +
  " transition-[transform,box-shadow] duration-300 ease-out will-change-transform " +
  "hover:-translate-y-0.5 hover:border-[#06b6d4]/35 " +
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_4px_12px_-3px_rgba(15,40,90,0.14),0_26px_60px_-26px_rgba(8,47,73,0.42),0_0_28px_-10px_rgba(6,182,212,0.45)] " +
  "active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Risk/example cards — red forensic glow on hover/focus (Why details matter). */
export const nextdoorCardRiskInteractiveClass =
  nextdoorCardClass +
  " transition-[transform,box-shadow,border-color] duration-300 ease-out will-change-transform " +
  "hover:-translate-y-0.5 hover:border-red-400 " +
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_50px_rgba(239,68,68,0.20)] " +
  "focus-within:-translate-y-0.5 focus-within:border-red-400 " +
  "focus-within:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_50px_rgba(239,68,68,0.20)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 " +
  "active:scale-[0.99] motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Hero-level elevated card (a touch more lift, used by the gradecard). */
export const nextdoorCardElevatedClass =
  "relative rounded-2xl border border-white/80 bg-gradient-to-b from-white to-slate-50/80 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_10px_-3px_rgba(15,40,90,0.12),0_30px_70px_-28px_rgba(8,47,73,0.40)]";

/** Primary action — forensic cyan, tactile depth + press + glow. */
export const nextdoorPrimaryCtaClass =
  "group relative inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-[#0e7490] bg-gradient-to-b from-[#22d3ee] via-[#06b6d4] to-[#0891b2] font-bold text-white " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_6px_18px_-6px_rgba(6,182,212,0.6),0_2px_6px_rgba(8,47,73,0.28)] " +
  "transition-[transform,box-shadow,filter] duration-200 ease-out " +
  "hover:-translate-y-0.5 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_10px_26px_-6px_rgba(6,182,212,0.72),0_4px_10px_rgba(8,47,73,0.3)] " +
  "active:translate-y-px active:shadow-[inset_0_2px_6px_rgba(8,47,73,0.4)] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "disabled:cursor-not-allowed disabled:opacity-55 disabled:saturate-50 disabled:hover:translate-y-0 " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Secondary action — premium raised neutral. */
export const nextdoorSecondaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-slate-300 bg-gradient-to-b from-white to-slate-100 font-semibold text-slate-800 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_2px_6px_-2px_rgba(15,40,90,0.12),0_8px_20px_-12px_rgba(15,40,90,0.28)] " +
  "transition-[transform,box-shadow,border-color,color] duration-200 ease-out " +
  "hover:-translate-y-0.5 hover:border-[#06b6d4]/45 hover:text-slate-900 " +
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_3px_8px_-2px_rgba(15,40,90,0.14),0_14px_30px_-14px_rgba(8,47,73,0.3)] " +
  "active:translate-y-px " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-offset-2 focus-visible:ring-offset-white " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Disabled / local-only action — visibly inactive but still premium. */
export const nextdoorDisabledCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-200/70 font-semibold text-slate-500 " +
  "shadow-[inset_0_1px_2px_rgba(15,40,90,0.08)] cursor-not-allowed";

/** Mono section eyebrow label. */
export const nextdoorEyebrowClass =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0e7490]";

/** Dark navy proof module shell — leverage / workflow sections. */
export const nextdoorProofSectionClass =
  "overflow-hidden rounded-2xl border border-[#06b6d4]/25 bg-gradient-to-br from-slate-950 via-slate-900 to-[#0b2436] " +
  "shadow-[0_28px_70px_-30px_rgba(8,47,73,0.55),0_0_40px_-12px_rgba(6,182,212,0.25)]";

/** Eyebrow on dark proof sections. */
export const nextdoorProofEyebrowClass =
  "font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#5fd6ec]";

/** Risk-pressure tile — orange/red forensic accent. */
export const nextdoorRiskTileClass =
  "rounded-xl border border-amber-500/25 bg-gradient-to-b from-amber-50/90 to-white p-5 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_8px_24px_-12px_rgba(245,158,11,0.35)] " +
  "transition-[transform,box-shadow,border-color] duration-300 ease-out " +
  "hover:-translate-y-0.5 hover:border-red-400/50 hover:shadow-[0_16px_40px_-12px_rgba(239,68,68,0.22)] " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

/** Leverage/clarity tile — navy-cyan accent on light surface. */
export const nextdoorLeverageTileClass =
  "rounded-xl border border-[#06b6d4]/30 bg-gradient-to-b from-slate-50 to-white p-5 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_8px_24px_-12px_rgba(6,182,212,0.25)] " +
  "transition-[transform,box-shadow,border-color] duration-300 ease-out " +
  "hover:-translate-y-0.5 hover:border-[#06b6d4]/55 hover:shadow-[0_16px_40px_-12px_rgba(6,182,212,0.35)] " +
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0";

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function scrollToElementAfterDelay(
  element: HTMLElement | null | undefined,
  delayMs = 300,
): void {
  if (!element) return;

  window.setTimeout(() => {
    element.scrollIntoView({
      behavior: prefersReducedMotion() ? "auto" : "smooth",
      block: "start",
    });
  }, delayMs);
}

export const SAMPLE_PREVIEW_ROWS = [
  {
    id: "scope",
    label: "Scope review",
    detail:
      "Scope controls what work is actually included — removals, disposal, trim, stucco, repairs, and exclusions. Clear scope helps homeowners compare quotes fairly instead of incomplete promises.",
  },
  {
    id: "permit",
    label: "Permit language",
    detail:
      "Permit wording should clarify who pulls permits, who handles inspection issues, and whether fees are included. Vague permit language can create surprise responsibility after signing.",
  },
  {
    id: "warranty",
    label: "Warranty terms",
    detail:
      "Warranty language should separate product, labor, glass, seal, and installation coverage. Clear terms help you understand what is covered if something fails later.",
  },
  {
    id: "payment",
    label: "Payment timing",
    detail:
      "Deposit size, progress payments, and final-balance triggers matter. Payment timing can shift risk onto the homeowner if too much is due before work is complete.",
  },
] as const;

export const PROTECTION_LEDGER_ITEMS = [
  {
    id: "not-contractor",
    title: "WindowMan is not a contractor.",
    detail:
      "WindowMan helps review quote language and structure. It does not sell, install, or recommend itself as the contractor.",
  },
  {
    id: "no-savings",
    title: "No savings are guaranteed.",
    detail:
      "The tool highlights questions and quote clarity issues. It does not promise a lower price or guaranteed negotiation result.",
  },
  {
    id: "preview",
    title: "Preview comes after a real upload.",
    detail:
      "A useful preview comes after a real estimate is uploaded and processed. You can stop after the preview, or continue only if you want the full Truth Report.",
  },
  {
    id: "verification",
    title: "Full Truth Report is optional.",
    detail:
      "You can start with a preview. Verification only appears later if you choose to continue to the full Truth Report.",
  },
  {
    id: "scan-flow",
    title: "Quote files stay inside the protected scan flow.",
    detail:
      "Quote files remain part of the protected upload and scan path. This page does not create scan or report records without a real file.",
  },
] as const;
