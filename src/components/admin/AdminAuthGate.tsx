/**
 * AdminAuthGate — Route wrapper enforcing a real Supabase session for /admin/*.
 *
 * - Honors existing DEV bypass (sandbox preview unchanged).
 * - In production: no session → redirects to /admin/login.
 * - Listens for SIGNED_OUT to redirect mid-session.
 * - Renders its own polished loading state (no blank screens).
 *
 * Role-level enforcement is intentionally left to backend user_roles checks
 * in admin-data/adminAuth.ts — failures surface from data calls, not by
 * decoding app_metadata.role in the browser.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

interface AdminAuthGateProps {
  children: ReactNode;
}

export function AdminAuthGate({ children }: AdminAuthGateProps) {
  if (import.meta.env.DEV) {
    return <>{children}</>;
  }
  return <ProductionAdminAuthGate>{children}</ProductionAdminAuthGate>;
}

type GateStatus = "checking" | "anonymous" | "authorized";

function ProductionAdminAuthGate({ children }: AdminAuthGateProps) {
  const location = useLocation();
  const [status, setStatus] = useState<GateStatus>("checking");

  useEffect(() => {
    let mounted = true;

    const apply = (
      session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]
    ) => {
      if (!mounted) return;
      if (!session?.user) {
        setStatus("anonymous");
        return;
      }
      setStatus("authorized");
    };

    supabase.auth
      .getSession()
      .then(({ data }) => apply(data.session))
      .catch(() => {
        if (!mounted) return;
        setStatus("anonymous");
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-7 w-7 text-primary animate-spin" />
          <p className="text-sm text-slate-700">Verifying admin session…</p>
        </div>
      </div>
    );
  }

  if (status === "anonymous") {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return <>{children}</>;
}

/** Reusable unauthorized panel for pages whose RPCs return `42501` etc. */
export function AdminUnauthorizedPanel({
  message = "Your account is signed in but does not have operator privileges. Ask a super admin to grant you access.",
}: {
  message?: string;
}) {
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.assign("/admin/login");
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-6 w-6 text-destructive" />
        </div>
        <h2 className="font-display text-xl font-extrabold tracking-tight text-foreground">
          Not authorized
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-700">{message}</p>
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-2">
          <Button variant="outline" onClick={handleSignOut}>Sign out</Button>
          <Button asChild>
            <Link to="/admin/login">Use a different account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
