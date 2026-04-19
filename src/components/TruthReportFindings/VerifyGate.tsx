/**
 * VerifyGate — Inline phone/OTP form placed between findings and evidence.
 * Includes Zeigarnik progress bar ("STEP 2 OF 2").
 *
 * Phase 3: auto-submit on 6th digit, error shake + auto-clear,
 *          CRO micro-copy, autoComplete="one-time-code".
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Loader2, ShieldOff, Clock, WifiOff, AlertCircle } from "lucide-react";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { trackGtmEvent } from "@/lib/trackConversion";

interface VerifyGateProps {
  issueCount: number;
  onVerified: () => void;
  scanSessionId?: string | null;
}

type Step = "phone" | "sending" | "otp" | "verifying";
type ErrorCategory = "blocked_prefix" | "rate_limit" | "network" | "generic";

const RESEND_COOLDOWN = 30;

const fadeUp = {
  initial: { opacity: 0, y: 16, filter: "blur(4px)" },
  animate: { opacity: 1, y: 0, filter: "blur(0px)" },
  transition: { delay: 0.32, duration: 0.55, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
};

export function VerifyGate({ issueCount, onVerified, scanSessionId }: VerifyGateProps) {
  const { displayValue, rawDigits, e164, isValid, handleChange } = usePhoneInput();
  const [otpValue, setOtpValue] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorCategory, setErrorCategory] = useState<ErrorCategory>("generic");
  const [cooldown, setCooldown] = useState(0);
  const [shakeKey, setShakeKey] = useState(0);
  const otpContainerRef = useRef<HTMLDivElement>(null);

  // ── Dev bypass: auto-skip the entire gate in DEV mode ──────────────
  const devBypassActive = import.meta.env.DEV && !!import.meta.env.VITE_DEV_BYPASS_SECRET;

  useEffect(() => {
    if (devBypassActive) {
      console.info("[VerifyGate] 🔓 DEV BYPASS — auto-verifying");
      onVerified();
    }
  }, [devBypassActive, onVerified]);

  const isPhoneStep = step === "phone" || step === "sending";
  const isOtpStep = step === "otp" || step === "verifying";
  const digitCount = rawDigits.length;
  const progressPercent = isPhoneStep ? 50 + (digitCount / 10) * 40 : 95;

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Classify error message into a category for icon/styling
  const classifyError = (msg: string): ErrorCategory => {
    const lower = msg.toLowerCase();
    if (lower.includes("blocked by our carrier") || lower.includes("blocked")) return "blocked_prefix";
    if (lower.includes("too many") || lower.includes("wait before")) return "rate_limit";
    if (lower.includes("network")) return "network";
    return "generic";
  };

  const setError = (msg: string) => {
    setErrorMsg(msg);
    setErrorCategory(classifyError(msg));
  };

  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (errorMsg) { setErrorMsg(""); setErrorCategory("generic"); }
      handleChange(e);
    },
    [handleChange, errorMsg]
  );

  // Clear error when OTP input changes
  const handleOtpChange = useCallback(
    (val: string) => {
      if (errorMsg) { setErrorMsg(""); setErrorCategory("generic"); }
      setOtpValue(val);
    },
    [errorMsg]
  );

  const handleSendCode = async () => {
    if (!isValid || !e164) return;
    setStep("sending");
    setErrorMsg("");
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone_e164: e164 },
      });
      if (error || !data?.success) {
        setError(data?.error || "Failed to send code.");
        setStep("phone");
        return;
      }
      setStep("otp");
      setCooldown(RESEND_COOLDOWN);
    } catch {
      setError("Network error. Try again.");
      setStep("phone");
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || !e164) return;
    setErrorMsg("");
    setErrorCategory("generic");
    setCooldown(RESEND_COOLDOWN);
    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone_e164: e164 },
      });
      if (error || !data?.success) {
        setError(data?.error || "Failed to resend code.");
        setCooldown(0);
      }
    } catch {
      setError("Network error. Try again.");
      setCooldown(0);
    }
  };

  const verifyLockRef = useRef(false);

  const handleVerify = useCallback(async () => {
    if (otpValue.length < 6 || !e164 || step === "verifying" || verifyLockRef.current) return;
    verifyLockRef.current = true;
    setStep("verifying");
    setErrorMsg("");
    setErrorCategory("generic");
    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: { phone_e164: e164, code: otpValue, scan_session_id: scanSessionId || undefined },
      });
      if (error || !data?.verified) {
        setError(data?.error || "Invalid or expired code.");
        setStep("otp");
        // Shake + auto-clear
        setShakeKey((k) => k + 1);
        setTimeout(() => {
          setOtpValue("");
        }, 600);
        return;
      }
      trackGtmEvent("otp_verified", {
        scan_session_id: scanSessionId || undefined,
        phone_e164_last4: e164 ? e164.slice(-4) : undefined,
      });
      trackGtmEvent("report_revealed", {
        scan_session_id: scanSessionId || undefined,
      });
      onVerified();
    } catch {
      setError("Network error. Try again.");
      setStep("otp");
      setShakeKey((k) => k + 1);
      setTimeout(() => {
        setOtpValue("");
      }, 600);
    } finally {
      verifyLockRef.current = false;
    }
  }, [otpValue, e164, step, scanSessionId, onVerified]);

  // Auto-submit when 6th digit entered
  useEffect(() => {
    if (otpValue.length === 6 && step === "otp") {
      handleVerify();
    }
  }, [otpValue, step, handleVerify]);

  return (
    <motion.div
      {...fadeUp}
      className="mb-12 border border-gold/30 bg-gold/[0.03] px-5 sm:px-8 py-7"
      role="region"
      aria-label="Phone verification to unlock report"
    >
      {/* Progress bar */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] tracking-[0.1em] text-gold font-bold">
            {isPhoneStep ? "STEP 2 OF 2" : "FINAL STEP"}
          </span>
          <span className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
            {isPhoneStep ? "ALMOST UNLOCKED" : "VERIFYING"}
          </span>
        </div>
        <div className="h-1 bg-surface-border overflow-hidden" role="progressbar" aria-valuenow={Math.round(progressPercent)} aria-valuemin={0} aria-valuemax={100}>
          <motion.div
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-gold to-[#E2B04A] shadow-[0_0_8px_rgba(200,149,42,0.4)]"
          />
        </div>
      </div>

      {/* Headline */}
      <div className="flex items-center gap-2 mb-1">
        <Lock size={14} className="text-gold" aria-hidden="true" />
        <span className="font-mono text-[10px] tracking-[0.1em] text-gold font-bold">
          VERIFICATION REQUIRED
        </span>
      </div>
      <h3 className="font-heading text-xl font-black text-foreground leading-tight mb-1">
        We found {issueCount} issue{issueCount !== 1 ? "s" : ""} in your quote.
      </h3>
      <p className="text-sm text-muted-foreground mb-5">
        Verify your number to see the full details.
      </p>

      {/* Error with contextual icon */}
      {errorMsg && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-3 px-3 py-2.5 rounded-md flex items-start gap-2"
          role="alert"
          style={{
            background: errorCategory === "blocked_prefix" || errorCategory === "rate_limit"
              ? "hsl(var(--color-caution) / 0.1)"
              : errorCategory === "network"
                ? "hsl(var(--muted-foreground) / 0.08)"
                : "hsl(var(--color-danger) / 0.08)",
            border: `1px solid ${
              errorCategory === "blocked_prefix" || errorCategory === "rate_limit"
                ? "hsl(var(--color-caution) / 0.25)"
                : errorCategory === "network"
                  ? "hsl(var(--muted-foreground) / 0.2)"
                  : "hsl(var(--color-danger) / 0.25)"
            }`,
          }}
        >
          {errorCategory === "blocked_prefix" ? (
            <ShieldOff size={14} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--color-caution))" }} />
          ) : errorCategory === "rate_limit" ? (
            <Clock size={14} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--color-caution))" }} />
          ) : errorCategory === "network" ? (
            <WifiOff size={14} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--muted-foreground))" }} />
          ) : (
            <AlertCircle size={14} className="mt-0.5 shrink-0" style={{ color: "hsl(var(--color-danger))" }} />
          )}
          <div>
            <p
              className="text-xs font-semibold"
              style={{
                color: errorCategory === "blocked_prefix" || errorCategory === "rate_limit"
                  ? "hsl(var(--color-caution))"
                  : errorCategory === "network"
                    ? "hsl(var(--muted-foreground))"
                    : "hsl(var(--color-danger))",
              }}
            >
              {errorMsg}
            </p>
            {errorCategory === "blocked_prefix" && (
              <p className="text-[11px] text-muted-foreground mt-0.5">Try a different phone number to continue.</p>
            )}
            {errorCategory === "rate_limit" && (
              <p className="text-[11px] text-muted-foreground mt-0.5">This protects your phone from abuse. The limit resets shortly.</p>
            )}
          </div>
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {isPhoneStep && (
          <motion.div
            key="phone"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 max-w-[480px]"
          >
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground font-semibold pointer-events-none" aria-hidden="true">
                +1
              </span>
              <input
                type="tel"
                value={displayValue}
                onChange={handlePhoneChange}
                placeholder="(555) 555-5555"
                aria-label="US phone number"
                autoComplete="tel-national"
                className="w-full h-[50px] bg-surface text-foreground text-center text-lg font-semibold tracking-wide pl-10 pr-4 outline-none border-2 transition-all duration-200 caret-gold"
                style={{
                  borderColor: isValid ? "hsl(var(--gold))" : "hsl(var(--surface-border))",
                  boxShadow: isValid ? "0 0 0 4px hsl(var(--gold) / 0.12)" : "none",
                }}
              />
            </div>
            <button
              onClick={handleSendCode}
              disabled={!isValid || step === "sending"}
              aria-label={`Send verification code to unlock ${issueCount} issues`}
              className="h-[50px] px-6 font-bold text-sm flex items-center justify-center gap-2 shrink-0 transition-all active:scale-[0.97]"
              style={{
                background: isValid ? "linear-gradient(135deg, hsl(var(--gold)), #E2B04A)" : "hsl(var(--gold) / 0.2)",
                color: isValid ? "white" : "hsl(var(--foreground) / 0.4)",
                cursor: isValid && step !== "sending" ? "pointer" : "not-allowed",
                boxShadow: isValid ? "0 4px 16px hsl(var(--gold) / 0.3)" : "none",
              }}
            >
              {step === "sending" ? (
                <><Loader2 size={16} className="animate-spin" aria-hidden="true" /> Sending…</>
              ) : (
                <>🔓 Reveal {issueCount} Issue{issueCount !== 1 ? "s" : ""}</>
              )}
            </button>
          </motion.div>
        )}

        {isOtpStep && (
          <motion.div
            key="otp"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col items-start gap-3"
          >
            <p className="text-sm text-muted-foreground" id="otp-instructions">
              Your Impact Window Audit is Ready. Enter the code we just texted you to unlock your counter-offer.
            </p>
            <div key={shakeKey} ref={otpContainerRef} className={shakeKey > 0 ? "otp-shake" : ""}>
              <InputOTP maxLength={6} value={otpValue} onChange={handleOtpChange} aria-describedby="otp-instructions" autoFocus>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot
                      key={i}
                      index={i}
                      className="!border-surface-border !bg-surface/60 !text-foreground !w-12 !h-14 !text-xl !font-bold"
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <div className="flex flex-col items-start gap-3 w-full">
              {/* Verifying spinner (replaces removed button) */}
              {step === "verifying" && (
                <div className="h-[50px] px-6 font-bold text-sm flex items-center justify-center gap-2">
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Verifying…
                </div>
              )}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="text-xs text-muted-foreground underline underline-offset-2 disabled:opacity-50 disabled:no-underline disabled:cursor-default transition-opacity"
                  aria-label={cooldown > 0 ? `Resend code available in ${cooldown} seconds` : "Resend verification code"}
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
                <span className="text-muted-foreground/30">·</span>
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setOtpValue(""); setErrorMsg(""); setErrorCategory("generic"); setCooldown(0); }}
                  className="text-xs text-muted-foreground underline underline-offset-2"
                >
                  Use a different number
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[11px] text-muted-foreground/50 mt-4">
        We'll text a 6-digit code. No spam, ever.
      </p>
    </motion.div>
  );
}
