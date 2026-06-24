import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  signArbitrageCaptureToken,
  verifyArbitrageCaptureToken,
  type ArbitrageCaptureTokenClaims,
} from "./arbitrageCaptureToken.ts";

const SECRET = "test-secret-for-arbitrage-capture-token";
const SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const LEAD_ID = "11111111-2222-3333-4444-555555555555";

function baseClaims(expOffsetSeconds = 3600): ArbitrageCaptureTokenClaims {
  return {
    v: 1,
    sid: SESSION_ID,
    lid: LEAD_ID,
    src: "arbitrage-engine",
    exp: Math.floor(Date.now() / 1000) + expOffsetSeconds,
  };
}

const expectedBinding = {
  session_id: SESSION_ID,
  lead_id: LEAD_ID,
  source: "arbitrage-engine" as const,
};

Deno.test("sign + verify round trip", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const result = await verifyArbitrageCaptureToken(token, SECRET, expectedBinding);
  assertEquals(result.ok, true);
  if (result.ok) {
    assertEquals(result.claims.sid, SESSION_ID);
    assertEquals(result.claims.lid, LEAD_ID);
  }
});

Deno.test("tampered payload rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const parts = token.split(".");
  const payloadBytes = Uint8Array.from(
    atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  payload.lid = "99999999-9999-9999-9999-999999999999";
  const tamperedPayload = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const tampered = `${parts[0]}.${tamperedPayload}.${parts[2]}`;
  const result = await verifyArbitrageCaptureToken(
    tampered,
    SECRET,
    expectedBinding,
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_capture_token");
});

Deno.test("tampered signature rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const parts = token.split(".");
  const tamperedSig = parts[2] === "AAAA" ? "BBBB" : "AAAA";
  const tampered = `${parts[0]}.${parts[1]}.${tamperedSig}`;
  const result = await verifyArbitrageCaptureToken(
    tampered,
    SECRET,
    expectedBinding,
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_capture_token");
});

Deno.test("wrong secret rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const result = await verifyArbitrageCaptureToken(
    token,
    "wrong-secret",
    expectedBinding,
  );
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_capture_token");
});

Deno.test("expired token rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(-60), SECRET);
  const result = await verifyArbitrageCaptureToken(token, SECRET, {
    ...expectedBinding,
    now: Math.floor(Date.now() / 1000),
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "capture_token_expired");
});

Deno.test("wrong session_id rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const result = await verifyArbitrageCaptureToken(token, SECRET, {
    ...expectedBinding,
    session_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_capture_token");
});

Deno.test("wrong lead_id rejected", async () => {
  const token = await signArbitrageCaptureToken(baseClaims(), SECRET);
  const result = await verifyArbitrageCaptureToken(token, SECRET, {
    ...expectedBinding,
    lead_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "invalid_capture_token");
});

Deno.test("wrong source rejected", async () => {
  const claims = baseClaims();
  const token = await signArbitrageCaptureToken(claims, SECRET);
  const result = await verifyArbitrageCaptureToken(token, SECRET, {
    session_id: SESSION_ID,
    lead_id: LEAD_ID,
    source: "arbitrage-engine",
  });
  assertEquals(result.ok, true);

  const badClaims = { ...claims, src: "other-source" as "arbitrage-engine" };
  const badToken = await signArbitrageCaptureToken(badClaims, SECRET);
  const badResult = await verifyArbitrageCaptureToken(
    badToken,
    SECRET,
    expectedBinding,
  );
  assertEquals(badResult.ok, false);
});

Deno.test("malformed token rejected", async () => {
  const cases = ["", "not-a-token", "v1.only-two-parts", "v2.payload.sig"];
  for (const token of cases) {
    const result = await verifyArbitrageCaptureToken(
      token,
      SECRET,
      expectedBinding,
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(
        result.code === "capture_token_required" ||
          result.code === "invalid_capture_token",
        true,
      );
    }
  }
});

Deno.test("missing token returns capture_token_required", async () => {
  const result = await verifyArbitrageCaptureToken("", SECRET, expectedBinding);
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "capture_token_required");
});
