import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, Filter, Loader2, RefreshCw, Search, ShieldCheck } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  fetchRevenueDispatchReadiness,
  maskId,
  type AttributionStrength,
  type ReadinessStatus,
  type RevenueReadinessRow,
} from "@/services/revenueDispatchReadiness";

const STATUS_OPTIONS: Array<ReadinessStatus | "all"> = ["all", "ready", "warning", "blocked"];
const ATTRIBUTION_OPTIONS: Array<AttributionStrength | "all"> = ["all", "strong", "medium", "weak"];
const PLATFORM_OPTIONS = ["all", "configured", "unconfigured"] as const;
const DATE_RANGES = ["24h", "7d", "30d", "all"] as const;

function StatusBadge({ status }: { status: ReadinessStatus }) {
  const classes: Record<ReadinessStatus, string> = {
    ready: "border-emerald-300 bg-emerald-100 text-emerald-950",
    warning: "border-amber-300 bg-amber-100 text-amber-950",
    blocked: "border-rose-300 bg-rose-100 text-rose-950",
  };
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", classes[status])}>{status}</Badge>;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="text-sm font-bold text-slate-700">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function PresencePill({ label, present }: { label: string; present: boolean }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", present ? "border-emerald-300 bg-emerald-100 text-emerald-950" : "border-slate-300 bg-white text-slate-700")}>
      {label}
    </span>
  );
}

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function withinDateRange(row: RevenueReadinessRow, range: typeof DATE_RANGES[number]): boolean {
  if (range === "all") return true;
  if (!row.timestamp) return false;
  const age = Date.now() - new Date(row.timestamp).getTime();
  const max = range === "24h" ? 24 * 3600_000 : range === "7d" ? 7 * 24 * 3600_000 : 30 * 24 * 3600_000;
  return age <= max;
}

function destinationSummary(row: RevenueReadinessRow) {
  if (row.config.platformConfigs.length === 0) return "None active";
  return row.config.platformConfigs.map((config) => config.platform_name).join(", ");
}

function reasonPreview(row: RevenueReadinessRow) {
  if (row.reasons.length === 0) return "ready";
  if (row.reasons.length <= 2) return row.reasons.join(", ");
  return `${row.reasons.slice(0, 2).join(", ")} +${row.reasons.length - 2}`;
}

export function RevenueDispatchReadiness() {
  const [selected, setSelected] = useState<RevenueReadinessRow | null>(null);
  const [status, setStatus] = useState<ReadinessStatus | "all">("all");
  const [clientSlug, setClientSlug] = useState("all");
  const [platformConfigured, setPlatformConfigured] = useState<typeof PLATFORM_OPTIONS[number]>("all");
  const [attribution, setAttribution] = useState<AttributionStrength | "all">("all");
  const [dateRange, setDateRange] = useState<typeof DATE_RANGES[number]>("30d");
  const [blockedOnly, setBlockedOnly] = useState(false);
  const [warningOnly, setWarningOnly] = useState(false);
  const [missingClientOnly, setMissingClientOnly] = useState(false);
  const [search, setSearch] = useState("");

  const readinessQ = useQuery({
    queryKey: ["admin-revenue-dispatch-readiness"],
    queryFn: fetchRevenueDispatchReadiness,
    staleTime: 30_000,
  });

  const rows = readinessQ.data?.rows ?? [];
  const kpis = readinessQ.data?.kpis ?? {
    totalRevenueEvents: 0,
    ready: 0,
    warning: 0,
    blocked: 0,
    activeDestinationConfigs: 0,
    missingClientSlug: 0,
    weakAttribution: 0,
    grossValueProxyCount: 0,
  };

  const clientOptions = useMemo(() => {
    return Array.from(new Set(rows.map((row) => row.clientSlug).filter(Boolean) as string[])).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (!withinDateRange(row, dateRange)) return false;
      if (blockedOnly && row.status !== "blocked") return false;
      if (warningOnly && row.status !== "warning") return false;
      if (missingClientOnly && row.clientSlug) return false;
      if (status !== "all" && row.status !== status) return false;
      if (clientSlug !== "all" && row.clientSlug !== clientSlug) return false;
      if (platformConfigured === "configured" && row.config.platformConfigs.length === 0) return false;
      if (platformConfigured === "unconfigured" && row.config.platformConfigs.length > 0) return false;
      if (attribution !== "all" && row.attributionStrength !== attribution) return false;
      if (q) {
        const haystack = [
          row.eventId,
          row.leadId,
          row.clientSlug,
          row.context.contractorOutcomeId,
          row.context.opportunityId,
          row.context.contractorId,
          row.eventName,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [attribution, blockedOnly, clientSlug, dateRange, missingClientOnly, platformConfigured, rows, search, status, warningOnly]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Revenue Dispatch Readiness</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">
            Audit canonical sold events before they are eligible for TikTok, Meta, Google, GTM, or webhook dispatch.
          </p>
        </div>
        <Button variant="outline" onClick={() => readinessQ.refetch()} disabled={readinessQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950">
          <RefreshCw className={cn("h-4 w-4", readinessQ.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Total Revenue Events" value={kpis.totalRevenueEvents} />
        <KpiCard label="Ready" value={kpis.ready} />
        <KpiCard label="Warning" value={kpis.warning} />
        <KpiCard label="Blocked" value={kpis.blocked} />
        <KpiCard label="Active Destination Configs" value={kpis.activeDestinationConfigs} />
        <KpiCard label="Missing client_slug" value={kpis.missingClientSlug} />
        <KpiCard label="Weak Attribution" value={kpis.weakAttribution} />
      </div>

      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950">
          <Filter className="h-4 w-4" /> Filters
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof DATE_RANGES[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Date range" /></SelectTrigger>
            <SelectContent>{DATE_RANGES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All time" : value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as ReadinessStatus | "all")}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{STATUS_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={clientSlug} onValueChange={setClientSlug}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="client_slug" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All clients</SelectItem>{clientOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={platformConfigured} onValueChange={(value) => setPlatformConfigured(value as typeof PLATFORM_OPTIONS[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Platform configured" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All config states</SelectItem><SelectItem value="configured">Configured</SelectItem><SelectItem value="unconfigured">Unconfigured</SelectItem></SelectContent>
          </Select>
          <Select value={attribution} onValueChange={(value) => setAttribution(value as AttributionStrength | "all")}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Attribution" /></SelectTrigger>
            <SelectContent>{ATTRIBUTION_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All attribution" : value}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="event_id / lead_id / client_slug / outcome_id" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <ToggleFilter id="blocked-only" label="Blocked only" checked={blockedOnly} onCheckedChange={setBlockedOnly} />
          <ToggleFilter id="warning-only" label="Warning only" checked={warningOnly} onCheckedChange={setWarningOnly} />
          <ToggleFilter id="missing-client" label="Missing client_slug only" checked={missingClientOnly} onCheckedChange={setMissingClientOnly} />
        </div>
      </div>

      {readinessQ.error ? (
        <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950 shadow-sm">
          <AlertTriangle className="mr-2 inline h-4 w-4" /> Failed to load revenue readiness: {readinessQ.error instanceof Error ? readinessQ.error.message : String(readinessQ.error)}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {readinessQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-black text-slate-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading readiness matrix</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center"><div className="text-xl font-black text-slate-950">No canonical revenue events found</div><div className="mt-2 text-sm font-semibold text-slate-700">Only sold/purchase-like events from wm_event_log are included. No top-of-funnel lead events are shown.</div></div>
        ) : (
          <div className="wm-slim-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1460px] text-sm">
              <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Readiness</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Event ID</th>
                  <th className="px-4 py-3">Lead ID</th>
                  <th className="px-4 py-3">client_slug</th>
                  <th className="px-4 py-3">Value</th>
                  <th className="px-4 py-3">Attribution</th>
                  <th className="px-4 py-3">Configured Destinations</th>
                  <th className="px-4 py-3">Reason Codes</th>
                  <th className="px-4 py-3">Contractor / Outcome</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{row.timestamp ? format(new Date(row.timestamp), "MMM d, h:mm a") : "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.eventName ?? "—"}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{maskId(row.eventId)}</td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-900">{maskId(row.leadId)}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.clientSlug ?? "—"}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{formatCurrency(row.valueUsd)}</td>
                    <td className="px-4 py-3 font-bold capitalize text-slate-900">{row.attributionStrength}</td>
                    <td className="max-w-[190px] px-4 py-3 font-semibold text-slate-700">{destinationSummary(row)}</td>
                    <td className="max-w-[240px] px-4 py-3 font-mono text-xs font-bold text-slate-900">{reasonPreview(row)}</td>
                    <td className="px-4 py-3 font-mono text-xs font-bold text-slate-900">{maskId(row.context.contractorOutcomeId ?? row.context.opportunityId ?? row.context.contractorId)}</td>
                    <td className="px-4 py-3"><RowActions row={row} onOpen={() => setSelected(row)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReadinessDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function ToggleFilter({ id, label, checked, onCheckedChange }: { id: string; label: string; checked: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
      <Label htmlFor={id} className="text-sm font-bold text-slate-800">{label}</Label>
    </div>
  );
}

function RowActions({ row, onOpen }: { row: RevenueReadinessRow; onOpen: () => void }) {
  return (
    <div className="flex min-w-[260px] flex-wrap gap-2">
      <Button size="sm" variant="outline" onClick={onOpen} className="border-slate-400 bg-white text-slate-950">Open Detail</Button>
      {row.leadId ? <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/leads/${row.leadId}`}>View Lead</Link></Button> : null}
      {row.leadId ? <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution?lead_id=${row.leadId}`}>View Attribution</Link></Button> : null}
      {(row.context.contractorOutcomeId || row.context.opportunityId) ? <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to="/admin/outcomes">Outcome Inspector</Link></Button> : null}
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string | number | boolean | null | undefined; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="text-xs font-black uppercase text-slate-700">{label}</div>
      <div className={cn("mt-1 break-all text-sm font-bold text-slate-950", mono && "font-mono")}>{value == null || value === "" ? "—" : String(value)}</div>
    </div>
  );
}

function ReadinessDetailDrawer({ row, onClose }: { row: RevenueReadinessRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-4xl">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black text-slate-950">Revenue readiness detail</SheetTitle>
          <SheetDescription className="font-semibold text-slate-700">Masked canonical event audit. Raw PII, raw click IDs, and Vault token values are never shown.</SheetDescription>
        </SheetHeader>
        {row ? (
          <div className="mt-6 space-y-6">
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-300 bg-slate-50 p-4">
              <StatusBadge status={row.status} />
              <div className="font-mono text-sm font-black text-slate-950">{maskId(row.eventId)}</div>
              <div className="text-sm font-bold text-slate-700">{row.eventName ?? "Unknown event"}</div>
            </div>

            <section>
              <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase text-slate-800"><ShieldCheck className="h-4 w-4" /> Readiness reasons</h3>
              <div className="flex flex-wrap gap-2">
                {row.reasons.length === 0 ? <Badge className="border border-emerald-300 bg-emerald-100 text-emerald-950">ready</Badge> : row.reasons.map((reason) => <Badge key={reason} className="border border-slate-300 bg-white font-mono text-slate-950">{reason}</Badge>)}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <DetailField label="Timestamp" value={row.timestamp ? format(new Date(row.timestamp), "PPP p") : null} />
              <DetailField label="client_slug" value={row.clientSlug} />
              <DetailField label="Event ID" value={maskId(row.eventId)} mono />
              <DetailField label="Lead ID" value={maskId(row.leadId)} mono />
              <DetailField label="Value used" value={formatCurrency(row.valueUsd)} />
              <DetailField label="Final value cents" value={row.finalValueCents} />
              <DetailField label="Optimization value USD" value={row.optimizationValueUsd} />
              <DetailField label="Attribution strength" value={row.attributionStrength} />
            </section>

            <section>
              <h3 className="mb-3 text-sm font-black uppercase text-slate-800">Client / platform config summary</h3>
              {row.config.platformConfigs.length === 0 ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-950">No active platform destinations are configured for this resolved client.</div>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {row.config.platformConfigs.map((config) => (
                    <div key={config.platform_name} className="rounded-xl border border-slate-300 bg-white p-3">
                      <div className="font-black text-slate-950">{config.platform_name}</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <PresencePill label="token" present={config.token_present} />
                        <PresencePill label="pixel" present={config.pixel_id_present} />
                        <PresencePill label="dataset" present={config.dataset_id_present} />
                        <PresencePill label="conversion id" present={config.conversion_id_present} />
                        <PresencePill label="label" present={config.conversion_label_present} />
                        <PresencePill label="endpoint" present={config.endpoint_url_present} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3 className="mb-3 text-sm font-black uppercase text-slate-800">Attribution presence matrix</h3>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(row.attributionPresence).map(([key, present]) => <PresencePill key={key} label={key} present={present} />)}
              </div>
            </section>

            <section className="grid gap-3 md:grid-cols-2">
              <DetailField label="Revenue truth source" value={row.payloadIntegrity.revenueTruthSource} />
              <DetailField label="Revenue rollup target" value={row.payloadIntegrity.revenueRollupTarget} />
              <DetailField label="Source system" value={row.payloadIntegrity.sourceSystem} />
              <DetailField label="Disposition state" value={row.payloadIntegrity.dispositionState} />
              <DetailField label="Optimization value basis" value={row.payloadIntegrity.optimizationValueBasis} />
              <DetailField label="True margin available" value={row.payloadIntegrity.trueMarginAvailable} />
              <DetailField label="Contractor outcome" value={maskId(row.context.contractorOutcomeId)} mono />
              <DetailField label="Opportunity" value={maskId(row.context.opportunityId)} mono />
            </section>

            <section className="flex flex-wrap gap-2">
              {row.leadId ? <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/leads/${row.leadId}`}>View Lead <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button> : null}
              {row.leadId ? <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution?lead_id=${row.leadId}`}>View Attribution <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button> : null}
              {(row.context.contractorOutcomeId || row.context.opportunityId) ? <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to="/admin/outcomes">Outcome Inspector <ArrowUpRight className="ml-2 h-4 w-4" /></Link></Button> : null}
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
