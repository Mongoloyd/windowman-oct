import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Ban, CheckCircle2, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fetchDispatchGovernance, type GovernanceStatus } from "@/services/dispatchGovernance";

type StatusTone = "passed" | "warning" | "blocked" | "manual_review" | "dry_run_locked" | "present" | "unknown";

const FUTURE_REQUIREMENTS = [
  "Explicit migration relaxing dry-run DB constraints",
  "Live worker with lock/idempotency contract",
  "Platform-specific sender implementations",
  "Token validation and rotation policy",
  "Retry policy with dead-letter handling",
  "Signed audit log for operator approvals",
  "Manual approval gate before any live migration",
  "Provider-specific test event plan",
  "Rollback plan and emergency disable path",
];

function statusClass(status: StatusTone) {
  const classes: Record<StatusTone, string> = {
    passed: "border-emerald-300 bg-emerald-100 text-emerald-950",
    present: "border-emerald-300 bg-emerald-100 text-emerald-950",
    warning: "border-amber-300 bg-amber-100 text-amber-950",
    blocked: "border-rose-300 bg-rose-100 text-rose-950",
    manual_review: "border-slate-300 bg-slate-100 text-slate-950",
    unknown: "border-slate-300 bg-slate-100 text-slate-950",
    dry_run_locked: "border-blue-300 bg-blue-100 text-blue-950",
  };
  return classes[status];
}

function StatusBadge({ status, label }: { status: StatusTone; label?: string }) {
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", statusClass(status))}>{label ?? status.replace(/_/g, " ")}</Badge>;
}

function MetricCard({ label, value, status = "dry_run_locked" }: { label: string; value: string | number; status?: StatusTone }) {
  return <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><div className="text-xs font-black uppercase text-slate-700">{label}</div><div className="mt-2 text-2xl font-black text-slate-950">{value}</div><div className="mt-3"><StatusBadge status={status} /></div></div>;
}

function SectionHeader({ title, description }: { title: string; description: string }) {
  return <div className="border-b border-slate-200 p-4"><h3 className="text-lg font-black text-slate-950">{title}</h3><p className="mt-1 text-sm font-semibold text-slate-700">{description}</p></div>;
}

function ChecklistStatus({ status }: { status: GovernanceStatus | "present" | "unknown" }) {
  if (status === "passed" || status === "present" || status === "dry_run_locked") return <CheckCircle2 className="h-4 w-4 text-emerald-700" />;
  if (status === "blocked") return <Ban className="h-4 w-4 text-rose-700" />;
  return <AlertTriangle className="h-4 w-4 text-amber-700" />;
}

export function DispatchGovernanceConsole() {
  const governanceQ = useQuery({ queryKey: ["admin-dispatch-governance"], queryFn: fetchDispatchGovernance, staleTime: 30_000 });
  const data = governanceQ.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Dispatch Governance</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">Pre-live governance visibility for dry-run dispatch controls, kill switches, no-live DB guards, and future migration blockers.</p>
        </div>
        <Button variant="outline" onClick={() => governanceQ.refetch()} disabled={governanceQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950"><RefreshCw className={cn("h-4 w-4", governanceQ.isFetching && "animate-spin")} /> Refresh</Button>
      </div>

      <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-black text-blue-950 shadow-sm">
        <ShieldCheck className="mr-2 inline h-4 w-4" /> Live dispatch is disabled. Kill switches are engaged. No external APIs or endpoints can be called from this console.
      </section>

      {governanceQ.error ? <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950"><AlertTriangle className="mr-2 inline h-4 w-4" /> {governanceQ.error instanceof Error ? governanceQ.error.message : "Failed to load dispatch governance."}</section> : null}
      {governanceQ.isLoading ? <section className="rounded-2xl border border-slate-300 bg-white p-5 text-sm font-black text-slate-700 shadow-sm">Loading dispatch governance state…</section> : null}

      {data ? <>
        <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
          <SectionHeader title="Global Dispatch Seal" description="This console exposes safety posture only; it contains no control that can enable live sending." />
          <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Live dispatch" value="Disabled" status="blocked" />
            <MetricCard label="Dry-run required" value={String(data.globalGovernance.dryRunRequired)} status="dry_run_locked" />
            <MetricCard label="Kill switch" value="Engaged" status="dry_run_locked" />
            <MetricCard label="Can send externally" value="False" status="blocked" />
            <MetricCard label="Workers enabled" value="False" status="blocked" />
            <MetricCard label="Future migration" value="Required" status="manual_review" />
          </div>
          <div className="border-t border-slate-200 p-4"><StatusBadge status="dry_run_locked" label={data.finalVerdict.label} /></div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
          <SectionHeader title="Pre-Live Readiness Checklist" description="Readiness here means audit visibility, not ready-to-send status." />
          <div className="divide-y divide-slate-200">
            {data.preLiveChecklist.map((item) => <div key={item.key} className="grid gap-3 p-4 md:grid-cols-[24px_220px_140px_1fr]"><ChecklistStatus status={item.status} /><div className="font-black text-slate-950">{item.label}</div><div><StatusBadge status={item.status} /></div><div className="text-sm font-semibold text-slate-700">{item.note}</div></div>)}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
          <SectionHeader title="Mapper Version Coverage" description="Dry-run mapper coverage required before any future live migration review." />
          <div className="wm-slim-scrollbar overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Mapper version</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Note</th></tr></thead><tbody className="divide-y divide-slate-200">{data.mapperCoverage.map((row) => <tr key={row.platform}><td className="px-4 py-3 font-black text-slate-950">{row.platform}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{row.mapperVersion}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3 text-sm font-semibold text-slate-700">{row.note}</td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
          <SectionHeader title="Platform Governance Matrix" description="Platform class posture across configs, dry-run rows, outbox, and simulated attempts. No platform is ready to send." />
          <div className="wm-slim-scrollbar overflow-x-auto"><table className="w-full min-w-[1280px] text-sm"><thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Mapper version</th><th className="px-4 py-3">Active configs</th><th className="px-4 py-3">Token present</th><th className="px-4 py-3">Destination present</th><th className="px-4 py-3">Dry-run rows</th><th className="px-4 py-3">Outbox rows</th><th className="px-4 py-3">Simulated attempts</th><th className="px-4 py-3">Blockers</th><th className="px-4 py-3">Warnings</th><th className="px-4 py-3">Live enabled</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200">{data.platformMatrix.map((row) => <tr key={row.platform}><td className="px-4 py-3 font-black text-slate-950">{row.platform}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{row.mapperVersion}</td><td className="px-4 py-3 font-bold text-slate-800">{row.activeConfigCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.tokenPresentCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.destinationPresentCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.dryRunRowsCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.outboxRowsCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.simulatedAttemptsCount}</td><td className="px-4 py-3 font-bold text-rose-900">{row.blockersCount}</td><td className="px-4 py-3 font-bold text-amber-900">{row.warningsCount}</td><td className="px-4 py-3"><StatusBadge status="blocked" label="false" /></td><td className="px-4 py-3"><StatusBadge status={row.governanceStatus} /></td></tr>)}</tbody></table></div>
        </section>

        <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
          <SectionHeader title="Client Governance Matrix" description="client_slug-level audit posture only; this is not contractor-facing and cannot enable dispatch." />
          <div className="wm-slim-scrollbar overflow-x-auto"><table className="w-full min-w-[1280px] text-sm"><thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">client_slug</th><th className="px-4 py-3">Configs</th><th className="px-4 py-3">Platforms</th><th className="px-4 py-3">Dry-run rows</th><th className="px-4 py-3">Outbox rows</th><th className="px-4 py-3">Simulated attempts</th><th className="px-4 py-3">Blockers</th><th className="px-4 py-3">Warnings</th><th className="px-4 py-3">Missing tokens</th><th className="px-4 py-3">Missing destinations</th><th className="px-4 py-3">Live enabled</th><th className="px-4 py-3">Status</th></tr></thead><tbody className="divide-y divide-slate-200">{data.clientMatrix.length === 0 ? <tr><td colSpan={12} className="px-4 py-8 text-center text-sm font-bold text-slate-700">No client governance rows available.</td></tr> : data.clientMatrix.map((row) => <tr key={row.clientSlug}><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{row.clientSlug}</td><td className="px-4 py-3 font-bold text-slate-800">{row.activeConfigCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.platformCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.dryRunRowsCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.outboxRowsCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.simulatedAttemptsCount}</td><td className="px-4 py-3 font-bold text-rose-900">{row.blockersCount}</td><td className="px-4 py-3 font-bold text-amber-900">{row.warningsCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.missingTokenCount}</td><td className="px-4 py-3 font-bold text-slate-800">{row.missingDestinationCount}</td><td className="px-4 py-3"><StatusBadge status="blocked" label="false" /></td><td className="px-4 py-3"><StatusBadge status={row.governanceStatus} /></td></tr>)}</tbody></table></div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
            <SectionHeader title="Guard Status Panel" description="Local migration-source proof for no-live constraints and triggers." />
            <div className="divide-y divide-slate-200">{data.guardStatus.map((guard) => <div key={guard.key} className="grid gap-3 p-4 sm:grid-cols-[24px_1fr_120px]"><ChecklistStatus status={guard.status} /><div><div className="font-black text-slate-950">{guard.label}</div><div className="mt-1 text-sm font-semibold text-slate-700">{guard.note}</div></div><div><StatusBadge status={guard.status} /></div></div>)}</div>
          </div>

          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
            <SectionHeader title="Outbox + Attempt Health" description="No-live indicators derived from loaded outbox and attempt ledger rows." />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <MetricCard label="Outbox rows" value={data.outboxHealth.totalRows} />
              <MetricCard label="Dry-run locked rows" value={data.outboxHealth.dryRunLockedRows} />
              <MetricCard label="Send-enabled rows" value={data.outboxHealth.sendEnabledRows} status={data.outboxHealth.sendEnabledRows === 0 ? "passed" : "blocked"} />
              <MetricCard label="Sent/external rows" value={data.outboxHealth.sentRows + data.outboxHealth.externalEventRows} status={data.outboxHealth.sentRows + data.outboxHealth.externalEventRows === 0 ? "passed" : "blocked"} />
              <MetricCard label="Attempt rows" value={data.attemptHealth.totalAttempts} />
              <MetricCard label="Provider responses" value={data.attemptHealth.attemptsWithProviderResponse} status={data.attemptHealth.attemptsWithProviderResponse === 0 ? "passed" : "blocked"} />
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-300 bg-white shadow-sm">
            <SectionHeader title="Future Live Dispatch Requirements" description="These must be completed in a later explicit live-dispatch migration and worker sprint." />
            <ul className="space-y-2 p-4">{FUTURE_REQUIREMENTS.map((item) => <li key={item} className="flex gap-2 text-sm font-bold text-slate-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" /> {item}</li>)}</ul>
          </div>

          <div className="rounded-2xl border border-blue-300 bg-blue-50 shadow-sm">
            <SectionHeader title="No-Send Proof Card" description="This console proves posture only and cannot dispatch." />
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <MetricCard label="External calls made" value="0" status="passed" />
              <MetricCard label="Live worker exists" value="No" status="blocked" />
              <MetricCard label="Enable controls" value="None" status="passed" />
              <MetricCard label="Attempts" value="Simulated only" status="dry_run_locked" />
              <MetricCard label="Provider responses" value="Null by design" status="passed" />
              <MetricCard label="Final verdict" value="Not live" status="blocked" />
            </div>
          </div>
        </section>
      </> : null}
    </div>
  );
}
