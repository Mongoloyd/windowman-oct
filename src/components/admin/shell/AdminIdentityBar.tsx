/**
 * AdminIdentityBar — Live identity + session control inside the admin shell.
 *
 * Shows: signed-in email, role, session-alive indicator, sign-out button.
 * In DEV (sandbox) shows a clear "DEV bypass" badge instead of fake credentials.
 *
 * Read-only with respect to roles. Only writes the auth signOut.
 */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LogOut, LogIn, ShieldCheck, ShieldAlert, Eye, Wrench } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useCurrentUserRole } from "@/hooks/useCurrentUserRole";
import type { JwtRole } from "@/components/admin/auth/decodeJwtRole";

function RolePill({ role, devBypass }: { role: JwtRole; devBypass: boolean }) {
  if (devBypass) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-amber-950 shadow-sm">
        <Wrench className="h-3 w-3" />
        DEV bypass
      </span>
    );
  }
  if (!role) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-slate-400 bg-white px-3 py-1 text-sm font-extrabold uppercase tracking-wider text-slate-950 shadow-sm">
        No role
      </span>
    );
  }
  const config: Record<Exclude<JwtRole, null>, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    super_admin: { label: "Super Admin", cls: "border-red-300 bg-red-100 text-red-950", Icon: ShieldAlert },
    admin: { label: "Admin", cls: "border-red-300 bg-red-100 text-red-950", Icon: ShieldAlert },
    operator: { label: "Operator", cls: "border-blue-300 bg-blue-100 text-blue-950", Icon: ShieldCheck },
    viewer: { label: "Viewer", cls: "border-emerald-300 bg-emerald-100 text-emerald-950", Icon: Eye },
  };
  const c = config[role];
  return (
    <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-extrabold uppercase tracking-wider shadow-sm ${c.cls}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export function AdminIdentityBar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const devBypass = import.meta.env.DEV;
  const { role: dbRole } = useCurrentUserRole();

  const [email, setEmail] = useState<string | null>(null);
  const [sessionAlive, setSessionAlive] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const displayRole: JwtRole = sessionAlive ? (dbRole as JwtRole) : null;

  useEffect(() => {
    let mounted = true;

    const apply = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
      setSessionAlive(!!session?.user);
    };

    supabase.auth.getSession().then(({ data }) => apply(data.session));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => apply(session));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await supabase.auth.signOut();
      toast({ title: "Signed out", description: "Your admin session has ended." });
      navigate("/admin/login", { replace: true });
    } catch (err) {
      toast({
        title: "Sign-out failed",
        description: err instanceof Error ? err.message : "Unexpected error.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  // Signed-out state (production) — show login link
  if (!sessionAlive && !devBypass) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden sm:inline-flex items-center gap-1.5 text-sm font-bold text-slate-700">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          No session
        </span>
        <Button asChild size="sm" variant="outline" className="h-10 border-slate-300 bg-white font-bold shadow-sm">
          <Link to="/admin/login" className="inline-flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="hidden md:flex flex-col items-end leading-tight">
        <span className="text-sm font-semibold text-foreground">
          {email ?? (devBypass ? "dev@windowman.app" : "Unknown")}
        </span>
        <div className="mt-0.5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1 text-sm font-bold text-slate-700">
            <span className={`h-1.5 w-1.5 rounded-full ${sessionAlive || devBypass ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            {sessionAlive ? "Session active" : devBypass ? "Dev session" : "No session"}
          </span>
        </div>
      </div>
      <RolePill role={displayRole} devBypass={devBypass && !sessionAlive} />
      {sessionAlive ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className="h-10 border-slate-300 bg-white font-bold shadow-sm"
          aria-label="Sign out of admin"
        >
          <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="h-10 border-slate-300 bg-white font-bold shadow-sm">
          <Link to="/admin/login" className="inline-flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
