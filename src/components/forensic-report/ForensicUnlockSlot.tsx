/**
 * ForensicUnlockSlot — production Dark V2 OTP card for partial reveal.
 * OTP-card only: no blur, FOG, or report modules. Handlers come from gateProps.
 */
import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2, RefreshCw, ShieldCheck } from "lucide-react";
import type { LockedOverlayProps } from "@/components/LockedOverlay";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export default function ForensicUnlockSlot({
  gateMode,
  flagCount,
  otpValue,
  onOtpChange,
  onOtpSubmit,
  onSendCode,
  phoneDisplayValue = "",
  phoneIsValid = false,
  phoneDigitCount = 0,
  onPhoneChange,
  onPhoneSubmit,
  tcpaConsent = false,
  onTcpaChange,
  maskedPhone,
  onChangePhone,
  isLoading,
  errorMsg,
  errorType,
  resendCooldown,
  onResend,
  fetchStalled,
  onRetryFetchFull,
}: LockedOverlayProps) {
  const prevOtpLengthRef = useRef(0);
  const autoSubmittedOtpRef = useRef<string | null>(null);

  useEffect(() => {
    if (errorType === "invalid_code") {
      const timer = window.setTimeout(() => onOtpChange(""), 600);
      return () => window.clearTimeout(timer);
    }
  }, [errorType, onOtpChange]);

  useEffect(() => {
    if (gateMode !== "enter_code" || fetchStalled || isLoading) return;
    if (otpValue.length === 6 && prevOtpLengthRef.current < 6) {
      if (autoSubmittedOtpRef.current !== otpValue) {
        autoSubmittedOtpRef.current = otpValue;
        onOtpSubmit();
      }
    }
    if (otpValue.length < 6) {
      autoSubmittedOtpRef.current = null;
    }
    prevOtpLengthRef.current = otpValue.length;
  }, [otpValue, gateMode, fetchStalled, isLoading, onOtpSubmit]);

  const canSubmitPhone = phoneIsValid && tcpaConsent && !isLoading;
  const showOtpStep = gateMode === "enter_code" && !fetchStalled;

  return (
    <div
      className="bg-slate-900 border border-blue-500/25 rounded-2xl shadow-2xl p-6 md:p-8 space-y-5 max-w-2xl mx-auto"
      role="region"
      aria-label="View your full quote analysis"
    >
      <div className="flex items-start gap-3">
        <div
          className="shrink-0 w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/40 flex items-center justify-center"
          style={{ boxShadow: "0 0 24px -6px hsl(217 91% 60% / 0.45)" }}
        >
          <ShieldCheck size={20} className="text-blue-300" aria-hidden />
        </div>
        <div className="space-y-1">
          <p className="text-[11px] font-mono tracking-[0.2em] text-blue-300/90">
            VERIFICATION REQUIRED
          </p>
          <h3 className="text-xl md:text-2xl font-bold text-white leading-tight tracking-tight">
            View Your Full Quote Analysis
          </h3>
          <p className="text-sm text-slate-300/90 leading-relaxed">
            Enter your mobile number to view the findings, supporting context, and the exact questions to ask before signing.
          </p>
          {flagCount > 0 && (
            <p className="text-xs text-slate-400">
              Review your full 5-pillar analysis and scope breakdown.
            </p>
          )}
        </div>
      </div>

      {fetchStalled && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/30 p-4 text-center space-y-3"
          role="alert"
        >
          <div className="flex items-center justify-center gap-2 text-red-300">
            <AlertCircle size={16} aria-hidden />
            <p className="text-sm font-semibold">Report loading failed</p>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            Your identity was verified, but the full report did not load. Tap below to retry.
          </p>
          {onRetryFetchFull && (
            <button
              type="button"
              onClick={onRetryFetchFull}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-5"
            >
              <RefreshCw size={14} aria-hidden />
              Tap to Retry
            </button>
          )}
          <button
            type="button"
            onClick={onResend}
            disabled={resendCooldown > 0}
            className="block w-full text-xs text-slate-400 hover:text-white underline underline-offset-4 disabled:no-underline disabled:opacity-60"
          >
            {resendCooldown > 0
              ? `Resend code (0:${String(resendCooldown).padStart(2, "0")})`
              : "Resend code instead"}
          </button>
        </div>
      )}

      {errorMsg && !fetchStalled && (
        <div
          className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 flex items-start gap-2"
          role="alert"
        >
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" aria-hidden />
          <div className="space-y-1">
            <p className="text-sm text-red-200">{errorMsg}</p>
            {errorType === "rate_limit" && (
              <p className="text-xs text-slate-400">
                This protects your phone from abuse. The limit resets shortly.
              </p>
            )}
            {errorType === "network" && (
              <p className="text-xs text-slate-400">Check your connection and try again.</p>
            )}
            {errorType === "blocked_prefix" && (
              <p className="text-xs text-slate-400">Try a different phone number to continue.</p>
            )}
            {errorType === "expired_session" && gateMode === "enter_code" && (
              <button
                type="button"
                onClick={onResend}
                disabled={resendCooldown > 0}
                className="text-xs text-blue-300 hover:text-blue-200 underline underline-offset-4 disabled:no-underline"
              >
                {resendCooldown > 0 ? `Wait ${resendCooldown}s` : "Request New Code"}
              </button>
            )}
          </div>
        </div>
      )}

      {gateMode === "enter_phone" && (
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300" htmlFor="fus-phone">
              Mobile number
            </label>
            <div className="flex items-center w-full h-12 min-h-[48px] rounded-xl bg-slate-800 border border-slate-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/30 px-4 transition-colors">
              <span className="text-slate-500 text-base mr-2" aria-hidden>
                +1
              </span>
              <input
                id="fus-phone"
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="(561) 123-4567"
                value={phoneDisplayValue}
                onChange={onPhoneChange}
                className="flex-1 bg-transparent text-base text-white placeholder:text-slate-500 focus:outline-none text-center tracking-wide"
              />
              {phoneIsValid && (
                <CheckCircle2 size={18} className="text-emerald-400 shrink-0" aria-hidden />
              )}
            </div>
            {phoneDigitCount > 0 && phoneDigitCount < 10 && (
              <p className="text-xs text-slate-500">{phoneDigitCount}/10 digits</p>
            )}
            <p className="text-[11px] leading-relaxed text-slate-400">
              Your number is used to send a one-time verification code for this report. It does not enroll you in marketing messages or authorize contractor calls.
            </p>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tcpaConsent}
              onChange={(e) => onTcpaChange?.(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-blue-500"
            />
            <span className="text-[11px] text-slate-400 leading-relaxed">
              I agree to receive a one-time verification code via SMS. Msg &amp; data rates may apply.
            </span>
          </label>

          <button
            type="button"
            onClick={onPhoneSubmit}
            disabled={!canSubmitPhone}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-blue-500 text-white font-semibold text-base flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send secure code"
            )}
          </button>
        </div>
      )}

      {gateMode === "send_code" && !fetchStalled && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-slate-300 leading-relaxed">
            {maskedPhone
              ? `We have your number on file (${maskedPhone}). Send a secure code to continue.`
              : "Your phone number is ready for verification. Send a secure code to continue."}
          </p>
          <button
            type="button"
            onClick={onSendCode}
            disabled={isLoading}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-base flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                Sending…
              </>
            ) : (
              "Send secure code"
            )}
          </button>
        </div>
      )}

      {showOtpStep && (
        <div className="space-y-5">
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-400">
              {maskedPhone
                ? `We sent a 6-digit code to ${maskedPhone}`
                : "Enter the 6-digit code we sent to your phone"}
            </p>
            {onChangePhone && (
              <button
                type="button"
                onClick={onChangePhone}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4"
              >
                Change number
              </button>
            )}
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={otpValue}
              onChange={onOtpChange}
              aria-label="One-time verification code"
            >
              <InputOTPGroup className="gap-1.5 sm:gap-2">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot
                    key={i}
                    index={i}
                    className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-slate-600 bg-slate-800 text-white text-lg font-mono first:rounded-l-xl last:rounded-r-xl data-[active=true]:border-blue-400 data-[active=true]:ring-2 data-[active=true]:ring-blue-500/40"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <button
            type="button"
            onClick={onOtpSubmit}
            disabled={otpValue.length < 6 || isLoading}
            className="w-full min-h-[52px] rounded-xl bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold text-base flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 size={18} className="animate-spin" aria-hidden />
                Verifying…
              </>
            ) : (
              "Verify & unlock report"
            )}
          </button>

          <div className="flex items-center justify-center gap-1 text-xs text-slate-400">
            <span>Didn&apos;t get it?</span>
            <button
              type="button"
              onClick={onResend}
              disabled={resendCooldown > 0 || isLoading}
              className="text-blue-400 hover:text-blue-300 underline underline-offset-4 disabled:no-underline disabled:opacity-60"
            >
              {resendCooldown > 0
                ? `Resend (0:${String(resendCooldown).padStart(2, "0")})`
                : "Resend code"}
            </button>
          </div>
        </div>
      )}

      <p className="text-[11px] text-center leading-relaxed text-slate-500">
        Your report is free. No contractor calls, no spam, no obligation.
      </p>
    </div>
  );
}
