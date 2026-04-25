/**
 * @deprecated Phase 26 — Replaced by `MasterCommandCenter` + the canonical
 * `funnelMetrics` engine. Kept on disk for archaeology only; no longer
 * imported by `AdminDashboard.tsx`. Do not re-mount: it uses the legacy
 * `latest_analysis_id` proxy and will disagree with Mission Control.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, ShieldCheck, Ghost, ArrowDown, Target } from "lucide-react";
import { ConversionFunnel } from "./ConversionFunnel";
import type { CommandCenterKPIs, CRMLead } from "./types";

interface CommandCenterProps {
  kpis: CommandCenterKPIs;
  isLoading?: boolean;
  leads: CRMLead[];
}

export function CommandCenter({ kpis, isLoading, leads }: CommandCenterProps) {
  /* ── North Star KPI ──────────────────────────────────────────────── */
  const northStar = useMemo(() => {
    const verified = leads.filter((l) => l.phone_verified === true);
    const converted = leads.filter(
      (l) => l.deal_status === "appointment_booked" || l.deal_status === "won"
    );
    const rate =
      verified.length > 0
        ? ((converted.length / verified.length) * 100).toFixed(1) + "%"
        : "—";

    // 7-day trend
    const now = Date.now();
    const day7 = now - 7 * 24 * 60 * 60 * 1000;
    const day14 = now - 14 * 24 * 60 * 60 * 1000;

    const thisWeekVerified = verified.filter((l) => new Date(l.created_at).getTime() >= day7);
    const lastWeekVerified = verified.filter((l) => {
      const t = new Date(l.created_at).getTime();
      return t >= day14 && t < day7;
    });

    const calcRate = (arr: CRMLead[]) => {
      if (arr.length === 0) return 0;
      const conv = arr.filter(
        (l) => l.deal_status === "appointment_booked" || l.deal_status === "won"
      ).length;
      return (conv / arr.length) * 100;
    };

    const showTrend = thisWeekVerified.length >= 5 && lastWeekVerified.length >= 5;
    let trendDelta = 0;
    let trendUp = true;
    if (showTrend) {
      const thisRate = calcRate(thisWeekVerified);
      const lastRate = calcRate(lastWeekVerified);
      trendDelta = parseFloat((thisRate - lastRate).toFixed(1));
      trendUp = trendDelta >= 0;
    }

    return { rate, converted: converted.length, verified: verified.length, showTrend, trendDelta, trendUp };
  }, [leads]);

  const cards = [
    {
      title: "Total Scans",
      value: kpis.totalScans,
      icon: Activity,
      description: "Quotes analyzed by AI",
      accent: "text-primary",
    },
    {
      title: "Verified Leads",
      value: kpis.verifiedLeads,
      icon: ShieldCheck,
      description: "Passed OTP — hot & handed off",
      accent: "text-emerald-950",
    },
    {
      title: "Ghost Leads",
      value: kpis.ghostLeads,
      icon: Ghost,
      description: "Scanned but abandoned OTP",
      accent: "text-destructive",
    },
  ] as const;

  const funnelSteps = [
    { label: "Scans Completed", value: kpis.totalScans },
    { label: "Phone Verified", value: kpis.verifiedLeads },
    { label: "Webhooks Delivered", value: kpis.webhooksDelivered },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards — North Star hero + 3 standard */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* North Star — span 2 */}
        <Card className="relative overflow-hidden sm:col-span-2 border-l-4 border-l-[#C8952A]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-slate-700 uppercase tracking-widest">
              Lead → Appointment Rate
            </CardTitle>
            <Target className="h-5 w-5" style={{ color: "#C8952A" }} />
          </CardHeader>
          <CardContent>
            <div className={`text-5xl font-bold tracking-tight ${isLoading ? "animate-pulse text-slate-700" : ""}`}>
              {isLoading ? "—" : northStar.rate}
            </div>
            {!isLoading && northStar.showTrend && (
              <p className={`text-xs mt-1 ${northStar.trendUp ? "text-emerald-400" : "text-destructive"}`}>
                {northStar.trendUp ? "↑" : "↓"} {Math.abs(northStar.trendDelta)}% vs last 7d
              </p>
            )}
            <p className="text-xs text-slate-700 mt-1">
              {isLoading ? "" : `${northStar.converted} of ${northStar.verified} verified leads`}
            </p>
          </CardContent>
        </Card>

        {cards.map((card) => (
          <Card key={card.title} className="relative overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-700">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.accent}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold tracking-tight ${isLoading ? "animate-pulse text-slate-700" : ""}`}>
                {isLoading ? "—" : card.value.toLocaleString()}
              </div>
              <p className="text-xs text-slate-700 mt-1">{card.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Conversion Funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
            Conversion Funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ConversionFunnel leads={leads} />
        </CardContent>
      </Card>

      {/* Funnel Progress */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
            Funnel Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {funnelSteps.map((step, i) => {
              const conversionRate =
                i > 0 && funnelSteps[i - 1].value > 0
                  ? Math.round((step.value / funnelSteps[i - 1].value) * 100)
                  : null;
              return (
                <div key={step.label}>
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-1 pl-4">
                      <ArrowDown className="h-3 w-3 text-slate-700" />
                      {conversionRate !== null && (
                        <Badge variant="secondary" className="text-xs font-mono">
                          {conversionRate}%
                        </Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between rounded-md border px-4 py-2.5 bg-card">
                    <span className="text-sm font-medium">{step.label}</span>
                    <span className="text-lg font-bold font-mono tabular-nums">
                      {isLoading ? "—" : step.value.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Webhook Health Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-slate-700 uppercase tracking-wider">
            Webhook Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Pending", value: kpis.webhooksPending, variant: "secondary" as const },
              { label: "Delivered", value: kpis.webhooksDelivered, variant: "default" as const },
              { label: "Failed", value: kpis.webhooksFailed, variant: "destructive" as const },
              { label: "Dead Letter", value: kpis.webhooksDeadLetter, variant: "outline" as const },
            ].map((item) => (
              <div key={item.label} className="flex flex-col items-center gap-1 rounded-md border p-3">
                <Badge variant={item.variant} className="text-xs">
                  {item.label}
                </Badge>
                <span className="text-xl font-bold font-mono tabular-nums">
                  {isLoading ? "—" : item.value}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
