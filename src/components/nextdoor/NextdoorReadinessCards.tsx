import {
  CalendarClock,
  Check,
  FileText,
  ListChecks,
  Search,
  type LucideIcon,
} from "lucide-react";
import type { QuoteReadiness } from "./types";

type ReadinessOption = {
  id: QuoteReadiness;
  title: string;
  body: string;
  bestFor: string;
  nextStep: string;
  icon: LucideIcon;
  accent: "blue" | "amber" | "slate";
};

const READINESS_OPTIONS: ReadinessOption[] = [
  {
    id: "has_estimate",
    title: "I already have an estimate",
    body: "Upload your estimate and see what is clear, vague, or worth questioning.",
    bestFor: "Best for: ready-to-check paperwork",
    nextStep: "Next: save your place → upload when ready",
    icon: FileText,
    accent: "amber",
  },
  {
    id: "getting_quotes_now",
    title: "I'm getting quotes now",
    body: "Get a quick comparison checklist before the next bid arrives.",
    bestFor: "Best for: comparing two or more bids",
    nextStep: "Next: know what to ask each contractor",
    icon: ListChecks,
    accent: "blue",
  },
  {
    id: "need_quote_soon",
    title: "I need a quote soon",
    body: "Prep the right questions before the sales visit.",
    bestFor: "Best for: pre-appointment planning",
    nextStep: "Next: build your quote-question list",
    icon: CalendarClock,
    accent: "blue",
  },
  {
    id: "researching",
    title: "I'm just researching",
    body: "Learn what a clean impact-window quote should include.",
    bestFor: "Best for: early-stage learning",
    nextStep: "Next: see the quote anatomy checklist",
    icon: Search,
    accent: "slate",
  },
];

const ACCENT_RING: Record<ReadinessOption["accent"], string> = {
  amber:
    "ring-amber-500/30 border-amber-500/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_46px_-14px_rgba(245,158,11,0.4),0_0_26px_-8px_rgba(245,158,11,0.35)]",
  blue: "ring-[#06b6d4]/35 border-[#06b6d4]/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_46px_-14px_rgba(6,182,212,0.4),0_0_26px_-8px_rgba(6,182,212,0.4)]",
  slate:
    "ring-slate-400/30 border-slate-500/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_16px_46px_-14px_rgba(15,23,42,0.22)]",
};

type Props = {
  selected: QuoteReadiness | null;
  onSelect: (value: QuoteReadiness) => void;
};

export function NextdoorReadinessCards({ selected, onSelect }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {READINESS_OPTIONS.map(({ id, title, body, bestFor, nextStep, icon: Icon, accent }) => {
        const isSelected = selected === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-pressed={isSelected}
            className={[
              "group relative min-h-[132px] w-full rounded-2xl border bg-gradient-to-b from-white to-slate-50/80 p-5 text-left",
              "transition-[transform,box-shadow,border-color] duration-200 ease-out will-change-transform",
              "shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_14px_-4px_rgba(15,40,90,0.12),0_16px_38px_-22px_rgba(8,47,73,0.3)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#06b6d4] focus-visible:ring-offset-2 focus-visible:ring-offset-white",
              "active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
              isSelected
                ? `-translate-y-0.5 border-2 ring-2 ${ACCENT_RING[accent]}`
                : "border-slate-200/80 hover:-translate-y-0.5 hover:border-[#06b6d4]/35 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_28px_-10px_rgba(8,47,73,0.32),0_0_22px_-10px_rgba(6,182,212,0.4)]",
            ].join(" ")}
          >
            <div className="flex items-start gap-3">
              <span
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border",
                  isSelected ? "border-primary/30 bg-primary/10 text-primary" : "border-border/70 bg-muted/40 text-muted-foreground group-hover:text-primary",
                ].join(" ")}
                aria-hidden="true"
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold leading-snug text-slate-900 md:text-lg">
                  {title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{body}</p>
                <p className="mt-3 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-primary/90">
                  {bestFor}
                </p>
                <p className="mt-1 text-xs font-medium text-slate-500">{nextStep}</p>
              </div>
              {isSelected ? (
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm"
                  aria-hidden="true"
                >
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
