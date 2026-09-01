import type { ReactNode } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Database,
  EyeOff,
  Info,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MetricId } from "@/types/metrics.dictionary";
import { formatDateRange } from "../format";
import type {
  EvidenceSummary,
  InsightMetric,
  InsightModule,
  IntelligenceViewState,
} from "../types";
import { OracleStatusRail, ORACLE_VISUAL_TOKENS } from "./OracleVisualSystem";

const metricTone = {
  BLUE: "border-blue-200 bg-blue-50/70 text-blue-950",
  ORANGE: "border-orange-200 bg-orange-50/70 text-orange-950",
  EMERALD: "border-emerald-200 bg-emerald-50/70 text-emerald-950",
  SLATE: "border-slate-200 bg-slate-50 text-slate-950",
} as const;

export function UnverifiedMetricChip({
  metricId,
  detail = "This metric is withheld until its contract and evidence are sufficient.",
}: {
  metricId: MetricId;
  detail?: string;
}) {
  return (
    <span
      role="status"
      title={`${metricId}: ${detail}`}
      className="inline-flex min-h-8 items-center rounded-md border border-slate-300 bg-slate-100 px-2.5 text-[11px] font-black uppercase tracking-[0.06em] text-slate-950"
    >
      Unverified metric
    </span>
  );
}

export function SyntheticPreviewBanner({ compact = false }: { compact?: boolean }) {
  return (
    <OracleStatusRail
      compact={compact}
      tone="legacy"
      icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
      title="Synthetic Preview"
      detail={compact ? undefined : "No live market or customer data"}
    />
  );
}

export function StatePanel({ state, audience }: { state: Exclude<IntelligenceViewState, "SUCCESS">; audience: "INTERNAL" | "PUBLIC" }) {
  const configs = {
    LOADING: {
      icon: <LoaderCircle className="h-7 w-7 animate-spin" aria-hidden="true" />,
      title: "Preparing the synthetic intelligence view",
      detail: "The future aggregate adapter can reuse this state while a governed cohort is loading.",
      tone: "border-blue-200 bg-blue-50 text-blue-950",
    },
    ERROR: {
      icon: <AlertTriangle className="h-7 w-7" aria-hidden="true" />,
      title: "Intelligence is temporarily unavailable",
      detail: audience === "PUBLIC" ? "The estimate scanner remains available. Market intelligence cannot interrupt it." : "The operator console failed safely. Existing scan and report workflows are unaffected.",
      tone: "border-rose-200 bg-rose-50 text-rose-950",
    },
    INSUFFICIENT_DATA: {
      icon: <Database className="h-7 w-7" aria-hidden="true" />,
      title: "Insufficient evidence for this view",
      detail: "WindowMan withholds a conclusion when the governed cohort is too thin.",
      tone: "border-amber-200 bg-amber-50 text-amber-950",
    },
    SUPPRESSED: {
      icon: <EyeOff className="h-7 w-7" aria-hidden="true" />,
      title: "Distribution withheld",
      detail: "The complete result is suppressed because releasing segments could reveal a small cohort.",
      tone: "border-slate-300 bg-slate-100 text-slate-950",
    },
  } as const;
  const config = configs[state];

  return (
    <section className={cn("mx-auto flex min-h-[360px] max-w-3xl flex-col items-center justify-center border p-8 text-center", ORACLE_VISUAL_TOKENS.panel, config.tone)}>
      {config.icon}
      <h2 className="mt-4 text-2xl font-black tracking-tight">{config.title}</h2>
      <p className="mt-2 max-w-xl text-sm font-medium leading-6 opacity-80">{config.detail}</p>
      {state === "ERROR" ? (
        <button type="button" className={cn("mt-6 min-h-11 rounded-lg border border-current bg-white px-5 text-sm font-bold shadow-sm", ORACLE_VISUAL_TOKENS.focusRing)}>
          Try again
        </button>
      ) : null}
    </section>
  );
}

export function EvidenceStrip({ evidence, className }: { evidence: EvidenceSummary; className?: string }) {
  const items = [
    ["Governed estimates", evidence.governedQuoteCount.toLocaleString("en-US")],
    ["Verified accepted", evidence.verifiedAcceptedCount.toLocaleString("en-US")],
    ["Verified final", evidence.verifiedFinalCount.toLocaleString("en-US")],
    ["Outcome coverage", `${evidence.outcomeCoveragePct}%`],
  ];

  return (
    <section className={cn("overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-slate-50 shadow-sm", className)} aria-label="Evidence and provenance">
      <div className="grid gap-0 lg:grid-cols-[1.4fr_repeat(4,0.72fr)]">
        <div className="flex items-start gap-3 border-b border-blue-100 p-4 lg:border-b-0 lg:border-r">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" aria-hidden="true" />
          <div>
            <h2 className="text-sm font-black text-slate-950">Evidence &amp; provenance</h2>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-600">
              {evidence.cohortLabel} · {formatDateRange(evidence.dateFrom, evidence.dateTo)}
            </p>
            <p className="text-xs font-semibold text-blue-800">{evidence.geographyLabel}</p>
          </div>
        </div>
        {items.map(([label, value]) => (
          <div key={label} className="border-b border-slate-200 px-4 py-3 last:border-0 sm:border-r lg:border-b-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</div>
            <div className="mt-1 font-mono text-xl font-black tabular-nums text-slate-950">{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SectionHeading({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-2xl font-black tracking-[-0.025em] text-[#0B1830]">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function MetricTile({ metric }: { metric: InsightMetric }) {
  return (
    <div className={cn("rounded-xl border p-3 shadow-sm", metricTone[metric.tone])}>
      <p className="text-[11px] font-black uppercase tracking-[0.08em] opacity-70">{metric.label}</p>
      <p className="mt-1 font-mono text-xl font-black tabular-nums">{metric.value}</p>
      <p className="mt-1 text-xs font-semibold opacity-70">{metric.detail}</p>
    </div>
  );
}

export function InsightCard({ module, compact = false }: { module: InsightModule; compact?: boolean }) {
  return (
    <article className={cn("group flex h-full flex-col border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06),0_12px_32px_rgba(15,23,42,0.05)]", compact ? "rounded-xl p-4" : "rounded-2xl p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] font-black uppercase tracking-[0.08em] text-blue-700">{module.maturity}</span>
            <span className="text-[11px] font-bold text-slate-400">·</span>
            <span className="text-[11px] font-bold text-slate-500">n={module.sampleSize}</span>
          </div>
          <h3 className="mt-2 text-base font-black leading-5 text-slate-950">{module.title}</h3>
        </div>
        <span className="shrink-0 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-blue-800">
          Synthetic
        </span>
      </div>
      <p className="mt-2 text-sm font-medium leading-5 text-slate-600">{module.question}</p>
      <div className={cn("mt-4 grid gap-2", module.metrics.length > 1 ? "sm:grid-cols-2" : "grid-cols-1")}>
        {module.metrics.map((metric) => <MetricTile key={metric.label} metric={metric} />)}
      </div>
      <p className="mt-4 text-sm font-bold leading-5 text-slate-800">{module.interpretation}</p>
      <div className="mt-auto pt-4">
        <div className="flex items-start gap-2 border-t border-slate-100 pt-3 text-xs font-medium leading-5 text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{module.notClaimed}</span>
        </div>
      </div>
    </article>
  );
}

export function ProgressDatum({ label, value, tone = "blue" }: { label: string; value: number; tone?: "blue" | "orange" | "emerald" }) {
  const bar = tone === "orange" ? "bg-[#C27040]" : tone === "emerald" ? "bg-emerald-600" : "bg-[#356AC3]";
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-4 text-xs font-bold text-slate-700">
        <span>{label}</span><span className="font-mono tabular-nums">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={cn("h-full rounded-full", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
    </div>
  );
}

export function ProofPrinciple({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex items-start gap-3 px-4 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700">{icon}</div>
      <div><h3 className="text-sm font-black text-slate-950">{title}</h3><p className="mt-1 text-xs font-medium leading-5 text-slate-600">{detail}</p></div>
    </div>
  );
}

export function SafeLinkLabel({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 text-sm font-black text-blue-700">{children}<ArrowRight className="h-4 w-4" aria-hidden="true" /></span>;
}

export function PrincipleIcon({ kind }: { kind: "evidence" | "separate" | "sample" | "withheld" }) {
  if (kind === "evidence") return <ShieldCheck className="h-5 w-5" aria-hidden="true" />;
  if (kind === "separate") return <Database className="h-5 w-5" aria-hidden="true" />;
  if (kind === "sample") return <CheckCircle2 className="h-5 w-5" aria-hidden="true" />;
  return <EyeOff className="h-5 w-5" aria-hidden="true" />;
}
