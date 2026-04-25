/**
 * AdminLogin — /admin/login
 *
 * Real Supabase email/password sign-in for admins. Inline "Forgot password?"
 * action triggers Supabase's recovery email pointing at /admin/reset-password.
 *
 * If a session already exists, the page redirects straight to /admin (or to
 * the original protected location captured by AdminAuthGate).
 */

import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type Mode = "signin" | "forgot";

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/admin";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already signed in, get out of here.
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data?.session?.user) navigate(redirectTo, { replace: true });
    });
    return () => {
      mounted = false;
    };
  }, [navigate, redirectTo]);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Sign-in failed. Check your email and password.");
        return;
      }
      navigate(redirectTo, { replace: true });
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim()) {
      setError("Enter the email associated with your admin account.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/admin/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setResetSent(true);
      toast({
        title: "Recovery email sent",
        description: "Check your inbox for a link to reset your password.",
      });
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-600">
            WindowMan · Admin
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            {mode === "signin" ? "Sign in to admin" : "Reset your password"}
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {mode === "signin"
              ? "Operator access for the WindowMan command center."
              : "We'll email you a secure link to set a new password."}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-card p-6 shadow-sm">
          {mode === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@windowman.app"
                    className="h-11 pl-9 border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    className="text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-9 border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full h-11 font-extrabold shadow-sm">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </form>
          )}

          {mode === "forgot" && !resetSent && (
            <form onSubmit={handleForgot} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="forgot-email" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@windowman.app"
                    className="h-11 pl-9 border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-500 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    required
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" disabled={submitting} className="w-full h-11 font-extrabold shadow-sm">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending…
                  </>
                ) : (
                  "Send recovery email"
                )}
              </Button>

              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="block w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                ← Back to sign in
              </button>
            </form>
          )}

          {mode === "forgot" && resetSent && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Check your inbox
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>, we've sent a recovery link.
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  setMode("signin");
                  setResetSent(false);
                }}
                className="mt-5"
              >
                Back to sign in
              </Button>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm font-medium text-slate-600">
          Admin access is internal-only.{" "}
          <Link to="/" className="underline hover:text-foreground">
            Return to homepage
          </Link>
        </p>
      </div>
    </div>
  );
}
