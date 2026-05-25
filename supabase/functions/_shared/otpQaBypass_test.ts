import {
  evaluateOtpQaBypassForSend,
  evaluateOtpQaBypassForVerify,
  type OtpQaBypassEnv,
  type OtpQaBypassResult,
} from "./otpQaBypass.ts";

const VALID_SCAN = "8ecb10ff-5c29-45be-a44e-4e933358d68b";
const QA_PHONE = "+13055551234";
const QA_CODE = "654321";

const fullEnv: OtpQaBypassEnv = {
  OTP_QA_BYPASS_ENABLED: "true",
  OTP_QA_PHONE_E164: QA_PHONE,
  OTP_QA_CODE: QA_CODE,
  OTP_QA_PROJECT_REF: "zgsofkgddpcntdvpckdq",
  WM_SUPABASE_PROJECT_REF: "zgsofkgddpcntdvpckdq",
};

function assertNoSensitiveFields(result: OtpQaBypassResult): void {
  const serialized = JSON.stringify(result);
  if (serialized.includes(QA_PHONE) || serialized.includes(QA_CODE)) {
    throw new Error("result must not contain phone or code values");
  }
  if (
    Object.prototype.hasOwnProperty.call(result, "phone") ||
    Object.prototype.hasOwnProperty.call(result, "code") ||
    Object.prototype.hasOwnProperty.call(result, "env")
  ) {
    throw new Error("result must not expose phone, code, or env fields");
  }
}

Deno.test("all env absent → approved false, reason missing_env", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: VALID_SCAN,
    env: {},
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "missing_env") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("OTP_QA_BYPASS_ENABLED !== true → disabled", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: VALID_SCAN,
    env: { ...fullEnv, OTP_QA_BYPASS_ENABLED: "false" },
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "disabled") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("wrong phone → denied", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: "+13055559999",
    scanSessionId: VALID_SCAN,
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "wrong_phone") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("wrong code on verify → denied", () => {
  const result = evaluateOtpQaBypassForVerify({
    phoneE164: QA_PHONE,
    code: "000000",
    scanSessionId: VALID_SCAN,
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "wrong_code") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("wrong project ref → denied", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: VALID_SCAN,
    env: {
      ...fullEnv,
      WM_SUPABASE_PROJECT_REF: "other-project-ref",
    },
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "wrong_project") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("missing scan_session_id → denied", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: null,
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "missing_scan_session") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("invalid scan_session_id → denied", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: "not-a-uuid",
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "invalid_scan_session") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("all send locks match → approved", () => {
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: VALID_SCAN,
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (!result.approved || result.reason !== "approved") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("all verify locks match → approved", () => {
  const result = evaluateOtpQaBypassForVerify({
    phoneE164: QA_PHONE,
    code: QA_CODE,
    scanSessionId: VALID_SCAN,
    env: fullEnv,
  });
  assertNoSensitiveFields(result);
  if (!result.approved || result.reason !== "approved") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("send helper does not require OTP_QA_CODE env", () => {
  const { OTP_QA_CODE: _omit, ...sendEnv } = fullEnv;
  const result = evaluateOtpQaBypassForSend({
    phoneE164: QA_PHONE,
    scanSessionId: VALID_SCAN,
    env: sendEnv,
  });
  assertNoSensitiveFields(result);
  if (!result.approved || result.reason !== "approved") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("verify helper requires OTP_QA_CODE env", () => {
  const { OTP_QA_CODE: _omit, ...verifyEnvMissingCode } = fullEnv;
  const result = evaluateOtpQaBypassForVerify({
    phoneE164: QA_PHONE,
    code: QA_CODE,
    scanSessionId: VALID_SCAN,
    env: verifyEnvMissingCode,
  });
  assertNoSensitiveFields(result);
  if (result.approved || result.reason !== "missing_env") {
    throw new Error(JSON.stringify(result));
  }
});

Deno.test("helper result never includes code in serialized output", () => {
  const result = evaluateOtpQaBypassForVerify({
    phoneE164: QA_PHONE,
    code: QA_CODE,
    scanSessionId: VALID_SCAN,
    env: fullEnv,
  });
  const serialized = JSON.stringify(result);
  if (serialized.includes(QA_CODE)) {
    throw new Error("serialized result must not contain OTP code");
  }
});
