import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Globe, Megaphone, BarChart3 } from "lucide-react";
import type { CRMLead } from "./types";

interface AttributionTabProps {
  leads: CRMLead[];
  isLoading: boolean;
}

function mode(arr: (string | null)[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) {
    if (!v) continue;
    counts[v] = (counts[v] ?? 0) + 1;
  }
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (sorted.length === 0) return "None yet";
  const topCount = sorted[0][1];
  return sorted
    .filter(([, c]) => c === topCount)
    .map(([v]) => v)
    .join(" / ");
}

interface AttributionRow {
  source: string;
  campaign: string;
  leads: number;
  verified: number;
  intros: number;
}

const SOURCE_COLORS: Record<string, string> = {
  facebook: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  google: "bg-green-500/20 text-green-400 border-green-500/30",
  organic: "bg-muted text-slate-700 border-border",
};

function pctStr(part: number, whole: number): string {
  if (whole === 0) return "0 (0%)";
  const pct = Math.min(100, Math.round((part / whole) * 100));
  return `${part} (${pct}%)`;
}

export function AttributionTab({ leads, isLoading }: AttributionTabProps) {
  const [page, setPage] = useState(0);

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-muted rounded h-10 w-full" />
        ))}
      </div>
    );
  }

  const hasAttribution = leads.some((l) => l.utm_source || l.utm_campaign);
  if (leads.length === 0 || !hasAttribution) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-slate-700">
        <BarChart3 className="w-10 h-10 opacity-40" />
        <p className="text-sm font-medium">No UTM attribution data yet.</p>
        <p className="text-xs max-w-sm text-center">
          Drive traffic through tracked links to see campaign performance here.
        </p>
      </div>
    );
  }

  const attributed = leads.filter((l) => l.utm_source || l.utm_medium || l.utm_campaign);
  const topSource = mode(leads.map((l) => l.utm_source));
  const topCampaign = mode(leads.map((l) => l.utm_campaign));

  // Build rows
  const rowMap = new Map<string, AttributionRow>();
  for (const lead of leads) {
    const source = lead.utm_source ?? "Direct";
    const campaign = lead.utm_campaign ?? "Unknown";
    const key = `${source}||${campaign}`;
    const existing = rowMap.get(key) ?? { source, campaign, leads: 0, verified: 0, intros: 0 };
    existing.leads++;
    if (lead.phone_verified) existing.verified++;
    if (lead.intro_requested_at) existing.intros++;
    rowMap.set(key, existing);
  }

  const rows = Array.from(rowMap.values()).sort((a, b) => b.leads - a.leads);
  const totalPages = Math.ceil(rows.length / 20);
  const pageRows = rows.slice(page * 20, (page + 1) * 20);

  const summaryCards = [
    { title: "Attributed Leads", value: attributed.length.toString(), icon: TrendingUp },
    { title: "Top Source", value: topSource, icon: Globe },
    { title: "Top Campaign", value: topCampaign, icon: Megaphone },
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">{c.title}</CardTitle>
              <c.icon className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight truncate">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Attribution Table */}
      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50 text-xs uppercase tracking-wide text-slate-700">
              <th className="px-4 py-3 text-left">Source</th>
              <th className="px-4 py-3 text-left">Campaign</th>
              <th className="px-4 py-3 text-right">Leads</th>
              <th className="px-4 py-3 text-right">Verified</th>
              <th className="px-4 py-3 text-right">Intro Requested</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const srcKey = row.source.toLowerCase();
              const badgeCls =
                SOURCE_COLORS[srcKey] ?? "bg-secondary text-secondary-foreground border-border";
              return (
                <tr key={`${row.source}||${row.campaign}`} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded border ${badgeCls}`}>
                      {row.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[240px] truncate">
                    {row.campaign}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">{row.leads}</td>
                  <td className="px-4 py-3 text-right">{pctStr(row.verified, row.leads)}</td>
                  <td className="px-4 py-3 text-right">{pctStr(row.intros, row.leads)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Prev
          </Button>
          <span className="text-xs text-slate-700">
            Page {page + 1} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
