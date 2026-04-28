/**
 * AcceptInvite — /partner/accept-invite?token=xxx
 *
 * Flow:
 * 1. If not authenticated → show sign-up / sign-in form
 * 2. If authenticated → call accept-invite edge function
 * 3. On success → redirect to /partner/opportunities
 */

import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Shield, ArrowRight, CheckCircle, AlertCircle, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { finalizeSupabaseAuthLink } from "@/lib/supabaseAuthLink";

type Step = "checking" | "needs_auth" | "accepting" | "success" | "error";

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") ?? searchParams.get("invite_token") ?? "";

  const [step, setStep] = useState<Step>("checking");
  const [errorMsg, setErrorMsg] = useState("");
  const [currentEmail, setCurrentEmail] = useState<string | null>(null);

  // Auth form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);

  const acceptInvite = useCallback(async (accessToken: string) => {
    setStep("accepting");
    try {
      const { data, error } = await supabase.functions.invoke("accept-invite", {
        body: { invite_token: token },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (error) {
        setStep("error");
        setErrorMsg(error.message || "Failed to accept invitation");
        return;
      }

      if (data?.error) {
        setStep("error");
        setErrorMsg(data.error);
        return;
      }

      setStep("success");
      setTimeout(() => navigate("/partner/opportunities", { replace: true }), 2000);
    } catch (err) {
      setStep("error");
      setErrorMsg(err instanceof Error ? err.message : "Unexpected error");
    }
  }, [navigate, token]);

  // On mount: check if token exists, finalize auth callback, then check auth state.
  useEffect(() => {
    if (!token) {
      setStep("error");
      setErrorMsg("This invite acceptance page needs the full tokenized invitation link.");
      return;
    }

    let cancelled = false;

    finalizeSupabaseAuthLink({ expectedType: "invite", cleanUrl: true }).then(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      setCurrentEmail(session?.user?.email ?? null);
      if (session?.user) {
        acceptInvite(session.access_token);
      } else {
        setStep("needs_auth");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [acceptInvite, token]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setErrorMsg("");

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/partner/accept-invite?token=${encodeURIComponent(token)}` },
        });
        if (error) throw error;
        const { data: { session } } = await supabase.auth.getSession();
        const activeSession = session ?? data.session;
        if (activeSession) {
          acceptInvite(activeSession.access_token);
        } else {
          setStep("needs_auth");
          setErrorMsg("Check your email to confirm your account, then return to this invite link.");
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const { data: { session } } = await supabase.auth.getSession();
        const activeSession = session ?? data.session;
        if (activeSession) {
          acceptInvite(activeSession.access_token);
        } else {
          setStep("needs_auth");
          setErrorMsg("Sign-in completed, but no active session was available. Please try opening the invite link again.");
        }
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  }

  if (step === "checking" || step === "accepting") {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
          <p className="text-xs text-slate-500 font-mono">
            {step === "checking" ? "Checking invitation…" : "Activating your partner account…"}
          </p>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Partner Account Activated</h1>
          <p className="text-sm text-slate-400">Redirecting to your dashboard…</p>
        </div>
      </div>
    );
  }

  if (step === "error" && !token) {
    return (
      <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-2xl bg-sky-500/10 flex items-center justify-center">
            <UserPlus className="h-8 w-8 text-sky-400" />
          </div>
          <h1 className="text-xl font-semibold text-white mb-2">Join the Partner Network</h1>
          <p className="text-sm text-slate-400 mb-6 leading-relaxed">
            {errorMsg} If you want to become a WindowMan partner, request access and we'll review your market fit.
          </p>
          <div className="flex flex-col gap-3">
            <Button asChild className="h-11 bg-sky-600 hover:bg-sky-500 text-white font-medium">
              <Link to="/partner/join">Request Partner Access</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 border-white/10 text-slate-300 hover:bg-white/5">
              <Link to="/partner/login">Partner Sign In</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // needs_auth or error with token (show form + error)
  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Shield className="h-6 w-6 text-sky-400" />
          <span className="text-lg font-semibold text-white/90 font-mono">WindowMan</span>
        </div>

        <Card className="border-white/[0.06] bg-white/[0.02] shadow-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <h2 className="text-xl font-semibold text-white">Accept Partner Invitation</h2>
            <p className="text-sm text-slate-400 mt-1">
              {isSignUp
                ? "Create your account to activate your partner access."
                : "Sign in to activate your partner access."}
            </p>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {errorMsg && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-xs text-red-400">{errorMsg}</p>
                {currentEmail && /different email|already linked/i.test(errorMsg) && (
                  <div className="mt-3 space-y-2">
                    <p className="text-[11px] text-slate-400">Current session: {currentEmail}</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-9 w-full border-white/10 text-slate-300 hover:bg-white/5"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        setCurrentEmail(null);
                        setStep("needs_auth");
                        setErrorMsg("Signed out. Sign in with the invited email to accept this partner invitation.");
                      }}
                    >
                      Sign out and use invited email
                    </Button>
                  </div>
                )}
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@company.com"
                  required
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
                />
              </div>

              <Button
                type="submit"
                disabled={authLoading}
                className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm"
              >
                {authLoading ? (
                  <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <>
                    {isSignUp ? "Create Account & Accept" : "Sign In & Accept"}
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-5 text-center">
              <button
                type="button"
                className="text-sm text-sky-400/80 hover:text-sky-300 transition-colors"
                onClick={() => { setIsSignUp(!isSignUp); setErrorMsg(""); }}
              >
                {isSignUp ? "Already have an account? Sign in" : "Need an account? Sign up"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
