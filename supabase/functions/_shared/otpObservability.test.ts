import {
  safeMetadata,
  safeRedactTwilioError,
} from "./otpObservability.ts";

Deno.test("safeMetadata whitelists allowed keys only", () => {
  const result = safeMetadata({
    reason: "lookup_rejected",
    branch: "twilio_send",
    phone_e164: "+13055551234",
    code: "123456",
    full_json: { grade: "A" },
    request_origin: "edge",
  });

  if (result.phone_e164 !== undefined || result.code !== undefined) {
    throw new Error("forbidden keys must be stripped");
  }
  if (result.reason !== "lookup_rejected" || result.branch !== "twilio_send") {
    throw new Error(JSON.stringify(result));
  }
  if (result.request_origin !== "edge") {
    throw new Error("request_origin must be set");
  }
});

Deno.test("safeRedactTwilioError extracts code and truncates message", () => {
  const longMessage = "x".repeat(400);
  const result = safeRedactTwilioError({
    code: 20404,
    message: longMessage,
    account_sid: "secret",
    more: "payload",
  });

  if (result.code !== 20404) {
    throw new Error(JSON.stringify(result));
  }
  if (!result.message || result.message.length > 300) {
    throw new Error("message must be truncated");
  }
  if (JSON.stringify(result).includes("account_sid")) {
    throw new Error("must not serialize raw payload fields");
  }
});
