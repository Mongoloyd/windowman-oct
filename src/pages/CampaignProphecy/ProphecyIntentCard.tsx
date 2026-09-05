import { useState } from "react";
import { cn } from "@/lib/utils";
import type { IntakeIntentChoice } from "@/components/intake/universal/intakeTypes";

/**
 * Optimized formats that exist on disk for a given card, best first.
 *
 * This is declared rather than assumed because `<picture>` commits to the first
 * `<source>` whose `type` the browser supports and does NOT fall back if that
 * file 404s — listing a format that has not been produced yet breaks the image
 * outright in every browser that supports it.
 */
export type ProphecyImageFormat = "avif" | "webp";

export interface ProphecyIntentOption {
  value: IntakeIntentChoice;
  /** Short state-of-play label. Two or three words. */
  eyebrow: string;
  /** The sentence the visitor identifies with, in their own voice. */
  title: string;
  /** What happens if they pick this. One sentence, concrete. */
  detail: string;
  /** Base path with no extension: `/images/prophecy/intent-has-quote`. */
  imageBase: string;
  /** Formats actually present alongside `<imageBase>.jpg`. Best first. */
  imageFormats?: readonly ProphecyImageFormat[];
  /** Describes the photograph, not the choice — the title already says that. */
  imageAlt: string;
}

const MIME_BY_FORMAT: Record<ProphecyImageFormat, string> = {
  avif: "image/avif",
  webp: "image/webp",
};

interface ProphecyIntentCardProps {
  option: ProphecyIntentOption;
  selected: boolean;
  onSelect: (value: IntakeIntentChoice) => void;
  /** Prioritize only cards visible in the initial hero viewport. */
  priority?: boolean;
}

const HIGH_FETCH_PRIORITY_ATTR = { fetchpriority: "high" } as Record<
  string,
  string
>;

/**
 * A full-bleed image card the visitor picks with their thumb.
 *
 * This is deliberately not `IntakeOptionCard` — that control is a text label
 * plus a switch, and the whole point here is that the two paths are chosen by
 * looking, not by reading a form.
 *
 * LIGHTING
 * Warm rim on hover means "not yet chosen, this is live"; the cool ring on
 * select means "locked in, resolved". Warm never appears on a committing
 * action, only on the ambient state of an unmade choice.
 *
 * ASSETS
 * `imageBase` resolves to `<base>.avif`, `.webp` and `.jpg`. If an advertised
 * asset fails, the layered gradient beneath the image remains as a deliberate
 * fallback rather than showing a broken-image icon.
 */
export default function ProphecyIntentCard({
  option,
  selected,
  onSelect,
  priority = false,
}: ProphecyIntentCardProps) {
  // A card whose art is missing must still look deliberate. On any load failure
  // the image is dropped and the gradient beneath becomes the design, rather
  // than leaving a broken-image glyph over the copy.
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <button
      type="button"
      aria-pressed={selected}
      data-intake-field="intent"
      data-intent-value={option.value}
      onClick={() => onSelect(option.value)}
      className={cn(
        "group relative flex w-full min-h-[13rem] overflow-hidden rounded-2xl border text-left",
        "aspect-[5/4] sm:aspect-[4/5]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/80 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a1628]",
        "motion-safe:transition-[transform,box-shadow,border-color] motion-safe:duration-200 motion-safe:ease-out",
        "active:translate-y-px active:scale-[0.995]",
        selected
          ? [
              "border-cyan-300/70",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_0_0_1px_rgba(103,232,249,0.45),0_26px_60px_-28px_rgba(34,211,238,0.55)]",
            ]
          : [
              "border-white/12",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-1px_0_rgba(0,0,0,0.55),0_22px_50px_-30px_rgba(0,0,0,0.85)]",
              "motion-safe:hover:-translate-y-1 hover:border-amber-200/40",
              "hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_0_0_1px_rgba(244,162,97,0.28),0_30px_70px_-30px_rgba(232,146,74,0.45)]",
            ],
      )}
    >
      {/* Depth floor. Also the graceful fallback if the photograph is absent. */}
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-0",
          option.value === "has_quote"
            ? "bg-[linear-gradient(160deg,#1d3552_0%,#132741_45%,#0a1628_100%)]"
            : "bg-[linear-gradient(160deg,#3a2a1c_0%,#24303f_45%,#0a1628_100%)]",
        )}
      />

      {!imageFailed && (
        <picture>
          {(option.imageFormats ?? []).map((format) => (
            <source
              key={format}
              srcSet={`${option.imageBase}.${format}`}
              type={MIME_BY_FORMAT[format]}
            />
          ))}
          <img
            src={`${option.imageBase}.jpg`}
            alt={option.imageAlt}
            width={896}
            height={1200}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            {...(priority ? HIGH_FETCH_PRIORITY_ATTR : {})}
            onError={() => setImageFailed(true)}
            className={cn(
              "absolute inset-0 h-full w-full object-cover",
              "motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-out",
              selected ? "scale-[1.02]" : "motion-safe:group-hover:scale-[1.03]",
            )}
          />
        </picture>
      )}

      {/* Scrim. Anchored to the bottom so the type stays legible over any art. */}
      <span
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-[#050b14] via-[#050b14]/78 via-45% to-transparent"
      />

      {/* Cool wash on the locked card, so the choice reads as resolved. */}
      {selected && (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(110%_80%_at_50%_100%,rgba(34,211,238,0.20),transparent_70%)]"
        />
      )}

      <span className="relative z-10 mt-auto flex w-full flex-col gap-2 p-5 sm:p-6">
        <span className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
              "motion-safe:transition-colors motion-safe:duration-150",
              selected
                ? "border-cyan-200/80 bg-cyan-300/90 text-[#062230] shadow-[0_0_14px_-2px_rgba(103,232,249,0.9)]"
                : "border-white/45 bg-white/5 text-transparent",
            )}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100/75">
            {option.eyebrow}
          </span>
        </span>

        <span className="text-[19px] font-bold leading-[1.2] text-white sm:text-[21px]">
          {option.title}
        </span>

        <span className="text-[13.5px] leading-relaxed text-slate-300/90">
          {option.detail}
        </span>
      </span>
    </button>
  );
}
