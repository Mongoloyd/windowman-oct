/**
 * PreviewUnlockSlot — DEV/SANDBOX VISUAL ONLY.
 *
 * Phone-only unlock gate for the Partial Reveal page. First name, last name,
 * and email are captured BEFORE quote upload elsewhere in the funnel; this
 * card only verifies the phone to unlock the full forensic report.
 *
 * This component does NOT:
 *  - call Supabase
 *  - call send-otp / verify-otp
 *  - fetch the full report
 *  - mutate any backend state
 *  - bypass the real Verify-to-Reveal gate
 *
 * The real production gate lives in `src/components/LockedOverlay.tsx`.
 * This file mirrors its visual states (phone entry → code sent → verifying)
 * using local component state only.
 */
import { useMemo, useState } from "react";
import { ShieldCheck, Loader2, Lock, CheckCircle2, AlertCircle, FileCheck2 } from "lucide-react";
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
      aria-label="Unlock your private Truth Report"
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center"
          style={{ boxShadow: "0 0 24px -6px hsl(217 91% 60% / 0.45)" }}
        >
          <span className="text-[18px] leading-none">🔒</span>
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-mono tracking-[0.2em] text-blue-300/90">
            VERIFICATION REQUIRED
          </p>
          <h3 className="text-xl md:text-2xl font-bold text-white leading-tight tracking-tight">
            Unlock Your Private Truth Report
          </h3>
          <p className="text-sm text-slate-300/90 leading-relaxed">
            WindowMan found risk signals in your quote. Verify your phone to
            access your full Forensic Audit.
          </p>
        </div>
      </div>

      {/* Case file ready summary */}
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3.5 flex items-start gap-3">
        <FileCheck2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-emerald-300">
            Scan Complete · Case File Created
          </p>
          <p className="text-xs text-slate-400 leading-relaxed">
            Your case file is saved. Verify your phone to access your full Forensic Audit.
          </p>
        </div>
      </div>

      {step === "phone" && (
        <div className="space-y-4">
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
                placeholder="(561) 123-4567"
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
                ? "Enter a valid mobile number to receive your secure unlock code."
                : isValid
                  ? "Ready to send verification code."
                  : "Check SMS for your secure code."}
            </p>
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={handleSendCode}
            disabled={!isValid || sending}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:hover:bg-blue-500 text-white font-semibold text-base shadow-[0_8px_24px_-8px_rgba(59,130,246,0.6)] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-colors flex items-center justify-center gap-2 opacity-100"
          >
            {sending ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            {ctaLabel}
          </button>

          <p className="text-[11px] text-center leading-relaxed text-slate-400">
            Your report is free — no strings attached. No contractor calls, no spam, no obligation.
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
              <InputOTPGroup className="gap-1.5 sm:gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-slate-600 bg-slate-800 text-white text-lg font-mono first:rounded-l-xl last:rounded-r-xl border-l data-[active=true]:border-blue-400 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/40 data-[active=true]:bg-slate-800/80"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="button"
            disabled={otp.length !== 6 || verifying}
            onClick={() => handleVerify(otp)}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:hover:bg-blue-500 text-white font-semibold text-base shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors flex items-center justify-center gap-2 opacity-100"
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

          <p className="text-[11px] text-center leading-relaxed text-slate-400">
            Your report is free no strings attached No contractor Calls. No spam. No obligation.
          </p>
        </div>
      )}

      <p className="text-[10px] text-center font-mono tracking-wider text-slate-300">
        DEV PREVIEW
      </p>
    </div>
  );
}
