import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, FileSearch, Loader2, RefreshCw, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  fetchTenantIsolationAudit,
  formatTenantWarning,
  type TenantAuditSeverity,
  type TenantIsolationWarning,
} from "@/services/tenantIsolationAudit";

const SEVERITIES: Array<TenantAuditSeverity | "all"> = ["all", "critical", "manual_review", "warning", "info"];

function tone(value: string) {
  if (value.includes("blocked") || value === "critical") return "border-rose-300 bg-rose-50 text-rose-950";
  if (value.includes("manual") || value === "manual_review" || value === "deferred") return "border-amber-300 bg-amber-50 text-amber-950";
  if (value === "warning" || value === "review") return "border-blue-300 bg-blue-50 text-blue-950";
  if (value === "safe" || value === "pass" || value.includes("ready")) return "border-emerald-300 bg-emerald-50 text-emerald-950";
  return "border-slate-300 bg-slate-50 text-slate-900";
}

function Pill({ value }: { value: string }) {
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", tone(value))}>{value}</Badge>;
}

function Kpi({ label, value, variant = "info" }: { label: string; value: number | string; variant?: string }) {
  return (
    <div className={cn("rounded-lg border bg-white p-4 shadow-sm", tone(variant))}>
      <p className="text-xs font-black uppercase tracking-wide text-slate-700">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

export function TenantIsolationAudit() {
  const [severity, setSeverity] = useState<TenantAuditSeverity | "all">("all");
  const [selected, setSelected] = useState<TenantIsolationWarning | null>(null);
  const auditQ = useQuery({ queryKey: ["tenant-isolation-audit", severity], queryFn: () => fetchTenantIsolationAudit({ severity }), staleTime: 30_000 });
  const summary = auditQ.data?.summary;
  const warnings = auditQ.data?.warnings ?? [];
  const clientOptions = useMemo(() => Array.from(new Set(warnings.map((row) => row.client_slug).filter(Boolean) as string[])).sort(), [warnings]);

  return (
    <div className="space-y-5 bg-slate-50 text-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Tenant Isolation Audit</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Tenant Isolation Audit is internal-only. It identifies routing, outcome, and revenue-signal boundary risks. It does not grant contractor/client access and does not mutate source records.
          </p>
        </div>
        <Button variant="outline" onClick={() => auditQ.refetch()} disabled={auditQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950">
          <RefreshCw className={cn("h-4 w-4", auditQ.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      {auditQ.error ? <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950"><AlertTriangle className="mr-2 inline h-4 w-4" /> Failed to load tenant audit.</div> : null}
      {auditQ.isLoading ? <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-8 font-bold text-slate-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading tenant audit</div> : null}

      {summary ? (
        <>
          <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-slate-600">Final Verdict</p>
                <h3 className="mt-2 break-words text-xl font-black text-slate-950">{summary.verdict}</h3>
              </div>
              <Pill value={summary.verdict.includes("blocked") ? "blocked" : summary.verdict.includes("partially") ? "manual_review" : "ready_for_review"} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Kpi label="Total Warnings" value={summary.totalWarnings} />
            <Kpi label="Critical" value={summary.criticalWarnings} variant="critical" />
            <Kpi label="Manual Review" value={summary.manualReviewWarnings} variant="manual_review" />
            <Kpi label="Warning" value={summary.warningWarnings} variant="warning" />
            <Kpi label="RLS Evidence" value={summary.rlsEvidenceLevel} variant={summary.rlsEvidenceLevel === "runtime_verified" ? "safe" : "review"} />
          </div>

          <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-base font-black text-slate-950"><FileSearch className="h-4 w-4" /> Tenant Warning Table</h3>
              <div className="flex min-w-[220px] gap-2">
                <Select value={severity} onValueChange={(value) => setSeverity(value as TenantAuditSeverity | "all")}>
                  <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue /></SelectTrigger>
                  <SelectContent>{SEVERITIES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All severities" : value}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="wm-slim-scrollbar overflow-x-auto">
              <Table className="min-w-[1120px]">
                <TableHeader><TableRow><TableHead>Severity</TableHead><TableHead>Warning</TableHead><TableHead>Entity</TableHead><TableHead>Client</TableHead><TableHead>Related</TableHead><TableHead>Syndicate</TableHead><TableHead>Evidence</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                <TableBody>
                  {warnings.map((warning) => (
                    <TableRow key={warning.id} className="cursor-pointer" onClick={() => setSelected(warning)}>
                      <TableCell><Pill value={warning.severity} /></TableCell>
                      <TableCell className="font-black text-slate-950">{formatTenantWarning(warning.warning_code)}</TableCell>
                      <TableCell className="font-mono text-xs font-bold text-slate-800">{warning.entity_type} / {warning.entity_id_masked}</TableCell>
                      <TableCell className="font-bold text-slate-900">{warning.client_slug ?? "—"}</TableCell>
                      <TableCell className="font-bold text-slate-900">{warning.related_client_slug ?? "—"}</TableCell>
                      <TableCell className="font-bold text-slate-900">{warning.syndicate_slug ?? "—"}</TableCell>
                      <TableCell><Pill value={warning.evidence_level} /></TableCell>
                      <TableCell className="max-w-[260px] text-sm font-semibold text-slate-700">{warning.suggested_action}</TableCell>
                    </TableRow>
                  ))}
                  {warnings.length === 0 ? <TableRow><TableCell colSpan={8} className="py-8 text-center font-bold text-slate-700">No warnings detected for the current filter.</TableCell></TableRow> : null}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <h3 className="mb-3 flex items-center gap-2 text-base font-black text-slate-950"><ShieldCheck className="h-4 w-4" /> RLS Posture Panel</h3>
              <div className="space-y-2">
                {summary.rlsPosture.map((row) => (
                  <div key={row.table_name} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-black text-slate-950">{row.table_name}</span><Pill value={row.status} /></div>
                    <p className="mt-1 text-xs font-semibold text-slate-700">Evidence: {row.evidence_level} · RLS: {String(row.rls_enabled)} · Anon access: {String(row.anon_access)} · Contractor scope: {row.contractor_scope}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-600">{row.notes}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-black text-slate-950">Contractor-Facing Readiness</h3>
                <div className="mt-3"><Pill value={summary.contractorFacingReadiness} /></div>
                <p className="mt-2 text-sm font-semibold text-slate-700">No contractor/client-facing access is added in this sprint.</p>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-black text-slate-950">Client-Facing Reporting Readiness</h3>
                <div className="mt-3"><Pill value={summary.clientReportingReadiness} /></div>
                <p className="mt-2 text-sm font-semibold text-slate-700">Reporting is gated by tenant warning and RLS evidence outcomes.</p>
              </div>
              <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
                <h3 className="text-base font-black text-slate-950">Closeout Checklist</h3>
                <div className="mt-3 space-y-2">
                  {summary.closeoutChecklist.map((item) => <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-950">{item.label}</span><Pill value={item.status} /></div><p className="mt-1 text-xs font-semibold text-slate-700">{item.detail}</p></div>)}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white p-5 text-slate-950 sm:max-w-2xl">
          <SheetHeader className="pr-8"><SheetTitle className="text-xl font-black text-slate-950">Tenant Warning Detail</SheetTitle><SheetDescription className="font-semibold text-slate-700">Masked internal evidence only. No source records are mutated here.</SheetDescription></SheetHeader>
          {selected ? <div className="mt-6 space-y-4 text-sm font-semibold text-slate-800">
            <Pill value={selected.severity} />
            <h3 className="text-lg font-black text-slate-950">{formatTenantWarning(selected.warning_code)}</h3>
            <p>{selected.explanation}</p><p>{selected.suggested_action}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[["Entity", `${selected.entity_type} / ${selected.entity_id_masked}`], ["Client", selected.client_slug ?? "—"], ["Related Client", selected.related_client_slug ?? "—"], ["Syndicate", selected.syndicate_slug ?? "—"], ["Source", selected.source_table], ["Evidence", selected.evidence_level]].map(([label, value]) => <div key={label} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-600">{label}</p><p className="mt-1 break-words font-bold text-slate-950">{value}</p></div>)}
            </div>
          </div> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
