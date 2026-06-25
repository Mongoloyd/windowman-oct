/**
 * Google Ads conversion payload validation + dry-run response helpers.
 * Sprint 4C: dry-run only — no Google Ads API calls.
 */

export interface GoogleConversionPayload {
  conversion_action?: string;
  conversion_action_id?: string;
  transaction_id?: string;
  event_id?: string;
  conversion_date_time?: string;
  event_time?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  conversion_value?: number;
  currency_code?: string;
  user_identifiers?: {
    hashed_email?: string;
    hashed_phone_number?: string;
  };
  hashed_email?: string;
  hashed_phone?: string;
}

export interface GoogleAdsConfigPresence {
  has_customer_id: boolean;
  has_conversion_action_id: boolean;
  has_developer_token: boolean;
  has_client_id: boolean;
  has_client_secret: boolean;
  has_refresh_token: boolean;
}

export interface GoogleConversionValidationSuccess {
  ok: true;
  payload: GoogleConversionPayload;
  normalized: {
    conversion_action: string;
    transaction_id: string;
    conversion_date_time: string;
    conversion_value?: number;
    currency_code?: string;
  };
  match_identifier_types: string[];
}

export interface GoogleConversionValidationFailure {
  ok: false;
  error: string;
  retryable: boolean;
}

export type GoogleConversionValidationResult =
  | GoogleConversionValidationSuccess
  | GoogleConversionValidationFailure;

export interface GoogleDryRunMaskedResponse {
  success: true;
  dry_run: true;
  masked_conversion_action: string;
  masked_transaction_id: string;
  match_identifier_types: string[];
  has_value: boolean;
  currency_code: string | null;
  config_presence: GoogleAdsConfigPresence;
}

export interface GoogleLiveDispatchRejectedResponse {
  success: false;
  dry_run: false;
  retryable: false;
  error: string;
}

const SHA256_HEX = /^[a-f0-9]{64}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function maskIdentifier(value: string, prefixLength = 4): string {
  if (value.length <= prefixLength) return "*".repeat(value.length);
  return `${value.slice(0, prefixLength)}…`;
}

export function extractGoogleConversionPayload(
  raw: unknown,
): GoogleConversionPayload | null {
  if (!isRecord(raw)) return null;
  const userIdentifiers = isRecord(raw.user_identifiers)
    ? raw.user_identifiers
    : undefined;

  return {
    conversion_action: readNonEmptyString(raw.conversion_action),
    conversion_action_id: readNonEmptyString(raw.conversion_action_id),
    transaction_id: readNonEmptyString(raw.transaction_id),
    event_id: readNonEmptyString(raw.event_id),
    conversion_date_time: readNonEmptyString(raw.conversion_date_time),
    event_time: readNonEmptyString(raw.event_time),
    gclid: readNonEmptyString(raw.gclid),
    gbraid: readNonEmptyString(raw.gbraid),
    wbraid: readNonEmptyString(raw.wbraid),
    conversion_value: readOptionalNumber(raw.conversion_value),
    currency_code: readNonEmptyString(raw.currency_code),
    user_identifiers: userIdentifiers
      ? {
        hashed_email: readNonEmptyString(userIdentifiers.hashed_email),
        hashed_phone_number: readNonEmptyString(
          userIdentifiers.hashed_phone_number,
        ),
      }
      : undefined,
    hashed_email: readNonEmptyString(raw.hashed_email),
    hashed_phone: readNonEmptyString(raw.hashed_phone),
  };
}

export function parseGoogleConversionRequestBody(
  body: unknown,
): {
  dryRun: boolean | null;
  payload: GoogleConversionPayload | null;
  error?: string;
} {
  if (!isRecord(body)) {
    return { dryRun: null, payload: null, error: "invalid_json_body" };
  }

  if (!("dry_run" in body)) {
    return { dryRun: null, payload: null, error: "missing_dry_run_flag" };
  }

  if (body.dry_run !== true && body.dry_run !== false) {
    return { dryRun: null, payload: null, error: "invalid_dry_run_flag" };
  }

  const payloadRaw = body.payload;
  if (payloadRaw === undefined) {
    return {
      dryRun: body.dry_run,
      payload: null,
      error: "missing_payload",
    };
  }

  const payload = extractGoogleConversionPayload(payloadRaw);
  if (!payload) {
    return {
      dryRun: body.dry_run,
      payload: null,
      error: "invalid_payload",
    };
  }

  return { dryRun: body.dry_run, payload };
}

export function rejectLiveGoogleDispatch(): GoogleLiveDispatchRejectedResponse {
  return {
    success: false,
    dry_run: false,
    retryable: false,
    error: "Live Google Ads dispatch is not enabled in 4C",
  };
}

export function getGoogleAdsConfigPresence(
  env: Record<string, string | undefined> = Deno.env.toObject(),
): GoogleAdsConfigPresence {
  const has = (key: string) => Boolean(env[key]?.trim());

  return {
    has_customer_id: has("GOOGLE_ADS_CUSTOMER_ID"),
    has_conversion_action_id: has("GOOGLE_ADS_CONVERSION_ACTION_ID"),
    has_developer_token: has("GOOGLE_ADS_DEVELOPER_TOKEN"),
    has_client_id: has("GOOGLE_ADS_CLIENT_ID"),
    has_client_secret: has("GOOGLE_ADS_CLIENT_SECRET"),
    has_refresh_token: has("GOOGLE_ADS_REFRESH_TOKEN"),
  };
}

function resolveHashedEmail(payload: GoogleConversionPayload): string | undefined {
  return payload.user_identifiers?.hashed_email ?? payload.hashed_email;
}

function resolveHashedPhone(payload: GoogleConversionPayload): string | undefined {
  return payload.user_identifiers?.hashed_phone_number ?? payload.hashed_phone;
}

function isValidSha256Hex(value: string | undefined): boolean {
  return Boolean(value && SHA256_HEX.test(value));
}

export function validateGoogleConversionPayload(
  payload: GoogleConversionPayload,
): GoogleConversionValidationResult {
  const conversionAction = payload.conversion_action ??
    payload.conversion_action_id;
  if (!conversionAction) {
    return {
      ok: false,
      error: "missing_conversion_action",
      retryable: false,
    };
  }

  const transactionId = payload.transaction_id ?? payload.event_id;
  if (!transactionId) {
    return {
      ok: false,
      error: "missing_transaction_or_event_id",
      retryable: false,
    };
  }

  const conversionDateTime = payload.conversion_date_time ??
    payload.event_time;
  if (!conversionDateTime) {
    return {
      ok: false,
      error: "missing_conversion_date_time",
      retryable: false,
    };
  }

  const matchIdentifierTypes: string[] = [];
  if (payload.gclid) matchIdentifierTypes.push("gclid");
  if (payload.gbraid) matchIdentifierTypes.push("gbraid");
  if (payload.wbraid) matchIdentifierTypes.push("wbraid");

  const hashedEmail = resolveHashedEmail(payload);
  const hashedPhone = resolveHashedPhone(payload);
  if (isValidSha256Hex(hashedEmail)) matchIdentifierTypes.push("hashed_email");
  if (isValidSha256Hex(hashedPhone)) matchIdentifierTypes.push("hashed_phone");

  if (matchIdentifierTypes.length === 0) {
    return {
      ok: false,
      error: "missing_match_identifiers",
      retryable: false,
    };
  }

  return {
    ok: true,
    payload,
    normalized: {
      conversion_action: conversionAction,
      transaction_id: transactionId,
      conversion_date_time: conversionDateTime,
      conversion_value: payload.conversion_value,
      currency_code: payload.currency_code,
    },
    match_identifier_types: matchIdentifierTypes,
  };
}

export function buildGoogleDryRunSuccessResponse(
  validation: GoogleConversionValidationSuccess,
  configPresence: GoogleAdsConfigPresence,
): GoogleDryRunMaskedResponse {
  const { normalized, match_identifier_types } = validation;
  const hasValue = typeof normalized.conversion_value === "number" &&
    Number.isFinite(normalized.conversion_value);

  return {
    success: true,
    dry_run: true,
    masked_conversion_action: maskIdentifier(normalized.conversion_action),
    masked_transaction_id: maskIdentifier(normalized.transaction_id, 8),
    match_identifier_types,
    has_value: hasValue,
    currency_code: normalized.currency_code ?? null,
    config_presence: configPresence,
  };
}

/** Returns true if serialized JSON contains forbidden raw PII / secret value patterns. */
export function containsForbiddenResponseContent(serialized: string): boolean {
  const forbiddenPatterns = [
    /@/,
    /\+1\d{10}/,
    /Bearer\s+[A-Za-z0-9._-]{20,}/,
    /"refresh_token"\s*:\s*"/,
    /"client_secret"\s*:\s*"/,
    /"developer_token"\s*:\s*"/,
    /GOOGLE_ADS_REFRESH_TOKEN=/,
  ];
  return forbiddenPatterns.some((pattern) => pattern.test(serialized));
}
