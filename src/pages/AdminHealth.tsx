// ============= Admin deployment health check =============
// Pings required admin routes against the current origin and reports
// whether the deployed bundle responds (HTTP 200 + valid HTML shell).
// Public route by design — no secrets, no data, just route reachability.

import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle } from "lucide-react";

type CheckStatus = "pending" | "pass" | "fail";

interface RouteCheck {
  path: string;
  label: string;
  status: CheckStatus;
  httpStatus?: number;
  durationMs?: number;
  error?: string;
}

const REQUIRED_ROUTES: Array<Pick<RouteCheck, "path" | "label">> = [
  { path: "/admin/login", label: "Admin login (public)" },
  { path: "/admin", label: "Admin shell (gated)" },
  { path: "/admin/leads", label: "Lead inbox (gated)" },
  { path: "/admin/forgot-password", label: "Password recovery" },
  { path: "/admin/reset-password", label: "Password reset" },
];

async function pingRoute(path: string): Promise<Omit<RouteCheck, "path" | "label">> {
  const url = `${window.location.origin}${path}`;
  const started = performance.now();
  try {
    // SPA fallback returns index.html for all client-routed paths.
    // A 200 + HTML response means the route is reachable on this deployment.
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      credentials: "omit",
      cache: "no-store",
    });
    const durationMs = Math.round(performance.now() - started);
    const contentType = res.headers.get("content-type") ?? "";
    const isHtml = contentType.includes("text/html");
    if (res.ok && isHtml) {
      return { status: "pass", httpStatus: res.status, durationMs };
    }
    return {
      status: "fail",
      httpStatus: res.status,
      durationMs,
      error: !res.ok
        ? `HTTP ${res.status}`
        : `Unexpected content-type: ${contentType || "unknown"}`,
    };
  } catch (err) {
    return {
      status: "fail",
      durationMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

export default function AdminHealth() {
  const [checks, setChecks] = useState<RouteCheck[]>(
    REQUIRED_ROUTES.map((r) => ({ ...r, status: "pending" })),
  );
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);

  const runChecks = async () => {
    setRunning(true);
    setChecks(REQUIRED_ROUTES.map((r) => ({ ...r, status: "pending" })));
    const results = await Promise.all(
      REQUIRED_ROUTES.map(async (r) => {
        const result = await pingRoute(r.path);
        return { ...r, ...result } satisfies RouteCheck;
      }),
    );
    setChecks(results);
    setLastRun(new Date());
    setRunning(false);
  };

  useEffect(() => {
    runChecks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allPass = checks.every((c) => c.status === "pass");
  const anyFail = checks.some((c) => c.status === "fail");
  const overall: "pending" | "healthy" | "degraded" = running
    ? "pending"
    : allPass
      ? "healthy"
      : anyFail
        ? "degraded"
        : "pending";

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Admin Deployment Health Check</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:py-14">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Deployment Health Check
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifies that required admin routes are reachable on the current
            origin (<code className="font-mono">{typeof window !== "undefined" ? window.location.origin : ""}</code>).
          </p>
        </header>

        {/* Overall status banner */}
        <div
          className={[
            "mb-6 flex items-center gap-3 rounded-lg border p-4",
            overall === "healthy" && "border-emerald-500/30 bg-emerald-500/5",
            overall === "degraded" && "border-destructive/40 bg-destructive/5",
            overall === "pending" && "border-border bg-muted/30",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {overall === "healthy" && <CheckCircle2 className="h-5 w-5 text-emerald-600" />}
          {overall === "degraded" && <AlertTriangle className="h-5 w-5 text-destructive" />}
          {overall === "pending" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">
              {overall === "healthy" && "All admin routes are deployed and reachable."}
              {overall === "degraded" && "One or more admin routes failed."}
              {overall === "pending" && "Running checks…"}
            </p>
            {lastRun && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Last run {lastRun.toLocaleTimeString()}
              </p>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={runChecks}
            disabled={running}
            className="gap-2"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
            Re-run
          </Button>
        </div>

        {/* Per-route results */}
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {checks.map((check) => (
            <li key={check.path} className="flex items-start gap-3 p-4">
              <div className="mt-0.5">
                {check.status === "pending" && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                {check.status === "pass" && (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                )}
                {check.status === "fail" && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-medium text-foreground">
                    {check.label}
                  </span>
                  <code className="font-mono text-xs text-muted-foreground">
                    {check.path}
                  </code>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  {check.httpStatus !== undefined && (
                    <span>HTTP {check.httpStatus}</span>
                  )}
                  {check.durationMs !== undefined && (
                    <span>{check.durationMs} ms</span>
                  )}
                  {check.error && (
                    <span className="text-destructive">{check.error}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>

        <p className="mt-6 text-xs text-muted-foreground">
          A passing check confirms the deployed bundle serves a valid HTML shell
          for the route. It does <strong>not</strong> verify authentication,
          role gating, or that the React component mounted — those are covered
          by the <code className="font-mono">AdminAuthGate</code> integration tests.
        </p>
      </div>
    </div>
  );
}
