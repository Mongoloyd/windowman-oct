import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchNextdoorReadiness,
  type NextdoorOverallStatus,
  type NextdoorReadinessState,
} from "@/services/nextdoorReadiness";

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "MMM d, yyyy HH:mm") : "—";
}

function overallStatusClasses(status: NextdoorOverallStatus) {
  const classes: Record<NextdoorOverallStatus, string> = {
    blocked: "border-rose-300 bg-rose-100 text-rose-950",
    pending_setup: "border-amber-300 bg-amber-100 text-amber-950",
    unknown: "border-slate-300 bg-slate-100 text-slate-950",
  };
  return classes[status];
}

function PresencePill({ label, present }: { label: string; present: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full border px-2 py-0.5 text-xs font-black",
        present
          ? "border-emerald-300 bg-emerald-100 text-emerald-950"
          : "border-slate-300 bg-white text-slate-700",
      )}
    >
      {label}: {present ? "yes" : "no"}
    </span>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase text-slate-700">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function ReadinessBody({ state }: { state: NextdoorReadinessState }) {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-black text-blue-950 shadow-sm">
        <ShieldCheck className="mr-2 inline h-4 w-4" />
        Read-only visibility. This panel does not enable dispatch.
      </section>

      {state.statsWarning ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {state.statsWarning}
        </section>
      ) : null}

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">Overall Status</h3>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              Blocked while runtime enablement env variables remain off or config is incomplete.
            </p>
          </div>
          <Badge className={cn("rounded-full border px-3 py-1 text-xs font-black uppercase", overallStatusClasses(state.overallStatus))}>
            {state.overallStatus.replace(/_/g, " ")}
          </Badge>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Runtime Enablement Variables</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <Badge className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-black uppercase",
            state.shouldSendNextdoorEnabled
              ? "border-emerald-300 bg-emerald-100 text-emerald-950"
              : "border-rose-300 bg-rose-100 text-rose-950",
          )}>
            VITE_NEXTDOOR_CAPI_ENABLED: {state.shouldSendNextdoorEnabled ? "Enabled" : "Disabled"}
          </Badge>
          <Badge className={cn(
            "rounded-full border px-2.5 py-1 text-xs font-black uppercase",
            state.canonicalLeadCapturedEnabled
              ? "border-emerald-300 bg-emerald-100 text-emerald-950"
              : "border-rose-300 bg-rose-100 text-rose-950",
          )}>
            CANONICAL_LEAD_CAPTURED_ENABLED: {state.canonicalLeadCapturedEnabled ? "Enabled" : "Disabled (edge env)"}
          </Badge>
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Default is off when env is unset. Public production cannot queue Nextdoor rows until gates and config are ready.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Migration / Typegen Gate</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <PresencePill label="generated types include nextdoor" present={state.generatedTypesIncludeNextdoor} />
          <Badge className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-950">
            db enum: {state.dbEnumGateStatus}
          </Badge>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Config Readiness</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <PresencePill label="platform configured" present={state.hasNextdoorConfig} />
          <PresencePill label="token present" present={state.tokenPresent} />
          <PresencePill label="dataset ID present" present={state.datasetIdPresent} />
          <PresencePill label="pixel ID present" present={state.pixelIdPresent} />
          <PresencePill label="data source ID present" present={state.dataSourceIdPresent} />
        </div>
        <p className="mt-3 text-sm font-semibold text-slate-700">
          Active configs: {state.activeNextdoorConfigCount} · Config status: {state.configReadinessStatus}
          {state.maskedDataSourceId ? ` · Masked data source: ${state.maskedDataSourceId}` : ""}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Dispatch Lane Stats</h3>
        <p className="mt-1 text-sm font-semibold text-slate-700">
          Stats available: {state.statsAvailable ? "yes" : "no"}
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <MetricCard label="pending" value={state.dispatchCounts.pending} />
          <MetricCard label="processing" value={state.dispatchCounts.processing} />
          <MetricCard label="sent" value={state.dispatchCounts.sent} />
          <MetricCard label="failed" value={state.dispatchCounts.failed} />
          <MetricCard label="failed w/ retry scheduled" value={state.dispatchCounts.failedWithRetryScheduled} />
          <MetricCard label="suppressed" value={state.dispatchCounts.suppressed} />
          <MetricCard label="dead letter" value={state.dispatchCounts.deadLetter} />
          <MetricCard label="blocked" value={state.dispatchCounts.blocked} />
          <MetricCard label="dispatched" value={state.dispatchCounts.dispatched} />
          <MetricCard label="total" value={state.dispatchCounts.total} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Top Suppression Reasons</h3>
        {state.topSuppressionReasons.length === 0 ? (
          <p className="mt-3 text-sm font-semibold text-slate-700">No suppression reason counts available.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {state.topSuppressionReasons.map((item) => (
              <Badge
                key={item.reason}
                className="border border-slate-300 bg-slate-100 font-mono text-xs font-black text-slate-950"
              >
                {item.reason}: {item.count}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <h3 className="text-sm font-black uppercase text-slate-800">Last Provider Status</h3>
        <div className="mt-3 space-y-1 text-sm font-semibold text-slate-800">
          <div>Status code: {state.lastProviderStatus?.providerStatus ?? "—"}</div>
          <div>Reason: {state.lastProviderStatus?.reason ?? "—"}</div>
          <div>Last attempt: {formatTime(state.lastAttemptAt)}</div>
        </div>
      </section>
    </div>
  );
}

export function NextdoorReadinessPanel() {
  const readinessQ = useQuery({
    queryKey: ["admin-nextdoor-readiness"],
    queryFn: fetchNextdoorReadiness,
    staleTime: 30_000,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Nextdoor Dispatch Readiness</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Read-only operator visibility for Nextdoor config, runtime enablement variables, and canonical dispatch lane status.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => readinessQ.refetch()}
          disabled={readinessQ.isFetching}
          className="gap-2 border-slate-400 bg-white text-slate-950"
        >
          <RefreshCw className={cn("h-4 w-4", readinessQ.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {readinessQ.isLoading ? (
        <section className="rounded-2xl border border-slate-300 bg-white p-5 text-sm font-black text-slate-700 shadow-sm">
          Loading Nextdoor readiness…
        </section>
      ) : null}

      {readinessQ.error ? (
        <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          Failed to load Nextdoor readiness. Showing no data.
        </section>
      ) : null}

      {readinessQ.data ? <ReadinessBody state={readinessQ.data} /> : null}
    </div>
  );
}
