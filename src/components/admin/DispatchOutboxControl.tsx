import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Database, Eye, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  fetchDispatchOutboxControl,
  formatDispatchCurrency,
  maskDispatchId,
  type DispatchEligibilityStatus,
  type DispatchOutboxCandidate,
  type DispatchOutboxRow,
} from "@/services/dispatchOutbox";

type DetailSelection = { kind: "candidate"; row: DispatchOutboxCandidate } | { kind: "outbox"; row: DispatchOutboxRow } | null;

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
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase text-slate-700">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
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
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", safe ? "border-blue-300 bg-blue-100 text-blue-950" : "border-rose-300 bg-rose-100 text-rose-950")}>
      {label}: {safe ? "safe" : "unsafe"}
    </span>
  );
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[440px] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-slate-100 shadow-inner">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

export function DispatchOutboxControl() {
  const [selected, setSelected] = useState<DetailSelection>(null);

  const outboxQ = useQuery({
    queryKey: ["admin-dispatch-outbox-control"],
    queryFn: fetchDispatchOutboxControl,
    staleTime: 30_000,
  });

  const candidates = outboxQ.data?.candidates ?? [];
  const outboxRows = outboxQ.data?.outboxRows ?? [];
  const kpis = outboxQ.data?.kpis ?? {
    candidateRevenueEvents: 0,
    eligibleCandidates: 0,
    warningCandidates: 0,
    blockedCandidates: 0,
    duplicateProtectedCandidates: 0,
    existingOutboxRows: 0,
    activePlatformConfigs: 0,
    sendEnabledRows: 0,
  };

  const detailTitle = selected?.kind === "candidate" ? "Eligibility Candidate" : selected?.kind === "outbox" ? "Existing Outbox Row" : "Dispatch Outbox";
  const selectedSnapshot = selected?.kind === "candidate" ? selected.row.decisionSnapshot : selected?.kind === "outbox" ? selected.row.decisionSnapshot : null;
  const selectedReasons = selected?.kind === "candidate" ? selected.row.eligibilityReasons : selected?.kind === "outbox" ? selected.row.eligibilityReasons : [];
  const selectedKey = selected?.kind === "candidate" ? selected.row.idempotencyKey : selected?.kind === "outbox" ? selected.row.idempotencyKey : null;
  const selectedFingerprint = selected?.kind === "candidate" ? selected.row.candidateFingerprint : selected?.kind === "outbox" ? selected.row.candidateFingerprint : null;

  const visibleCandidates = useMemo(() => candidates.slice(0, 250), [candidates]);
  const visibleOutboxRows = useMemo(() => outboxRows.slice(0, 250), [outboxRows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Dispatch Eligibility Gate + Outbox</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">Durable outbox contract and idempotency proof. No external APIs are called.</p>
        </div>
        <Button variant="outline" onClick={() => outboxQ.refetch()} disabled={outboxQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950">
          <RefreshCw className={cn("h-4 w-4", outboxQ.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">
        <ShieldCheck className="mr-2 inline h-4 w-4" /> Outbox contract only. Live dispatch is disabled. No Meta, TikTok, Google, GTM, or webhook APIs are called.
      </div>

      {outboxQ.error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950">{outboxQ.error instanceof Error ? outboxQ.error.message : "Failed to load dispatch outbox control."}</div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Candidate revenue events" value={kpis.candidateRevenueEvents} />
        <KpiCard label="Eligible candidates" value={kpis.eligibleCandidates} />
        <KpiCard label="Warnings" value={kpis.warningCandidates} />
        <KpiCard label="Blocked" value={kpis.blockedCandidates} />
        <KpiCard label="Duplicate protected" value={kpis.duplicateProtectedCandidates} />
        <KpiCard label="Existing outbox rows" value={kpis.existingOutboxRows} />
        <KpiCard label="Active platform configs" value={kpis.activePlatformConfigs} />
        <KpiCard label="Send-enabled rows" value={kpis.sendEnabledRows} />
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Eligibility Candidates</h3>
            <p className="text-sm font-semibold text-slate-700">Read-only candidate rows from canonical revenue events and active platform configs.</p>
          </div>
          <Badge className="border border-slate-300 bg-slate-100 text-slate-950">{visibleCandidates.length} shown</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-700">
              <tr>
                <th className="px-4 py-3">Canonical event</th>
                <th className="px-4 py-3">Client</th>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Eligibility</th>
                <th className="px-4 py-3">Idempotency key</th>
                <th className="px-4 py-3">Fingerprint</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Reasons</th>
                <th className="px-4 py-3">Outbox</th>
                <th className="px-4 py-3">Mapper</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleCandidates.map((row) => (
                <tr key={row.candidateId} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3"><div className="font-mono text-xs font-black text-slate-950">{maskDispatchId(row.canonicalEventId ?? row.eventRowId)}</div><div className="mt-1 text-xs font-bold text-slate-600">{row.canonicalEventName}</div></td>
                  <td className="px-4 py-3 font-black text-slate-950">{row.clientSlug ?? "—"}</td>
                  <td className="px-4 py-3"><PlatformBadge platform={row.platformName} /></td>
                  <td className="px-4 py-3"><StatusBadge status={row.eligibilityStatus} /></td>
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.idempotencyKey)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.candidateFingerprint)}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{formatDispatchCurrency(row.valueUsd, row.currency)}</td>
                  <td className="px-4 py-3 max-w-[220px] text-xs font-bold text-slate-700">{reasonPreview(row.eligibilityReasons)}</td>
                  <td className="px-4 py-3"><Badge className={cn("border", row.outboxRowExists ? "border-blue-300 bg-blue-100 text-blue-950" : "border-slate-300 bg-slate-100 text-slate-950")}>{row.outboxRowExists ? "exists" : "none"}</Badge></td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">{row.mapperVersion ?? "—"}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" className="gap-2 border-slate-400 bg-white text-slate-950" onClick={() => setSelected({ kind: "candidate", row })}><Eye className="h-4 w-4" /> Detail</Button></td>
                </tr>
              ))}
              {visibleCandidates.length === 0 && !outboxQ.isLoading ? <tr><td colSpan={11} className="p-8 text-center font-bold text-slate-700">No dispatch eligibility candidates found.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <h3 className="text-lg font-black text-slate-950">Existing Outbox Rows</h3>
            <p className="text-sm font-semibold text-slate-700">Materialized rows remain non-sendable by database design.</p>
          </div>
          <Badge className="border border-slate-300 bg-slate-100 text-slate-950">{visibleOutboxRows.length} shown</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[1080px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase text-slate-700"><tr><th className="px-4 py-3">Created</th><th className="px-4 py-3">Idempotency</th><th className="px-4 py-3">Fingerprint</th><th className="px-4 py-3">Canonical event</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Lifecycle</th><th className="px-4 py-3">Eligibility</th><th className="px-4 py-3">Safety</th><th className="px-4 py-3">Attempts</th><th className="px-4 py-3">Reasons</th><th className="px-4 py-3">Actions</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {visibleOutboxRows.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-3 text-xs font-bold text-slate-700">{formatTime(row.createdAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.idempotencyKey)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.candidateFingerprint)}</td>
                  <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskDispatchId(row.canonicalEventId ?? row.canonicalEventLogId)}</td>
                  <td className="px-4 py-3 font-black text-slate-950">{row.clientSlug}</td>
                  <td className="px-4 py-3"><PlatformBadge platform={row.platformName} /></td>
                  <td className="px-4 py-3 text-xs font-black text-slate-950">{row.lifecycleStatus}</td>
                  <td className="px-4 py-3"><StatusBadge status={row.eligibilityStatus} /></td>
                  <td className="px-4 py-3"><div className="flex flex-col gap-1"><SafetyPill label="dry_run" safe={row.dryRunOnly} /><SafetyPill label="send_off" safe={!row.sendEnabled} /></div></td>
                  <td className="px-4 py-3 font-black text-slate-950">{row.attemptCount}</td>
                  <td className="px-4 py-3 max-w-[220px] text-xs font-bold text-slate-700">{reasonPreview(row.eligibilityReasons)}</td>
                  <td className="px-4 py-3"><Button size="sm" variant="outline" className="gap-2 border-slate-400 bg-white text-slate-950" onClick={() => setSelected({ kind: "outbox", row })}><Eye className="h-4 w-4" /> Detail</Button></td>
                </tr>
              ))}
              {visibleOutboxRows.length === 0 && !outboxQ.isLoading ? <tr><td colSpan={12} className="p-8 text-center font-bold text-slate-700">No outbox rows have been materialized yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <Database className="mb-3 h-5 w-5 text-slate-700" />
          <h3 className="text-base font-black text-slate-950">Idempotency Contract</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-700">One canonical event can create at most one outbox row per platform config. Retries reuse the same idempotency key. Mapper upgrades do not automatically resend past events.</p>
        </section>
        <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-sm">
          <ShieldCheck className="mb-3 h-5 w-5 text-blue-900" />
          <h3 className="text-base font-black text-blue-950">No-Live-Dispatch Guard</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-blue-950">Database triggers reject row states that look like live dispatch: send_enabled=true, dry_run_only=false, sent_at set, external_event_id set, worker locks, retry schedules, or live attempt responses.</p>
        </section>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto bg-slate-50 sm:max-w-3xl">
          <SheetHeader>
            <SheetTitle className="text-slate-950">{detailTitle}</SheetTitle>
            <SheetDescription>Redacted routing proof, idempotency proof, and no-live-dispatch safety state.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-4">
            <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-black uppercase text-slate-950">Idempotency Proof</h4>
              <div className="space-y-2 text-sm font-semibold text-slate-800">
                <div>key: <span className="font-mono text-xs font-black text-slate-950">{selectedKey ?? "—"}</span></div>
                <div>fingerprint: <span className="font-mono text-xs font-black text-slate-950">{selectedFingerprint ?? "—"}</span></div>
                <div className="rounded-xl border border-slate-300 bg-slate-50 p-3">Formula: wm_dispatch:v1:md5(canonical_event_log_id | canonical_event_id | platform_config_id | platform_name | client_slug). Mapper version and payload body are excluded.</div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-black uppercase text-slate-950">Eligibility Reasons</h4>
              <div className="flex flex-wrap gap-2">{selectedReasons.length ? selectedReasons.map((reason) => <Badge key={reason} className="border border-slate-300 bg-slate-100 font-mono text-xs text-slate-950">{reason}</Badge>) : <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-950">eligible</Badge>}</div>
            </section>
            <section className="rounded-2xl border border-blue-300 bg-blue-50 p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-black uppercase text-blue-950">Safety Flags</h4>
              <div className="flex flex-wrap gap-2"><SafetyPill label="dry_run_only" safe /><SafetyPill label="send_enabled_false" safe /><SafetyPill label="live_dispatch_disabled" safe /></div>
            </section>
            <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <h4 className="mb-3 text-sm font-black uppercase text-slate-950">Decision Snapshot</h4>
              <JsonBlock value={selectedSnapshot ?? {}} />
            </section>
            {selected?.kind === "outbox" ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Redacted Payload Snapshot</h4><JsonBlock value={selected.row.redactedPayloadSnapshot} /></section> : null}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
