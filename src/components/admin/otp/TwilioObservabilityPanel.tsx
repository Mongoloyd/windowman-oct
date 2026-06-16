/**
 * TWILIO-OBS-05 — Admin OTP Observability panel (read-only).
 * All data via admin-data get_otp_observability. No resend, unlock, or SMS actions.
 */

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  RefreshCw,
  Shield,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchOtpObservability,
  getErrorMessage,
  type OtpObservabilityReadModel,
} from "@/services/adminDataService";

const WINDOW_OPTIONS = [
  { label: "1 hour", minutes: 60 },
  { label: "24 hours", minutes: 1440 },
  { label: "7 days", minutes: 10080 },
] as const;

function healthTone(score: number): string {
  if (score >= 75) return "text-emerald-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function priorityBadge(priority: string) {
  if (priority === "high") {
    return <Badge className="bg-red-100 text-red-950 border-red-300">High</Badge>;
  }
  if (priority === "medium") {
    return <Badge className="bg-amber-100 text-amber-950 border-amber-300">Medium</Badge>;
  }
  return <Badge variant="outline">Low</Badge>;
}

function severityBadge(severity: string) {
  if (severity === "critical") {
    return <Badge className="bg-red-100 text-red-950 border-red-300">Critical</Badge>;
  }
  if (severity === "warning") {
    return <Badge className="bg-amber-100 text-amber-950 border-amber-300">Warning</Badge>;
  }
  return <Badge variant="outline">Info</Badge>;
}

function FunnelStep({
  label,
  count,
  rate,
}: {
  label: string;
  count: number;
  rate?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-slate-300 bg-white px-4 py-3 min-w-[100px]">
      <span className="text-2xl font-black text-slate-950">{count}</span>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-600 text-center">
        {label}
      </span>
      {rate != null && (
        <span className="text-xs font-semibold text-slate-500">{rate}</span>
      )}
    </div>
  );
}

export function TwilioObservabilityPanel() {
  const [windowMinutes, setWindowMinutes] = useState(1440);
  const [data, setData] = useState<OtpObservabilityReadModel | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fetchOtpObservability({ windowMinutes, limit: 100 });
      setData(result);
      setLastSyncedAt(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    load();
  }, [load]);

  const health = data?.health;
  const isEmpty = !isLoading && !error && (data?.recentEvents.length ?? 0) === 0;

  return (
    <div className="space-y-6 px-2 sm:px-6 pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              OTP Ops
            </h2>
            <Badge variant="outline" className="text-xs font-bold">
              Read-only
            </Badge>
          </div>
          <p className="mt-1 text-sm font-semibold text-slate-700">
            Twilio OTP funnel health, friction signals, and stuck-lead queue.
            {lastSyncedAt && (
              <span className="ml-1 text-slate-500">
                Updated {formatDistanceToNow(lastSyncedAt, { addSuffix: true })}.
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={String(windowMinutes)}
            onValueChange={(v) => setWindowMinutes(Number(v))}
          >
            <SelectTrigger className="w-[140px] border-slate-400 font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOW_OPTIONS.map((o) => (
                <SelectItem key={o.minutes} value={String(o.minutes)}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={isLoading}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-destructive">Failed to load OTP observability</p>
              <p className="text-sm text-slate-700 mt-1 break-all">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && !data && (
        <Card className="wm-admin-panel">
          <CardContent className="py-12 text-center text-slate-600 font-semibold">
            Loading OTP observability…
          </CardContent>
        </Card>
      )}

      {isEmpty && (
        <Card className="wm-admin-panel border-dashed">
          <CardContent className="py-12 text-center">
            <p className="font-bold text-slate-800">No OTP events in this window</p>
            <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
              Events appear after homeowners interact with the SMS gate. Confirm
              send-otp/verify-otp instrumentation is deployed.
            </p>
          </CardContent>
        </Card>
      )}

      {health && (
        <>
          {/* OTP Health Score */}
          <Card className="wm-admin-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">OTP Health Score</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-end gap-6">
                <div>
                  <span className={`text-5xl font-black ${healthTone(health.otpHealthScore)}`}>
                    {health.otpHealthScore}
                  </span>
                  <span className="text-lg font-bold text-slate-500">/100</span>
                </div>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-slate-500 font-semibold">Send acceptance</span>
                    <p className="font-black text-slate-950">{health.sendAcceptanceRate}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Verify approval</span>
                    <p className="font-black text-slate-950">{health.verifyApprovalRate}%</p>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold">Send → verify</span>
                    <p className="font-black text-slate-950">{health.sendToVerifyRate}%</p>
                  </div>
                  {health.qaBypassCount > 0 && (
                    <div>
                      <span className="text-slate-500 font-semibold">QA bypass</span>
                      <p className="font-black text-amber-700">{health.qaBypassCount}</p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Send → Verify Funnel */}
          <Card className="wm-admin-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Send → Verify Funnel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3 items-center overflow-x-auto pb-2">
                <FunnelStep label="Send requested" count={health.sendRequested} />
                <span className="text-slate-400">→</span>
                <FunnelStep
                  label="Send accepted"
                  count={health.sendAccepted}
                  rate={`${health.sendAcceptanceRate}%`}
                />
                <span className="text-slate-400">→</span>
                <FunnelStep
                  label="Verify submitted"
                  count={health.verifySubmitted}
                  rate={`${health.sendToVerifyRate}%`}
                />
                <span className="text-slate-400">→</span>
                <FunnelStep
                  label="Verify approved"
                  count={health.verifyApproved}
                  rate={`${health.verifyApprovalRate}%`}
                />
              </div>
              <div className="mt-3 flex gap-4 text-xs font-semibold text-slate-600">
                <span>Failed sends: {health.sendFailed}</span>
                <span>Rate limited: {health.rateLimited}</span>
                <span>Verify failed: {health.verifyFailed}</span>
              </div>
            </CardContent>
          </Card>

          {/* Ops Recommendations */}
          {(data?.recommendations.length ?? 0) > 0 && (
            <Card className="wm-admin-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black">Ops Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data!.recommendations.map((rec, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-300 bg-slate-50 p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {severityBadge(rec.severity)}
                      <span className="font-bold text-slate-950">{rec.title}</span>
                    </div>
                    <p className="text-sm text-slate-700">{rec.reason}</p>
                    <p className="text-sm font-semibold text-slate-800 mt-2">
                      → {rec.suggestedAction}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Failure Buckets */}
          <Card className="wm-admin-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Failure Buckets</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.failureBuckets.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-600 font-semibold">No failures in window.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead className="text-right">Count</TableHead>
                      <TableHead className="text-right">% of failures</TableHead>
                      <TableHead>Twilio codes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.failureBuckets.map((b) => (
                      <TableRow key={b.bucketKey}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-xs">
                            {b.category}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold">{b.label}</TableCell>
                        <TableCell className="text-right font-mono">{b.count}</TableCell>
                        <TableCell className="text-right">{b.pctOfFailures}%</TableCell>
                        <TableCell className="font-mono text-xs">
                          {b.topTwilioCodes.join(", ") || "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Stuck High-Intent Leads */}
          <Card className="wm-admin-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Stuck High-Intent Leads</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.stuckSessions.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-600 font-semibold">
                  No stuck sessions detected in this window.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Stuck</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Lead</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.stuckSessions.map((s) => (
                      <TableRow key={`${s.leadId}-${s.scanSessionId}`}>
                        <TableCell>{priorityBadge(s.followUpPriority)}</TableCell>
                        <TableCell className="font-black">{s.grade ?? "—"}</TableCell>
                        <TableCell className="text-sm">{s.minutesStuck}m</TableCell>
                        <TableCell className="text-xs font-mono">{s.stuckReason}</TableCell>
                        <TableCell className="font-mono text-sm">{s.phoneMasked}</TableCell>
                        <TableCell className="text-xs">
                          {s.utmCampaign ?? s.utmSource ?? s.clientSlug ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="link" size="sm" className="h-auto p-0">
                            <Link to={`/admin/leads/${s.leadId}`}>Dossier</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Source / Campaign Quality */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="wm-admin-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <TrendingDown className="h-4 w-4" />
                  Source Friction
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.sourceBreakdown.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-600">No source data.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Source</TableHead>
                        <TableHead className="text-right">Send→Verify</TableHead>
                        <TableHead className="text-right">Friction</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.sourceBreakdown.slice(0, 10).map((s) => (
                        <TableRow key={`${s.dimension}-${s.value}`}>
                          <TableCell className="text-xs">
                            <span className="font-mono text-slate-500">{s.dimension}</span>
                            <br />
                            <span className="font-semibold">{s.value}</span>
                          </TableCell>
                          <TableCell className="text-right">{s.sendToVerifyRate}%</TableCell>
                          <TableCell className="text-right font-bold text-amber-700">
                            {s.frictionScore}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card className="wm-admin-panel">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-black flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Campaign Quality
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(data?.campaignBreakdown.length ?? 0) === 0 ? (
                  <p className="text-sm text-slate-600">No campaign data.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Campaign</TableHead>
                        <TableHead className="text-right">Scans</TableHead>
                        <TableHead className="text-right">Verified</TableHead>
                        <TableHead className="text-right">Curiosity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data!.campaignBreakdown.slice(0, 10).map((c) => (
                        <TableRow key={c.utmCampaign}>
                          <TableCell className="text-xs font-semibold">{c.utmCampaign}</TableCell>
                          <TableCell className="text-right">{c.scans}</TableCell>
                          <TableCell className="text-right">{c.verifyApproved}</TableCell>
                          <TableCell className="text-right">
                            {c.scans >= 10 ? c.curiosityScore : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Timeline */}
          <Card className="wm-admin-panel">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-black">Recent OTP Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {(data?.recentEvents.length ?? 0) === 0 ? (
                <p className="text-sm text-slate-600">No events.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Campaign</TableHead>
                      <TableHead>Code</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data!.recentEvents.slice(0, 50).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDistanceToNow(new Date(e.createdAt), { addSuffix: true })}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{e.eventType}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {e.eventStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{e.source}</TableCell>
                        <TableCell className="text-xs">
                          {e.utmCampaign ?? e.clientSlug ?? "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {e.twilioErrorCode ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

export default TwilioObservabilityPanel;
