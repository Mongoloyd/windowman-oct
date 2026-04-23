/**
 * usePhonePipeline — Single OTP orchestration hook for all phone-bearing forms.
 *
 * Adding a new OTP UI? Consume this hook — do not call
 * `supabase.functions.invoke('send-otp' | 'verify-otp')` directly.
 * Payload shape is locked by `usePhonePipeline.test.ts`.
 *
 * Two modes:
 *   validate_only        — screen + normalize, no OTP
 *   validate_and_send_otp — screen + normalize + call send-otp
 *
 * Also supports:
 *   submitOtp()           — verify a 6-digit code against verify-otp
 *   resend()              — re-send OTP with cooldown
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { screenPhone } from "@/utils/screenPhone";
import { trackEvent } from "@/lib/trackEvent";
import { sendOtp, verifyOtp } from "@/services/phoneVerificationService";
import type { OtpServiceErr } from "@/types/serviceResults";

/* ── Types ─────────────────────────────────────────────── */

export type PipelineMode = "validate_only" | "validate_and_send_otp";

export type PhoneStatus =
  | "idle"
  | "screening"
  | "invalid"
  | "valid"
  | "sending_otp"
  | "otp_sent"
  | "otp_failed"
  | "verifying"
  | "verified"
  | "error";

export type ErrorType = "rate_limit" | "blocked_prefix" | "expired_session" | "invalid_code" | "network" | "generic";

export interface PipelineStartResult {
  status: "valid" | "otp_sent" | "already_verified" | "blocked" | "error";
  e164?: string;
  error?: string;
}

export interface PipelineVerifyResult {
  status: "verified" | "invalid_code" | "expired" | "error";
  error?: string;
  /** Server-canonical phone in E.164 format, returned on successful verify */
  e164?: string;
  /** Server-generated canonical event_id for the phone_verified business event (browser reuses for dedup) */
  phoneVerifiedEventId?: string | null;
  /** Server-generated canonical event_id for the report_revealed business event (browser reuses for dedup) */
  reportRevealedEventId?: string | null;
}

export interface UsePhonePipelineReturn {
  /** Formatted display value for the input */
  displayValue: string;
  /** Raw digits */
  rawDigits: string;
  /** E.164 or null */
  e164: string | null;
  /** Whether raw input has 10 valid digits */
  inputComplete: boolean;
  /** Current pipeline status */
  phoneStatus: PhoneStatus;
  /** Human-readable error message (empty if none) */
  errorMsg: string;
  /** Classifies the error for richer UX */
  errorType: ErrorType | null;
  /** Resend cooldown in seconds (0 = can resend) */
  resendCooldown: number;
  /** onChange handler for phone input */
  handlePhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Submit phone through the pipeline */
  submitPhone: () => Promise<PipelineStartResult>;
  /** Submit a 6-digit OTP code */
  submitOtp: (code: string) => Promise<PipelineVerifyResult>;
  /** Resend OTP (respects cooldown) */
  resend: (resendOptions?: { scanSessionId?: string | null }) => Promise<PipelineStartResult>;
  /** Reset pipeline to idle */
  reset: () => void;
}

/* ── Constants ─────────────────────────────────────────── */

const RESEND_COOLDOWN_SECONDS = 30;

/* ── Hook ──────────────────────────────────────────────── */

export function usePhonePipeline(
  mode: PipelineMode,
  options?: {
    scanSessionId?: string | null;
    onVerified?: () => void;
    externalPhoneE164?: string | null;
  }
): UsePhonePipelineReturn {
  const { displayValue, rawDigits, e164, isValid, handleChange, setValue } =
    usePhoneInput();

  const [phoneStatus, setPhoneStatus] = useState<PhoneStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [errorType, setErrorType] = useState<ErrorType | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef = useRef(false);

  const activePhone = options?.externalPhoneE164 || e164;

  // Cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
      return;
    }
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current);
    };
  }, [cooldown > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear error when user types
  const handlePhoneChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (errorMsg) { setErrorMsg(""); setErrorType(null); }
      if (phoneStatus === "invalid") setPhoneStatus("idle");
      handleChange(e);
    },
    [handleChange, errorMsg, phoneStatus]
  );

  /* ── submitPhone ─────────────────────────────────────── */

  const submitPhone = useCallback(async (): Promise<PipelineStartResult> => {
    if (isSendingRef.current) {
      console.warn("[usePhonePipeline] submitPhone blocked — send already in-flight");
      return { status: "error", error: "Already sending. Please wait." };
    }
    setErrorMsg(""); setErrorType(null);

    const hasExternal = !!options?.externalPhoneE164;
    let normalizedE164: string;

    if (hasExternal) {
      normalizedE164 = options!.externalPhoneE164!;
    } else {
      const screen = screenPhone(rawDigits);
      if (screen.ok === false) {
        setPhoneStatus("invalid");
        setErrorMsg(screen.reason);
        setErrorType("generic");
        return { status: "blocked", error: screen.reason };
      }
      normalizedE164 = screen.e164;
    }

    if (mode === "validate_only") {
      setPhoneStatus("valid");
      return { status: "valid", e164: normalizedE164 };
    }

    // validate_and_send_otp
    isSendingRef.current = true;
    setPhoneStatus("sending_otp");
    console.log("[usePhonePipeline] submitPhone → calling send-otp", { phone: normalizedE164 });
    try {
      const result = await sendOtp(normalizedE164, options?.scanSessionId || undefined);

      if (!result.ok) {
        const err = result as OtpServiceErr;
        const classifiedType = (err.errorCode || "generic") as ErrorType;
        setPhoneStatus("otp_failed");
        setErrorMsg(err.message);
        setErrorType(classifiedType);
        trackEvent({ event_name: classifiedType === "rate_limit" ? "rate_limit_hit" : "otp_send_failed", session_id: options?.scanSessionId, metadata: { error_type: classifiedType, error_msg: err.message } });
        return { status: "error", error: err.message };
      }

      console.log("[usePhonePipeline] send-otp SUCCESS");
      setPhoneStatus("otp_sent");
      setCooldown(RESEND_COOLDOWN_SECONDS);
      trackEvent({ event_name: "otp_sent", session_id: options?.scanSessionId, metadata: { phone_last4: normalizedE164.slice(-4) } });
      return { status: "otp_sent", e164: normalizedE164 };
    } finally {
      isSendingRef.current = false;
    }
  }, [rawDigits, mode, options?.externalPhoneE164]);

  /* ── submitOtp ───────────────────────────────────────── */

  const isVerifyingRef = useRef(false);

  const submitOtp = useCallback(
    async (code: string): Promise<PipelineVerifyResult> => {
      if (code.length < 6 || !activePhone) {
        return { status: "error", error: "Enter the full 6-digit code." };
      }
      if (isVerifyingRef.current) {
        console.warn("[usePhonePipeline] submitOtp suppressed — already in flight");
        return { status: "error", error: "Already verifying." };
      }
      isVerifyingRef.current = true;

      setPhoneStatus("verifying");
      setErrorMsg(""); setErrorType(null);

      console.log("[usePhonePipeline] submitOtp → calling verify-otp", {
        phone: activePhone, code, scanSessionId: options?.scanSessionId,
      });
      try {
        const result = await verifyOtp(activePhone, code, options?.scanSessionId || undefined);

        if (!result.ok) {
          const err = result as OtpServiceErr;
          const classifiedType = (err.errorCode || "invalid_code") as ErrorType;
          setPhoneStatus("otp_sent"); // allow retry
          setErrorMsg(err.message);
          setErrorType(classifiedType);
          trackEvent({ event_name: "otp_error", session_id: options?.scanSessionId, metadata: { error_type: classifiedType, error_msg: err.message } });
          return { status: "invalid_code", error: err.message };
        }

        const canonicalPhone = result.data.phone_e164;
        console.log("[usePhonePipeline] verify-otp SUCCESS — canonical phone:", canonicalPhone);
        setPhoneStatus("verified");
        trackEvent({ event_name: "otp_verify_success", session_id: options?.scanSessionId, metadata: { phone_last4: canonicalPhone.slice(-4) } });
        options?.onVerified?.();
        return {
          status: "verified",
          e164: canonicalPhone,
          phoneVerifiedEventId: result.data.phone_verified_event_id,
          reportRevealedEventId: result.data.report_revealed_event_id,
        };
      } finally {
        isVerifyingRef.current = false;
      }
    },
    [activePhone, options]
  );

  /* ── resend ──────────────────────────────────────────── */

  const resend = useCallback(async (resendOptions?: { scanSessionId?: string | null }): Promise<PipelineStartResult> => {
    if (cooldown > 0 || !activePhone) {
      const msg = "Please wait before requesting another code.";
      setErrorMsg(msg);
      setErrorType("generic");
      return { status: "blocked", error: msg };
    }
    setErrorMsg(""); setErrorType(null);
    setCooldown(RESEND_COOLDOWN_SECONDS);

    try {
      setPhoneStatus("sending_otp");
      const result = await sendOtp(
        activePhone,
        resendOptions?.scanSessionId || options?.scanSessionId || undefined
      );

      if (!result.ok) {
        const err = result as OtpServiceErr;
        const classifiedType = (err.errorCode || "generic") as ErrorType;
        setErrorMsg(err.message);
        setErrorType(classifiedType);
        setPhoneStatus("otp_failed");
        setCooldown(0);
        return { status: "error", error: err.message };
      }

      setPhoneStatus("otp_sent");
      return { status: "otp_sent", e164: activePhone };
    } catch {
      const msg = "Network error. Please try again.";
      setErrorMsg(msg);
      setErrorType("network");
      setPhoneStatus("otp_failed");
      setCooldown(0);
      return { status: "error", error: msg };
    }
  }, [cooldown, activePhone, options?.scanSessionId]);

  /* ── reset ───────────────────────────────────────────── */

  const reset = useCallback(() => {
    setValue("");
    setPhoneStatus("idle");
    setErrorMsg("");
    setErrorType(null);
    setCooldown(0);
  }, [setValue]);

  return {
    displayValue,
    rawDigits,
    e164,
    inputComplete: isValid,
    phoneStatus,
    errorMsg,
    errorType,
    resendCooldown: cooldown,
    handlePhoneChange,
    submitPhone,
    submitOtp,
    resend,
    reset,
  };
}
