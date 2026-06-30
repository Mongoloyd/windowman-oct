import { cn } from "@/lib/utils";
import { landingContainerWide, landingSectionPad } from "./landingTypes";

const homeownerItems = [
  "A single total price that looks comparable to the next bid",
  "A brand name and a few product labels",
  "Pressure to decide before the next contractor visit",
];

const hiddenItems = [
  "Different product tiers, glass packages, and installation assumptions",
  "Permit, cleanup, disposal, and structural prep left unstated",
  "Warranty length, transfer rules, and what voids coverage",
  "Payment timing, change-order language, and exclusion clauses",
];

export default function MarketAsymmetrySection() {
  return (
    <section id="market-asymmetry" className={cn("bg-background", landingSectionPad)}>
      <div className={landingContainerWide}>
        <p className="wm-eyebrow mb-3 text-primary">The problem</p>
        <h2 className="wm-title-section mb-4 text-foreground">Window quotes are not apples-to-apples.</h2>
        <p className="mb-10 max-w-3xl text-base leading-relaxed text-muted-foreground">
          Two estimates can look similar on price while hiding completely different assumptions about
          product, labor, permits, warranty, cleanup, and payment timing. WindowMan does not assume every
          contractor is dishonest — unclear quotes create risk because homeowners cannot compare what was
          never spelled out.
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          <div className="card-raised border-l-4 border-l-muted-foreground/30 p-6 md:p-7">
            <h3 className="mb-4 font-display text-lg font-bold text-foreground">What homeowners see</h3>
            <ul className="space-y-3">
              {homeownerItems.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="card-raised border-l-4 border-l-primary/40 p-6 md:p-7">
            <h3 className="mb-4 font-display text-lg font-bold text-foreground">What quotes hide</h3>
            <ul className="space-y-3">
              {hiddenItems.map((item) => (
                <li key={item} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
