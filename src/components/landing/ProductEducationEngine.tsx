import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { EducationModule, EducationModuleId } from "./landingTypes";
import QuoteAnatomyDiagram from "./QuoteAnatomyDiagram";
import {
  handoffToCanonicalUpload,
  handoffToSampleReport,
} from "./landingHandoff";
import {
  landingContainerWide,
  landingCtaMinH,
  landingFocusRing,
  landingSectionPad,
} from "./landingTypes";

const REVEAL_EDUCATION_EVENT = "wm-landing-reveal-education";

const visibleModules: EducationModule[] = [
  {
    id: "price-not-quote",
    title: "Price Is Not the Quote",
    teachingLine:
      "If two quotes include different assumptions, you are not comparing price. You are comparing confusion.",
  },
  {
    id: "missing-scope",
    title: "Missing Scope",
    teachingLine: "Missing does not always mean dishonest. But missing always means unclear.",
  },
  {
    id: "product-details",
    title: "Product Details",
    teachingLine: "If the product is vague, the comparison is weak.",
  },
  {
    id: "payment-terms",
    title: "Payment Terms",
    teachingLine: "The price matters. The timing of the money matters too.",
  },
  {
    id: "warranty-clarity",
    title: "Warranty Clarity",
    teachingLine:
      "A warranty is only useful if you understand what it covers, who backs it, and how long it lasts.",
  },
];

const hiddenModules: EducationModule[] = [
  {
    id: "permit-inspection",
    title: "Permit and Inspection Language",
    teachingLine: "Who pulls permits and handles failed inspections should never be a guess.",
    body: "Look for explicit language on permit responsibility, inspection scheduling, and who pays for corrections if the job fails inspection. Vague permit lines often hide real project risk.",
    expandable: true,
  },
  {
    id: "quote-comparison",
    title: "Quote Comparison",
    teachingLine: "Compare assumptions line by line — not just the bottom-line total.",
    body: "Educational guidance only: align product tier, opening count, removal/disposal, trim, and payment triggers before you treat two totals as comparable. WindowMan does not run live multi-quote analysis on this page.",
    expandable: true,
  },
  {
    id: "sales-pressure",
    title: "Sales Pressure and Decision Timing",
    teachingLine: "Urgency is not a substitute for quote clarity.",
    body: "Limited-time discounts and same-day sign incentives can push homeowners past unanswered scope questions. A clearer quote is worth more than a faster signature.",
    expandable: true,
  },
];

type ProductEducationEngineProps = {
  expandedModules: string[];
  onToggleModule: (moduleId: string) => void;
};

export default function ProductEducationEngine({
  expandedModules,
  onToggleModule,
}: ProductEducationEngineProps) {
  const [showMoreChecks, setShowMoreChecks] = useState(false);
  const [focusedModuleId, setFocusedModuleId] = useState<EducationModuleId | null>(null);
  const [pendingFocusModuleId, setPendingFocusModuleId] = useState<EducationModuleId | null>(null);

  const handleZoneFocus = useCallback((moduleId: EducationModuleId) => {
    setFocusedModuleId(moduleId);
    const hidden = hiddenModules.find((m) => m.id === moduleId);
    if (hidden) {
      setShowMoreChecks(true);
    }
    document.getElementById(`education-module-${moduleId}`)?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
      block: "nearest",
    });
  }, []);

  useEffect(() => {
    const revealHidden = (event: Event) => {
      const moduleId = (event as CustomEvent<{ moduleId?: EducationModuleId }>).detail?.moduleId;
      setShowMoreChecks(true);
      if (moduleId) {
        setFocusedModuleId(moduleId);
        setPendingFocusModuleId(moduleId);
      }
    };
    window.addEventListener(REVEAL_EDUCATION_EVENT, revealHidden);
    return () => window.removeEventListener(REVEAL_EDUCATION_EVENT, revealHidden);
  }, []);

  useEffect(() => {
    if (!showMoreChecks || !pendingFocusModuleId) return;
    document.getElementById(`education-module-${pendingFocusModuleId}`)?.scrollIntoView({
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? "auto" : "smooth",
      block: "nearest",
    });
    setPendingFocusModuleId(null);
  }, [showMoreChecks, pendingFocusModuleId]);

  const renderModuleCard = (module: EducationModule) => {
    const isExpandable = module.expandable;
    const expanded = expandedModules.includes(module.id);
    const isFocused = focusedModuleId === module.id;

    if (isExpandable) {
      return (
        <div
          key={module.id}
          id={`education-module-${module.id}`}
          className={cn(
            "card-raised overflow-hidden transition-shadow",
            isFocused && "ring-2 ring-primary/40",
          )}
        >
          <button
            type="button"
            onClick={() => {
              setFocusedModuleId(module.id);
              onToggleModule(module.id);
            }}
            className={cn(
              "flex w-full min-h-[56px] items-start justify-between gap-3 p-4 text-left",
              landingFocusRing,
            )}
            aria-expanded={expanded}
          >
            <div>
              <h3 className="font-display text-base font-bold text-foreground">{module.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{module.teachingLine}</p>
            </div>
            <span className="shrink-0 pt-0.5 text-sm font-medium text-muted-foreground" aria-hidden="true">
              {expanded ? "−" : "+"}
            </span>
          </button>
          {expanded && module.body ? (
            <div className="border-t border-border px-4 pb-4">
              <p className="pt-3 text-sm leading-relaxed text-muted-foreground">{module.body}</p>
            </div>
          ) : null}
        </div>
      );
    }

    return (
      <div
        key={module.id}
        id={`education-module-${module.id}`}
        className={cn(
          "card-raised p-4 transition-shadow",
          isFocused && "ring-2 ring-primary/40",
        )}
      >
        <h3 className="font-display text-base font-bold text-foreground">{module.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{module.teachingLine}</p>
      </div>
    );
  };

  return (
    <section
      id="product-education"
      className={cn("border-t border-border bg-card", landingSectionPad)}
    >
      <div className={landingContainerWide}>
        <p className="wm-eyebrow mb-3 text-primary">WHAT MOST HOMEOWNERS MISS</p>
        <h2 className="wm-title-section mb-4 text-foreground">
          A window quote is not just a price. It is a stack of assumptions.
        </h2>
        <p className="mb-2 max-w-3xl text-sm italic leading-relaxed text-muted-foreground">
          Most homeowners do not make bad decisions because they are careless. They make hard
          decisions with incomplete information.
        </p>
        <p className="mb-10 max-w-3xl text-xs text-muted-foreground">
          Educational guidance only — not legal, engineering, permitting, or contractor licensing
          advice.
        </p>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          <QuoteAnatomyDiagram
            activeModuleId={focusedModuleId}
            onZoneFocus={handleZoneFocus}
          />

          <div className="space-y-3">
            {visibleModules.map((module) => renderModuleCard(module))}

            {showMoreChecks ? hiddenModules.map((module) => renderModuleCard(module)) : null}

            <button
              type="button"
              onClick={() => setShowMoreChecks((prev) => !prev)}
              className={cn(
                "w-full rounded-lg border border-dashed border-border py-3.5 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/5",
                landingCtaMinH,
                landingFocusRing,
              )}
              aria-expanded={showMoreChecks}
            >
              {showMoreChecks ? "Show fewer checks" : "View more checks"}
            </button>

            <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => handoffToSampleReport()}
                className={cn(
                  "btn-secondary-tactile w-full px-5 py-3 text-sm sm:w-auto",
                  landingCtaMinH,
                  landingFocusRing,
                )}
              >
                View a Sample Truth Report
              </button>
              <button
                type="button"
                onClick={() => handoffToCanonicalUpload()}
                className={cn(
                  "btn-depth-primary w-full px-6 py-3 text-sm sm:w-auto",
                  landingCtaMinH,
                  landingFocusRing,
                )}
              >
                Analyze My Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
