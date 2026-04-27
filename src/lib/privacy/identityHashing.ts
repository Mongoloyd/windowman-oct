export interface HashResult {
  hash: string | null;
  present: boolean;
  alreadyHashed: boolean;
  normalizationApplied: boolean;
}

export interface IdentityHashInput {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  externalId?: string | null;
}

export interface HashedIdentity {
  email_hash: string | null;
  phone_hash: string | null;
  first_name_hash: string | null;
  last_name_hash: string | null;
  city_hash: string | null;
  state_hash: string | null;
  zip_hash: string | null;
  country_hash: string | null;
  external_id_hash: string | null;
  email_hash_present: boolean;
  phone_hash_present: boolean;
  first_name_hash_present: boolean;
  last_name_hash_present: boolean;
  city_hash_present: boolean;
  state_hash_present: boolean;
  zip_hash_present: boolean;
  country_hash_present: boolean;
  external_id_hash_present: boolean;
  email_already_hashed: boolean;
  phone_already_hashed: boolean;
  first_name_already_hashed: boolean;
  last_name_already_hashed: boolean;
  city_already_hashed: boolean;
  state_already_hashed: boolean;
  zip_already_hashed: boolean;
  country_already_hashed: boolean;
  external_id_already_hashed: boolean;
}

export type EnhancedMatchingReadiness = "ready" | "partial" | "missing" | "manual_review";

export interface HashedIdentityDiagnostics {
  email_hash_present: boolean;
  phone_hash_present: boolean;
  external_id_hash_present: boolean;
  enhanced_matching_readiness: EnhancedMatchingReadiness;
  already_hashed_detected: boolean;
  hash_prefixes?: {
    email?: string;
    phone?: string;
    external_id?: string;
  };
}

export interface ProviderIdentityContracts {
  meta: {
    em?: string[];
    ph?: string[];
    external_id?: string[];
  };
  googleEnhancedConversions: {
    email?: string;
    phone_number?: string;
    first_name?: string;
    last_name?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country_code?: string;
  };
  tiktok: {
    email?: string;
    phone?: string;
    external_id?: string;
  };
}

interface HashOptions {
  normalizer?: (value: string | null | undefined) => string | null;
}

const SHA_256_HEX_PATTERN = /^[a-f0-9]{64}$/i;

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = trimToNull(email);
  return trimmed ? trimmed.toLowerCase() : null;
}

export function normalizePhone(phone: string | null | undefined): string | null {
  const trimmed = trimToNull(phone);
  if (!trimmed) return null;

  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return null;

  if (hasLeadingPlus) {
    return digits.length >= 8 && digits.length <= 15 ? `+${digits}` : null;
  }

  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return null;
}

export function normalizeBasicText(value: string | null | undefined): string | null {
  const trimmed = trimToNull(value);
  return trimmed ? trimmed.toLowerCase().replace(/\s+/g, " ") : null;
}

export function isSha256Hex(value: string | null | undefined): boolean {
  const trimmed = trimToNull(value);
  return Boolean(trimmed && SHA_256_HEX_PATTERN.test(trimmed));
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashNormalizedValue(value: string | null | undefined, options: HashOptions = {}): Promise<HashResult> {
  const trimmed = trimToNull(value);
  if (!trimmed) {
    return { hash: null, present: false, alreadyHashed: false, normalizationApplied: false };
  }

  if (isSha256Hex(trimmed)) {
    return { hash: trimmed.toLowerCase(), present: true, alreadyHashed: true, normalizationApplied: false };
  }

  const normalizer = options.normalizer ?? normalizeBasicText;
  const normalized = normalizer(trimmed);
  if (!normalized) {
    return { hash: null, present: false, alreadyHashed: false, normalizationApplied: false };
  }

  return {
    hash: await sha256Hex(normalized),
    present: true,
    alreadyHashed: false,
    normalizationApplied: normalized !== trimmed,
  };
}

export async function buildHashedIdentity(input: IdentityHashInput): Promise<HashedIdentity> {
  const email = await hashNormalizedValue(input.email, { normalizer: normalizeEmail });
  const phone = await hashNormalizedValue(input.phone, { normalizer: normalizePhone });
  const firstName = await hashNormalizedValue(input.firstName, { normalizer: normalizeBasicText });
  const lastName = await hashNormalizedValue(input.lastName, { normalizer: normalizeBasicText });
  const city = await hashNormalizedValue(input.city, { normalizer: normalizeBasicText });
  const state = await hashNormalizedValue(input.state, { normalizer: normalizeBasicText });
  const zip = await hashNormalizedValue(input.zip, { normalizer: normalizeBasicText });
  const country = await hashNormalizedValue(input.country, { normalizer: normalizeBasicText });
  const externalId = await hashNormalizedValue(input.externalId, { normalizer: normalizeBasicText });

  return {
    email_hash: email.hash,
    phone_hash: phone.hash,
    first_name_hash: firstName.hash,
    last_name_hash: lastName.hash,
    city_hash: city.hash,
    state_hash: state.hash,
    zip_hash: zip.hash,
    country_hash: country.hash,
    external_id_hash: externalId.hash,
    email_hash_present: email.present,
    phone_hash_present: phone.present,
    first_name_hash_present: firstName.present,
    last_name_hash_present: lastName.present,
    city_hash_present: city.present,
    state_hash_present: state.present,
    zip_hash_present: zip.present,
    country_hash_present: country.present,
    external_id_hash_present: externalId.present,
    email_already_hashed: email.alreadyHashed,
    phone_already_hashed: phone.alreadyHashed,
    first_name_already_hashed: firstName.alreadyHashed,
    last_name_already_hashed: lastName.alreadyHashed,
    city_already_hashed: city.alreadyHashed,
    state_already_hashed: state.alreadyHashed,
    zip_already_hashed: zip.alreadyHashed,
    country_already_hashed: country.alreadyHashed,
    external_id_already_hashed: externalId.alreadyHashed,
  };
}

export function getEnhancedMatchingReadiness(identity: Pick<HashedIdentity, "email_hash_present" | "phone_hash_present" | "external_id_hash_present">): EnhancedMatchingReadiness {
  if (identity.email_hash_present && identity.phone_hash_present) return "ready";
  if (identity.email_hash_present || identity.phone_hash_present || identity.external_id_hash_present) return "partial";
  return "missing";
}

export function getHashedIdentityDiagnostics(identity: HashedIdentity, options: { includeHashPrefixes?: boolean } = {}): HashedIdentityDiagnostics {
  const alreadyHashedDetected = [
    identity.email_already_hashed,
    identity.phone_already_hashed,
    identity.first_name_already_hashed,
    identity.last_name_already_hashed,
    identity.city_already_hashed,
    identity.state_already_hashed,
    identity.zip_already_hashed,
    identity.country_already_hashed,
    identity.external_id_already_hashed,
  ].some(Boolean);

  const diagnostics: HashedIdentityDiagnostics = {
    email_hash_present: identity.email_hash_present,
    phone_hash_present: identity.phone_hash_present,
    external_id_hash_present: identity.external_id_hash_present,
    enhanced_matching_readiness: getEnhancedMatchingReadiness(identity),
    already_hashed_detected: alreadyHashedDetected,
  };

  if (options.includeHashPrefixes) {
    diagnostics.hash_prefixes = {
      ...(identity.email_hash ? { email: identity.email_hash.slice(0, 8) } : {}),
      ...(identity.phone_hash ? { phone: identity.phone_hash.slice(0, 8) } : {}),
      ...(identity.external_id_hash ? { external_id: identity.external_id_hash.slice(0, 8) } : {}),
    };
  }

  return diagnostics;
}

export function buildProviderIdentityContracts(identity: HashedIdentity): ProviderIdentityContracts {
  return {
    meta: {
      ...(identity.email_hash ? { em: [identity.email_hash] } : {}),
      ...(identity.phone_hash ? { ph: [identity.phone_hash] } : {}),
      ...(identity.external_id_hash ? { external_id: [identity.external_id_hash] } : {}),
    },
    googleEnhancedConversions: {
      ...(identity.email_hash ? { email: identity.email_hash } : {}),
      ...(identity.phone_hash ? { phone_number: identity.phone_hash } : {}),
      ...(identity.first_name_hash ? { first_name: identity.first_name_hash } : {}),
      ...(identity.last_name_hash ? { last_name: identity.last_name_hash } : {}),
      ...(identity.city_hash ? { city: identity.city_hash } : {}),
      ...(identity.state_hash ? { state: identity.state_hash } : {}),
      ...(identity.zip_hash ? { postal_code: identity.zip_hash } : {}),
      ...(identity.country_hash ? { country_code: identity.country_hash } : {}),
    },
    tiktok: {
      ...(identity.email_hash ? { email: identity.email_hash } : {}),
      ...(identity.phone_hash ? { phone: identity.phone_hash } : {}),
      ...(identity.external_id_hash ? { external_id: identity.external_id_hash } : {}),
    },
  };
}
