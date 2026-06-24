export type ArbitrageCaptureTokenClaims = {
  v: 1;
  sid: string;
  lid: string;
  src: "arbitrage-engine";
  exp: number;
};

const TOKEN_VERSION = "v1";

function utf8Bytes(input: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(input);
  return new Uint8Array(encoded);
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  const b64 = btoa(binary);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(input: string): Uint8Array | null {
  try {
    let b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const binary = atob(b64);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  } catch {
    return null;
  }
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    const len = Math.max(a.length, b.length);
    let diff = a.length ^ b.length;
    for (let i = 0; i < len; i++) {
      diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    }
    return diff === 0;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i]! ^ b[i]!;
  }
  return diff === 0;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    utf8Bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(secret: string, message: string): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, utf8Bytes(message));
  return new Uint8Array(sig);
}

function parseClaimsJson(raw: string): ArbitrageCaptureTokenClaims | null {
  try {
    const parsed = JSON.parse(raw) as Partial<ArbitrageCaptureTokenClaims>;
    if (
      parsed.v !== 1 ||
      typeof parsed.sid !== "string" ||
      typeof parsed.lid !== "string" ||
      parsed.src !== "arbitrage-engine" ||
      typeof parsed.exp !== "number"
    ) {
      return null;
    }
    return {
      v: 1,
      sid: parsed.sid,
      lid: parsed.lid,
      src: "arbitrage-engine",
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}

export async function signArbitrageCaptureToken(
  claims: ArbitrageCaptureTokenClaims,
  secret: string,
): Promise<string> {
  const payloadJson = JSON.stringify(claims);
  const payloadB64 = bytesToBase64Url(utf8Bytes(payloadJson));
  const signingInput = `${TOKEN_VERSION}.${payloadB64}`;
  const sigBytes = await hmacSign(secret, signingInput);
  const sigB64 = bytesToBase64Url(sigBytes);
  return `${TOKEN_VERSION}.${payloadB64}.${sigB64}`;
}

export async function verifyArbitrageCaptureToken(
  token: string,
  secret: string,
  expected: {
    session_id: string;
    lead_id: string;
    source: "arbitrage-engine";
    now?: number;
  },
): Promise<
  | { ok: true; claims: ArbitrageCaptureTokenClaims }
  | {
      ok: false;
      code:
        | "capture_token_required"
        | "invalid_capture_token"
        | "capture_token_expired";
    }
> {
  if (!token || typeof token !== "string" || token.trim().length === 0) {
    return { ok: false, code: "capture_token_required" };
  }

  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) {
    return { ok: false, code: "invalid_capture_token" };
  }

  const payloadB64 = parts[1]!;
  const sigB64 = parts[2]!;
  const payloadBytes = base64UrlToBytes(payloadB64);
  const sigBytes = base64UrlToBytes(sigB64);
  if (!payloadBytes || !sigBytes) {
    return { ok: false, code: "invalid_capture_token" };
  }

  const signingInput = `${TOKEN_VERSION}.${payloadB64}`;
  const expectedSig = await hmacSign(secret, signingInput);
  if (!constantTimeEqual(sigBytes, expectedSig)) {
    return { ok: false, code: "invalid_capture_token" };
  }

  const payloadJson = new TextDecoder().decode(payloadBytes);
  const claims = parseClaimsJson(payloadJson);
  if (!claims) {
    return { ok: false, code: "invalid_capture_token" };
  }

  const now = expected.now ?? Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    return { ok: false, code: "capture_token_expired" };
  }

  if (
    claims.sid !== expected.session_id ||
    claims.lid !== expected.lead_id ||
    claims.src !== expected.source
  ) {
    return { ok: false, code: "invalid_capture_token" };
  }

  return { ok: true, claims };
}

export const STAGE_RANK = {
  arb_contact: 1,
  arb_identity: 2,
  arb_call_intent: 3,
  arb_complete: 4,
} as const;

export type ArbFunnelStage = keyof typeof STAGE_RANK;

export function stageRank(stage: string | null | undefined): number | null {
  if (!stage || !(stage in STAGE_RANK)) return null;
  return STAGE_RANK[stage as ArbFunnelStage];
}

export function computeMonotonicStage(
  current: string | null | undefined,
  target: ArbFunnelStage,
): ArbFunnelStage {
  const currentRank = stageRank(current) ?? 0;
  const targetRank = STAGE_RANK[target];
  if (targetRank >= currentRank) return target;
  return (current as ArbFunnelStage) ?? target;
}

export function isStageAllowedForAction(
  action: "update_identity" | "update_call_intent" | "update_timeframe",
  currentStage: string | null | undefined,
): boolean {
  const rank = stageRank(currentStage);
  if (rank === null) return false;
  switch (action) {
    case "update_identity":
      return rank >= STAGE_RANK.arb_contact;
    case "update_call_intent":
      return rank >= STAGE_RANK.arb_identity;
    case "update_timeframe":
      return rank >= STAGE_RANK.arb_call_intent;
  }
}
