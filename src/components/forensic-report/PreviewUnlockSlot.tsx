/**
 * PreviewUnlockSlot — DEV/SANDBOX VISUAL ONLY.
 *
 * This component is a presentational harness used exclusively by
 * `/dev/report-preview?v=v3&mode=preview` to visually QA the unlock
 * form / phone field / OTP states inside the forensic dark surface.
 *
 * It does NOT:
 *  - call Supabase
 *  - call send-otp / verify-otp
 *  - fetch the full report
 *  - mutate any backend state
 *  - bypass the real Verify-to-Reveal gate
 *
 * The real production gate lives in `src/components/LockedOverlay.tsx`,
 * orchestrated by the post-scan flow. This file mirrors its visual states
 * (phone entry → code sent → verifying) using local component state only.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, Loader2, Lock, CheckCircle2, AlertCircle } from "lucide-react";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

type Step = "phone" | "code";

function formatPhoneDisplay(digits: string): string {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export default function PreviewUnlockSlot() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [touched, setTouched] = useState(false);
  const [otp, setOtp] = useState("");
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const digits = phone.replace(/\D/g, "").slice(0, 10);
  const isValid = digits.length === 10;
  const showInvalid = touched && digits.length > 0 && !isValid;

  const phoneBorder = useMemo(() => {
    if (showInvalid) return "border-red-500/70 ring-2 ring-red-500/20";
    if (isValid) return "border-emerald-500/70 ring-2 ring-emerald-500/20";
    return "border-slate-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30";
  }, [isValid, showInvalid]);

  const ctaLabel = sending
    ? "Sending…"
    : isValid
      ? "Send Verification Code"
      : "Unlock My Report";

  const handleSendCode = () => {
    if (!isValid || sending) return;
    setSending(true);
    // VISUAL ONLY — no real network call. Mimic latency for QA.
    setTimeout(() => {
      setSending(false);
      setStep("code");
    }, 600);
  };

  const handleVerify = (value: string) => {
    if (value.length !== 6 || verifying) return;
    setVerifying(true);
    setTimeout(() => setVerifying(false), 800);
  };

  return (
    <div
      className="bg-slate-900 border border-blue-500/25 rounded-2xl shadow-2xl p-6 md:p-8 space-y-5 max-w-2xl mx-auto"
      role="region"
      aria-label="Unlock your full forensic report"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
          <Lock size={18} className="text-blue-400" />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-mono tracking-widest text-blue-400">
            VERIFICATION REQUIRED
          </p>
          <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">
            Unlock Your Full Report
          </h3>
          <p className="text-sm text-slate-400">
            Your report stays private until your phone is verified. Used only
            to send your secure one-time code. No spam. No obligation.
          </p>
        </div>
      </div>

      {step === "phone" && (
        <div className="space-y-4">
          {/* Name row — visual only */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300" htmlFor="pus-fname">
                First name
              </label>
              <input
                id="pus-fname"
                type="text"
                autoComplete="given-name"
                placeholder="Maria"
                className="w-full h-12 min-h-[48px] text-base rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300" htmlFor="pus-lname">
                Last name
              </label>
              <input
                id="pus-lname"
                type="text"
                autoComplete="family-name"
                placeholder="Gonzalez"
                className="w-full h-12 min-h-[48px] text-base rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300" htmlFor="pus-email">
              Email
            </label>
            <input
              id="pus-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="w-full h-12 min-h-[48px] text-base rounded-xl bg-slate-800 border border-slate-600 text-white placeholder:text-slate-500 px-4 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300" htmlFor="pus-phone">
              Mobile number
            </label>
            <div
              className={`flex items-center w-full h-12 min-h-[48px] rounded-xl bg-slate-800 border transition-colors px-4 ${phoneBorder}`}
            >
              <span className="text-slate-500 text-base mr-2">🇺🇸 +1</span>
              <input
                id="pus-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(555) 123-4567"
                value={formatPhoneDisplay(digits)}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (!touched) setTouched(true);
                }}
                onBlur={() => setTouched(true)}
                className="flex-1 bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none"
              />
              {isValid && <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />}
              {showInvalid && <AlertCircle size={18} className="text-red-400 shrink-0" />}
            </div>
            <p
              className={`text-xs ${
                showInvalid
                  ? "text-red-400"
                  : isValid
                    ? "text-emerald-400"
                    : "text-slate-500"
              }`}
            >
              {showInvalid
                ? "Enter a valid 10-digit US mobile number"
                : isValid
                  ? "Ready to send verification code"
                  : "We'll text you a 6-digit code. Standard message rates apply."}
            </p>
          </div>

          {/* TCPA */}
          <label className="flex items-start gap-3 text-xs text-slate-400 leading-relaxed cursor-pointer select-none">
            <input
              type="checkbox"
              defaultChecked
              className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-2 focus:ring-blue-500/40"
            />
            <span>
              I agree to receive a one-time verification code by SMS. Message
              and data rates may apply. Reply STOP to opt out.
            </span>
          </label>

          {/* CTA */}
          <button
            type="button"
            onClick={handleSendCode}
            disabled={!isValid || sending}
            className="w-full min-h-[52px] h-13 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-semibold text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {ctaLabel}
          </button>

          <p className="text-[11px] text-center text-slate-500">
            🔒 Secure verification · Your number is never shared
          </p>
        </div>
      )}

      {step === "code" && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-400">
              We sent a 6-digit code to{" "}
              <span className="text-white font-medium">
                {formatPhoneDisplay(digits) || "your phone"}
              </span>
            </p>
            <button
              type="button"
              onClick={() => {
                setStep("phone");
                setOtp("");
              }}
              className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
            >
              Change number
            </button>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otp}
              onChange={(v) => {
                setOtp(v);
                handleVerify(v);
              }}
            >
              <InputOTPGroup className="gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-11 sm:h-14 sm:w-12 rounded-xl border border-slate-600 bg-slate-800 text-white text-lg font-mono first:rounded-l-xl last:rounded-r-xl border-l data-[active=true]:border-blue-500 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/30"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="button"
            disabled={otp.length !== 6 || verifying}
            onClick={() => handleVerify(otp)}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-semibold text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors flex items-center justify-center gap-2"
          >
            {verifying ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheck size={18} />
                Verify &amp; Unlock Report
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
            <span>Didn't get it?</span>
            <button
              type="button"
              className="text-blue-400 hover:text-blue-300 underline underline-offset-4"
            >
              Resend code
            </button>
          </div>
        </div>
      )}

      <p className="text-[10px] text-center text-slate-600 font-mono tracking-wider">
        DEV PREVIEW · NO REAL OTP IS SENT
      </p>
    </div>
  );
}
