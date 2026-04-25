import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Shield, Lock, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type PageState = "loading" | "ready" | "success" | "invalid";

export default function PartnerResetPassword() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase automatically exchanges the recovery token from the URL hash
    // and fires a PASSWORD_RECOVERY event on onAuthStateChange.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setPageState("ready");
      }
    });

    // Also check if we already have a session (e.g. fast token exchange)
    supabase.auth.getSession().then(({ data: { session } }) => {
      // If there's a session and the URL contains recovery params, show form
      const hash = window.location.hash;
      if (session && (hash.includes("type=recovery") || hash.includes("access_token"))) {
        setPageState("ready");
      } else if (!session) {
        // Give Supabase a moment to process the hash
        setTimeout(() => {
          setPageState((prev) => (prev === "loading" ? "invalid" : prev));
        }, 3000);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({ title: "Too short", description: "Password must be at least 8 characters.", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Mismatch", description: "Passwords do not match.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
      } else {
        setPageState("success");
        setTimeout(() => navigate("/partner/login", { replace: true }), 3000);
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const renderContent = () => {
    switch (pageState) {
      case "loading":
        return (
          <Card className="border-white/20 bg-white/[0.05] shadow-2xl">
            <CardContent className="px-8 py-12 flex flex-col items-center gap-4">
              <div className="h-8 w-8 rounded-full border-2 border-sky-500/30 border-t-sky-400 animate-spin" />
              <p className="text-sm text-slate-300 font-mono">Verifying recovery link…</p>
            </CardContent>
          </Card>
        );

      case "invalid":
        return (
          <Card className="border-white/20 bg-white/[0.05] shadow-2xl">
            <CardContent className="px-8 py-10 flex flex-col items-center gap-4 text-center">
              <div className="h-12 w-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-amber-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invalid or Expired Link</h2>
              <p className="text-sm text-slate-300 max-w-xs">
                This recovery link is no longer valid. Please request a new one from the login page.
              </p>
              <Button
                onClick={() => navigate("/partner/login")}
                className="mt-2 bg-sky-600 hover:bg-sky-500 text-white h-10 px-6"
              >
                Back to Sign In
              </Button>
            </CardContent>
          </Card>
        );

      case "success":
        return (
          <Card className="border-white/20 bg-white/[0.05] shadow-2xl">
            <CardContent className="px-8 py-10 flex flex-col items-center gap-4 text-center">
              <div className="h-12 w-12 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Password Updated</h2>
              <p className="text-sm text-slate-300">Redirecting you to sign in…</p>
            </CardContent>
          </Card>
        );

      case "ready":
        return (
          <Card className="border-white/20 bg-white/[0.05] shadow-2xl">
            <CardHeader className="pb-2 pt-8 px-8">
              <div className="flex items-center gap-2 mb-1">
                <Lock className="h-4 w-4 text-slate-300" />
                <span className="text-xs font-mono text-slate-300 uppercase tracking-widest">
                  Account Recovery
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white">Set a new password</h2>
              <p className="text-sm text-slate-300 mt-1">Choose a strong password for your partner account.</p>
            </CardHeader>
            <CardContent className="px-8 pb-8 pt-4">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                    New Password
                  </label>
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="bg-white/[0.04] border-white/25 text-white placeholder:text-slate-300 focus-visible:ring-sky-500/40 h-11"
                  />
                  <p className="text-[11px] text-slate-300">Minimum 8 characters</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-300 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={8}
                    className="bg-white/[0.04] border-white/25 text-white placeholder:text-slate-300 focus-visible:ring-sky-500/40 h-11"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-bold text-sm transition-all"
                >
                  {submitting ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    "Update Password"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        );
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-10 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-sky-400" />
            <span className="text-lg font-semibold text-white/90 font-mono">WindowMan</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Partner Portal</h1>
          <p className="text-sm text-sky-400">Account Recovery</p>
        </div>

        {renderContent()}

        <p className="text-center text-[11px] text-slate-300 mt-6">
          WindowMan Partner Portal is invitation-only.
        </p>
      </div>
    </div>
  );
}
