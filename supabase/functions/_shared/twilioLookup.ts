export type TwilioBasicLookupResult =
  | {
    readonly kind: "valid";
    readonly canonicalPhoneE164: string;
  }
  | {
    readonly kind: "invalid";
    readonly validationErrors: readonly string[];
  }
  | {
    readonly kind: "unavailable";
    readonly reason:
      | "disabled"
      | "misconfigured"
      | "timeout"
      | "upstream"
      | "malformed";
  };

export type TwilioBasicLookupInput = {
  readonly phoneE164: string;
  readonly enabled: boolean;
  readonly accountSid: string | null | undefined;
  readonly authToken: string | null | undefined;
  readonly timeoutMs?: number;
  readonly fetchImpl?: TwilioLookupFetch;
};

export type TwilioLookupFetch = (
  input: string,
  init: {
    readonly method: "GET";
    readonly headers: Readonly<Record<string, string>>;
    readonly signal: AbortSignal;
  },
) => Promise<Response>;

const US_E164_RE = /^\+1\d{10}$/;
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_VALIDATION_ERRORS = 8;
const SAFE_VALIDATION_ERROR_RE = /^[A-Z0-9_]{1,64}$/;

function normalizeValidationErrors(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is string =>
        typeof entry === "string" && SAFE_VALIDATION_ERROR_RE.test(entry),
    )
    .slice(0, MAX_VALIDATION_ERRORS);
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/**
 * Performs Twilio Lookup v2 Basic validation only. Supplying no `Fields`
 * parameter is deliberate: this helper must not activate a paid data package.
 */
export async function lookupTwilioBasicPhone(
  input: TwilioBasicLookupInput,
): Promise<TwilioBasicLookupResult> {
  if (!US_E164_RE.test(input.phoneE164)) {
    return { kind: "invalid", validationErrors: ["INVALID_FORMAT"] };
  }
  if (!input.enabled) {
    return { kind: "unavailable", reason: "disabled" };
  }

  const accountSid = input.accountSid?.trim();
  const authToken = input.authToken?.trim();
  if (!accountSid || !authToken) {
    return { kind: "unavailable", reason: "misconfigured" };
  }

  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { kind: "unavailable", reason: "misconfigured" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const fetchImpl: TwilioLookupFetch = input.fetchImpl ?? fetch;

  try {
    const response = await fetchImpl(
      `https://lookups.twilio.com/v2/PhoneNumbers/${
        encodeURIComponent(input.phoneE164)
      }`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
          Accept: "application/json",
        },
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      return { kind: "unavailable", reason: "upstream" };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { kind: "unavailable", reason: "malformed" };
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { kind: "unavailable", reason: "malformed" };
    }

    const result = body as Record<string, unknown>;
    if (result.valid === false) {
      return {
        kind: "invalid",
        validationErrors: normalizeValidationErrors(result.validation_errors),
      };
    }
    if (result.valid !== true) {
      return { kind: "unavailable", reason: "malformed" };
    }
    if (
      result.phone_number !== input.phoneE164 ||
      result.country_code !== "US" ||
      result.calling_country_code !== "1"
    ) {
      return { kind: "unavailable", reason: "malformed" };
    }

    return {
      kind: "valid",
      canonicalPhoneE164: input.phoneE164,
    };
  } catch (error) {
    return {
      kind: "unavailable",
      reason: isAbortError(error) ? "timeout" : "upstream",
    };
  } finally {
    clearTimeout(timeout);
  }
}
