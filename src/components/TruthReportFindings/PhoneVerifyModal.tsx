/**
 * PhoneVerifyModal — Shared modal for all V2 verification touchpoints.
 * Phone input → OTP entry → onVerified callback.
 *
 * SECURITY: This is a UI gate only. Backend independently gates full_json.
 */

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, Lock } from "lucide-react";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { supabase } from "@/integrations/supabase/client";
import { trackGtmEvent } from "@/lib/trackConversion";

interface PhoneVerifyModalProps {
  open: boolean;
  onClose: () => void;
  onVerified: () => void;
  issueCount: number;
  scanSessionId?: string | null;
}

type Step = "phone" | "sending" | "otp" | "verifying" | "error";

export function PhoneVerifyModal({
  open,
  onClose,
  onVerified,
  issueCount,
  scanSessionId,
}: PhoneVerifyModalProps) {
  const { displayValue, rawDigits, e164, isValid, handleChange } = usePhoneInput();
  const [otpValue, setOtpValue] = useState("");
  const [step, setStep] = useState<Step>("phone");
  const [errorMsg, setErrorMsg] = useState("");

  const isPhoneStep = step === "phone" || step === "sending";
  const isOtpStep = step === "otp" || step === "verifying";
  const digitCount = rawDigits.length;
  const progressPercent = isPhoneStep ? 50 + (digitCount / 10) * 40 : 95;

  const handleSendCode = async () => {
    if (!isValid || !e164) return;
    setStep("sending");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("send-otp", {
        body: { phone_e164: e164 },
      });

      if (error || !data?.success) {
        setErrorMsg(data?.error || "Failed to send code. Try again.");
        setStep("phone");
        return;
      }
      setStep("otp");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStep("phone");
    }
  };

  const handleVerify = async () => {
    if (otpValue.length < 6 || !e164) return;
    setStep("verifying");
    setErrorMsg("");

    try {
      const { data, error } = await supabase.functions.invoke("verify-otp", {
        body: {
          phone_e164: e164,
          code: otpValue,
          scan_session_id: scanSessionId || undefined,
        },
      });

      if (error || !data?.verified) {
        setErrorMsg(data?.error || "Invalid or expired code.");
        setStep("otp");
        return;
      }
      trackGtmEvent("otp_verified", {
        scan_session_id: scanSessionId || undefined,
        phone_e164_last4: e164 ? e164.slice(-4) : undefined,
        source: "modal",
      });
      trackGtmEvent("report_revealed", {
        scan_session_id: scanSessionId || undefined,
        source: "modal",
      });
      onVerified();
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStep("otp");
    }
  };

  const handleReset = () => {
    setStep("phone");
    setOtpValue("");
    setErrorMsg("");
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.97 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[420px] bg-surface border border-surface-border shadow-[0_12px_48px_rgba(0,0,0,0.5)]"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={18} />
          </button>

          <div className="px-7 pt-7 pb-8 text-center">
            {/* Progress bar */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="font-mono text-[10px] tracking-[0.1em] text-gold font-bold">
                  {isPhoneStep ? "STEP 2 OF 2" : "FINAL STEP"}
                </span>
                <span className="font-mono text-[10px] tracking-[0.06em] text-muted-foreground">
                  {isPhoneStep ? "ALMOST UNLOCKED" : "VERIFYING"}
                </span>
              </div>
              <div className="h-1 bg-surface-border overflow-hidden">
                <motion.div
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="h-full bg-gradient-to-r from-gold to-[#E2B04A] shadow-[0_0_8px_rgba(200,149,42,0.4)]"
                />
              </div>
            </div>

            {/* Headline */}
            <div className="mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Lock size={14} className="text-gold" />
                <span className="font-mono text-[11px] tracking-[0.1em] text-gold font-bold">
                  VERIFICATION REQUIRED
                </span>
              </div>
              <h2 className="font-heading text-xl sm:text-2xl font-black text-foreground leading-tight mb-2">
                We found {issueCount} issue{issueCount !== 1 ? "s" : ""} in your quote.
              </h2>
              <p className="text-sm text-muted-foreground">
                Verify your number to see the full details.
              </p>
            </div>

            {/* Error message */}
            {errorMsg && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xs text-vivid-orange mb-4 font-medium"
              >
                {errorMsg}
              </motion.p>
            )}

            <AnimatePresence mode="wait">
              {/* ── Phone step ── */}
              {isPhoneStep && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center gap-3"
                >
                  <div className="relative w-full max-w-[320px]">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground font-semibold pointer-events-none">
                      +1
                    </span>
                    <input
                      type="tel"
                      value={displayValue}
                      onChange={handleChange}
                      placeholder="(555) 555-5555"
                      autoFocus
                      className="w-full h-[54px] bg-surface-border/30 text-foreground text-center text-lg font-semibold tracking-wide pl-10 pr-4 outline-none transition-all duration-200 caret-gold border-2"
                      style={{
                        borderColor: isValid
                          ? "hsl(var(--gold))"
                          : digitCount > 0
                          ? "hsl(var(--surface-border))"
                          : "transparent",
                        boxShadow: isValid
                          ? "0 0 0 4px hsl(var(--gold) / 0.15)"
                          : "none",
                      }}
                    />
                    {digitCount > 0 && digitCount < 10 && (
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 font-mono text-[11px] text-muted-foreground">
                        {digitCount}/10
                      </span>
                    )}
                    {isValid && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gold text-base"
                      >
                        ✓
                      </motion.span>
                    )}
                  </div>

                  <button
                    onClick={handleSendCode}
                    disabled={!isValid || step === "sending"}
                    className="w-full max-w-[320px] h-[54px] font-semibold text-[17px] transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97]"
                    style={{
                      background: isValid
                        ? "linear-gradient(135deg, hsl(var(--gold)), #E2B04A)"
                        : "hsl(var(--gold) / 0.2)",
                      color: isValid ? "white" : "hsl(var(--foreground) / 0.4)",
                      border: isValid
                        ? "1px solid hsl(var(--gold) / 0.3)"
                        : "1px solid transparent",
                      cursor: isValid && step !== "sending" ? "pointer" : "not-allowed",
                      boxShadow: isValid
                        ? "0 6px 24px hsl(var(--gold) / 0.4)"
                        : "none",
                    }}
                  >
                    {step === "sending" ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Sending Code…
                      </>
                    ) : (
                      <>🔓 Reveal {issueCount} Issue{issueCount !== 1 ? "s" : ""}</>
                    )}
                  </button>
                </motion.div>
              )}

              {/* ── OTP step ── */}
              {isOtpStep && (
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col items-center gap-4"
                >
                  <p className="text-sm text-muted-foreground">
                    Enter The 6-Digit Code Sent To Your Phone
                  </p>

                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                    <InputOTPGroup>
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="!border-surface-border !bg-surface-border/30 !text-foreground !w-12 !h-14 !text-xl !font-bold"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>

                  <button
                    onClick={handleVerify}
                    disabled={otpValue.length < 6 || step === "verifying"}
                    className="w-full max-w-[320px] h-[54px] font-semibold text-[17px] transition-all duration-300 flex items-center justify-center gap-2 active:scale-[0.97]"
                    style={{
                      background:
                        otpValue.length === 6
                          ? "linear-gradient(135deg, hsl(var(--gold)), #E2B04A)"
                          : "hsl(var(--gold) / 0.2)",
                      color:
                        otpValue.length === 6
                          ? "white"
                          : "hsl(var(--foreground) / 0.4)",
                      border:
                        otpValue.length === 6
                          ? "1px solid hsl(var(--gold) / 0.3)"
                          : "1px solid transparent",
                      cursor:
                        otpValue.length === 6 && step !== "verifying"
                          ? "pointer"
                          : "not-allowed",
                      boxShadow:
                        otpValue.length === 6
                          ? "0 6px 24px hsl(var(--gold) / 0.4)"
                          : "none",
                    }}
                  >
                    {step === "verifying" ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        Verifying…
                      </>
                    ) : (
                      "Verify & Unlock Report"
                    )}
                  </button>

                  <button
                    onClick={handleReset}
                    className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
                  >
                    Use a Different Number
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <p className="text-[11px] text-muted-foreground/60 mt-5 leading-relaxed">
              We'll Text a 6-Digit Code. No Spam, Ever.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
