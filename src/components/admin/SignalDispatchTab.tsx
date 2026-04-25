import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ExternalLink, HelpCircle, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchSignalDispatchRows, maskId, type SignalEventRow, type SignalPlatform, type SignalSourceAudit, type SignalStatus } from "@/services/signalDispatch";

const PLATFORMS = ["all", "Meta CAPI", "Google Ads", "GTM Server", "CRM Webhook", "Other"] as const;
const EVENT_TYPES = ["all", "Lead", "Verified Lead", "Purchase", "Sold Closed", "Custom"] as const;
const STATUSES = ["all", "success", "failed", "pending", "skipped", "retryable"] as const;
const DATE_RANGES = ["24h", "7d", "30d", "all"] as const;

function HelpTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2" aria-label="Signal field explanation">
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-sm border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-lg">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function KpiCard({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <span>{label}</span>
        {help ? <HelpTip>{help}</HelpTip> : null}
      </div>
      <div className="mt-2 text-3xl font-black text-slate-950">{value}</div>
    </div>
  );
}

function StatusBadge({ status, httpStatus }: { status: SignalStatus; httpStatus: number | null }) {
  const classes: Record<SignalStatus, string> = {
    success: "border-emerald-300 bg-emerald-100 text-emerald-950",
    failed: "border-red-300 bg-red-100 text-red-950",
    pending: "border-slate-400 bg-slate-100 text-slate-950",
    skipped: "border-amber-300 bg-amber-100 text-amber-950",
    retryable: "border-orange-300 bg-orange-100 text-orange-950",
  };
  return (
    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-black ${classes[status]}`}>
      {httpStatus ? `HTTP ${httpStatus}` : status}
    </span>
  );
}

function MatchKeys({ row }: { row: SignalEventRow }) {
  const keys = [
    ["email hash", row.matchKeys.emailHash],
    ["phone hash", row.matchKeys.phoneHash],
    ["fbc", row.matchKeys.fbc],
    ["fbp", row.matchKeys.fbp],
    ["gclid", row.matchKeys.gclid],
    ["external_id", row.matchKeys.externalId],
    ["lead_id", row.matchKeys.leadId],
  ] as const;
  return (
    <div className="flex min-w-[220px] flex-wrap gap-1.5">
      {keys.map(([label, present]) => (
        <span key={label} className={`rounded-full border px-2 py-0.5 text-xs font-black ${present ? "border-emerald-300 bg-emerald-100 text-emerald-950" : "border-slate-300 bg-white text-slate-700"}`}>
          {label}
        </span>
      ))}
    </div>
  );
}

function sourceStateLabel(audit: SignalSourceAudit): string {
  const missing = Object.entries(audit).filter(([key, value]) => key !== "notes" && value === "missing").map(([key]) => key);
  const empty = Object.entries(audit).filter(([key, value]) => key !== "notes" && value === "empty").map(([key]) => key);
  if (missing.length === 0 && empty.length === 0) return "All configured signal sources returned rows.";
  return [...missing.map((m) => `${m} missing`), ...empty.map((e) => `${e} empty`)].join(" · ");
}

function withinDateRange(row: SignalEventRow, range: typeof DATE_RANGES[number]): boolean {
  if (range === "all") return true;
  const age = Date.now() - new Date(row.timestamp).getTime();
  const max = range === "24h" ? 24 * 3600_000 : range === "7d" ? 7 * 24 * 3600_000 : 30 * 24 * 3600_000;
  return age <= max;
}

function matchesEventType(row: SignalEventRow, selected: typeof EVENT_TYPES[number]): boolean {
  if (selected === "all") return true;
  if (selected === "Custom") return !["Lead", "Verified Lead", "Purchase", "Sold Closed"].includes(row.eventType);
  return row.eventType === selected;
}

export function SignalDispatchTab() {
  const [rows, setRows] = useState<SignalEventRow[]>([]);
  const [audit, setAudit] = useState<SignalSourceAudit | null>(null);
  const [selected, setSelected] = useState<SignalEventRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<typeof DATE_RANGES[number]>("7d");
  const [platform, setPlatform] = useState<typeof PLATFORMS[number]>("all");
  const [eventType, setEventType] = useState<typeof EVENT_TYPES[number]>("all");
  const [status, setStatus] = useState<typeof STATUSES[number]>("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [eventSearch, setEventSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchSignalDispatchRows();
      setRows(result.rows);
      setAudit(result.audit);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const leadQ = leadSearch.trim().toLowerCase();
    const eventQ = eventSearch.trim().toLowerCase();
    const campaignQ = campaignSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (!withinDateRange(row, dateRange)) return false;
      if (platform !== "all" && row.platform !== platform) return false;
      if (!matchesEventType(row, eventType)) return false;
      if (status !== "all" && row.status !== status) return false;
      if (leadQ && !(row.leadId ?? "").toLowerCase().includes(leadQ)) return false;
      if (eventQ && !`${row.eventId ?? ""} ${row.dedupKey ?? ""}`.toLowerCase().includes(eventQ)) return false;
      if (campaignQ && !(row.sourceCampaign ?? "").toLowerCase().includes(campaignQ)) return false;
      return true;
    });
  }, [campaignSearch, dateRange, eventSearch, eventType, leadSearch, platform, rows, status]);

  const kpis = useMemo(() => {
    const recent = rows.filter((row) => withinDateRange(row, "24h"));
    const successes = rows.filter((row) => row.status === "success");
    const dispatchable = rows.filter((row) => row.platform !== "Internal Lead Event");
    const dispatchSuccess = dispatchable.length ? Math.round((dispatchable.filter((row) => row.status === "success").length / dispatchable.length) * 100) : 0;
    const lastMeta = rows.find((row) => row.platform === "Meta CAPI" && row.status === "success");
    const lastGoogle = rows.find((row) => row.platform === "Google Ads" && row.status === "success");
    return {
      lastMeta: lastMeta ? format(new Date(lastMeta.timestamp), "MMM d, h:mm a") : "None",
      lastGoogle: lastGoogle ? format(new Date(lastGoogle.timestamp), "MMM d, h:mm a") : "No logs",
      failures24h: String(recent.filter((row) => row.status === "failed" || row.status === "retryable").length),
      pending: String(rows.filter((row) => row.status === "pending").length),
      successRate: dispatchable.length ? `${dispatchSuccess}%` : "N/A",
      purchaseSold: String(successes.filter((row) => row.eventType === "Purchase" || row.eventType === "Sold Closed").length),
      leadEvents: String(rows.filter((row) => row.eventType === "Lead" || row.eventType === "Verified Lead").length),
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-slate-950">Signal Dispatch</h2>
          <p className="mt-1 text-sm font-semibold text-slate-700">Server-side delivery monitor for Meta CAPI, Google/GTM readiness, CRM webhooks, and lead-event audit records.</p>
        </div>
        <Button variant="outline" onClick={load} disabled={isLoading} className="gap-2 border-slate-400 bg-white text-slate-950">
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <KpiCard label="Last Meta Success" value={kpis.lastMeta} />
        <KpiCard label="Last Google Success" value={kpis.lastGoogle} />
        <KpiCard label="Failures Last 24h" value={kpis.failures24h} />
        <KpiCard label="Pending / Queued" value={kpis.pending} />
        <KpiCard label="Dispatch Success Rate" value={kpis.successRate} />
        <KpiCard label="Purchase/Sold Events Sent" value={kpis.purchaseSold} help="Sent only when a lead is marked sold_closed with a final value." />
        <KpiCard label="Lead Events Sent" value={kpis.leadEvents} help="Top-of-funnel event. Should not be confused with phone verification unless explicitly mapped." />
      </div>

      {audit && (
        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-slate-800" />
            <div>
              <div className="text-sm font-black text-slate-950">Source audit</div>
              <div className="mt-1 text-sm font-semibold text-slate-700">{sourceStateLabel(audit)}</div>
              {audit.notes.length > 0 && <div className="mt-2 text-sm font-semibold text-slate-700">{audit.notes.join(" ")}</div>}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-bold text-red-950 shadow-sm">
          <AlertTriangle className="mr-2 inline h-4 w-4" /> Failed to load signal rows: {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Select value={dateRange} onValueChange={(value) => setDateRange(value as typeof DATE_RANGES[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Date range" /></SelectTrigger>
            <SelectContent>{DATE_RANGES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All time" : value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={platform} onValueChange={(value) => setPlatform(value as typeof PLATFORMS[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Platform" /></SelectTrigger>
            <SelectContent>{PLATFORMS.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All platforms" : value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={eventType} onValueChange={(value) => setEventType(value as typeof EVENT_TYPES[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Event type" /></SelectTrigger>
            <SelectContent>{EVENT_TYPES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All event types" : value}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value as typeof STATUSES[number])}>
            <SelectTrigger className="border-slate-300 text-slate-950"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : value}</SelectItem>)}</SelectContent>
          </Select>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" /><Input value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} placeholder="Lead ID" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" /></div>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" /><Input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="Event ID" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" /></div>
          <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-700" /><Input value={campaignSearch} onChange={(e) => setCampaignSearch(e.target.value)} placeholder="Campaign/source" className="border-slate-300 pl-9 text-slate-950 placeholder:text-slate-700" /></div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
        {rows.length === 0 && !isLoading ? (
          <div className="p-8 text-center">
            <div className="text-xl font-black text-slate-950">No dispatch logs found</div>
            <div className="mt-2 text-sm font-semibold text-slate-700">Available signal tables are missing or empty. No fake dispatch values are shown.</div>
          </div>
        ) : (
          <div className="wm-slim-scrollbar overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="border-b border-slate-300 bg-slate-50 text-left text-xs font-black uppercase text-slate-800">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Platform</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">Lead</th>
                  <th className="px-4 py-3">Source/Campaign</th>
                  <th className="px-4 py-3">Event ID <HelpTip>Used for deduplication between browser/server/platform events.</HelpTip></th>
                  <th className="px-4 py-3">Match Keys <HelpTip>Presence of hashed identifiers and click/browser IDs used for platform match quality.</HelpTip></th>
                  <th className="px-4 py-3">HTTP Status</th>
                  <th className="px-4 py-3">Result</th>
                  <th className="px-4 py-3">Retry Status</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-bold text-slate-900">{format(new Date(row.timestamp), "MMM d, h:mm a")}</td>
                    <td className="px-4 py-3 font-black text-slate-950">{row.platform}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.eventType}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{maskId(row.leadId)}</td>
                    <td className="max-w-[180px] px-4 py-3 font-semibold text-slate-700">{row.sourceCampaign ?? "—"}</td>
                    <td className="px-4 py-3 font-mono text-sm font-bold text-slate-900">{maskId(row.eventId ?? row.dedupKey)}</td>
                    <td className="px-4 py-3"><MatchKeys row={row} /></td>
                    <td className="px-4 py-3"><StatusBadge status={row.status} httpStatus={row.httpStatus} /></td>
                    <td className="px-4 py-3 font-bold text-slate-900">{row.errorMessage ?? row.responseCode ?? row.status}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{row.retryStatus}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelected(row)} className="border-slate-400 bg-white text-slate-950">Open Detail</Button>
                        {row.leadId ? <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/leads/${row.leadId}`}>View Lead</Link></Button> : null}
                        <Button asChild size="sm" variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution${row.leadId ? `?lead_id=${row.leadId}` : ""}`}>View Attribution</Link></Button>
                        <Tooltip>
                          <TooltipTrigger asChild><Button size="sm" variant="outline" disabled className="border-slate-300 bg-white text-slate-700">Retry unavailable</Button></TooltipTrigger>
                          <TooltipContent className="border border-slate-300 bg-white text-sm font-semibold text-slate-900">No read-safe retry action exists for this page. Existing queue retries remain backend-controlled.</TooltipContent>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <SignalDetailDrawer row={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function DetailField({ label, value, mono = false }: { label: string; value: string | number | null | undefined; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="text-xs font-black uppercase text-slate-700">{label}</div>
      <div className={`mt-1 break-all text-sm font-bold text-slate-950 ${mono ? "font-mono" : ""}`}>{value ?? "—"}</div>
    </div>
  );
}

function SignalDetailDrawer({ row, onClose }: { row: SignalEventRow | null; onClose: () => void }) {
  return (
    <Sheet open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto bg-white sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="text-2xl font-black text-slate-950">Signal event detail</SheetTitle>
          <SheetDescription className="font-semibold text-slate-700">Raw PII, tokens, and full payloads are intentionally hidden.</SheetDescription>
        </SheetHeader>
        {row && (
          <div className="mt-5 space-y-6">
            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Event Summary</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Timestamp" value={format(new Date(row.timestamp), "PPpp")} />
                <DetailField label="Platform" value={row.platform} />
                <DetailField label="Event type" value={row.eventType} />
                <DetailField label="Lead ID" value={row.leadId} mono />
                <DetailField label="Event ID" value={row.eventId} mono />
                <DetailField label="Dedup key" value={row.dedupKey} mono />
                <DetailField label="Status" value={row.status} />
                <DetailField label="HTTP status" value={row.httpStatus} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase text-slate-800">Match Quality Inputs <HelpTip>Presence of hashed identifiers and click/browser IDs used for platform match quality.</HelpTip></h3>
              <MatchKeys row={row} />
            </section>

            <section className="space-y-3">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase text-slate-800">Payload Fingerprint <HelpTip>Fingerprint proving which payload was sent without exposing raw PII.</HelpTip></h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <DetailField label="Payload hash" value={row.payloadHash} mono />
                <DetailField label="Payload version" value={row.payloadVersion} />
                <DetailField label="Payload size" value={row.payloadSize == null ? null : `${row.payloadSize} bytes`} />
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Platform Response</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="HTTP status" value={row.httpStatus} />
                <DetailField label="Response code" value={row.responseCode} />
                <DetailField label="Error message" value={row.errorMessage} />
                <DetailField label="Response excerpt" value={row.responseExcerpt} mono />
              </div>
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-700">
                HTTP 400 usually means rejected payload format or required fields. HTTP 401/403 usually means token, permission, or account access issue. HTTP 5xx usually means platform/server temporary failure and may be retryable.
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="text-sm font-black uppercase text-slate-800">Related Records</h3>
              <div className="flex flex-wrap gap-2">
                {row.leadId ? <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/leads/${row.leadId}`}>Admin lead dossier <ExternalLink className="ml-2 h-4 w-4" /></Link></Button> : null}
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to={`/admin/attribution${row.leadId ? `?lead_id=${row.leadId}` : ""}`}>Attribution page <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to="/admin/delivery-inspector">Delivery Inspector <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to="/admin/partners">Client Config <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
                <Button asChild variant="outline" className="border-slate-400 bg-white text-slate-950"><Link to="/admin/outcomes">Outcome detail <ExternalLink className="ml-2 h-4 w-4" /></Link></Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailField label="Source table" value={row.sourceTable} />
                <DetailField label="lead_events link id" value={row.related.leadEventId} mono />
                <DetailField label="webhook_deliveries link id" value={row.related.deliveryId} mono />
                <DetailField label="conversion/capi log id" value={row.related.conversionLogId} mono />
              </div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
