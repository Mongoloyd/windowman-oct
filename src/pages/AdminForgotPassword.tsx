/**
 * AdminForgotPassword — /admin/forgot-password
 *
 * Standalone recovery-request page (deep-linkable). Mirrors the inline
 * forgot-password mode in AdminLogin so direct links also work.
 */

import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Loader2, Mail, CheckCircle2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AdminForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    if (!email.trim()) {
      setError("Enter your admin email.");
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
      setSent(true);
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
          <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-600">
            WindowMan · Admin
          </p>
          <h1 className="mt-2 font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground">
            Reset your password
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-700">
            Enter your admin email and we'll send a secure recovery link.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-300 bg-card p-6 shadow-sm">
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
                  Email
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
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
            </form>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <h2 className="font-display text-lg font-bold tracking-tight text-foreground">
                Check your inbox
              </h2>
              <p className="mt-1 text-sm font-medium text-slate-700">
                If an account exists for <span className="font-semibold text-foreground">{email}</span>, a recovery link is on its way.
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm font-medium text-slate-600">
          <Link to="/admin/login" className="underline hover:text-foreground">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
