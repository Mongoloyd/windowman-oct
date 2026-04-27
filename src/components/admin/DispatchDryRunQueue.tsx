import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AlertTriangle, ArrowUpRight, Eye, Filter, Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  fetchDispatchDryRunQueue,
  META_CAPI_DRY_RUN_MAPPER_VERSION,
  TIKTOK_DRY_RUN_MAPPER_VERSION,
  type DispatchDryRunOrphan,
  type DispatchDryRunRow,
  type DryRunStatus,
} from "@/services/dispatchSimulator";
import { maskId, type AttributionStrength } from "@/services/revenueDispatchReadiness";
import { maskConfigId } from "@/services/clientPlatformConfigs";

const PLATFORM_OPTIONS = ["all", "meta", "tiktok", "google_ads", "ga4", "gtm_server", "crm_webhook", "internal", "other"] as const;
const STATUS_OPTIONS: Array<DryRunStatus | "all"> = ["all", "dry_run_ready", "dry_run_warning", "dry_run_blocked"];
const ATTRIBUTION_OPTIONS: Array<AttributionStrength | "all"> = ["all", "strong", "medium", "weak"];
const DATE_RANGES = ["24h", "7d", "30d", "all"] as const;

type DetailSelection = { kind: "row"; row: DispatchDryRunRow } | { kind: "orphan"; orphan: DispatchDryRunOrphan } | null;

function formatCurrency(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function formatTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? format(date, "MMM d, yyyy HH:mm") : "—";
}

function withinDateRange(value: string | null, range: typeof DATE_RANGES[number]) {
  if (range === "all") return true;
  if (!value) return false;
  const age = Date.now() - new Date(value).getTime();
  const max = range === "24h" ? 24 * 3600_000 : range === "7d" ? 7 * 24 * 3600_000 : 30 * 24 * 3600_000;
  return age <= max;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="text-xs font-black uppercase text-slate-700">{label}</div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: DryRunStatus }) {
  const classes: Record<DryRunStatus, string> = {
    dry_run_ready: "border-emerald-300 bg-emerald-100 text-emerald-950",
    dry_run_warning: "border-amber-300 bg-amber-100 text-amber-950",
    dry_run_blocked: "border-rose-300 bg-rose-100 text-rose-950",
  };
  return <Badge className={cn("rounded-full border px-2.5 py-1 text-xs font-black uppercase", classes[status])}>{status.replace("dry_run_", "")}</Badge>;
}

function AttributionBadge({ value }: { value: AttributionStrength }) {
  const classes: Record<AttributionStrength, string> = {
    strong: "border-emerald-300 bg-emerald-100 text-emerald-950",
    medium: "border-blue-300 bg-blue-100 text-blue-950",
    weak: "border-amber-300 bg-amber-100 text-amber-950",
  };
  return <Badge className={cn("rounded-full border px-2 py-0.5 text-xs font-black uppercase", classes[value])}>{value}</Badge>;
}

function PlatformBadge({ platform }: { platform: string }) {
  return <Badge className="rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-black uppercase text-slate-950">{platform}</Badge>;
}

function PresencePill({ label, present }: { label: string; present: boolean }) {
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-xs font-black", present ? "border-emerald-300 bg-emerald-100 text-emerald-950" : "border-slate-300 bg-white text-slate-700")}>
      {label}: {present ? "present" : "missing"}
    </span>
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

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className="max-h-[520px] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-4 text-xs font-semibold leading-relaxed text-slate-100 shadow-inner">
      <code>{JSON.stringify(value, null, 2)}</code>
    </pre>
  );
}

function reasonPreview(reasons: string[]) {
  if (reasons.length === 0) return "payload_draft_ready";
  if (reasons.length <= 2) return reasons.join(", ");
  return `${reasons.slice(0, 2).join(", ")} +${reasons.length - 2}`;
}

function getTikTokDryRunSummary(row: DispatchDryRunRow | null) {
  if (!row || row.platformName !== "tiktok") return null;
  const payload = row.payload as {
    event_source_id?: string | null;
    data?: Array<{ event?: string }>;
    windowman_debug?: {
      mapper_version?: string;
      match_quality?: string;
      value_basis?: string;
      warnings?: string[];
    };
  };
  return {
    eventName: payload.data?.[0]?.event ?? "—",
    eventSourceIdPresent: Boolean(payload.event_source_id),
    mapperVersion: payload.windowman_debug?.mapper_version ?? TIKTOK_DRY_RUN_MAPPER_VERSION,
    matchQuality: payload.windowman_debug?.match_quality ?? "missing",
    warningCount: payload.windowman_debug?.warnings?.length ?? row.reasons.filter((reason) => reason.startsWith("tiktok_")).length,
    valueSource: payload.windowman_debug?.value_basis ?? "gross_sale_value",
  };
}

function getMetaDryRunSummary(row: DispatchDryRunRow | null) {
  if (!row || row.platformName !== "meta") return null;
  const payload = row.payload as {
    data?: Array<{ event_name?: string; custom_data?: { value_basis?: string } }>;
    windowman_debug?: {
      mapper_version?: string;
      destination_id_present?: boolean;
      destination_id_type?: string;
      deduplication_event_id_present?: boolean;
      deduplication_event_id_source?: string;
      match_input_quality?: string;
      warnings?: string[];
    };
  };
  return {
    eventName: payload.data?.[0]?.event_name ?? "—",
    destinationIdPresent: Boolean(payload.windowman_debug?.destination_id_present),
    destinationType: payload.windowman_debug?.destination_id_type ?? "missing",
    mapperVersion: payload.windowman_debug?.mapper_version ?? META_CAPI_DRY_RUN_MAPPER_VERSION,
    matchInputQuality: payload.windowman_debug?.match_input_quality ?? "missing",
    deduplicationEventIdPresent: Boolean(payload.windowman_debug?.deduplication_event_id_present),
    deduplicationSource: payload.windowman_debug?.deduplication_event_id_source ?? "canonical_event_id",
    warningCount: payload.windowman_debug?.warnings?.length ?? row.reasons.filter((reason) => reason.startsWith("meta_")).length,
    valueSource: payload.data?.[0]?.custom_data?.value_basis ?? "gross_sale_value",
  };
}

export function DispatchDryRunQueue() {
  const [selected, setSelected] = useState<DetailSelection>(null);
  const [platform, setPlatform] = useState<typeof PLATFORM_OPTIONS[number]>("all");
  const [status, setStatus] = useState<DryRunStatus | "all">("all");
  const [clientSlug, setClientSlug] = useState("all");
  const [attribution, setAttribution] = useState<AttributionStrength | "all">("all");
  const [dateRange, setDateRange] = useState<typeof DATE_RANGES[number]>("30d");
  const [warningsOnly, setWarningsOnly] = useState(false);
  const [orphanedOnly, setOrphanedOnly] = useState(false);
  const [search, setSearch] = useState("");

  const queueQ = useQuery({
    queryKey: ["admin-dispatch-dry-run-queue"],
    queryFn: fetchDispatchDryRunQueue,
    staleTime: 30_000,
  });

  const rows = queueQ.data?.rows ?? [];
  const orphans = queueQ.data?.orphans ?? [];
  const kpis = queueQ.data?.kpis ?? {
    canonicalRevenueEventsInspected: 0,
    readyEvents: 0,
    warningEvents: 0,
    blockedOrOrphanedEvents: 0,
    totalSimulatedDispatches: 0,
    metaDispatches: 0,
    tiktokDispatches: 0,
    googleDispatches: 0,
    gtmWebhookDispatches: 0,
    orphanedNoActiveConfig: 0,
  };

  const clientOptions = useMemo(() => Array.from(new Set([...rows.map((row) => row.clientSlug), ...orphans.map((row) => row.clientSlug)].filter(Boolean) as string[])).sort(), [rows, orphans]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (orphanedOnly) return false;
      if (!withinDateRange(row.eventTimestamp, dateRange)) return false;
      if (platform !== "all" && row.platformName !== platform) return false;
      if (status !== "all" && row.simulatedStatus !== status) return false;
      if (clientSlug !== "all" && row.clientSlug !== clientSlug) return false;
      if (attribution !== "all" && row.attributionStrength !== attribution) return false;
      if (warningsOnly && row.reasons.length === 0) return false;
      if (q) {
        const haystack = [row.canonicalEventId, row.leadId, row.clientSlug, row.config.id, row.platformName, row.eventName, row.eventRowId].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [attribution, clientSlug, dateRange, orphanedOnly, platform, rows, search, status, warningsOnly]);

  const filteredOrphans = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orphans.filter((row) => {
      if (!withinDateRange(row.eventTimestamp, dateRange)) return false;
      if (clientSlug !== "all" && row.clientSlug !== clientSlug) return false;
      if (attribution !== "all" && row.attributionStrength !== attribution) return false;
      if (!orphanedOnly && platform !== "all") return false;
      if (q) {
        const haystack = [row.canonicalEventId, row.leadId, row.clientSlug, row.eventName, row.eventRowId].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [attribution, clientSlug, dateRange, orphans, orphanedOnly, platform, search]);

  const detailRow = selected?.kind === "row" ? selected.row : null;
  const detailOrphan = selected?.kind === "orphan" ? selected.orphan : null;
  const detailCanonical = detailRow?.canonical ?? detailOrphan?.canonical ?? null;
  const tiktokSummary = getTikTokDryRunSummary(detailRow);
  const metaSummary = getMetaDryRunSummary(detailRow);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Dispatch Dry-Run Simulator</h2>
          <p className="mt-1 max-w-4xl text-sm font-semibold text-slate-700">Simulating multi-tenant payload fan-out. No external APIs are being called.</p>
        </div>
        <Button variant="outline" onClick={() => queueQ.refetch()} disabled={queueQ.isFetching} className="gap-2 border-slate-400 bg-white text-slate-950">
          <RefreshCw className={cn("h-4 w-4", queueQ.isFetching && "animate-spin")} /> Refresh
        </Button>
      </div>

      <div className="rounded-2xl border border-blue-300 bg-blue-50 p-4 text-sm font-bold text-blue-950 shadow-sm">
        <ShieldAlert className="mr-2 inline h-4 w-4" /> Simulation only. No Meta, TikTok, Google, GTM, or webhook API calls are made. No dispatch logs are written.
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <KpiCard label="Canonical events inspected" value={kpis.canonicalRevenueEventsInspected} />
        <KpiCard label="Ready events" value={kpis.readyEvents} />
        <KpiCard label="Warning events" value={kpis.warningEvents} />
        <KpiCard label="Blocked / orphaned" value={kpis.blockedOrOrphanedEvents} />
        <KpiCard label="Simulated dispatches" value={kpis.totalSimulatedDispatches} />
        <KpiCard label="Meta dispatches" value={kpis.metaDispatches} />
        <KpiCard label="TikTok dispatches" value={kpis.tiktokDispatches} />
        <KpiCard label="Google dispatches" value={kpis.googleDispatches} />
        <KpiCard label="GTM / webhook dispatches" value={kpis.gtmWebhookDispatches} />
        <KpiCard label="No active config" value={kpis.orphanedNoActiveConfig} />
      </div>

      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-sm font-black text-slate-950"><Filter className="h-4 w-4" /> Filters</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof DATE_RANGES[number])}><SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Date range" /></SelectTrigger><SelectContent>{DATE_RANGES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All time" : value}</SelectItem>)}</SelectContent></Select>
          <Select value={platform} onValueChange={(value) => setPlatform(value as typeof PLATFORM_OPTIONS[number])}><SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Platform" /></SelectTrigger><SelectContent>{PLATFORM_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All platforms" : value}</SelectItem>)}</SelectContent></Select>
          <Select value={status} onValueChange={(value) => setStatus(value as DryRunStatus | "all")}><SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value.replace("dry_run_", "")}</SelectItem>)}</SelectContent></Select>
          <Select value={clientSlug} onValueChange={setClientSlug}><SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="client_slug" /></SelectTrigger><SelectContent><SelectItem value="all">All clients</SelectItem>{clientOptions.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select>
          <Select value={attribution} onValueChange={(value) => setAttribution(value as AttributionStrength | "all")}><SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Attribution" /></SelectTrigger><SelectContent>{ATTRIBUTION_OPTIONS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All attribution" : value}</SelectItem>)}</SelectContent></Select>
          <div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" /><Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="event_id / lead_id / client_slug / config_id" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-5">
          <ToggleFilter id="dry-run-warnings" label="Warnings only" checked={warningsOnly} onCheckedChange={setWarningsOnly} />
          <ToggleFilter id="dry-run-orphans" label="Orphaned only" checked={orphanedOnly} onCheckedChange={setOrphanedOnly} />
        </div>
      </div>

      {queueQ.error ? <div className="rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-950 shadow-sm"><AlertTriangle className="mr-2 inline h-4 w-4" /> Failed to load dry-run queue: {queueQ.error instanceof Error ? queueQ.error.message : String(queueQ.error)}</div> : null}

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {queueQ.isLoading ? (
          <div className="flex items-center justify-center gap-2 p-10 text-sm font-black text-slate-800"><Loader2 className="h-4 w-4 animate-spin" /> Loading dry-run queue</div>
        ) : filteredRows.length === 0 ? (
          <div className="p-8 text-center"><div className="text-xl font-black text-slate-950">No simulated dispatch rows match filters</div><div className="mt-2 text-sm font-semibold text-slate-700">Ready or warning events need active destination configs before fan-out rows appear.</div></div>
        ) : (
          <div className="wm-slim-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1500px] text-sm">
              <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Event ID</th><th className="px-4 py-3">client_slug</th><th className="px-4 py-3">Platform</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Attribution</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Reasons</th><th className="px-4 py-3">Timestamp</th><th className="px-4 py-3">Actions</th></tr></thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <tr key={row.id} className="align-top hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskId(row.canonicalEventId)}</td>
                    <td className="px-4 py-3 font-bold text-slate-950">{row.clientSlug ?? "—"}</td>
                    <td className="px-4 py-3"><PlatformBadge platform={row.platformName} /></td>
                    <td className="px-4 py-3"><StatusBadge status={row.simulatedStatus} /></td>
                    <td className="px-4 py-3 font-black text-slate-950">{formatCurrency(row.valueUsd)}</td>
                    <td className="px-4 py-3"><AttributionBadge value={row.attributionStrength} /></td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.config.destinationSummary}</td>
                    <td className="px-4 py-3 max-w-[260px] text-xs font-bold text-slate-700">{reasonPreview(row.reasons)}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">{formatTime(row.eventTimestamp)}</td>
                    <td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelected({ kind: "row", row })} className="gap-1 border-slate-400 bg-white text-slate-950"><Eye className="h-3.5 w-3.5" /> Payload</Button>{row.leadId ? <Button asChild size="sm" variant="outline" className="gap-1 border-slate-300 bg-white text-slate-950"><Link to={`/admin/leads/${row.leadId}`}>Lead <ArrowUpRight className="h-3.5 w-3.5" /></Link></Button> : null}</div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-rose-300 bg-white shadow-sm">
        <div className="border-b border-rose-200 bg-rose-50 px-4 py-3"><h3 className="text-lg font-black text-rose-950">Orphaned / Not Simulated</h3><p className="text-sm font-semibold text-rose-900">Canonical revenue events that did not fan out into destination payload rows.</p></div>
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800"><tr><th className="px-4 py-3">Event ID</th><th className="px-4 py-3">client_slug</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Value</th><th className="px-4 py-3">Suggested fix</th><th className="px-4 py-3">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {filteredOrphans.length === 0 ? <tr><td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-700">No orphaned events match filters.</td></tr> : filteredOrphans.map((row) => (
                <tr key={row.id} className="align-top hover:bg-slate-50"><td className="px-4 py-3 font-mono text-xs font-black text-slate-950">{maskId(row.canonicalEventId)}</td><td className="px-4 py-3 font-bold text-slate-950">{row.clientSlug ?? "—"}</td><td className="px-4 py-3 max-w-[260px] text-xs font-bold text-rose-900">{reasonPreview(row.reasons)}</td><td className="px-4 py-3 font-black text-slate-950">{formatCurrency(row.valueUsd)}</td><td className="px-4 py-3 text-sm font-semibold text-slate-800">{row.suggestedFix}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => setSelected({ kind: "orphan", orphan: row })} className="gap-1 border-slate-400 bg-white text-slate-950"><Eye className="h-3.5 w-3.5" /> Inspect</Button><Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950">Platform Configs</Button></div></td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="right" className="wm-slim-scrollbar w-full overflow-y-auto border-slate-300 bg-slate-50 p-0 sm:max-w-3xl">
          <SheetHeader className="border-b border-slate-300 bg-white p-5 text-left"><SheetTitle className="text-2xl font-black text-slate-950">Simulated Payload Drawer</SheetTitle><SheetDescription className="font-semibold text-slate-700">This is a dry-run payload. No external API call has been made.</SheetDescription></SheetHeader>
          {detailCanonical ? (
            <div className="space-y-4 p-5">
              <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Canonical Event Summary</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>event_id: <span className="font-mono font-black text-slate-950">{maskId(detailCanonical.eventId)}</span></div><div>event_name: <span className="font-black text-slate-950">{detailCanonical.eventName ?? "—"}</span></div><div>timestamp: <span className="font-black text-slate-950">{formatTime(detailCanonical.timestamp ?? detailCanonical.createdAt)}</span></div><div>lead_id: <span className="font-mono font-black text-slate-950">{maskId(detailCanonical.leadId)}</span></div><div>client_slug: <span className="font-black text-slate-950">{detailCanonical.clientSlug ?? "—"}</span></div><div>value: <span className="font-black text-slate-950">{formatCurrency(detailCanonical.valueUsd)}</span></div></div><div className="mt-3 flex flex-wrap gap-2"><PresencePill label="gross value proxy" present={detailCanonical.reasons.includes("gross_value_used_not_true_margin")} /><PresencePill label="true margin available" present={detailCanonical.payloadIntegrity.trueMarginAvailable === true} /><PresencePill label="payload object" present={detailCanonical.payloadIntegrity.payloadIsObject} /></div></section>
              {detailRow ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Resolved Platform Config</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>platform: <span className="font-black text-slate-950">{detailRow.platformName}</span></div><div>config_id: <span className="font-mono font-black text-slate-950">{maskConfigId(detailRow.config.id)}</span></div><div>token_present: <span className="font-black text-slate-950">{String(detailRow.tokenPresent)}</span></div><div>destination: <span className="font-black text-slate-950">{detailRow.config.destinationSummary}</span></div></div><div className="mt-3 flex flex-wrap gap-2"><PresencePill label="pixel" present={detailRow.config.pixelIdPresent} /><PresencePill label="dataset" present={detailRow.config.datasetIdPresent} /><PresencePill label="conversion id" present={detailRow.config.conversionIdPresent} /><PresencePill label="conversion label" present={detailRow.config.conversionLabelPresent} /><PresencePill label="endpoint" present={detailRow.config.endpointUrlPresent} /></div></section> : null}
              {metaSummary ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Meta CAPI Dry-Run Mapping</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>Meta event name: <span className="font-black text-slate-950">{metaSummary.eventName}</span></div><div>pixel/dataset present: <span className="font-black text-slate-950">{String(metaSummary.destinationIdPresent)}</span></div><div>destination type: <span className="font-black text-slate-950">{metaSummary.destinationType}</span></div><div>mapper version: <span className="font-mono font-black text-slate-950">{metaSummary.mapperVersion}</span></div><div>match input quality: <span className="font-black text-slate-950">{metaSummary.matchInputQuality}</span></div><div>dedup event ID present: <span className="font-black text-slate-950">{String(metaSummary.deduplicationEventIdPresent)}</span></div><div>dedup source: <span className="font-black text-slate-950">{metaSummary.deduplicationSource}</span></div><div>warning count: <span className="font-black text-slate-950">{metaSummary.warningCount}</span></div><div>value source: <span className="font-black text-slate-950">{metaSummary.valueSource}</span></div></div><div className="mt-3 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm font-black text-blue-950">This is a dry-run approximation. No Meta CAPI request was sent.</div></section> : null}
              {tiktokSummary ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">TikTok Dry-Run Mapping</h4><div className="grid gap-2 text-sm font-semibold text-slate-800 sm:grid-cols-2"><div>TikTok event name: <span className="font-black text-slate-950">{tiktokSummary.eventName}</span></div><div>event_source_id present: <span className="font-black text-slate-950">{String(tiktokSummary.eventSourceIdPresent)}</span></div><div>mapper version: <span className="font-mono font-black text-slate-950">{tiktokSummary.mapperVersion}</span></div><div>match quality: <span className="font-black text-slate-950">{tiktokSummary.matchQuality}</span></div><div>warning count: <span className="font-black text-slate-950">{tiktokSummary.warningCount}</span></div><div>value source: <span className="font-black text-slate-950">{tiktokSummary.valueSource}</span></div></div><div className="mt-3 rounded-xl border border-blue-300 bg-blue-50 p-3 text-sm font-black text-blue-950">Dry-run approximation only. No TikTok Events API request was sent.</div></section> : null}
              {detailRow ? <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Simulated Outbound JSON Payload</h4><JsonBlock value={detailRow.payload} /></section> : <section className="rounded-2xl border border-rose-300 bg-rose-50 p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-rose-950">Blocked Simulation</h4><p className="text-sm font-bold text-rose-950">No outbound payload was generated for this canonical event because it is orphaned or blocked.</p></section>}
              <section className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm"><h4 className="mb-3 text-sm font-black uppercase text-slate-950">Routing Proof</h4><div className="space-y-2 text-sm font-semibold text-slate-800"><div>{detailRow ? "1 canonical event → this platform row" : "1 canonical event → no platform rows"}</div><div>readiness: <span className="font-black text-slate-950">{detailCanonical.status}</span></div><div>dry-run status: <span className="font-black text-slate-950">{detailRow?.simulatedStatus ?? "not_simulated"}</span></div><div>reason codes: <span className="font-mono text-xs font-black text-slate-950">{(detailRow?.reasons ?? detailOrphan?.reasons ?? []).join(", ") || "payload_draft_ready"}</span></div><div className="rounded-xl border border-blue-300 bg-blue-50 p-3 font-black text-blue-950">Dry-run disclaimer: no dispatch queue write, no platform API call, no token exposure, and no wm_event_log mutation occurred.</div></div></section>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
