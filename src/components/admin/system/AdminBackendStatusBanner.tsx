/**
 * Operator-visible admin-data backend status for AdminDashboard tracked calls.
 * Does not expose raw errors, PII, or authorization state beyond safe labels.
 */

import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldAlert, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type AdminBackendCallStatus = {
  action: string;
  label: string;
  status: "idle" | "loading" | "success" | "failed";
  severity: "info" | "warning" | "critical";
  message?: string;
  statusCode?: number | null;
  errorCode?: string | null;
  lastCheckedAt?: string | null;
  failureKind?: "auth" | "network" | "server" | "client" | "unknown" | null;
};

type AdminBackendStatusBannerProps = {
  calls: AdminBackendCallStatus[];
  isRefreshing: boolean;
  onRetry: () => void;
};

function describeFailureKind(kind: AdminBackendCallStatus["failureKind"]): string {
  switch (kind) {
    case "auth":
      return "Auth / role";
    case "network":
      return "Network";
    case "server":
      return "Edge Function 500";
    case "client":
      return "Backend action";
    default:
      return "Unknown";
  }
}

export function AdminBackendStatusBanner({
  calls,
  isRefreshing,
  onRetry,
}: AdminBackendStatusBannerProps) {
  const tracked = calls.filter((c) => c.status !== "idle");
  if (tracked.length === 0 && !isRefreshing) return null;

  const loading = isRefreshing || tracked.some((c) => c.status === "loading");
  const failed = tracked.filter((c) => c.status === "failed");
  const authFailures = failed.filter((c) => c.failureKind === "auth");
  const allTrackedSettled = tracked.every((c) => c.status === "success" || c.status === "failed");
  const allSuccess = allTrackedSettled && failed.length === 0;

  const title = loading
    ? "Checking admin backend…"
    : authFailures.length > 0
      ? "Admin access / role issue"
      : failed.length > 0
        ? failed.some((c) => c.severity === "critical")
          ? "Admin data could not be loaded"
          : "Partial admin data failure"
        : "No tracked backend failures detected";

  const tone =
    loading || allSuccess
      ? "neutral"
      : authFailures.length > 0 || failed.some((c) => c.severity === "critical")
        ? "critical"
        : "warning";

  const Icon = loading
    ? Loader2
    : authFailures.length > 0
      ? ShieldAlert
      : failed.some((c) => c.failureKind === "network")
        ? WifiOff
        : failed.length > 0
          ? AlertCircle
          : CheckCircle2;

  const cardClass =
    tone === "critical"
      ? "border-[#7e3540] bg-[#30161b]"
      : tone === "warning"
        ? "border-[#8a5a1c] bg-[#2b1e10]"
        : "border-[#2b435b] bg-[#0c1b29]";

  const iconClass =
    tone === "critical"
      ? "text-[#ffaaa6]"
      : tone === "warning"
        ? "text-[#ffc06f]"
        : "text-[#61ebca]";

  return (
    <Card className={`wm-admin-directory-panel p-3 ${cardClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${iconClass} ${loading ? "animate-spin" : ""}`} />
          <div className="min-w-0 space-y-2">
            <div>
              <p className="text-sm font-extrabold text-[#f7fbff]">{title}</p>
              {allSuccess && !loading && (
                <p className="text-xs text-[#cad7e4] mt-0.5">
                  Tracked admin-data calls completed without reported failures.
                </p>
              )}
              {failed.length > 0 && !loading && (
                <p className="text-xs text-[#cad7e4] mt-0.5">
                  Some panels may show empty counts until the failed calls succeed. Use retry after
                  checking session role and backend deploy health.
                </p>
              )}
            </div>

            {failed.length > 0 && (
              <ul className="space-y-1.5">
                {failed.map((call) => (
                  <li
                    key={call.action}
                    className="rounded-md border border-[#3b5874] bg-[#091725] px-2.5 py-2 text-xs"
                  >
                    <div className="font-bold text-[#f7fbff]">
                      {call.label}{" "}
                      <span className="font-mono font-semibold text-[#cad7e4]">({call.action})</span>
                    </div>
                    <div className="text-[#cad7e4] mt-0.5">
                      {describeFailureKind(call.failureKind)}
                      {call.statusCode != null ? ` · HTTP ${call.statusCode}` : ""}
                      {call.errorCode ? ` · ${call.errorCode}` : ""}
                    </div>
                    {call.message && <div className="text-[#e7f0f9] mt-0.5">{call.message}</div>}
                    {call.lastCheckedAt && (
                      <div className="text-[#cad7e4] mt-0.5">
                        Last checked{" "}
                        {formatDistanceToNow(new Date(call.lastCheckedAt), { addSuffix: true })}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          disabled={isRefreshing}
          className="shrink-0 gap-1.5 border-[#3b5874] bg-[#091725] text-[#e7f0f9] hover:bg-[#142a3e] hover:text-[#f7fbff]"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
          Retry admin data
        </Button>
      </div>
    </Card>
  );
}
