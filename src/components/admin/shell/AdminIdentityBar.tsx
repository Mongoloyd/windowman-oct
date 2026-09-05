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
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#8a5a1c] bg-[#2b1e10] px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#ffc06f]">
        <Wrench className="h-3 w-3" />
        DEV
      </span>
    );
  }
  if (!role) {
    return (
      <span className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#3b5874] bg-[#152333] px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider text-[#e3edf7]">
        No role
      </span>
    );
  }
  const config: Record<Exclude<JwtRole, null>, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    super_admin: { label: "Super Admin", cls: "border-[#7e3540] bg-[#30161b] text-[#ffaaa6]", Icon: ShieldAlert },
    admin: { label: "Admin", cls: "border-[#7e3540] bg-[#30161b] text-[#ffaaa6]", Icon: ShieldAlert },
    operator: { label: "Operator", cls: "border-[#2f6eb9] bg-[#0a2947] text-[#a9d4ff]", Icon: ShieldCheck },
    viewer: { label: "Viewer", cls: "border-[#23745f] bg-[#082c26] text-[#61ebca]", Icon: Eye },
  };
  const c = config[role];
  return (
    <span className={`inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-extrabold uppercase tracking-wider ${c.cls}`}>
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
  const controlClass =
    "h-10 border-[#3b5874] bg-[#091725] font-bold text-[#e7f0f9] shadow-none hover:bg-[#142a3e] hover:text-[#f7fbff]";

  if (!sessionAlive && !devBypass) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="hidden lg:inline-flex items-center gap-1.5 text-xs font-bold text-[#cad7e4]">
          <span className="h-2 w-2 rounded-full bg-slate-500" />
          No session
        </span>
        <Button asChild size="sm" variant="outline" className={controlClass}>
          <Link to="/admin/login" className="inline-flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            Sign in
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 max-w-[min(100%,22rem)] items-center gap-2">
      <div className="hidden xl:flex min-w-0 flex-col items-end leading-tight">
        <span className="max-w-[12rem] truncate text-xs font-semibold text-[#f7fbff]">
          {email ?? (devBypass ? "dev@windowman.app" : "Unknown")}
        </span>
        <span className="inline-flex items-center gap-1 text-[0.6875rem] font-bold text-[#cad7e4]">
          <span className={`h-1.5 w-1.5 rounded-full ${sessionAlive || devBypass ? "bg-emerald-400" : "bg-slate-500"}`} />
          {sessionAlive ? "Session active" : devBypass ? "Dev session" : "No session"}
        </span>
      </div>
      <RolePill role={displayRole} devBypass={devBypass && !sessionAlive} />
      {sessionAlive ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className={controlClass}
          aria-label="Sign out of admin"
        >
          <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className={controlClass}>
          <Link to="/admin/login" className="inline-flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
