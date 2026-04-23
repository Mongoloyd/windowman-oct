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

type JwtRole = "super_admin" | "admin" | "operator" | "viewer" | null;

function decodeJwtRole(accessToken: string | undefined): JwtRole {
  if (!accessToken) return null;
  try {
    const payload = accessToken.split(".")[1];
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    const role = json?.app_metadata?.role ?? json?.role ?? null;
    if (role === "super_admin" || role === "admin" || role === "operator" || role === "viewer") {
      return role;
    }
    return null;
  } catch {
    return null;
  }
}

function RolePill({ role, devBypass }: { role: JwtRole; devBypass: boolean }) {
  if (devBypass) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-700">
        <Wrench className="h-3 w-3" />
        DEV bypass
      </span>
    );
  }
  if (!role) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        No role
      </span>
    );
  }
  const config: Record<Exclude<JwtRole, null>, { label: string; cls: string; Icon: typeof ShieldCheck }> = {
    super_admin: { label: "Super Admin", cls: "border-rose-200 bg-rose-50 text-rose-700", Icon: ShieldAlert },
    admin: { label: "Admin", cls: "border-rose-200 bg-rose-50 text-rose-700", Icon: ShieldAlert },
    operator: { label: "Operator", cls: "border-blue-200 bg-blue-50 text-blue-700", Icon: ShieldCheck },
    viewer: { label: "Viewer", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", Icon: Eye },
  };
  const c = config[role];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${c.cls}`}>
      <c.Icon className="h-3 w-3" />
      {c.label}
    </span>
  );
}

export function AdminIdentityBar() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const devBypass = import.meta.env.DEV;

  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<JwtRole>(null);
  const [sessionAlive, setSessionAlive] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    const apply = (session: Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]) => {
      if (!mounted) return;
      setEmail(session?.user?.email ?? null);
      setRole(decodeJwtRole(session?.access_token));
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
        <span className="hidden sm:inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
          No session
        </span>
        <Button asChild size="sm" variant="outline" className="h-9">
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
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <span className={`h-1.5 w-1.5 rounded-full ${sessionAlive || devBypass ? "bg-emerald-500" : "bg-muted-foreground/40"}`} />
            {sessionAlive ? "Session active" : devBypass ? "Dev session" : "No session"}
          </span>
        </div>
      </div>
      <RolePill role={role} devBypass={devBypass && !sessionAlive} />
      {sessionAlive ? (
        <Button
          size="sm"
          variant="outline"
          onClick={handleSignOut}
          disabled={signingOut}
          className="h-9"
          aria-label="Sign out of admin"
        >
          <LogOut className="h-3.5 w-3.5 sm:mr-1.5" />
          <span className="hidden sm:inline">{signingOut ? "Signing out…" : "Sign out"}</span>
        </Button>
      ) : (
        <Button asChild size="sm" variant="outline" className="h-9">
          <Link to="/admin/login" className="inline-flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Sign in</span>
          </Link>
        </Button>
      )}
    </div>
  );
}
