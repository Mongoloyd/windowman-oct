import { useMemo, useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, Clock, Loader2, Play, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatDryRunError,
  runRevenueSignalDryRun,
  type RevenueSignalDryRunReport,
} from "@/services/revenueSignalDryRunAudit";
import { DryRunCandidateSamples } from "@/components/admin/revenue-dry-run/DryRunCandidateSamples";
import { DryRunClientBreakdown } from "@/components/admin/revenue-dry-run/DryRunClientBreakdown";
import { DryRunKeyBasisBreakdown, getDryRunBasisStrength } from "@/components/admin/revenue-dry-run/DryRunKeyBasisBreakdown";
import { DryRunKpiStrip } from "@/components/admin/revenue-dry-run/DryRunKpiStrip";
import { DryRunReasonBreakdown, getDryRunReasonSeverity, hasUnmappedReasons } from "@/components/admin/revenue-dry-run/DryRunReasonBreakdown";
import { DryRunSafetyPanel } from "@/components/admin/revenue-dry-run/DryRunSafetyPanel";

const LIMIT_OPTIONS = [50, 100, 250, 500] as const;
type LimitOption = (typeof LIMIT_OPTIONS)[number];
type DryRunUiState = "idle" | "loading" | "success" | "empty" | "warning" | "critical" | "error";

function getDryRunUiState(report: RevenueSignalDryRunReport | null, loading: boolean, error: string | null): DryRunUiState {
  if (loading) return "loading";
  if (error) return "error";
  if (!report) return "idle";
  if (report.externalDispatch !== false || report.dispatchCreated !== false) return "critical";
  if (report.candidateCount === 0) return "empty";

  const hasCriticalReason = Object.entries(report.byReasonCode).some(
    ([code, count]) => count > 0 && getDryRunReasonSeverity(code) === "critical",
  );
  const hasBlockedWeakBasis = Object.entries(report.byKeyBasis).some(
    ([basis, row]) => row.candidateCount > 0 && getDryRunBasisStrength(basis) === "blocked_weak",
  );

  if (hasCriticalReason || hasBlockedWeakBasis) return "critical";
  if (
    report.wouldInsert > 0 ||
    report.blocked > 0 ||
    report.weakLifecycleKey > 0 ||
    report.duplicateProtected > 0 ||
    hasUnmappedReasons(report.byReasonCode)
  ) {
    return "warning";
  }
  return "success";
}

function StateBanner({ state }: { state: DryRunUiState }) {
  const copy: Record<DryRunUiState, { title: string; body: string; className: string; icon: typeof CheckCircle2 }> = {
    idle: {
      title: "Ready for dry-run audit",
      body: "Choose a limit and run the service-backed audit. No live sync path is exposed here.",
      className: "border-slate-300 bg-white text-slate-950",
      icon: Clock,
    },
    loading: {
      title: "Dry-run audit running",
      body: "Evaluating eligible revenue signal candidates through the safe service wrapper.",
      className: "border-blue-300 bg-blue-50 text-blue-950",
      icon: Loader2,
    },
    success: {
      title: "Dry-run audit healthy",
      body: "Candidates were evaluated without blockers, duplicates, weak keys, or unsafe dispatch flags.",
      className: "border-emerald-300 bg-emerald-50 text-emerald-950",
      icon: CheckCircle2,
    },
    empty: {
      title: "No revenue signal candidates were found",
      body: "This may be expected if no contractor outcomes have been marked sold.",
      className: "border-slate-300 bg-slate-50 text-slate-950",
      icon: Clock,
    },
    warning: {
      title: "Dry-run audit needs operator attention",
      body: "Valid candidates or non-critical blockers exist. No insertion happened because this is dry-run.",
      className: "border-amber-300 bg-amber-50 text-amber-950",
      icon: AlertTriangle,
    },
    critical: {
      title: "Dry-run audit found critical blockers",
      body: "Resolve critical lifecycle, tenant, value, integrity, or safety blockers before materialization.",
      className: "border-rose-300 bg-rose-50 text-rose-950",
      icon: ShieldAlert,
    },
    error: {
      title: "Dry-run audit failed safely",
      body: "No external dispatch was attempted.",
      className: "border-rose-300 bg-rose-50 text-rose-950",
      icon: ShieldAlert,
    },
  };
  const item = copy[state];
  const Icon = item.icon;

  return (
    <div className={cn("flex items-start gap-3 rounded-2xl border p-4 shadow-sm", item.className)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", state === "loading" && "animate-spin")} />
      <div>
        <div className="font-black">{item.title}</div>
        <div className="mt-1 text-sm font-semibold text-current/75">{item.body}</div>
      </div>
    </div>
  );
}

function MetaPanel({ report }: { report: RevenueSignalDryRunReport | null }) {
  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="text-xs font-black uppercase text-slate-700">Run ID</div>
        <div className="mt-2 break-all font-mono text-sm font-black text-slate-950">{report?.runId ?? "—"}</div>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="text-xs font-black uppercase text-slate-700">Operator ID</div>
        <div className="mt-2 break-all font-mono text-sm font-black text-slate-950">{report?.operatorId ?? "Not returned"}</div>
      </div>
      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="text-xs font-black uppercase text-slate-700">Timestamp</div>
        <div className="mt-2 text-sm font-black text-slate-950">{report?.startedAt ? format(new Date(report.startedAt), "MMM d, yyyy h:mm:ss a") : "—"}</div>
      </div>
    </div>
  );
}

export function RevenueSignalDryRunAudit() {
  const [limit, setLimit] = useState<LimitOption>(100);
  const [report, setReport] = useState<RevenueSignalDryRunReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const state = useMemo(() => getDryRunUiState(report, isLoading, error), [error, isLoading, report]);

  async function handleRunDryRun() {
    setIsLoading(true);
    setError(null);
    try {
      const nextReport = await runRevenueSignalDryRun({ limit });
      setReport(nextReport);
    } catch (err) {
      setError(formatDryRunError(err));
      setReport(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Revenue Signal Dry-Run Audit</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Inspect what internal revenue signal sync would do before anything is inserted, dispatched, or externally sent.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value) as LimitOption)} disabled={isLoading}>
            <SelectTrigger className="h-11 w-[132px] border-slate-300 bg-white font-black text-slate-950">
              <SelectValue placeholder="Limit" />
            </SelectTrigger>
            <SelectContent>
              {LIMIT_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleRunDryRun} disabled={isLoading} className="h-11 gap-2 bg-slate-950 font-black text-white hover:bg-slate-800">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run Dry-Run
          </Button>
        </div>
      </div>

      <StateBanner state={state} />
      {error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">{error}</div> : null}

      <DryRunSafetyPanel report={report} />
      <MetaPanel report={report} />

      {report ? (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge className="border border-slate-300 bg-white text-slate-950">state: {state}</Badge>
            <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-950">externalDispatch: false</Badge>
            <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-950">dispatchCreated: false</Badge>
          </div>
          <DryRunKpiStrip report={report} />
          <DryRunClientBreakdown rows={report.byClientSlug} />
          <DryRunReasonBreakdown rows={report.byReasonCode} />
          <DryRunKeyBasisBreakdown rows={report.byKeyBasis} />
          <DryRunCandidateSamples sampleCandidateIds={report.sampleCandidateIds} />
        </>
      ) : (
        <div className="rounded-2xl border border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="text-xl font-black text-slate-950">No dry-run report loaded</div>
          <div className="mt-2 text-sm font-semibold text-slate-700">Run a dry-run audit to populate KPIs, breakdown tables, sample masked IDs, and no-dispatch proof.</div>
        </div>
      )}
    </div>
  );
}
