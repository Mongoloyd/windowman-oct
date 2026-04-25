/**
 * SessionDiagnosticPanel — strictly read-only.
 *
 * Surfaces the live browser auth/session truth so we can tell what is
 * actually authorizing (or failing to authorize) against the backend.
 *
 * No writes. No mutations. No protected-path edits. No PR-2 work.
 *
 * Why this exists:
 *   - AuthGuard short-circuits in DEV.
 *   - useCurrentUserRole returns a fabricated "super_admin" in DEV.
 *   - is_internal_operator() reads auth.jwt().app_metadata.role from the
 *     REAL JWT, which the DEV bypasses do not affect.
 *   So the app may "think" you are super_admin while RLS sees an anonymous
 *   request. This panel makes that gap visible.
 */

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";

type JwtPayload = {
  sub?: string;
  email?: string;
  aud?: string;
  exp?: number;
  role?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
};

type SessionState = {
  hasSession: boolean;
  uid: string | null;
  email: string | null;
  accessTokenPresent: boolean;
  accessTokenLength: number;
  accessTokenPrefix: string | null;
  jwtPayload: JwtPayload | null;
  jwtDecodeError: string | null;
  sessionError: string | null;
  fetchedAt: string;
};

type RlsProbeState = {
  status: "idle" | "running" | "ok" | "denied" | "error";
  rowCount: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  errorDetails: string | null;
};

function decodeJwt(token: string): { payload: JwtPayload | null; error: string | null } {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return { payload: null, error: "JWT does not have 3 segments" };
    // base64url → base64
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/").padEnd(parts[1].length + ((4 - (parts[1].length % 4)) % 4), "=");
    const json = atob(b64);
    return { payload: JSON.parse(json) as JwtPayload, error: null };
  } catch (err) {
    return { payload: null, error: err instanceof Error ? err.message : String(err) };
  }
}

function fmtExpiry(exp: number | undefined): { absolute: string; relative: string; expired: boolean } {
  if (!exp) return { absolute: "(none)", relative: "(none)", expired: false };
  const ms = exp * 1000;
  const now = Date.now();
  const diffMin = Math.round((ms - now) / 60000);
  return {
    absolute: new Date(ms).toISOString(),
    relative: diffMin >= 0 ? `expires in ${diffMin} min` : `expired ${Math.abs(diffMin)} min ago`,
    expired: ms < now,
  };
}

function statusBadgeClass(tone: "success" | "danger" | "warning" | "neutral") {
  const base = "wm-admin-badge";
  if (tone === "success") return `${base} border-emerald-300 bg-emerald-100 text-emerald-950`;
  if (tone === "danger") return `${base} border-red-300 bg-red-100 text-red-950`;
  if (tone === "warning") return `${base} border-amber-300 bg-amber-100 text-amber-950`;
  return `${base} border-slate-400 bg-white text-slate-950`;
}

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid gap-2 border-b border-slate-300 py-3 last:border-b-0 sm:grid-cols-[240px_1fr]">
      <div className="text-sm font-extrabold uppercase tracking-wide text-slate-700">{label}</div>
      <div className={mono ? "break-all font-mono text-base font-semibold text-slate-950" : "break-words text-base font-semibold text-slate-950"}>{value}</div>
    </div>
  );
}

export function SessionDiagnosticPanel() {
  const [session, setSession] = useState<SessionState | null>(null);
  const [probe, setProbe] = useState<RlsProbeState>({
    status: "idle",
    rowCount: null,
    errorCode: null,
    errorMessage: null,
    errorDetails: null,
  });

  // Hook reflects what the *app* thinks (subject to DEV bypass).
  const roleHook = useCurrentUserRole();

  const readSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      const s = data?.session ?? null;
      const token = s?.access_token ?? null;
      const decoded = token ? decodeJwt(token) : { payload: null, error: null };
      setSession({
        hasSession: !!s,
        uid: s?.user?.id ?? null,
        email: s?.user?.email ?? null,
        accessTokenPresent: !!token,
        accessTokenLength: token?.length ?? 0,
        accessTokenPrefix: token ? token.slice(0, 6) : null,
        jwtPayload: decoded.payload,
        jwtDecodeError: decoded.error,
        sessionError: error ? error.message : null,
        fetchedAt: new Date().toISOString(),
      });
    } catch (err) {
      setSession({
        hasSession: false,
        uid: null,
        email: null,
        accessTokenPresent: false,
        accessTokenLength: 0,
        accessTokenPrefix: null,
        jwtPayload: null,
        jwtDecodeError: null,
        sessionError: err instanceof Error ? err.message : String(err),
        fetchedAt: new Date().toISOString(),
      });
    }
  }, []);

  const runRlsProbe = useCallback(async () => {
    setProbe({ status: "running", rowCount: null, errorCode: null, errorMessage: null, errorDetails: null });
    try {
      // Strict read-only probe: select a single id from contractors.
      const { data, error } = await supabase.from("contractors").select("id").limit(1);
      if (error) {
        const code = (error as { code?: string }).code ?? null;
        setProbe({
          status: code === "42501" ? "denied" : "error",
          rowCount: null,
          errorCode: code,
          errorMessage: error.message,
          errorDetails: (error as { details?: string }).details ?? null,
        });
        return;
      }
      setProbe({
        status: "ok",
        rowCount: Array.isArray(data) ? data.length : 0,
        errorCode: null,
        errorMessage: null,
        errorDetails: null,
      });
    } catch (err) {
      setProbe({
        status: "error",
        rowCount: null,
        errorCode: null,
        errorMessage: err instanceof Error ? err.message : String(err),
        errorDetails: null,
      });
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await readSession();
    await runRlsProbe();
  }, [readSession, runRlsProbe]);

  useEffect(() => {
    refreshAll();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      readSession();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshAll, readSession]);

  // Derived
  const jwt = session?.jwtPayload ?? null;
  const appMetaRole =
    jwt && jwt.app_metadata && typeof jwt.app_metadata === "object"
      ? ((jwt.app_metadata as Record<string, unknown>).role as string | undefined) ?? null
      : null;
  const exp = fmtExpiry(jwt?.exp);
  const isAuthenticated = !!session?.hasSession && jwt?.aud === "authenticated" && !!session?.uid;
  const wouldPassIsInternalOperator =
    isAuthenticated && !!appMetaRole && ["operator", "admin", "super_admin"].includes(appMetaRole);
  const devBypassActive = import.meta.env.DEV;

  return (
    <div className="w-full max-w-6xl space-y-5">
      <Card className="wm-admin-panel">
        <CardHeader className="border-b border-slate-300 pb-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-2xl font-black text-slate-950">Session Diagnostic — read only</CardTitle>
              <p className="mt-1 text-base font-semibold text-slate-700">
                Live browser auth/session state. No writes. Used to diagnose Inspector RLS denials.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={refreshAll} className="min-h-10 border border-slate-400 bg-white px-4 text-sm font-extrabold text-slate-950 shadow-sm hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-primary/20">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Top-line verdict */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={statusBadgeClass(isAuthenticated ? "success" : "danger")}>
              {isAuthenticated ? "Browser: AUTHENTICATED" : "Browser: ANONYMOUS / NO SESSION"}
            </Badge>
            <Badge variant="outline" className={statusBadgeClass(wouldPassIsInternalOperator ? "success" : "danger")}>
              is_internal_operator(): {wouldPassIsInternalOperator ? "would PASS" : "would FAIL"}
            </Badge>
            <Badge variant="outline" className={statusBadgeClass(probe.status === "ok" ? "success" : probe.status === "denied" ? "danger" : "neutral")}>
              RLS probe (contractors): {probe.status.toUpperCase()}
              {probe.errorCode ? ` · ${probe.errorCode}` : ""}
            </Badge>
            {devBypassActive && (
              <Badge variant="outline" className={statusBadgeClass("warning")}>
                DEV BYPASS ACTIVE — AuthGuard + useCurrentUserRole are short-circuited
              </Badge>
            )}
          </div>

          {/* Section 1: Session */}
          <section>
            <h3 className="mb-2 text-lg font-black text-slate-950">supabase.auth.getSession()</h3>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <Row label="hasSession" value={String(session?.hasSession ?? "(loading)")} />
              <Row label="auth.uid" value={session?.uid ?? "(none)"} />
              <Row label="email" value={session?.email ?? "(none)"} />
              <Row label="access_token present" value={String(session?.accessTokenPresent ?? false)} />
              <Row
                label="access_token"
                value={
                  session?.accessTokenPresent
                    ? `${session.accessTokenPrefix}… (length ${session.accessTokenLength})`
                    : "(none)"
                }
              />
              <Row label="session error" value={session?.sessionError ?? "(none)"} />
              <Row label="fetched at" value={session?.fetchedAt ?? "(none)"} />
            </div>
          </section>

          {/* Section 2: Decoded JWT */}
          <section>
            <h3 className="mb-2 text-lg font-black text-slate-950">Decoded JWT payload (the field RLS reads)</h3>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <Row label="jwt decode error" value={session?.jwtDecodeError ?? "(none)"} />
              <Row label="aud" value={jwt?.aud ?? "(none)"} />
              <Row label="sub" value={jwt?.sub ?? "(none)"} />
              <Row label="role (top-level)" value={jwt?.role ?? "(none)"} />
              <Row
                label="app_metadata.role"
                value={
                  appMetaRole ? (
                    <span className="text-emerald-600 font-semibold">{appMetaRole}</span>
                  ) : (
                    <span className="text-destructive font-semibold">(missing — RLS will deny)</span>
                  )
                }
              />
              <Row label="exp (absolute)" value={exp.absolute} />
              <Row
                label="exp (relative)"
                value={
                  exp.expired ? (
                    <span className="text-destructive font-semibold">{exp.relative}</span>
                  ) : (
                    exp.relative
                  )
                }
              />
              <Row
                label="full app_metadata"
                value={
                  jwt?.app_metadata ? (
                    <pre className="whitespace-pre-wrap text-sm font-semibold text-slate-950">{JSON.stringify(jwt.app_metadata, null, 2)}</pre>
                  ) : (
                    "(none)"
                  )
                }
                mono={false}
              />
            </div>
          </section>

          {/* Section 3: What the app thinks */}
          <section>
            <h3 className="mb-2 text-lg font-black text-slate-950">What the app thinks (useCurrentUserRole)</h3>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <Row label="role" value={roleHook.role ?? "(null)"} />
              <Row label="userId" value={roleHook.userId ?? "(null)"} />
              <Row label="email" value={roleHook.email ?? "(null)"} />
              <Row label="isLoading" value={String(roleHook.isLoading)} />
              <Row label="error" value={roleHook.error ?? "(none)"} />
              <Row label="isSuperAdmin" value={String(roleHook.isSuperAdmin)} />
              <Row label="isOperator" value={String(roleHook.isOperator)} />
              <Row label="hasWriteAccess" value={String(roleHook.hasWriteAccess)} />
              {devBypassActive && (
                <Row
                  label="⚠ note"
                  value={
                    <span className="text-amber-700">
                      In DEV, this hook returns a fabricated super_admin and ignores the real session. Use the
                      sections above for the real story.
                    </span>
                  }
                  mono={false}
                />
              )}
            </div>
          </section>

          {/* Section 4: RLS probe */}
          <section>
            <h3 className="mb-2 text-lg font-black text-slate-950">
              Live RLS probe — <code className="font-mono text-sm font-bold text-slate-800">select id from public.contractors limit 1</code>
            </h3>
            <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
              <Row label="status" value={probe.status} />
              <Row label="row count" value={probe.rowCount === null ? "(n/a)" : String(probe.rowCount)} />
              <Row label="error code" value={probe.errorCode ?? "(none)"} />
              <Row label="error message" value={probe.errorMessage ?? "(none)"} />
              <Row label="error details" value={probe.errorDetails ?? "(none)"} />
              <div className="pt-2">
                <Button size="sm" variant="outline" onClick={runRlsProbe} className="min-h-10 border border-slate-400 bg-white px-4 text-sm font-extrabold text-slate-950 shadow-sm hover:bg-slate-50">
                  Re-run probe
                </Button>
              </div>
            </div>
          </section>

          {/* Section 5: Diagnosis hint */}
          <section>
            <h3 className="mb-2 text-lg font-black text-slate-950">Likely diagnosis</h3>
            <div className="space-y-2 rounded-2xl border border-slate-300 bg-slate-50 p-4 text-base font-semibold text-slate-800 shadow-sm">
              {!session?.hasSession && (
                <p>
                  ▸ No browser session at all. The Supabase client has no JWT in localStorage. Sign in via{" "}
                  <code>/signin</code> (you reported it broken — that is the upstream blocker).
                </p>
              )}
              {session?.hasSession && !appMetaRole && (
                <p>
                  ▸ Session exists but the JWT has no <code>app_metadata.role</code>. The current user has not been
                  granted operator/admin/super_admin in <code>auth.users.raw_app_meta_data</code>. Either sign in as a
                  user who already has the role (e.g. <code>mongoloyd@protonmail.com</code>) or grant the role to the
                  current user in Supabase auth admin.
                </p>
              )}
              {session?.hasSession && appMetaRole && !["operator", "admin", "super_admin"].includes(appMetaRole) && (
                <p>
                  ▸ JWT has <code>app_metadata.role = "{appMetaRole}"</code>, which is not in the operator allow-list.
                </p>
              )}
              {session?.hasSession && exp.expired && (
                <p>
                  ▸ Access token is <strong>expired</strong>. Sign out and sign back in to mint a fresh JWT.
                </p>
              )}
              {wouldPassIsInternalOperator && probe.status === "denied" && (
                <p className="text-destructive">
                  ▸ JWT looks correct but probe still denied. Investigate RLS policy state on <code>contractors</code>.
                </p>
              )}
              {wouldPassIsInternalOperator && probe.status === "ok" && (
                <p className="text-emerald-700">
                  ▸ Live session is authorized and contractors is readable. Inspector should now render real rows.
                </p>
              )}
            </div>
          </section>
        </CardContent>
      </Card>
    </div>
  );
}
