import type { WMIdentityPayload, WMIdentityQuality } from "./types.ts";

function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

function normalizeEmail(email?: string): string | undefined {
  if (!email) return undefined;
  const normalized = email.trim().toLowerCase();
  return normalized.includes("@") ? normalized : undefined;
}

function normalizeUSPhoneE164(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/\D/g, "");
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  return undefined;
}

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface NormalizedIdentity {
  email?: string;
  emailHash?: string;
  phone?: string;
  phoneHash?: string;
  clickId?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  phoneVerifiedAt?: string;
  leadId?: string;
  userId?: string;
  sameDeviceAsUpload?: boolean;
  ipRiskLevel?: "low" | "medium" | "high";
  userAgent?: string;
  clientIp?: string;
}

export async function normalizeAndHashIdentity(
  identity: WMIdentityPayload,
): Promise<NormalizedIdentity> {
  const normalizedEmail = normalizeEmail(identity.email);
  const normalizedPhone = normalizeUSPhoneE164(identity.phone);

  const emailHash = identity.emailHash
    ? (isSha256Hex(identity.emailHash)
      ? identity.emailHash.toLowerCase()
      : await sha256Hex(identity.emailHash.trim().toLowerCase()))
    : normalizedEmail
    ? await sha256Hex(normalizedEmail)
    : undefined;

  const phoneHash = identity.phoneHash
    ? (isSha256Hex(identity.phoneHash)
      ? identity.phoneHash.toLowerCase()
      : normalizedPhone
      ? await sha256Hex(normalizedPhone.replace(/\D/g, ""))
      : await sha256Hex(identity.phoneHash.replace(/\D/g, "")))
    : normalizedPhone
    ? await sha256Hex(normalizedPhone.replace(/\D/g, ""))
    : undefined;

  return {
    leadId: identity.leadId,
    userId: identity.userId,
    email: normalizedEmail,
    emailHash,
    phone: normalizedPhone,
    phoneHash,
    clickId: identity.clickId,
    fbc: identity.fbc,
    fbp: identity.fbp,
    gclid: identity.gclid,
    gbraid: identity.gbraid,
    wbraid: identity.wbraid,
    phoneVerifiedAt: identity.phoneVerifiedAt,
    sameDeviceAsUpload: identity.sameDeviceAsUpload,
    ipRiskLevel: identity.ipRiskLevel,
    userAgent: identity.userAgent,
    clientIp: identity.clientIp,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function computeIdentityStrength(payload: WMIdentityPayload): number {
  let score = 0;
  const hasRawPii = Boolean(payload.email || payload.phone);
  const hasHashedPii = Boolean(payload.emailHash || payload.phoneHash);
  const hasClickId = Boolean(
    payload.clickId || payload.gclid || payload.gbraid || payload.wbraid ||
      payload.fbc,
  );

  if (payload.leadId) score += 0.1;
  if (payload.userId) score += 0.1;
  if (hasRawPii) {
    score += 0.35;
  } else if (hasHashedPii) {
    score += 0.3;
  }
  if (payload.phoneVerifiedAt) score += 0.15;
  if (hasClickId) score += 0.25;
  if (payload.sameDeviceAsUpload) score += 0.05;
  if (payload.ipRiskLevel === "low") score += 0.05;

  if (!hasRawPii && !hasHashedPii && hasClickId) score = Math.min(score, 0.45);

  return clamp01(score);
}

export function computeIdentityQuality(
  payload: WMIdentityPayload,
): WMIdentityQuality {
  const hasStrongPii = Boolean(
    payload.email || payload.phone || payload.emailHash || payload.phoneHash,
  );
  const hasClickId = Boolean(
    payload.clickId || payload.gclid || payload.gbraid || payload.wbraid ||
      payload.fbc,
  );
  const strength = computeIdentityStrength(payload);

  if (hasStrongPii && hasClickId && strength >= 0.6) return "high";
  if (hasStrongPii && strength >= 0.45) return "medium";
  if (strength > 0) return "low";
  return "unknown";
}
