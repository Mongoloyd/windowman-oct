import { normalizePhone } from "./normalizePhone.ts";

export type OtpQaBypassEnv = {
  OTP_QA_BYPASS_ENABLED?: string | null;
  OTP_QA_PHONE_E164?: string | null;
  OTP_QA_CODE?: string | null;
  OTP_QA_PROJECT_REF?: string | null;
  WM_SUPABASE_PROJECT_REF?: string | null;
};

export type OtpQaBypassResult = {
  approved: boolean;
  reason:
    | "approved"
    | "missing_env"
    | "disabled"
    | "wrong_phone"
    | "wrong_code"
    | "wrong_project"
    | "missing_scan_session"
    | "invalid_scan_session";
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNonEmptyString(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function evaluateSendLocks(args: {
  phoneE164: string | null | undefined;
  scanSessionId: string | null | undefined;
  env: OtpQaBypassEnv;
}): OtpQaBypassResult {
  const { phoneE164, scanSessionId, env } = args;

  if (
    !isNonEmptyString(env.OTP_QA_BYPASS_ENABLED) ||
    !isNonEmptyString(env.OTP_QA_PHONE_E164) ||
    !isNonEmptyString(env.OTP_QA_PROJECT_REF) ||
    !isNonEmptyString(env.WM_SUPABASE_PROJECT_REF)
  ) {
    return { approved: false, reason: "missing_env" };
  }

  if (env.OTP_QA_BYPASS_ENABLED.trim() !== "true") {
    return { approved: false, reason: "disabled" };
  }

  if (env.WM_SUPABASE_PROJECT_REF.trim() !== env.OTP_QA_PROJECT_REF.trim()) {
    return { approved: false, reason: "wrong_project" };
  }

  if (scanSessionId == null || scanSessionId === "") {
    return { approved: false, reason: "missing_scan_session" };
  }

  if (typeof scanSessionId !== "string" || !UUID_RE.test(scanSessionId.trim())) {
    return { approved: false, reason: "invalid_scan_session" };
  }

  const normalizedRequestPhone = normalizePhone(phoneE164);
  const normalizedQaPhone = normalizePhone(env.OTP_QA_PHONE_E164);

  if (!normalizedRequestPhone || normalizedRequestPhone !== normalizedQaPhone) {
    return { approved: false, reason: "wrong_phone" };
  }

  return { approved: true, reason: "approved" };
}

export function evaluateOtpQaBypassForSend(args: {
  phoneE164: string | null | undefined;
  scanSessionId: string | null | undefined;
  env: OtpQaBypassEnv;
}): OtpQaBypassResult {
  return evaluateSendLocks(args);
}

export function evaluateOtpQaBypassForVerify(args: {
  phoneE164: string | null | undefined;
  code: string | null | undefined;
  scanSessionId: string | null | undefined;
  env: OtpQaBypassEnv;
}): OtpQaBypassResult {
  const sendResult = evaluateSendLocks(args);
  if (!sendResult.approved) {
    return sendResult;
  }

  if (!isNonEmptyString(args.env.OTP_QA_CODE)) {
    return { approved: false, reason: "missing_env" };
  }

  const requestCode = typeof args.code === "string" ? args.code.trim() : "";
  if (!requestCode || requestCode !== args.env.OTP_QA_CODE.trim()) {
    return { approved: false, reason: "wrong_code" };
  }

  return { approved: true, reason: "approved" };
}
