import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckSquare, Database, Eye, PlayCircle, RefreshCw, ShieldCheck, Square } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fetchDispatchOutboxControl,
  formatDispatchCurrency,
  maskDispatchId,
  runDispatchOutboxMaterialization,
  type DispatchEligibilityStatus,
  type DispatchMaterializationFilters,
  type DispatchMaterializationResult,
  type DispatchOutboxCandidate,
  type DispatchOutboxRow,
  type MaterializationMode,
} from "@/services/dispatchOutbox";

type DetailSelection = { kind: "candidate"; row: DispatchOutboxCandidate } | { kind: "outbox"; row: DispatchOutboxRow } | null;

const STATUS_OPTIONS = ["all", "eligible_not_sent", "warning_not_sent", "blocked", "duplicate_protected"] as const;

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "MMM d, yyyy HH:mm") : "—";
}

function reasonPreview(reasons: string[]) {
  if (reasons.length === 0) return "eligible";
  if (reasons.length <= 2) return reasons.join(", ");
  return `${reasons.slice(0, 2).join(", ")} +${reasons.length - 2}`;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><div className="text-xs font-black uppercase text-slate-700">{label}</div><div className="mt-2 text-3xl font-black text-slate-950">{value}</div></div>;
}

function StatusBadge({ status }: { status: DispatchEligibilityStatus | string }) {
  const classes: Record<string, string> = {
    eligible_not_sent: "border-emerald-300 bg-emerald-100 text-emerald-950",
    warning_not_sent: "border-amber-300 bg-amber-100 text-amber-950",
    blocked: "border-rose-300 bg-rose-100 text-rose-950",
    duplicate_protected: "border-blue-300 bg-blue-100 text-blue-950",
    skipped: "border-slate-300 bg-slate-100 text-slate-950",
    superseded: "border-slate-300 bg-slate-100 text-slate-950",
  };
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", classes[status] ?? classes.skipped)}>{status.replace(/_/g, " ")}</Badge>;
}

function PlatformBadge({ platform }: { platform: string | null }) {
  return <Badge className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-950">{platform ?? "no config"}</Badge>;
}

function SafetyPill({ label, safe }: { label: string; safe: boolean }) {
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", safe ? "border-blue-300 bg-blue-100 text-blue-950" : "border-rose-300 bg-rose-100 text-rose-950")}>{label}: {safe ? "safe" : "unsafe"}</span>;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-[440px] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-slate-100 shadow-inner"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}

function ResultSummary({ result }: { result: DispatchMaterializationResult }) {
  return (
    <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-black text-emerald-950">Materialization Result</h3><p className="text-sm font-semibold text-emerald-900">Preview only: {result.preview_only ? "yes" : "no"} · External APIs called: {result.external_apis_called ? "yes" : "no"} · Attempts written: {result.attempts_written ? "yes" : "no"}</p></div>
        <StatusBadge status={result.preview_only ? "skipped" : "eligible_not_sent"} />
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(result.summary).map(([key, value]) => <div key={key} className="rounded-xl border border-emerald-200 bg-white p-3"><div className="text-[11px] font-black uppercase text-emerald-900">{key.replace(/_/g, " ")}</div><div className="text-2xl font-black text-emerald-950">{value}</div></div>)}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div><div className="mb-2 text-xs font-black uppercase text-emerald-950">Created outbox row IDs</div><div className="flex flex-wrap gap-2">{result.created_outbox_row_ids_masked.length ? result.created_outbox_row_ids_masked.map((id) => <Badge key={id} className="border border-emerald-300 bg-white font-mono text-emerald-950">{id}</Badge>) : <span className="text-sm font-bold text-emerald-900">None</span>}</div></div>
        <div><div className="mb-2 text-xs font-black uppercase text-emerald-950">Reason-code breakdown</div><div className="flex flex-wrap gap-2">{Object.entries(result.reason_code_breakdown).map(([reason, count]) => <Badge key={reason} className="border border-emerald-300 bg-white font-mono text-emerald-950">{reason}: {count}</Badge>)}</div></div>
      </div>
    </section>
  );
}

export function DispatchOutboxControl() {
  const [selected, setSelected] = useState<DetailSelection>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_OPTIONS[number]>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [includeWarnings, setIncludeWarnings] = useState(false);
  const [result, setResult] = useState<DispatchMaterializationResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isActionRunning, setIsActionRunning] = useState(false);

  const outboxQ = useQuery({ queryKey: ["admin-dispatch-outbox-control"], queryFn: fetchDispatchOutboxControl, staleTime: 30_000 });

  const candidates = outboxQ.data?.candidates ?? [];
  const outboxRows = outboxQ.data?.outboxRows ?? [];
  const kpis = outboxQ.data?.kpis ?? { candidateRevenueEvents: 0, eligibleCandidates: 0, warningCandidates: 0, blockedCandidates: 0, duplicateProtectedCandidates: 0, existingOutboxRows: 0, activePlatformConfigs: 0, sendEnabledRows: 0 };

  const clientOptions = useMemo(() => Array.from(new Set(candidates.map((row) => row.clientSlug).filter(Boolean) as string[])).sort(), [candidates]);
  const platformOptions = useMemo(() => Array.from(new Set(candidates.map((row) => row.platformName).filter(Boolean) as string[])).sort(), [candidates]);
  const visibleCandidates = useMemo(() => candidates.filter((row) => {
    if (clientFilter !== "all" && row.clientSlug !== clientFilter) return false;
    if (platformFilter !== "all" && row.platformName !== platformFilter) return false;
    if (statusFilter !== "all" && row.eligibilityStatus !== statusFilter) return false;
    if (dateFrom && (!row.canonicalEventTimestamp || new Date(row.canonicalEventTimestamp) < new Date(dateFrom))) return false;
    if (dateTo && (!row.canonicalEventTimestamp || new Date(row.canonicalEventTimestamp) > new Date(dateTo))) return false;
    return true;
  }).slice(0, 250), [candidates, clientFilter, dateFrom, dateTo, platformFilter, statusFilter]);
  const visibleOutboxRows = useMemo(() => outboxRows.slice(0, 250), [outboxRows]);
  const allVisibleSelected = visibleCandidates.length > 0 && visibleCandidates.every((row) => selectedIds.has(row.candidateId));

  const detailTitle = selected?.kind === "candidate" ? "Eligibility Candidate" : selected?.kind === "outbox" ? "Existing Outbox Row" : "Dispatch Outbox";
  const selectedSnapshot = selected?.kind === "candidate" ? selected.row.decisionSnapshot : selected?.kind === "outbox" ? selected.row.decisionSnapshot : null;
  const selectedReasons = selected?.kind === "candidate" ? selected.row.eligibilityReasons : selected?.kind === "outbox" ? selected.row.eligibilityReasons : [];
  const selectedKey = selected?.kind === "candidate" ? selected.row.idempotencyKey : selected?.kind === "outbox" ? selected.row.idempotencyKey : null;
  const selectedFingerprint = selected?.kind === "candidate" ? selected.row.candidateFingerprint : selected?.kind === "outbox" ? selected.row.candidateFingerprint : null;

  function toggleSelected(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allVisibleSelected) visibleCandidates.forEach((row) => next.delete(row.candidateId));
      else visibleCandidates.forEach((row) => next.add(row.candidateId));
      return next;
    });
  }

  function filtersPayload(): DispatchMaterializationFilters {
    return {
      ...(clientFilter !== "all" ? { client_slug: clientFilter } : {}),
      ...(platformFilter !== "all" ? { platform_name: platformFilter } : {}),
      ...(statusFilter !== "all" ? { eligibility_status: statusFilter } : {}),
      ...(dateFrom ? { date_from: new Date(dateFrom).toISOString() } : {}),
      ...(dateTo ? { date_to: new Date(dateTo).toISOString() } : {}),
    };
  }

  async function runAction(mode: MaterializationMode) {
    setActionError(null);
    const selectedMode = mode.endsWith("selected");
    const materializeMode = mode.startsWith("materialize");
    if (selectedMode && selectedIds.size === 0) {
      setActionError("Select at least one candidate first.");
      return;
    }
    let confirmation: string | undefined;
    if (materializeMode) {
      confirmation = window.prompt("This will create dry-run-only outbox rows. It will not send events externally. Database guards still prevent live dispatch. Type MATERIALIZE_DRY_RUN_ONLY to continue.") ?? undefined;
      if (confirmation !== "MATERIALIZE_DRY_RUN_ONLY") {
        setActionError("Materialization cancelled: confirmation text did not match.");
        return;
      }
    }
    setIsActionRunning(true);
    try {
      const next = await runDispatchOutboxMaterialization({ mode, candidate_ids: selectedMode ? Array.from(selectedIds) : [], filters: selectedMode ? {} : filtersPayload(), include_warnings: includeWarnings, confirmation });
      setResult(next);
      if (materializeMode) {
        await outboxQ.refetch();
        setSelectedIds(new Set());
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Materialization action failed.");
    } finally {
      setIsActionRunning(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4"><div className="min-w-0"><h2 className="text-2xl font-black tracking-tight text-slate-950">Dispatch Eligibility Gate + Outbox</h2><p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">Durable outbox contract, controlled materialization, and idempotency proof. No external APIs are called.</p></div><Button variant="outline" onClick={() => outboxQ.refetch()} disabled={outboxQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950"><RefreshCw className={cn("h-4 w-4", outboxQ.isFetching && "animate-spin")} /> Refresh</Button></div>
      <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm"><ShieldCheck className="mr-2 inline h-4 w-4" /> Materialization creates durable dry-run outbox rows only. Database triggers still prevent live dispatch state. No external APIs are called.</div>
      {outboxQ.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">{outboxQ.error instanceof Error ? outboxQ.error.message : "Failed to load dispatch outbox control."}</div> : null}
      {actionError ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">{actionError}</div> : null}
      {result ? <ResultSummary result={result} /> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><KpiCard label="Candidate revenue events" value={kpis.candidateRevenueEvents} /><KpiCard label="Eligible candidates" value={kpis.eligibleCandidates} /><KpiCard label="Warnings" value={kpis.warningCandidates} /><KpiCard label="Blocked" value={kpis.blockedCandidates} /><KpiCard label="Duplicate protected" value={kpis.duplicateProtectedCandidates} /><KpiCard label="Existing outbox rows" value={kpis.existingOutboxRows} /><KpiCard label="Active platform configs" value={kpis.activePlatformConfigs} /><KpiCard label="Send-enabled rows" value={kpis.sendEnabledRows} /></div>

      <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label className="text-xs font-black uppercase text-slate-700">Client</Label><select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} className="mt-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"><option value="all">All clients</option>{clientOptions.map((slug) => <option key={slug} value={slug}>{slug}</option>)}</select></div>
          <div><Label className="text-xs font-black uppercase text-slate-700">Platform</Label><select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)} className="mt-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950"><option value="all">All platforms</option>{platformOptions.map((name) => <option key={name} value={name}>{name}</option>)}</select></div>
          <div><Label className="text-xs font-black uppercase text-slate-700">Status</Label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof STATUS_OPTIONS[number])} className="mt-1 h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-950">{STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status.replace(/_/g, " ")}</option>)}</select></div>
          <div><Label className="text-xs font-black uppercase text-slate-700">Date from</Label><Input type="datetime-local" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="mt-1 border-slate-300 bg-white font-bold text-slate-950" /></div>
          <div><Label className="text-xs font-black uppercase text-slate-700">Date to</Label><Input type="datetime-local" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="mt-1 border-slate-300 bg-white font-bold text-slate-950" /></div>
          <label className="flex min-h-10 items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 text-sm font-black text-amber-950"><input type="checkbox" checked={includeWarnings} onChange={(e) => setIncludeWarnings(e.target.checked)} /> Include warnings</label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="outline" disabled={isActionRunning} onClick={() => runAction("preview_selected")} className="gap-2 border-slate-400 bg-white text-slate-950"><Eye className="h-4 w-4" /> Preview selected</Button>
          <Button variant="outline" disabled={isActionRunning} onClick={() => runAction("preview_filtered")} className="gap-2 border-slate-400 bg-white text-slate-950"><Eye className="h-4 w-4" /> Preview filtered</Button>
          <Button disabled={isActionRunning} onClick={() => runAction("materialize_selected")} className="gap-2"><PlayCircle className="h-4 w-4" /> Materialize selected</Button>
          <Button disabled={isActionRunning} onClick={() => runAction("materialize_filtered")} className="gap-2"><PlayCircle className="h-4 w-4" /> Materialize filtered</Button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h3 className="text-lg font-black text-slate-950">Eligibility Candidates</h3><p className="text-sm font-semibold text-slate-700">Server recomputes every selected or filtered candidate before preview/materialization.</p></div><div className="flex items-center gap-2"><Badge className="border border-slate-300 bg-slate-100 text-slate-950">{selectedIds.size} selected</Badge><Badge className="border border-slate-300 bg-slate-100 text-slate-950">{visibleCandidates.length} shown</Badge></div></div>
        <div className="overflow-x-auto"><table className="min-w-[1180px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-700"><tr><th className="px-4 py-3"><button type="button" onClick={toggleAllVisible} className="inline-flex items-center gap-1 text-slate-950">{allVisibleSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />} Select</button></th><th className="px-4 py-3">Canonical event</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Eligibility</th><th className="px-4 py-3">Idempotency key</th><th className="px-4 py-3">Fingerprint</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Reasons</th><th className="px-4 py-3">Outbox</th><th className="px-4 py-3">Mapper</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">
          {visibleCandidates.map((row) => <tr key={row.candidateId} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" checked={selectedIds.has(row.candidateId)} onChange={() => toggleSelected(row.candidateId)} className="h-4 w-4" /></td><td className="px-4 py-3"><div className="font-mono text-xs font-black text-slate-950">{maskDispatchId(row.canonicalEventId ?? row.eventRowId)}</div><div className="mt-1 text-xs font-bold text-slate-600">{row.canonicalEventName}</div></td><td className="px-4 py-3 font-black text-slate-950">{row.clientSlug ?? "—"}</td><td className="px-4 py-3"><PlatformBadge platform={row.platformName} /></td><td className="px-4 py-3"><StatusBadge status={row.eligibilityStatus} /></td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.idempotencyKey)}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.candidateFingerprint)}</td><td className="px-4 py-3 font-black text-slate-950">{formatDispatchCurrency(row.valueUsd, row.currency)}</td><td className="px-4 py-3 max-w-[220px] text-xs font-bold text-slate-700">{reasonPreview(row.eligibilityReasons)}</td><td className="px-4 py-3"><Badge className={cn("border", row.outboxRowExists ? "border-blue-300 bg-blue-100 text-blue-950" : "border-slate-300 bg-slate-100 text-slate-950")}>{row.outboxRowExists ? "exists" : "none"}</Badge></td><td className="px-4 py-3 text-xs font-bold text-slate-700">{row.mapperVersion ?? "—"}</td><td className="px-4 py-3"><Button size="sm" variant="outline" className="gap-2 border-slate-400 bg-white text-slate-950" onClick={() => setSelected({ kind: "candidate", row })}><Eye className="h-4 w-4" /> Detail</Button></td></tr>)}
          {visibleCandidates.length === 0 && !outboxQ.isLoading ? <tr><td colSpan={12} className="p-8 text-center font-bold text-slate-700">No dispatch eligibility candidates found.</td></tr> : null}
        </tbody></table></div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h3 className="text-lg font-black text-slate-950">Existing Outbox Rows</h3><p className="text-sm font-semibold text-slate-700">Materialized rows remain non-sendable by database design.</p></div><Badge className="border border-slate-300 bg-slate-100 text-slate-950">{visibleOutboxRows.length} shown</Badge></div><div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><thead className="bg-slate-50 text-xs font-black uppercase text-slate-700"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Idempotency</th><th className="px-4 py-3">Fingerprint</th><th className="px-4 py-3">Canonical event</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Eligibility</th><th className="px-4 py-3">Safety</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Reasons</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{visibleOutboxRows.map((row) => <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3 text-xs font-bold text-slate-700">{formatTime(row.createdAt)}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.idempotencyKey)}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.candidateFingerprint)}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.canonicalEventId ?? row.canonicalEventLogId)}</td><td className="px-4 py-3 font-black text-slate-950">{row.clientSlug}</td><td className="px-4 py-3"><PlatformBadge platform={row.platformName} /></td><td className="px-4 py-3 text-xs font-black text-slate-950">{row.lifecycleStatus}</td><td className="px-4 py-3"><StatusBadge status={row.eligibilityStatus} /></td><td className="px-4 py-3"><div className="flex flex-col gap-1"><SafetyPill label="dry_run" safe={row.dryRunOnly} /><SafetyPill label="send_off" safe={!row.sendEnabled} /></div></td><td className="px-4 py-3 font-black text-slate-950">{row.attemptCount}</td><td className="px-4 py-3 max-w-[220px] text-xs font-bold text-slate-700">{reasonPreview(row.eligibilityReasons)}</td><td className="px-4 py-3"><Button size="sm" variant="outline" className="gap-2 border-slate-400 bg-white text-slate-950" onClick={() => setSelected({ kind: "outbox", row })}><Eye className="h-4 w-4" /> Detail</Button></td></tr>)}{visibleOutboxRows.length === 0 && !outboxQ.isLoading ? <tr><td colSpan={12} className="p-8 text-center font-bold text-slate-700">No outbox rows have been materialized yet.</td></tr> : null}</tbody></table></div></section>

      <div className="grid gap-4 lg:grid-cols-2"><section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><Database className="mb-3 h-5 w-5 text-slate-700" /><h3 className="text-base font-black text-slate-950">Idempotency Contract</h3><p className="mt-2 text-sm font-semibold leading-6 text-slate-700">One canonical event can create at most one outbox row per platform config. Retries reuse the same idempotency key. Mapper upgrades do not automatically resend past events.</p></section><section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-sm"><ShieldCheck className="mb-3 h-5 w-5 text-blue-900" /><h3 className="text-base font-black text-blue-950">No-Live-Dispatch Guard</h3><p className="mt-2 text-sm font-semibold leading-6 text-blue-950">Database triggers reject row states that look like live dispatch: send_enabled=true, dry_run_only=false, sent_at set, external_event_id set, worker locks, retry schedules, or live attempt responses.</p></section></div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}><SheetContent side="right" className="w-full overflow-y-auto bg-slate-50 sm:max-w-3xl"><SheetHeader><SheetTitle className="text-slate-950">{detailTitle}</SheetTitle><SheetDescription>Redacted routing proof, idempotency proof, materialization proof, and no-live-dispatch safety state.</SheetDescription></SheetHeader><div className="mt-5 space-y-4"><section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Idempotency Proof</h4><div className="space-y-2 text-sm font-semibold text-slate-800"><div>key: <span className="font-mono text-xs font-black text-slate-950">{selectedKey ?? "—"}</span></div><div>fingerprint: <span className="font-mono text-xs font-black text-slate-950">{selectedFingerprint ?? "—"}</span></div><div className="rounded-xl border border-slate-300 bg-slate-50 p-3">Formula: wm_dispatch:v1:md5(canonical_event_log_id | canonical_event_id | platform_config_id | platform_name | client_slug). Mapper version and payload body are excluded.</div></div></section><section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Materialization Proof</h4><div className="space-y-2 text-sm font-semibold text-slate-800"><div>outbox row: <span className="font-mono text-xs font-black text-slate-950">{selected?.kind === "outbox" ? maskDispatchId(selected.row.id) : selected?.kind === "candidate" ? maskDispatchId(selected.row.outboxId) : "—"}</span></div><div>status: <span className="font-black text-slate-950">{selected?.kind === "outbox" ? selected.row.lifecycleStatus : selected?.kind === "candidate" ? (selected.row.outboxRowExists ? "duplicate_protected" : "candidate_only") : "—"}</span></div><div className="flex flex-wrap gap-2"><SafetyPill label="dry_run_only" safe={selected?.kind === "outbox" ? selected.row.dryRunOnly : true} /><SafetyPill label="send_enabled_false" safe={selected?.kind === "outbox" ? !selected.row.sendEnabled : true} /><SafetyPill label="no_live_dispatch_guard" safe /></div></div></section><section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Eligibility Reasons</h4><div className="flex flex-wrap gap-2">{selectedReasons.length ? selectedReasons.map((reason) => <Badge key={reason} className="border border-slate-300 bg-slate-100 font-mono text-xs text-slate-950">{reason}</Badge>) : <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-950">eligible</Badge>}</div></section><section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-blue-950">Safety Flags</h4><div className="flex flex-wrap gap-2"><SafetyPill label="dry_run_only" safe /><SafetyPill label="send_enabled_false" safe /><SafetyPill label="live_dispatch_disabled" safe /></div></section><section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Decision Snapshot</h4><JsonBlock value={selectedSnapshot ?? {}} /></section>{selected?.kind === "outbox" ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Redacted Payload Snapshot</h4><JsonBlock value={selected.row.redactedPayloadSnapshot} /></section> : null}</div></SheetContent></Sheet>
    </div>
  );
}
