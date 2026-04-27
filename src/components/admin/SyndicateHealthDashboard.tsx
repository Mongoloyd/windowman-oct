import { useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Activity, AlertTriangle, Eye, Filter, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  fetchClientHealthRows,
  fetchContractorAccountHealthRows,
  fetchOperationalActionQueue,
  fetchSyndicateHealthRows,
  fetchSyndicateHealthSummary,
  formatHealthReason,
  type ClientHealthRow,
  type ContractorAccountHealthRow,
  type OperationalAction,
  type SyndicateHealthRow,
  type SyndicateHealthStatus,
} from "@/services/syndicateHealth";
import { TenantIsolationAudit } from "@/components/admin/TenantIsolationAudit";

const STATUSES: Array<SyndicateHealthStatus | "all"> = ["all", "critical", "manual_review", "warning", "unknown", "healthy"];

type DetailRow = SyndicateHealthRow | ClientHealthRow | ContractorAccountHealthRow | OperationalAction;

function statusClass(status: string) {
  if (status === "critical") return "border-rose-300 bg-rose-50 text-rose-950";
  if (status === "manual_review") return "border-amber-300 bg-amber-50 text-amber-950";
  if (status === "warning") return "border-blue-300 bg-blue-50 text-blue-950";
  if (status === "healthy") return "border-emerald-300 bg-emerald-50 text-emerald-950";
  return "border-slate-300 bg-slate-100 text-slate-900";
}

function StatusBadge({ status }: { status: SyndicateHealthStatus }) {
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", statusClass(status))}>{status}</Badge>;
}

function Kpi({ label, value, status }: { label: string; value: number | string; status?: string }) {
  return <div className={cn("rounded-lg border bg-white p-4 shadow-sm", status ? statusClass(status) : "border-slate-300")}><p className="text-xs font-black uppercase tracking-wide text-slate-700">{label}</p><p className="mt-2 text-2xl font-black text-slate-950">{value}</p></div>;
}

function Reasons({ reasons }: { reasons: string[] }) {
  if (reasons.length === 0) return <span className="text-sm font-semibold text-slate-600">No detected issues</span>;
  return <span className="text-sm font-semibold text-slate-700">{reasons.slice(0, 3).map(formatHealthReason).join(", ")}{reasons.length > 3 ? ` +${reasons.length - 3}` : ""}</span>;
}

function MatrixSection<T extends DetailRow>({ title, rows, columns, onOpen }: { title: string; rows: T[]; columns: Array<{ label: string; render: (row: T) => React.ReactNode }>; onOpen: (row: T) => void }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-4"><h3 className="text-base font-black text-slate-950">{title}</h3></div>
      <div className="wm-slim-scrollbar overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader><TableRow>{columns.map((column) => <TableHead key={column.label}>{column.label}</TableHead>)}<TableHead>Detail</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((row, index) => <TableRow key={("id" in row && row.id) || ("clientSlug" in row && row.clientSlug) || index}><>{columns.map((column) => <TableCell key={column.label}>{column.render(row)}</TableCell>)}</><TableCell><Button size="sm" variant="outline" className="gap-1 border-slate-300 bg-white text-slate-950" onClick={() => onOpen(row)}><Eye className="h-3.5 w-3.5" />Open</Button></TableCell></TableRow>)}
            {rows.length === 0 ? <TableRow><TableCell colSpan={columns.length + 1} className="py-8 text-center font-bold text-slate-700">No rows for current filters.</TableCell></TableRow> : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function SyndicateHealthDashboard() {
  const [syndicateId, setSyndicateId] = useState("all");
  const [clientSlug, setClientSlug] = useState("all");
  const [contractorId, setContractorId] = useState("all");
  const [status, setStatus] = useState<SyndicateHealthStatus | "all">("all");
  const [needsAttentionOnly, setNeedsAttentionOnly] = useState(false);
  const [selected, setSelected] = useState<DetailRow | null>(null);
  const filters = { syndicateId: syndicateId === "all" ? undefined : syndicateId, clientSlug: clientSlug === "all" ? undefined : clientSlug, contractorAccountId: contractorId === "all" ? undefined : contractorId, status, needsAttentionOnly };

  const [summaryQ, syndicatesQ, clientsQ, contractorsQ, actionsQ] = useQueries({
    queries: [
      { queryKey: ["syndicate-health-summary", filters], queryFn: () => fetchSyndicateHealthSummary(filters), staleTime: 30_000 },
      { queryKey: ["syndicate-health-rows", filters], queryFn: () => fetchSyndicateHealthRows(filters), staleTime: 30_000 },
      { queryKey: ["client-health-rows", filters], queryFn: () => fetchClientHealthRows(filters), staleTime: 30_000 },
      { queryKey: ["contractor-health-rows", filters], queryFn: () => fetchContractorAccountHealthRows(filters), staleTime: 30_000 },
      { queryKey: ["operational-action-queue", filters], queryFn: () => fetchOperationalActionQueue(filters), staleTime: 30_000 },
    ],
  });

  const summary = summaryQ.data;
  const syndicates = (syndicatesQ.data ?? []) as SyndicateHealthRow[];
  const clients = (clientsQ.data ?? []) as ClientHealthRow[];
  const contractors = (contractorsQ.data ?? []) as ContractorAccountHealthRow[];
  const actions = (actionsQ.data ?? []) as OperationalAction[];
  const clientOptions = useMemo(() => Array.from(new Set(clients.map((row) => row.clientSlug))).sort(), [clients]);
  const loading = [summaryQ, syndicatesQ, clientsQ, contractorsQ, actionsQ].some((query) => query.isLoading);
  const error = [summaryQ, syndicatesQ, clientsQ, contractorsQ, actionsQ].find((query) => query.error)?.error;
  const refetchAll = () => [summaryQ, syndicatesQ, clientsQ, contractorsQ, actionsQ].forEach((query) => query.refetch());

  return (
    <div className="space-y-6 bg-slate-50 text-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Syndicate Health</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Syndicate Health is internal-only. It summarizes routing, outcomes, and revenue signal readiness without exposing cross-tenant data externally. Dashboard metrics are not source-of-truth records.
          </p>
        </div>
        <Button variant="outline" onClick={refetchAll} className="gap-2 border-slate-400 bg-white text-slate-950"><RefreshCw className="h-4 w-4" />Refresh</Button>
      </div>

      {error ? <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950"><AlertTriangle className="mr-2 inline h-4 w-4" /> Failed to load syndicate health.</div> : null}
      {loading ? <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white p-8 font-bold text-slate-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading health model</div> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <Kpi label="Active Syndicates" value={summary?.activeSyndicates ?? "—"} />
        <Kpi label="Active Clients" value={summary?.activeClients ?? "—"} />
        <Kpi label="Active Contractors" value={summary?.activeContractors ?? "—"} />
        <Kpi label="Current Assignments" value={summary?.currentAssignments ?? "—"} />
        <Kpi label="Stale Assignments" value={summary?.staleAssignments ?? "—"} status={(summary?.staleAssignments ?? 0) > 0 ? "warning" : undefined} />
        <Kpi label="Sold Outcomes" value={summary?.soldOutcomes ?? "—"} />
        <Kpi label="Blocked Signals" value={summary?.blockedSignals ?? "—"} status={(summary?.blockedSignals ?? 0) > 0 ? "critical" : undefined} />
        <Kpi label="Operational Actions" value={summary?.operationalActions ?? "—"} status={(summary?.operationalActions ?? 0) > 0 ? "manual_review" : undefined} />
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950"><Filter className="h-4 w-4" /> Filters</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <Select value={syndicateId} onValueChange={setSyndicateId}><SelectTrigger><SelectValue placeholder="Syndicate" /></SelectTrigger><SelectContent><SelectItem value="all">All syndicates</SelectItem>{syndicates.map((row) => <SelectItem key={row.id} value={row.id}>{row.slug}</SelectItem>)}</SelectContent></Select>
          <Select value={clientSlug} onValueChange={setClientSlug}><SelectTrigger><SelectValue placeholder="Client" /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clientOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={contractorId} onValueChange={setContractorId}><SelectTrigger><SelectValue placeholder="Contractor" /></SelectTrigger><SelectContent><SelectItem value="all">All contractors</SelectItem>{contractors.map((row) => <SelectItem key={row.id} value={row.id}>{row.displayName}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => setStatus(value as SyndicateHealthStatus | "all")}><SelectTrigger><SelectValue placeholder="Health" /></SelectTrigger><SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value}</SelectItem>)}</SelectContent></Select>
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3"><Switch id="needs-attention" checked={needsAttentionOnly} onCheckedChange={setNeedsAttentionOnly} /><Label htmlFor="needs-attention" className="font-bold text-slate-800">Needs attention only</Label></div>
        </div>
      </div>

      <MatrixSection title="Syndicate Matrix" rows={syndicates} onOpen={setSelected} columns={[
        { label: "Status", render: (row) => <StatusBadge status={row.status} /> }, { label: "Syndicate", render: (row) => <span className="font-black text-slate-950">{row.name} / {row.slug}</span> }, { label: "Clients", render: (row) => row.activeClients }, { label: "Contractors", render: (row) => row.activeContractors }, { label: "Assignments", render: (row) => row.currentAssignments }, { label: "Stale", render: (row) => row.staleAssignments }, { label: "Blocked Outcomes", render: (row) => row.blockedOutcomes }, { label: "Reasons", render: (row) => <Reasons reasons={row.reasons} /> },
      ]} />

      <MatrixSection title="Client Matrix" rows={clients} onOpen={setSelected} columns={[
        { label: "Status", render: (row) => <StatusBadge status={row.status} /> }, { label: "Client", render: (row) => <span className="font-black text-slate-950">{row.clientSlug}</span> }, { label: "Syndicate", render: (row) => row.syndicateSlug ?? "—" }, { label: "Contractors", render: (row) => row.activeContractors }, { label: "Assignments", render: (row) => row.currentAssignments }, { label: "Sold", render: (row) => row.soldOutcomes }, { label: "Blocked Signals", render: (row) => row.blockedSignals }, { label: "Reasons", render: (row) => <Reasons reasons={row.reasons} /> },
      ]} />

      <MatrixSection title="Contractor Account Matrix" rows={contractors} onOpen={setSelected} columns={[
        { label: "Status", render: (row) => <StatusBadge status={row.status} /> }, { label: "Contractor", render: (row) => <span className="font-black text-slate-950">{row.displayName}</span> }, { label: "Client", render: (row) => row.clientSlug ?? "—" }, { label: "Active", render: (row) => row.isActive ? "Yes" : "No" }, { label: "Assignments", render: (row) => row.currentAssignments }, { label: "Stale", render: (row) => row.staleAssignments }, { label: "Outcomes", render: (row) => row.soldOutcomes }, { label: "Reasons", render: (row) => <Reasons reasons={row.reasons} /> },
      ]} />

      <MatrixSection title="Operational Action Queue" rows={actions} onOpen={setSelected} columns={[
        { label: "Status", render: (row) => <StatusBadge status={row.status} /> }, { label: "Action", render: (row) => <span className="font-black text-slate-950">{row.label}</span> }, { label: "Entity", render: (row) => <span className="font-mono text-xs font-bold">{row.entityType} / {row.entityIdMasked}</span> }, { label: "Client", render: (row) => row.clientSlug ?? "—" }, { label: "Syndicate", render: (row) => row.syndicateSlug ?? "—" }, { label: "Reason", render: (row) => <span className="text-sm font-semibold text-slate-700">{row.reason}</span> },
      ]} />

      <div className="pt-2"><TenantIsolationAudit /></div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white p-5 text-slate-950 sm:max-w-2xl">
          <SheetHeader className="pr-8"><SheetTitle className="flex items-center gap-2 text-xl font-black text-slate-950"><Activity className="h-5 w-5" /> Health Detail</SheetTitle><SheetDescription className="font-semibold text-slate-700">Masked internal summary only. Metrics are not source-of-truth records.</SheetDescription></SheetHeader>
          {selected ? <pre className="mt-6 whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs font-semibold text-slate-800">{JSON.stringify(selected, null, 2)}</pre> : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
