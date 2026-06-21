import { NextdoorHeroGradeCard } from "./NextdoorHeroGradeCard";

const MASCOT_URL =
  "https://d2xsxph8kpxj0f.cloudfront.net/87108037/YjBTWCdi7jZwa5GFcxbLnp/windowmanwithtruthreportonthephone_be309c26.avif";

type Props = {
  subtitle: string;
  /** When true, mascot loads eagerly (desktop right column). */
  priority?: boolean;
};

/**
 * Presentational mascot + grade-card stack for /nextdoor intake hero.
 * No upload, scan, report, or backend wiring.
 */
export function NextdoorHeroMascotStack({ subtitle, priority = false }: Props) {
  return (
    <div className="mascot-float mx-auto flex w-full min-w-0 max-w-[340px] flex-col items-center sm:max-w-[400px] md:max-w-[420px]">
      <div className="relative z-10 flex aspect-[4/5] w-full max-h-[220px] justify-center sm:max-h-[280px] md:aspect-[3/4] md:max-h-none">
        <img
          src={MASCOT_URL}
          alt="WindowMan holding a Truth Report"
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={priority ? "high" : "auto"}
          width={480}
          height={640}
          className="absolute inset-0 h-full w-full object-contain object-bottom"
        />
      </div>

      <div className="relative z-20 -mt-6 w-full min-w-0 px-1 sm:-mt-8 md:-mt-10 md:px-0">
        <NextdoorHeroGradeCard subtitle={subtitle} />
      </div>
    </div>
  );
}
