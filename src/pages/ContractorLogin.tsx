import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { Shield, ArrowRight, Lock, ArrowLeft, CheckCircle2, Building2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { usePartnerAuth } from "@/hooks/usePartnerAuth";
import NativeBookingForm from "@/pages/contractors3/components/sections/NativeBookingForm";

type View = "login" | "forgot" | "register" | "register-success";

const RegisterSchema = z
  .object({
    companyName: z.string().trim().min(1, "Company name is required").max(200),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(255),
    password: z.string().min(8, "Password must be at least 8 characters").max(128),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type RegisterErrors = Partial<Record<"companyName" | "email" | "password" | "confirmPassword", string>>;

export default function ContractorLogin() {
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  // Register state
  const [regCompany, setRegCompany] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regErrors, setRegErrors] = useState<RegisterErrors>({});

  const { toast } = useToast();
  const navigate = useNavigate();
  const partner = usePartnerAuth();

  // Redirect active partners via component return, not imperative navigate during render
  if (partner.state === "active") {
    return <Navigate to="/partner/opportunities" replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ title: "Sign In Failed", description: error.message, variant: "destructive" });
        return;
      }
      if (data.session) navigate("/partner/opportunities", { replace: true });
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", description: "Enter your partner email address.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/partner/reset-password`,
      });
      if (error) {
        toast({ title: "Reset Failed", description: error.message, variant: "destructive" });
      } else {
        setResetSent(true);
      }
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegErrors({});

    const parsed = RegisterSchema.safeParse({
      companyName: regCompany,
      email: regEmail,
      password: regPassword,
      confirmPassword: regConfirm,
    });

    if (!parsed.success) {
      const fieldErrors: RegisterErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof RegisterErrors | undefined;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setRegErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-partner-access", {
        body: {
          companyName: parsed.data.companyName,
          email: parsed.data.email,
          password: parsed.data.password,
        },
      });

      if (error) {
        toast({
          title: "Request failed",
          description: error.message ?? "We couldn't submit your request. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const result = data as { ok?: boolean; error_code?: string; message?: string } | null;

      if (!result?.ok) {
        const code = result?.error_code;
        if (code === "email_taken") {
          setRegErrors({ email: "This email is already registered." });
        } else if (code === "weak_password") {
          setRegErrors({ password: "Password is too weak. Use at least 8 characters." });
        } else if (code === "invalid_email") {
          setRegErrors({ email: "Invalid email address." });
        } else if (code === "missing_company") {
          setRegErrors({ companyName: "Company name is required." });
        } else {
          toast({
            title: "Request failed",
            description: result?.message ?? "Something went wrong. Please try again.",
            variant: "destructive",
          });
        }
        return;
      }

      // Success
      setRegCompany("");
      setRegEmail("");
      setRegPassword("");
      setRegConfirm("");
      setView("register-success");
    } catch {
      toast({ title: "Error", description: "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderRegister = () => (
    <Card className="border-white/[0.06] bg-white/[0.02] shadow-2xl">
      <CardHeader className="pb-2 pt-8 px-8">
        <button
          type="button"
          onClick={() => { setView("login"); setRegErrors({}); }}
          className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 -ml-0.5"
        >
          <ArrowLeft className="h-3 w-3" /> Back to sign in
        </button>
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="h-4 w-4 text-slate-500" />
          <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
            Partner Application
          </span>
        </div>
        <h2 className="text-xl font-semibold text-white">Request partner access</h2>
        <p className="text-sm text-slate-400 mt-1">
          New accounts are reviewed within 1 business day.
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8 pt-4">
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Company Name</label>
            <Input
              type="text"
              value={regCompany}
              onChange={(e) => setRegCompany(e.target.value)}
              placeholder="Acme Windows & Doors"
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
            />
            {regErrors.companyName && (
              <p className="text-xs text-rose-400">{regErrors.companyName}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Contact Email</label>
            <Input
              type="email"
              value={regEmail}
              onChange={(e) => setRegEmail(e.target.value)}
              placeholder="partner@company.com"
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
            />
            {regErrors.email && (
              <p className="text-xs text-rose-400">{regErrors.email}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
            <Input
              type="password"
              value={regPassword}
              onChange={(e) => setRegPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
            />
            {regErrors.password && (
              <p className="text-xs text-rose-400">{regErrors.password}</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Confirm Password</label>
            <Input
              type="password"
              value={regConfirm}
              onChange={(e) => setRegConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
              className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
            />
            {regErrors.confirmPassword && (
              <p className="text-xs text-rose-400">{regErrors.confirmPassword}</p>
            )}
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all"
          >
            {loading ? (
              <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                Submit Request
                <ArrowRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
          <p className="text-[11px] text-slate-500 text-center pt-1 leading-relaxed">
            By submitting, you agree your account will be held in pending review until manually approved by WindowMan ops.
          </p>
        </form>
      </CardContent>
    </Card>
  );

  const renderRegisterSuccess = () => (
    <Card className="border-white/[0.06] bg-white/[0.02] shadow-2xl">
      <CardHeader className="pb-2 pt-8 px-8">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span className="text-xs font-mono text-emerald-400/80 uppercase tracking-widest">
            Request Received
          </span>
        </div>
        <h2 className="text-xl font-semibold text-white">You're on the list</h2>
        <p className="text-sm text-slate-400 mt-1">
          Your partner account is pending review. We'll email you once approved — typically within 1 business day.
        </p>
      </CardHeader>
      <CardContent className="px-8 pb-8 pt-4 space-y-4">
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <p className="text-sm text-emerald-300">
            Sign-in is disabled until your account is approved.
          </p>
        </div>
        <Button
          type="button"
          className="w-full h-11 border border-white/10 bg-black text-white"
          onClick={() => setView("login")}
        >
          Return to Sign in
        </Button>
      </CardContent>
    </Card>
  );

  const rightPanel = () => {
    if (view === "register") return renderRegister();
    if (view === "register-success") return renderRegisterSuccess();

    if (view === "forgot") {
      return (
        <Card className="border-white/[0.06] bg-white/[0.02] shadow-2xl">
          <CardHeader className="pb-2 pt-8 px-8">
            <button
              type="button"
              onClick={() => { setView("login"); setResetSent(false); }}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 -ml-0.5"
            >
              <ArrowLeft className="h-3 w-3" /> Back to sign in
            </button>
            <div className="flex items-center gap-2 mb-1">
              <Lock className="h-4 w-4 text-slate-500" />
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">
                Account Recovery
              </span>
            </div>
            <h2 className="text-xl font-semibold text-white">Reset your password</h2>
            <p className="text-sm text-slate-400 mt-1">
              {resetSent
                ? "If an account exists for that email, a reset link has been sent."
                : "Enter the email associated with your partner account."}
            </p>
          </CardHeader>
          <CardContent className="px-8 pb-8 pt-4">
            {resetSent ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-sky-500/20 bg-sky-500/5 px-4 py-3">
                  <p className="text-sm text-sky-300">Check your email for a reset link.</p>
                </div>
                <Button
                  type="button"
                  className="w-full h-11 border border-white/10 bg-black text-white"
                  onClick={() => { setView("login"); setResetSent(false); }}
                >
                  Return to Sign in
                </Button>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-5">
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
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all"
                >
                  {loading ? (
                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-white/[0.06] bg-white/[0.02] shadow-2xl">
        <CardHeader className="pb-2 pt-8 px-8">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="h-4 w-4 text-slate-500" />
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Secure Access</span>
          </div>
          <h2 className="text-xl font-semibold text-white">Sign in to your account</h2>
          <p className="text-sm text-slate-400 mt-1">Enter your partner credentials below.</p>
        </CardHeader>
        <CardContent className="px-8 pb-8 pt-4">
          <form onSubmit={handleLogin} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">Password</label>
                <button
                  type="button"
                  onClick={() => setView("forgot")}
                  className="text-xs text-sky-400/70 hover:text-sky-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="bg-white/[0.04] border-white/10 text-white placeholder:text-slate-600 focus-visible:ring-sky-500/40 h-11"
              />
            </div>
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all"
            >
              {loading ? (
                <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </form>
          <div className="mt-6 pt-5 border-t border-white/[0.06] text-center">
            <button
              type="button"
              className="text-sm text-sky-400/80 hover:text-sky-300 transition-colors"
              onClick={() => setView("register")}
            >
              Request Partner Access →
            </button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] flex">
      <div className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 bg-[hsl(222,47%,8%)] border-r border-white/5">
        <div>
          <div className="flex items-center gap-3 mb-16">
            <div className="h-9 w-9 rounded-lg bg-sky-500/20 flex items-center justify-center">
              <Shield className="h-5 w-5 text-sky-400" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white/90 font-mono">WindowMan</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-white leading-tight mb-4">Partner Portal</h1>
          <p className="text-xl text-sky-400 font-medium mb-8">Weaponized Competitive Intelligence</p>
          <p className="text-sm text-slate-400 leading-relaxed max-w-md">
            Access real-time dossiers on in-market homeowners. See exactly what your competitor quoted,
            where they cut corners, and how to win the deal.
          </p>
        </div>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0" />
            <p className="text-xs text-slate-500">Verified homeowner leads with quote intelligence</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0" />
            <p className="text-xs text-slate-500">Forensic vulnerability reports on competitor quotes</p>
          </div>
          <div className="flex items-start gap-3">
            <div className="h-1.5 w-1.5 rounded-full bg-sky-500 mt-2 shrink-0" />
            <p className="text-xs text-slate-500">Pay-per-lead — no monthly contracts</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-10 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Shield className="h-6 w-6 text-sky-400" />
              <span className="text-lg font-semibold text-white/90 font-mono">WindowMan</span>
            </div>
            <h1 className="text-2xl font-bold text-white mb-1">Partner Portal</h1>
            <p className="text-sm text-sky-400">Weaponized Competitive Intelligence</p>
          </div>

          {rightPanel()}

          <p className="text-center text-[11px] text-slate-600 mt-6">
            WindowMan Partner Portal is invitation-only.
            <br />
            Unauthorized access attempts are logged.
          </p>
        </div>
      </div>
    </div>
  );
}
