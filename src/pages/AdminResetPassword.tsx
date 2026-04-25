/**
 * AdminResetPassword — /admin/reset-password
 *
 * Completes the Supabase recovery loop for admin accounts. Listens for
 * PASSWORD_RECOVERY (or the recovery hash on first paint), accepts a new
 * password, and redirects to /admin/login on success.
 */

import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Lock, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

type PageState = "loading" | "ready" | "success" | "invalid";

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setPageState("ready");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      const hash = window.location.hash;
      if (session && (hash.includes("type=recovery") || hash.includes("access_token"))) {
        setPageState("ready");
      } else if (!session) {
        // Give Supabase a moment to process the hash.
        setTimeout(() => {
          setPageState((prev) => (prev === "loading" ? "invalid" : prev));
        }, 3000);
      } else {
        // Session exists but not a recovery flow — treat as ready (operator
        // re-setting their own password).
        setPageState("ready");
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setPageState("success");
      toast({ title: "Password updated", description: "Sign in with your new password." });
      setTimeout(() => navigate("/admin/login", { replace: true }), 2500);
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
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-700">
            WindowMan · Admin
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            Set a new password
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-card p-6 shadow-sm">
          {pageState === "loading" && (
            <div className="flex flex-col items-center gap-3 py-6">
              <Loader2 className="h-7 w-7 text-primary animate-spin" />
              <p className="text-sm font-medium text-slate-700">Verifying recovery link…</p>
            </div>
          )}

          {pageState === "invalid" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Invalid or expired link
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">
                This recovery link is no longer valid. Request a new one to continue.
              </p>
              <Button onClick={() => navigate("/admin/forgot-password")} className="mt-5">
                Request a new link
              </Button>
            </div>
          )}

          {pageState === "success" && (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Password updated
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">Redirecting you to sign in…</p>
            </div>
          )}

          {pageState === "ready" && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  New password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    autoFocus
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-9 border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    required
                    minLength={8}
                  />
                </div>
                <p className="text-sm font-medium text-slate-700">Minimum 8 characters.</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Confirm password
                </Label>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-700" />
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 pl-9 border-2 border-slate-300 bg-white text-slate-950 placeholder:text-slate-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/15"
                    required
                    minLength={8}
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
                    Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
