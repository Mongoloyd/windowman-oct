import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  BadgeCheck,
  BarChart3,
  CircleDollarSign,
  ExternalLink,
  HelpCircle,
  Info,
  LineChart,
  MousePointerClick,
  PhoneCall,
  ReceiptText,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import type { CRMLead } from "./types";

type AttributionRpcRow = {
  lead_id: string;
  attribution_id: string;
  lead_name: string | null;
  has_email: boolean;
  has_phone: boolean;
  source_platform: string | null;
  source_channel: string | null;
  source_detail: string | null;
  campaign_name: string | null;
  campaign_id: string | null;
  adset_name: string | null;
  adset_id: string | null;
  ad_name: string | null;
  ad_id: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  fbclid_present: boolean;
  gclid_present: boolean;
  fbc_present: boolean;
  fbp_present: boolean;
  phone_verified: boolean;
  final_disposition: string | null;
  final_value_cents: number | null;
  created_at: string;
};

type CampaignRow = {
  key: string;
  sourcePlatform: string;
  sourceChannel: string;
  campaignName: string;
  campaignId: string | null;
  adsetName: string;
  adsetId: string | null;
  adName: string;
  adId: string | null;
  leads: number;
  verified: number;
  sold: number;
  revenueCents: number;
  fbclidCount: number;
  gclidCount: number;
  fbcCount: number;
  fbpCount: number;
  platformLeadCount: number;
  rows: AttributionRpcRow[];
};

interface AttributionTabProps {
  leads: CRMLead[];
  isLoading: boolean;
}

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function fmtMoneyFromCents(cents: number | null | undefined): string {
  if (!cents) return "$0";
  return money.format(cents / 100);
}

function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

function display(value: string | null | undefined, fallback = "Untracked"): string {
  return value?.trim() || fallback;
}

function compactId(value: string | null | undefined): string {
  if (!value) return "—";
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function HelpTip({ children }: { children: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-slate-700 hover:text-slate-950 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20 focus-visible:ring-offset-2" aria-label="Metric explanation">
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs border border-slate-300 bg-white text-sm font-semibold text-slate-900 shadow-lg">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}

function HealthBadge({ tone, children, title }: { tone: "blue" | "emerald" | "amber" | "red" | "slate"; children: string; title?: string }) {
  const classes = {
    blue: "bg-blue-100 text-blue-950 border-blue-300",
    emerald: "bg-emerald-100 text-emerald-950 border-emerald-300",
    amber: "bg-amber-100 text-amber-950 border-amber-300",
    red: "bg-red-100 text-red-950 border-red-300",
    slate: "bg-slate-100 text-slate-950 border-slate-400",
  }[tone];

  return (
    <span title={title} className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-black ${classes}`}>
      {children}
    </span>
  );
}

function KpiCard({ label, value, help, icon: Icon }: { label: string; value: string; help?: string; icon: typeof BarChart3 }) {
  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <span>{label}</span>
            {help ? <HelpTip>{help}</HelpTip> : null}
          </div>
          <div className="text-3xl font-black text-slate-950">{value}</div>
        </div>
        <div className="rounded-xl border border-slate-300 bg-slate-50 p-2 text-slate-800">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function buildCampaignRows(rows: AttributionRpcRow[]): CampaignRow[] {
  const map = new Map<string, CampaignRow>();

  for (const row of rows) {
    const sourcePlatform = display(row.source_platform, "unknown");
    const sourceChannel = display(row.source_channel, "unknown");
    const campaignName = display(row.campaign_name ?? row.utm_campaign, "Untracked campaign");
    const adsetName = display(row.adset_name ?? row.utm_term, "No ad set / term");
    const adName = display(row.ad_name ?? row.utm_content, "No ad / content");
    const key = [sourcePlatform, sourceChannel, row.campaign_id ?? campaignName, row.adset_id ?? adsetName, row.ad_id ?? adName].join("||");
    const current = map.get(key) ?? {
      key,
      sourcePlatform,
      sourceChannel,
      campaignName,
      campaignId: row.campaign_id,
      adsetName,
      adsetId: row.adset_id,
      adName,
      adId: row.ad_id,
      leads: 0,
      verified: 0,
      sold: 0,
      revenueCents: 0,
      fbclidCount: 0,
      gclidCount: 0,
      fbcCount: 0,
      fbpCount: 0,
      platformLeadCount: 0,
      rows: [],
    };

    current.leads += 1;
    if (row.phone_verified) current.verified += 1;
    if (row.final_disposition === "sold_closed") current.sold += 1;
    current.revenueCents += row.final_value_cents ?? 0;
    if (row.fbclid_present) current.fbclidCount += 1;
    if (row.gclid_present) current.gclidCount += 1;
    if (row.fbc_present) current.fbcCount += 1;
    if (row.fbp_present) current.fbpCount += 1;
    if (row.source_platform === "facebook" && row.source_channel === "lead_ads") current.platformLeadCount += 1;
    current.rows.push(row);
    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.revenueCents - a.revenueCents || b.verified - a.verified || b.leads - a.leads);
}

function AttributionHealth({ row }: { row: CampaignRow }) {
  const hasClickContext = row.fbclidCount + row.gclidCount + row.fbcCount + row.fbpCount > 0;
  return (
    <div className="flex flex-wrap gap-1.5">
      {row.sourcePlatform === "facebook" && row.sourceChannel === "lead_ads" ? (
        <HealthBadge tone="blue" title="Lead came from Facebook Lead Ads import, not a website visit. It may not have fbclid/gclid.">imported lead ad</HealthBadge>
      ) : (
        <HealthBadge tone="slate" title="Lead came through the website attribution spine.">website lead</HealthBadge>
      )}
      {row.fbclidCount > 0 ? <HealthBadge tone="emerald" title="Facebook click ID present.">fbclid</HealthBadge> : null}
      {row.fbcCount + row.fbpCount > 0 ? <HealthBadge tone="emerald" title="Meta browser/click cookies present for match quality.">fbc/fbp</HealthBadge> : null}
      {row.gclidCount > 0 ? <HealthBadge tone="emerald" title="Google click ID present.">gclid</HealthBadge> : null}
      {!hasClickContext ? <HealthBadge tone="amber" title="No fbclid/gclid/fbc/fbp values were present.">missing click context</HealthBadge> : null}
    </div>
  );
}

export function AttributionTab({ leads, isLoading }: AttributionTabProps) {
  const [rows, setRows] = useState<AttributionRpcRow[]>([]);
  const [isRpcLoading, setIsRpcLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);
  const [selectedLead, setSelectedLead] = useState<AttributionRpcRow | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadAttribution() {
      setIsRpcLoading(true);
      setError(null);
      const { data, error: rpcError } = await supabase.rpc("get_admin_attribution_spine", { p_limit: 1000 });
      if (cancelled) return;
      if (rpcError) {
        setRows([]);
        setError(rpcError.message || "Attribution spine not connected.");
      } else {
        setRows(((data ?? []) as AttributionRpcRow[]).filter(Boolean));
      }
      setIsRpcLoading(false);
    }

    loadAttribution();
    return () => {
      cancelled = true;
    };
  }, []);

  const campaignRows = useMemo(() => buildCampaignRows(rows), [rows]);
  const totalLeads = rows.length;
  const verifiedLeads = rows.filter((r) => r.phone_verified).length;
  const soldLeads = rows.filter((r) => r.final_disposition === "sold_closed").length;
  const managedRevenue = rows.reduce((sum, r) => sum + (r.final_value_cents ?? 0), 0);
  const scannedLeads = leads.filter((l) => l.latest_analysis_id).length;
  const hasOutcomes = rows.some((r) => r.final_disposition || (r.final_value_cents ?? 0) > 0);
  const loading = isLoading || isRpcLoading;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl border border-slate-300 bg-white shadow-sm" />)}
        </div>
        <div className="h-80 animate-pulse rounded-2xl border border-slate-300 bg-white shadow-sm" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-1 h-6 w-6 text-amber-900" />
          <div className="space-y-2">
            <h2 className="text-xl font-black text-slate-950">Attribution spine not connected yet</h2>
            <p className="max-w-3xl text-base font-semibold text-slate-800">
              Website TruthGate UTM capture exists, but imported Facebook Lead Ads require lead_attribution_details before campaign ROI can be complete.
            </p>
            <p className="text-sm font-bold text-slate-700">Read error: {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <KpiCard label="Total Leads" value={totalLeads.toLocaleString()} icon={BarChart3} />
        <KpiCard label="Verified Leads" value={verifiedLeads.toLocaleString()} icon={ShieldCheck} help="A lead that completed the phone verification gate." />
        <KpiCard label="Verified Rate" value={pct(verifiedLeads, totalLeads)} icon={BadgeCheck} help="Verified leads divided by total attributed leads." />
        <KpiCard label="Sold / Closed" value={soldLeads.toLocaleString()} icon={Target} help="A contractor outcome marked sold_closed with required final value." />
        <KpiCard label="Managed Revenue" value={fmtMoneyFromCents(managedRevenue)} icon={CircleDollarSign} />
        <KpiCard label="CPA Verified" value="Spend not connected" icon={ReceiptText} help="Ad spend divided by verified leads. Shows only when spend is available." />
        <KpiCard label="CPA Sold" value="Spend not connected" icon={ReceiptText} help="Ad spend divided by sold_closed leads. Shows only when spend is available." />
        <KpiCard label="ROAS" value="Spend not connected" icon={LineChart} help="Managed revenue divided by ad spend. Shows only when spend is available." />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm lg:col-span-2">
          <div className="flex items-start gap-3">
            <Info className="mt-1 h-5 w-5 text-slate-800" />
            <div>
              <h3 className="text-base font-black text-slate-950">Ad spend not connected</h3>
              <p className="text-sm font-bold text-slate-700">CPA and ROAS will appear after spend import/API integration. No fake CPA or ROAS values are shown.</p>
            </div>
          </div>
        </div>
        {!hasOutcomes ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Outcome data not available</h3>
            <p className="text-sm font-bold text-slate-800">Sold and revenue metrics require partner disposition updates.</p>
          </div>
        ) : (
          <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm">
            <h3 className="text-base font-black text-slate-950">Outcome data connected</h3>
            <p className="text-sm font-bold text-slate-800">Sold and managed revenue are sourced from contractor outcomes.</p>
          </div>
        )}
      </div>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-300 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Campaign Performance</h2>
            <p className="text-sm font-bold text-slate-700">Grouped by source, channel, campaign, ad set, and ad.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <MousePointerClick className="h-4 w-4" />
            Click a row for campaign detail
          </div>
        </div>
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1180px] text-sm">
            <thead className="bg-slate-50 text-left text-sm font-black text-slate-800">
              <tr className="border-b border-slate-300">
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Ad Set</th>
                <th className="px-4 py-3">Ad</th>
                <th className="px-4 py-3 text-right">Leads</th>
                <th className="px-4 py-3 text-right">Verified</th>
                <th className="px-4 py-3 text-right">Verified Rate</th>
                <th className="px-4 py-3 text-right">Sold Closed</th>
                <th className="px-4 py-3 text-right">Revenue</th>
                <th className="px-4 py-3">Spend</th>
                <th className="px-4 py-3">CPA / ROAS</th>
                <th className="px-4 py-3">Attribution Health <HelpTip>Presence of fbclid/gclid/fbc/fbp used for attribution and server-side match quality.</HelpTip></th>
              </tr>
            </thead>
            <tbody>
              {campaignRows.map((row) => (
                <tr key={row.key} className="cursor-pointer border-b border-slate-200 hover:bg-slate-50" onClick={() => setSelectedCampaign(row)}>
                  <td className="px-4 py-4"><HealthBadge tone={row.sourcePlatform === "facebook" ? "blue" : "slate"}>{`${row.sourcePlatform} · ${row.sourceChannel}`}</HealthBadge></td>
                  <td className="px-4 py-4 font-black text-slate-950"><div>{row.campaignName}</div><div className="text-xs font-bold text-slate-700">{compactId(row.campaignId)}</div></td>
                  <td className="px-4 py-4 font-bold text-slate-800"><div>{row.adsetName}</div><div className="text-xs font-bold text-slate-700">{compactId(row.adsetId)}</div></td>
                  <td className="px-4 py-4 font-bold text-slate-800"><div>{row.adName}</div><div className="text-xs font-bold text-slate-700">{compactId(row.adId)}</div></td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{row.leads}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{row.verified}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{pct(row.verified, row.leads)}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{row.sold}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{fmtMoneyFromCents(row.revenueCents)}</td>
                  <td className="px-4 py-4"><HealthBadge tone="amber">Spend not connected</HealthBadge></td>
                  <td className="px-4 py-4"><HealthBadge tone="amber">Pending spend</HealthBadge></td>
                  <td className="px-4 py-4"><AttributionHealth row={row} /></td>
                </tr>
              ))}
              {campaignRows.length === 0 ? (
                <tr><td colSpan={12} className="px-4 py-10 text-center text-base font-bold text-slate-700">No attribution records yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-300 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-300 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-950">Lead Attribution</h2>
            <p className="text-sm font-bold text-slate-700">Lead-level attribution spine with masked click-context indicators.</p>
          </div>
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Search className="h-4 w-4" />
            {scannedLeads} leads have scans in current admin cache
          </div>
        </div>
        <div className="wm-slim-scrollbar overflow-x-auto">
          <table className="w-full min-w-[1120px] text-sm">
            <thead className="bg-slate-50 text-left text-sm font-black text-slate-800">
              <tr className="border-b border-slate-300">
                <th className="px-4 py-3">Lead</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Campaign</th>
                <th className="px-4 py-3">Ad Set / Term</th>
                <th className="px-4 py-3">Ad / Content</th>
                <th className="px-4 py-3">Click IDs</th>
                <th className="px-4 py-3">Phone Verified <HelpTip>A lead that completed the phone verification gate.</HelpTip></th>
                <th className="px-4 py-3">Final Disposition</th>
                <th className="px-4 py-3 text-right">Final Value</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.attribution_id} className="border-b border-slate-200 hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-slate-950">{display(row.lead_name, "Unnamed lead")}</td>
                  <td className="px-4 py-4"><HealthBadge tone={row.source_platform === "facebook" ? "blue" : "slate"}>{`${display(row.source_platform)} · ${display(row.source_channel)}`}</HealthBadge></td>
                  <td className="px-4 py-4 font-bold text-slate-800">{display(row.campaign_name ?? row.utm_campaign)}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{display(row.adset_name ?? row.utm_term, "—")}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{display(row.ad_name ?? row.utm_content, "—")}</td>
                  <td className="px-4 py-4"><div className="flex flex-wrap gap-1.5">{row.fbclid_present ? <HealthBadge tone="emerald">fbclid</HealthBadge> : null}{row.gclid_present ? <HealthBadge tone="emerald">gclid</HealthBadge> : null}{row.fbc_present ? <HealthBadge tone="emerald">fbc</HealthBadge> : null}{row.fbp_present ? <HealthBadge tone="emerald">fbp</HealthBadge> : null}{!(row.fbclid_present || row.gclid_present || row.fbc_present || row.fbp_present) ? <HealthBadge tone="amber">none</HealthBadge> : null}</div></td>
                  <td className="px-4 py-4">{row.phone_verified ? <HealthBadge tone="emerald">verified</HealthBadge> : <HealthBadge tone="amber">not verified</HealthBadge>}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{display(row.final_disposition, "open / unknown")}</td>
                  <td className="px-4 py-4 text-right font-black text-slate-950">{fmtMoneyFromCents(row.final_value_cents)}</td>
                  <td className="px-4 py-4 font-bold text-slate-700">{new Date(row.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="min-h-9 border-slate-400 bg-white text-sm font-black text-slate-950">
                        <Link to={`/admin/leads/${row.lead_id}`}>Dossier <ExternalLink className="ml-1 h-3.5 w-3.5" /></Link>
                      </Button>
                      <Button asChild size="sm" variant="outline" className="min-h-9 border-slate-400 bg-white text-sm font-black text-slate-950">
                        <Link to={`/admin/signal-dispatch?lead_id=${row.lead_id}`}>Signals</Link>
                      </Button>
                      <Button size="sm" variant="outline" className="min-h-9 border-slate-400 bg-white text-sm font-black text-slate-950" onClick={() => setSelectedLead(row)}>Details</Button>
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr><td colSpan={11} className="px-4 py-10 text-center text-base font-bold text-slate-700">No lead attribution rows yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Sheet open={!!selectedCampaign} onOpenChange={(open) => !open && setSelectedCampaign(null)}>
        <SheetContent className="wm-dashboard-surface wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white text-slate-950 sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-slate-950">Campaign Detail</SheetTitle>
            <SheetDescription className="text-sm font-bold text-slate-700">Campaign quality, attribution identifiers, and top lead links.</SheetDescription>
          </SheetHeader>
          {selectedCampaign ? (
            <div className="mt-6 space-y-6">
              <div className="grid grid-cols-2 gap-3">
                <KpiCard label="Leads" value={selectedCampaign.leads.toString()} icon={BarChart3} />
                <KpiCard label="Verified" value={selectedCampaign.verified.toString()} icon={ShieldCheck} />
                <KpiCard label="Sold" value={selectedCampaign.sold.toString()} icon={Target} />
                <KpiCard label="Revenue" value={fmtMoneyFromCents(selectedCampaign.revenueCents)} icon={CircleDollarSign} />
              </div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <h3 className="text-lg font-black text-slate-950">Funnel quality</h3>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm font-bold text-slate-800">
                  <div>Captured: {selectedCampaign.leads}</div>
                  <div>Verified: {selectedCampaign.verified}</div>
                  <div>Scanned: {selectedCampaign.rows.filter((r) => leads.some((l) => l.id === r.lead_id && l.latest_analysis_id)).length}</div>
                  <div>Routed: {selectedCampaign.rows.filter((r) => leads.some((l) => l.id === r.lead_id && l.routed_to_contractor_at)).length}</div>
                  <div>Sold closed: {selectedCampaign.sold}</div>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <h3 className="text-lg font-black text-slate-950">Attribution identifiers</h3>
                <div className="mt-3 flex flex-wrap gap-2"><HealthBadge tone="blue">{`platform leads ${selectedCampaign.platformLeadCount}`}</HealthBadge><HealthBadge tone="emerald">{`fbclid ${selectedCampaign.fbclidCount}`}</HealthBadge><HealthBadge tone="emerald">{`gclid ${selectedCampaign.gclidCount}`}</HealthBadge><HealthBadge tone="emerald">{`fbc/fbp ${selectedCampaign.fbcCount + selectedCampaign.fbpCount}`}</HealthBadge></div>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4">
                <h3 className="text-lg font-black text-slate-950">Top leads</h3>
                <div className="mt-3 space-y-2">
                  {selectedCampaign.rows.slice(0, 10).map((row) => (
                    <Link key={row.attribution_id} to={`/admin/leads/${row.lead_id}`} className="flex items-center justify-between rounded-xl border border-slate-300 bg-slate-50 p-3 text-sm font-black text-slate-950 hover:bg-white">
                      <span>{display(row.lead_name, "Unnamed lead")}</span><span>{fmtMoneyFromCents(row.final_value_cents)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent className="wm-dashboard-surface wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white text-slate-950 sm:max-w-xl">
          <SheetHeader>
            <SheetTitle className="text-2xl font-black text-slate-950">Lead Attribution Detail</SheetTitle>
            <SheetDescription className="text-sm font-bold text-slate-700">Masked identifiers by default; use signal logs for event dispatch diagnostics.</SheetDescription>
          </SheetHeader>
          {selectedLead ? (
            <div className="mt-6 space-y-4 text-sm font-bold text-slate-800">
              <div className="rounded-2xl border border-slate-300 bg-white p-4"><div className="text-xs font-black uppercase text-slate-700">Lead ID</div><div className="mt-1 break-all text-base font-black text-slate-950">{selectedLead.lead_id}</div></div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-300 bg-white p-4"><div className="text-xs font-black uppercase text-slate-700">Source</div><div className="mt-1 text-base font-black text-slate-950">{display(selectedLead.source_platform)} · {display(selectedLead.source_channel)}</div></div>
                <div className="rounded-2xl border border-slate-300 bg-white p-4"><div className="text-xs font-black uppercase text-slate-700">Phone verified</div><div className="mt-2">{selectedLead.phone_verified ? <HealthBadge tone="emerald">verified</HealthBadge> : <HealthBadge tone="amber">not verified</HealthBadge>}</div></div>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4"><h3 className="text-lg font-black text-slate-950">Campaign metadata</h3><dl className="mt-3 grid grid-cols-1 gap-2"><div>Campaign: {display(selectedLead.campaign_name ?? selectedLead.utm_campaign)} ({compactId(selectedLead.campaign_id)})</div><div>Ad set / term: {display(selectedLead.adset_name ?? selectedLead.utm_term, "—")} ({compactId(selectedLead.adset_id)})</div><div>Ad / content: {display(selectedLead.ad_name ?? selectedLead.utm_content, "—")} ({compactId(selectedLead.ad_id)})</div></dl></div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4"><h3 className="text-lg font-black text-slate-950">Click ID presence</h3><div className="mt-3 flex flex-wrap gap-2">{selectedLead.fbclid_present ? <HealthBadge tone="emerald">fbclid present</HealthBadge> : <HealthBadge tone="slate">fbclid absent</HealthBadge>}{selectedLead.gclid_present ? <HealthBadge tone="emerald">gclid present</HealthBadge> : <HealthBadge tone="slate">gclid absent</HealthBadge>}{selectedLead.fbc_present ? <HealthBadge tone="emerald">fbc present</HealthBadge> : <HealthBadge tone="slate">fbc absent</HealthBadge>}{selectedLead.fbp_present ? <HealthBadge tone="emerald">fbp present</HealthBadge> : <HealthBadge tone="slate">fbp absent</HealthBadge>}</div></div>
              <div className="rounded-2xl border border-slate-300 bg-white p-4"><h3 className="text-lg font-black text-slate-950">Outcome</h3><div className="mt-2">Disposition: {display(selectedLead.final_disposition, "open / unknown")}</div><div>Final value: {fmtMoneyFromCents(selectedLead.final_value_cents)}</div></div>
              <div className="flex flex-wrap gap-2"><Button asChild className="min-h-10 bg-slate-950 text-sm font-black text-white hover:bg-slate-800"><Link to={`/admin/leads/${selectedLead.lead_id}`}>Open Lead Dossier</Link></Button><Button asChild variant="outline" className="min-h-10 border-slate-400 bg-white text-sm font-black text-slate-950"><Link to={`/admin/signal-dispatch?lead_id=${selectedLead.lead_id}`}>Related Signal Events</Link></Button></div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
