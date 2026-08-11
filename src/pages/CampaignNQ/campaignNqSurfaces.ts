/**
 * CampaignNQ "Glass & Frame" surface tokens — scoped to /nq.
 *
 * Light-band surfaces consume the global skeuomorphic scale already defined in
 * src/index.css (--shadow-resting / --shadow-elevated / --shadow-sunken), which
 * models a single top-left light source. Dark-band equivalents are declared
 * here because index.css only ships light-surface shadows.
 *
 * Light model, applied without exception:
 *   raised   = 1px top inset highlight + tight contact shadow + wide ambient shadow
 *   recessed = inverted, with the highlight on the bottom edge
 */

/** Raised pane on a light band. Frame, glass gradient, top-left highlight. */
export const NQ_PANE_LIGHT =
  "rounded-[var(--radius-card)] border border-slate-300/90 bg-gradient-to-b from-white to-slate-50 shadow-[var(--shadow-resting)]";

/** Raised pane at hero elevation on a light band. */
export const NQ_PANE_LIGHT_ELEVATED =
  "rounded-[var(--radius-card)] border border-slate-300/90 bg-gradient-to-b from-white to-slate-50 shadow-[var(--shadow-elevated)]";

/** Recessed well on a light band — the "reveal" behind a frame. */
export const NQ_WELL_LIGHT =
  "rounded-[var(--radius-btn)] border border-slate-300/80 bg-gradient-to-b from-slate-100 to-slate-50 shadow-[var(--shadow-sunken)]";

/** Raised pane on the obsidian band. */
export const NQ_PANE_DARK =
  "rounded-[var(--radius-card)] border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(2,6,23,0.55),0_18px_44px_-12px_rgba(2,6,23,0.75)]";

/** Recessed well on the obsidian band. */
export const NQ_WELL_DARK =
  "rounded-[var(--radius-btn)] border border-white/5 bg-slate-950/60 shadow-[inset_0_2px_5px_rgba(2,6,23,0.7),inset_0_-1px_0_rgba(255,255,255,0.07)]";

/**
 * Primary CTA — a pressable physical object.
 * Hover lifts 1px and widens the ambient shadow; :active drops 1px and
 * collapses to the tight contact shadow only, so the press reads mechanical.
 * Text is slate-950 against every stop of the gradient (7:1 at the darkest
 * stop, 11.9:1 at the lightest), so contrast holds at the worst point.
 */
export const NQ_CTA_PRESSABLE = [
  "group relative inline-flex min-h-14 items-center justify-center gap-2",
  "rounded-[var(--radius-btn)] px-7 text-base font-extrabold text-slate-950",
  "border border-sky-700/50 border-t-sky-100/70",
  "bg-[linear-gradient(170deg,#7dd3fc_0%,#38bdf8_46%,#0ea5e9_100%)]",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.6),inset_0_-2px_4px_rgba(2,6,23,0.2),0_1px_2px_rgba(2,6,23,0.4),0_12px_30px_-8px_rgba(14,165,233,0.6)]",
  "transition-[transform,box-shadow] duration-150 ease-out",
  "hover:-translate-y-px hover:bg-[linear-gradient(170deg,#93ddff_0%,#4cc4fa_46%,#12b0f5_100%)]",
  "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_4px_rgba(2,6,23,0.18),0_2px_4px_rgba(2,6,23,0.4),0_20px_44px_-10px_rgba(14,165,233,0.7)]",
  "active:translate-y-px active:shadow-[inset_0_2px_7px_rgba(2,6,23,0.35),inset_0_1px_2px_rgba(2,6,23,0.25)]",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
].join(" ");

/** Secondary tactile control for light bands. */
export const NQ_CTA_SECONDARY_LIGHT = [
  "inline-flex min-h-11 items-center justify-center gap-2",
  "rounded-[var(--radius-btn)] px-4 text-sm font-bold text-slate-900",
  "border border-slate-300 border-t-white",
  "bg-gradient-to-b from-white to-slate-100",
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(10,25,55,0.1),0_6px_16px_-4px_rgba(10,25,55,0.16)]",
  "transition-[transform,box-shadow] duration-150 ease-out",
  "hover:-translate-y-px hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(10,25,55,0.1),0_12px_26px_-6px_rgba(10,25,55,0.2)]",
  "active:translate-y-px active:shadow-[inset_0_2px_6px_rgba(10,25,55,0.16)]",
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2",
  "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:translate-y-0",
].join(" ");

/**
 * Mullion grid. A pre-baked repeating gradient rather than a blur layer, so it
 * costs nothing to composite on low-end mobile. Masked so it fades out well
 * before it reaches headline text.
 */
export const NQ_MULLION_GRID_STYLE = {
  backgroundImage:
    "linear-gradient(to right, rgba(186,230,253,0.30) 1px, transparent 1px), linear-gradient(to bottom, rgba(186,230,253,0.30) 1px, transparent 1px)",
  backgroundSize: "96px 96px",
  backgroundPosition: "center top",
  // Weighted toward the right, away from the headline column, so the grid never
  // sits behind body text and cannot erode contrast.
  maskImage:
    "radial-gradient(95% 80% at 82% 6%, rgba(0,0,0,0.55) 0%, transparent 66%)",
  WebkitMaskImage:
    "radial-gradient(95% 80% at 82% 6%, rgba(0,0,0,0.55) 0%, transparent 66%)",
} as const;

/** Cobalt bloom behind the hero. Pre-baked radial gradient, no blur filter. */
export const NQ_COBALT_BLOOM_STYLE = {
  backgroundImage:
    "radial-gradient(70% 60% at 18% 8%, hsl(var(--color-cobalt) / 0.30) 0%, transparent 62%), radial-gradient(55% 50% at 88% 96%, hsl(var(--color-cobalt) / 0.16) 0%, transparent 60%)",
} as const;

/** Grounding contact shadow so the hero figure sits in the scene. */
export const NQ_FIGURE_CONTACT_SHADOW_STYLE = {
  backgroundImage:
    "radial-gradient(closest-side, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.34) 55%, transparent 100%)",
} as const;
