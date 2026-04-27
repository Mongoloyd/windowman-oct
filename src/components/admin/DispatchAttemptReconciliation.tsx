import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, Eye, PlayCircle, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fetchDispatchAttemptReconciliation,
  maskDispatchId,
  runDispatchAttemptSimulation,
  shortHash,
  type AttemptSimulationResult,
  type DispatchAttemptRow,
} from "@/services/dispatchAttempts";
import type { DispatchOutboxRow } from "@/services/dispatchOutbox";

type DetailSelection = { kind: "outbox"; row: DispatchOutboxRow; preview?: AttemptSimulationResult | null } | { kind: "attempt"; row: DispatchAttemptRow } | null;

const CONFIRMATION = "SIMULATE_DRY_RUN_ATTEMPT_ONLY";
const MAX_SELECTED = 25;

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "MMM d, yyyy HH:mm") : "—";
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><div className="text-xs font-black uppercase text-slate-700">{label}</div><div className="mt-2 text-3xl font-black text-slate-950">{value}</div></div>;
}

function StatusBadge({ status }: { status: string }) {
  const classes: Record<string, string> = {
    simulated: "border-emerald-300 bg-emerald-100 text-emerald-950",
    failed_preflight: "border-amber-300 bg-amber-100 text-amber-950",
    blocked_by_gate: "border-rose-300 bg-rose-100 text-rose-950",
  };
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", classes[status] ?? "border-slate-300 bg-slate-100 text-slate-950")}>{status.replace(/_/g, " ")}</Badge>;
}

function SafetyPill({ label, safe }: { label: string; safe: boolean }) {
  return <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", safe ? "border-blue-300 bg-blue-100 text-blue-950" : "border-rose-300 bg-rose-100 text-rose-950")}>{label}: {safe ? "safe" : "unsafe"}</span>;
}

function JsonBlock({ value }: { value: unknown }) {
  return <pre className="max-h-[440px] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-slate-100 shadow-inner"><code>{JSON.stringify(value, null, 2)}</code></pre>;
}

function reasonPreview(reasons: string[]) {
  if (reasons.length === 0) return "no blockers";
  if (reasons.length <= 2) return reasons.join(", ");
  return `${reasons.slice(0, 2).join(", ")} +${reasons.length - 2}`;
}

export function DispatchAttemptReconciliation() {
  const [selected, setSelected] = useState<DetailSelection>(null);
  const [selectedOutboxIds, setSelectedOutboxIds] = useState<string[]>([]);
  const [result, setResult] = useState<AttemptSimulationResult | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reconciliationQ = useQuery({ queryKey: ["admin-dispatch-attempt-reconciliation"], queryFn: fetchDispatchAttemptReconciliation, staleTime: 30_000 });
  const outboxRows = reconciliationQ.data?.outboxRows ?? [];
  const attempts = reconciliationQ.data?.attempts ?? [];
  const kpis = reconciliationQ.data?.kpis ?? { outboxRows: 0, simulatedAttempts: 0, failedPreflight: 0, blockedByGate: 0, attemptsWithResponseStatus: 0, externalCallsMade: 0 };

  const latestAttemptByOutbox = useMemo(() => {
    const map = new Map<string, DispatchAttemptRow>();
    for (const attempt of attempts) if (!map.has(attempt.outboxId)) map.set(attempt.outboxId, attempt);
    return map;
  }, [attempts]);

  const attemptCountByOutbox = useMemo(() => {
    const map = new Map<string, number>();
    for (const attempt of attempts) map.set(attempt.outboxId, (map.get(attempt.outboxId) ?? 0) + 1);
    return map;
  }, [attempts]);

  const visibleIds = useMemo(() => outboxRows.map((row) => row.id), [outboxRows]);
  const selectedVisibleIds = selectedOutboxIds.filter((id) => visibleIds.includes(id));
  const selectionLimitReached = selectedVisibleIds.length >= MAX_SELECTED;

  const simulationMutation = useMutation({
    mutationFn: runDispatchAttemptSimulation,
    onSuccess: async (next) => {
      setResult(next);
      if (!next.preview_only) await reconciliationQ.refetch();
    },
    onError: (error) => setActionError(error instanceof Error ? error.message : "Attempt simulation failed."),
  });

  function toggleSelected(id: string) {
    setActionError(null);
    setSelectedOutboxIds((current) => {
      if (current.includes(id)) return current.filter((next) => next !== id);
      if (current.filter((next) => visibleIds.includes(next)).length >= MAX_SELECTED) return current;
      return [...current, id];
    });
  }

  function toggleAllVisible() {
    setActionError(null);
    const visibleSelected = selectedOutboxIds.filter((id) => visibleIds.includes(id));
    if (visibleSelected.length === Math.min(visibleIds.length, MAX_SELECTED)) {
      setSelectedOutboxIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }
    setSelectedOutboxIds((current) => Array.from(new Set([...current.filter((id) => !visibleIds.includes(id)), ...visibleIds.slice(0, MAX_SELECTED)])));
  }

  async function previewAttempt(row: DispatchOutboxRow) {
    setActionError(null);
    const preview = await simulationMutation.mutateAsync({ mode: "preview_attempt", outbox_id: row.id });
    setSelected({ kind: "outbox", row, preview });
  }

  async function simulateAttempt(row: DispatchOutboxRow) {
    setActionError(null);
    const confirmation = window.prompt(`This writes one dry-run-only attempt row. It does not call providers, GTM Server, CRM webhooks, endpoints, or browser pixels. Provider response fields remain blank. Type ${CONFIRMATION} to continue.`) ?? undefined;
    if (confirmation !== CONFIRMATION) {
      setActionError("Simulation cancelled: confirmation text did not match.");
      return;
    }
    await simulationMutation.mutateAsync({ mode: "simulate_attempt", outbox_id: row.id, confirmation });
  }

  async function simulateSelected() {
    setActionError(null);
    const ids = selectedVisibleIds.slice(0, MAX_SELECTED);
    if (ids.length === 0) {
      setActionError("Select at least one visible outbox row to simulate.");
      return;
    }
    const confirmation = window.prompt(`This writes up to ${MAX_SELECTED} dry-run-only attempt rows for selected outbox rows. It does not call providers, GTM Server, CRM webhooks, endpoints, or browser pixels. Provider response fields remain blank. Type ${CONFIRMATION} to continue.`) ?? undefined;
    if (confirmation !== CONFIRMATION) {
      setActionError("Selected simulation cancelled: confirmation text did not match.");
      return;
    }
    await simulationMutation.mutateAsync({ mode: "simulate_selected", outbox_ids: ids, confirmation });
  }

  const detailPreviewItem = selected?.kind === "outbox" ? selected.preview?.items?.[0] : null;
  const detailAttempt = selected?.kind === "attempt" ? selected.row : null;
  const selectAllChecked = selectedVisibleIds.length > 0 && selectedVisibleIds.length === Math.min(visibleIds.length, MAX_SELECTED);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0"><h2 className="text-2xl font-black tracking-tight text-slate-950">Dispatch Attempt Reconciliation</h2><p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">Simulated attempt ledger for dry-run outbox rows. Preview writes nothing; simulate writes dry-run audit rows only.</p></div>
        <Button variant="outline" onClick={() => reconciliationQ.refetch()} disabled={reconciliationQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950"><RefreshCw className={cn("h-4 w-4", reconciliationQ.isFetching && "animate-spin")} /> Refresh</Button>
      </div>

      <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm"><ShieldCheck className="mr-2 inline h-4 w-4" /> Simulated attempts only. No external APIs or endpoints are called. Provider response status and external response fields remain empty by design.</div>
      {reconciliationQ.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950"><AlertTriangle className="mr-2 inline h-4 w-4" /> {reconciliationQ.error instanceof Error ? reconciliationQ.error.message : "Failed to load attempt reconciliation."}</div> : null}
      {actionError ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">{actionError}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><KpiCard label="Outbox rows" value={kpis.outboxRows} /><KpiCard label="Simulated attempts" value={kpis.simulatedAttempts} /><KpiCard label="Failed preflight" value={kpis.failedPreflight} /><KpiCard label="Blocked by gate" value={kpis.blockedByGate} /><KpiCard label="Attempts with provider response" value={kpis.attemptsWithResponseStatus} /><KpiCard label="External calls made" value={kpis.externalCallsMade} /></div>

      {result ? <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black text-emerald-950">Simulation Result</h3><p className="text-sm font-semibold text-emerald-900">Mode: {result.mode} · Write requested: {result.write_requested ? "yes" : "no"} · Preview only: {result.preview_only ? "yes" : "no"} · Attempts written: {result.attempts_written_count} · External APIs called: no · Provider response statuses written: no · Outbox rows updated: no</p></div><StatusBadge status={result.items[0]?.status ?? "simulated"} /></div><div className="mt-3 grid gap-2 text-sm font-black text-emerald-950 sm:grid-cols-2 lg:grid-cols-5"><div>simulated: {result.summary.simulated}</div><div>failed_preflight: {result.summary.failed_preflight}</div><div>blocked_by_gate: {result.summary.blocked_by_gate}</div><div>attempts_written: {result.summary.attempts_written}</div><div>response_statuses: {result.summary.response_status_codes_written}</div></div><div className="mt-3 flex flex-wrap gap-2"><SafetyPill label="dry_run_only" safe={result.dry_run_only} /><SafetyPill label="external_apis_0" safe={result.summary.external_apis_called === 0} /><SafetyPill label="provider_response_0" safe={result.summary.response_status_codes_written === 0} /><SafetyPill label="outbox_updates_0" safe={result.summary.outbox_rows_updated === 0} /></div></section> : null}

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4"><div><h3 className="text-lg font-black text-slate-950">Outbox Rows Available for Simulation</h3><p className="text-sm font-semibold text-slate-700">Duplicate protection belongs to outbox idempotency. Repeated simulations are dry-run audit records; no live duplicate send can occur.</p></div><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black uppercase text-slate-700">Selected {selectedVisibleIds.length}/{MAX_SELECTED}</span><Button size="sm" variant="outline" onClick={toggleAllVisible} disabled={outboxRows.length === 0 || simulationMutation.isPending} className="border-slate-400 bg-white text-slate-950">{selectAllChecked ? "Clear visible" : "Select visible"}</Button><Button size="sm" onClick={simulateSelected} disabled={selectedVisibleIds.length === 0 || simulationMutation.isPending} className="gap-1"><PlayCircle className="h-3.5 w-3.5" /> Simulate selected</Button></div></div>
        <div className="wm-slim-scrollbar overflow-x-auto"><table className="w-full min-w-[1420px] text-sm"><thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Select</th><th className="px-4 py-3">Created</th><th className="px-4 py-3">client_slug</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Idempotency</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Eligibility</th><th className="px-4 py-3">Dry run</th><th className="px-4 py-3">Send enabled</th><th className="px-4 py-3">Ledger attempts</th><th className="px-4 py-3">Last status</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-slate-200">{outboxRows.length === 0 ? <tr><td colSpan={12} className="px-4 py-8 text-center text-sm font-bold text-slate-700">No materialized outbox rows found.</td></tr> : outboxRows.map((row) => { const latest = latestAttemptByOutbox.get(row.id); const checked = selectedVisibleIds.includes(row.id); const disabled = !checked && selectionLimitReached; return <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${row.platformName} outbox row`} checked={checked} disabled={disabled || simulationMutation.isPending} onChange={() => toggleSelected(row.id)} className="h-4 w-4 accent-slate-950" /></td><td className="px-4 py-3 text-xs font-bold text-slate-700">{formatTime(row.createdAt)}</td><td className="px-4 py-3 font-bold text-slate-950">{row.clientSlug}</td><td className="px-4 py-3"><Badge className="border border-slate-300 bg-slate-100 text-slate-950">{row.platformName}</Badge></td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.idempotencyKey)}</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{row.lifecycleStatus}</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{row.eligibilityStatus}</td><td className="px-4 py-3"><SafetyPill label="dry_run" safe={row.dryRunOnly} /></td><td className="px-4 py-3"><SafetyPill label="send" safe={!row.sendEnabled} /></td><td className="px-4 py-3 font-black text-slate-950">{attemptCountByOutbox.get(row.id) ?? 0}</td><td className="px-4 py-3">{latest ? <StatusBadge status={latest.status} /> : <span className="text-xs font-bold text-slate-600">none</span>}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" disabled={simulationMutation.isPending} onClick={() => previewAttempt(row)} className="gap-1 border-slate-400 bg-white text-slate-950"><Eye className="h-3.5 w-3.5" /> Preview</Button><Button size="sm" disabled={simulationMutation.isPending} onClick={() => simulateAttempt(row)} className="gap-1"><PlayCircle className="h-3.5 w-3.5" /> Simulate</Button></div></td></tr>; })}</tbody></table></div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><h3 className="text-lg font-black text-slate-950">Attempt Ledger</h3><p className="text-sm font-semibold text-slate-700">Dry-run attempt rows. Provider response status and external response fields should remain blank.</p></div>
        <div className="wm-slim-scrollbar overflow-x-auto"><table className="w-full min-w-[1220px] text-sm"><thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Outbox ID</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Attempt #</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Payload hash</th><th className="px-4 py-3">Error code</th><th className="px-4 py-3">Error message</th><th className="px-4 py-3">Provider response status</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-slate-200">{attempts.length === 0 ? <tr><td colSpan={10} className="px-4 py-8 text-center text-sm font-bold text-slate-700">No simulated attempt rows yet.</td></tr> : attempts.map((row) => <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3 text-xs font-bold text-slate-700">{formatTime(row.createdAt)}</td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.outboxId)}</td><td className="px-4 py-3"><Badge className="border border-slate-300 bg-slate-100 text-slate-950">{row.outbox?.platformName ?? "—"}</Badge></td><td className="px-4 py-3 font-black text-slate-950">{row.attemptNumber}</td><td className="px-4 py-3"><StatusBadge status={row.status} /></td><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{shortHash(row.requestPayloadHash)}</td><td className="px-4 py-3 text-xs font-bold text-slate-700">{row.errorCode ?? "—"}</td><td className="px-4 py-3 max-w-[260px] text-xs font-bold text-slate-700">{row.errorMessage ?? "—"}</td><td className="px-4 py-3 font-black text-slate-950">{row.responseStatusCode ?? "—"}</td><td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => setSelected({ kind: "attempt", row })} className="gap-1 border-slate-400 bg-white text-slate-950"><Eye className="h-3.5 w-3.5" /> Detail</Button></td></tr>)}</tbody></table></div>
      </section>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="wm-slim-scrollbar w-full overflow-y-auto border-slate-300 bg-slate-50 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b border-slate-300 bg-white p-5 text-left"><SheetTitle className="text-2xl font-black text-slate-950">Attempt Detail</SheetTitle><SheetDescription className="font-semibold text-slate-700">No external response exists. No platform, GTM, CRM, webhook, endpoint, or browser-pixel request was sent.</SheetDescription></SheetHeader>
          {selected ? <div className="space-y-4 p-5">
            {selected.kind === "outbox" ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Previewed Outbox Attempt</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>outbox_id: <span className="font-mono font-black text-slate-950">{maskDispatchId(selected.row.id)}</span></div><div>platform: <span className="font-black text-slate-950">{selected.row.platformName}</span></div><div>client_slug: <span className="font-black text-slate-950">{selected.row.clientSlug}</span></div><div>status: <span className="font-black text-slate-950">{detailPreviewItem?.status ?? "—"}</span></div><div>attempt #: <span className="font-black text-slate-950">{detailPreviewItem?.attempt_number ?? "—"}</span></div><div>payload hash: <span className="font-mono font-black text-slate-950">{shortHash(detailPreviewItem?.request_payload_hash)}</span></div><div>write requested: <span className="font-black text-slate-950">{selected.preview?.write_requested ? "yes" : "no"}</span></div><div>attempts written: <span className="font-black text-slate-950">{selected.preview?.attempts_written_count ?? 0}</span></div></div><div className="mt-3 text-sm font-bold text-slate-800">reason codes: <span className="font-mono text-xs font-black text-slate-950">{reasonPreview(detailPreviewItem?.reasons ?? [])}</span></div></section> : null}
            {detailAttempt ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Attempt Summary</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>attempt_id: <span className="font-mono font-black text-slate-950">{maskDispatchId(detailAttempt.id)}</span></div><div>outbox_id: <span className="font-mono font-black text-slate-950">{maskDispatchId(detailAttempt.outboxId)}</span></div><div>attempt #: <span className="font-black text-slate-950">{detailAttempt.attemptNumber}</span></div><div>status: <StatusBadge status={detailAttempt.status} /></div><div>payload hash: <span className="font-mono font-black text-slate-950">{shortHash(detailAttempt.requestPayloadHash)}</span></div><div>provider response status: <span className="font-black text-slate-950">{detailAttempt.responseStatusCode ?? "—"}</span></div><div>external response excerpt: <span className="font-black text-slate-950">{detailAttempt.responseExcerpt ?? "—"}</span></div><div>error code: <span className="font-black text-slate-950">{detailAttempt.errorCode ?? "—"}</span></div><div>error message: <span className="font-black text-slate-950">{detailAttempt.errorMessage ?? "—"}</span></div></div></section> : null}
            <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Redacted Request Snapshot</h4><JsonBlock value={detailPreviewItem?.redacted_request_snapshot ?? detailAttempt?.redactedRequestSnapshot ?? {}} /></section>
            <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-black text-blue-950 shadow-sm">No-send proof: dry_run = true, provider response status = null, external response excerpt = null, external calls made = 0, outbox rows updated = 0.</section>
          </div> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
