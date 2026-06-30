import { useState } from "react";
import { cn } from "@/lib/utils";
import type { EducationModuleId, QuoteAnatomyZoneId } from "./landingTypes";
import { landingFocusRing } from "./landingTypes";

type AnatomyZone = {
  id: QuoteAnatomyZoneId;
  label: string;
  moduleId: EducationModuleId;
};

const zones: AnatomyZone[] = [
  { id: "scope", label: "Scope", moduleId: "missing-scope" },
  { id: "product", label: "Product", moduleId: "product-details" },
  { id: "permit", label: "Permit", moduleId: "permit-inspection" },
  { id: "payment", label: "Payment", moduleId: "payment-terms" },
  { id: "warranty", label: "Warranty", moduleId: "warranty-clarity" },
  { id: "risk", label: "Risk Language", moduleId: "sales-pressure" },
];

type QuoteAnatomyDiagramProps = {
  activeModuleId?: EducationModuleId | null;
  onZoneFocus?: (moduleId: EducationModuleId) => void;
};

export default function QuoteAnatomyDiagram({
  activeModuleId,
  onZoneFocus,
}: QuoteAnatomyDiagramProps) {
  const [hoveredZone, setHoveredZone] = useState<QuoteAnatomyZoneId | null>(null);

  const highlightedModule =
    activeModuleId ??
    (hoveredZone ? zones.find((z) => z.id === hoveredZone)?.moduleId : null);

  return (
    <div className="card-raised p-5 md:p-6" aria-labelledby="quote-anatomy-heading">
      <p id="quote-anatomy-heading" className="wm-eyebrow mb-1 text-primary">
        Sample quote anatomy
      </p>
      <p className="mb-5 text-xs text-muted-foreground">
        Representative document layout — not your personal quote.
      </p>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div
          className="rounded-lg border-2 border-dashed border-border bg-background p-4 shadow-inner"
          role="img"
          aria-label="Sample quote document with highlighted educational zones"
        >
          <div className="mb-3 border-b border-border pb-2">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Impact Window Estimate
            </p>
            <p className="text-xs text-muted-foreground">Sample document · Generic contractor</p>
          </div>

          <div className="mb-4 space-y-1.5">
            <div className="h-2 w-full rounded bg-muted" />
            <div className="h-2 w-4/5 rounded bg-muted" />
            <div className="h-2 w-3/5 rounded bg-muted" />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {zones.map((zone) => {
              const isActive = highlightedModule === zone.moduleId;
              const isWide = zone.id === "risk";
              return (
                <button
                  key={zone.id}
                  type="button"
                  className={cn(
                    "rounded border px-2.5 py-3 text-left text-xs font-semibold leading-tight transition-colors sm:text-[11px]",
                    landingFocusRing,
                    isWide && "col-span-2 sm:col-span-3",
                    isActive
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-primary/5",
                  )}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                  onFocus={() => setHoveredZone(zone.id)}
                  onBlur={() => setHoveredZone(null)}
                  onClick={() => onZoneFocus?.(zone.moduleId)}
                  aria-pressed={isActive}
                  aria-label={`Sample quote zone: ${zone.label}`}
                >
                  {zone.label}
                </button>
              );
            })}
          </div>

          <p className="mt-4 text-center font-mono text-[10px] text-muted-foreground">
            Total shown — assumptions may differ
          </p>
        </div>

        <div className="flex flex-wrap gap-2 lg:hidden" aria-hidden="true">
          {zones.map((zone) => (
            <div
              key={zone.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-center text-xs font-medium transition-colors",
                highlightedModule === zone.moduleId
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border text-muted-foreground",
              )}
            >
              {zone.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
