/**
 * verify-otp pure eligibility predicate suite (Phase A2a, Layer 1).
 *
 * Pure logic only: no Supabase client, no Twilio, no network, no Deno.serve.
 * The module under test has zero imports by design.
 */

import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  evaluatePendingRowEligibility,
  evaluateScanLeadBinding,
  evaluateVerificationCasResult,
  maskPhoneForLog,
  PENDING_STATUS,
  validateVerifyOtpRequest,
  type PendingVerificationRow,
} from "./pendingRowBinding.ts";

const PHONE = "+13055551234";
const SCAN_A = "11111111-1111-4111-8111-111111111111";
const SCAN_B = "22222222-2222-4222-8222-222222222222";
const LEAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROW_ID = "99999999-9999-4999-8999-999999999999";

function pendingRow(
  overrides: Partial<PendingVerificationRow> = {},
): PendingVerificationRow {
  return {
    id: ROW_ID,
    phone_e164: PHONE,
    status: PENDING_STATUS,
    scan_session_id: SCAN_A,
    lead_id: null,
    created_at: "2026-08-04T12:00:00.000Z",
    ...overrides,
  };
}

// ── Request validation ──────────────────────────────────────────────────────

Deno.test("validateVerifyOtpRequest accepts a valid phone/code/scan triple", () => {
  const result = validateVerifyOtpRequest({
    normalizedPhoneE164: PHONE,
    code: " 123456 ",
    scanSessionId: SCAN_A,
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.phoneE164, PHONE);
  assertEquals(result.code, "123456");
  assertEquals(result.scanSessionId, SCAN_A);
});

Deno.test("validateVerifyOtpRequest rejects missing phone or code", () => {
  assertEquals(
    validateVerifyOtpRequest({
      normalizedPhoneE164: "",
      code: "123456",
      scanSessionId: SCAN_A,
    }),
    { ok: false, reason: "missing_phone_or_code" },
  );

  assertEquals(
    validateVerifyOtpRequest({
      normalizedPhoneE164: PHONE,
      code: "   ",
      scanSessionId: SCAN_A,
    }),
    { ok: false, reason: "missing_phone_or_code" },
  );
});

Deno.test("validateVerifyOtpRequest rejects a non-US-E.164 phone", () => {
  assertEquals(
    validateVerifyOtpRequest({
      normalizedPhoneE164: "+443055551234",
      code: "123456",
      scanSessionId: SCAN_A,
    }),
    { ok: false, reason: "invalid_phone" },
  );
});

Deno.test("validateVerifyOtpRequest rejects a missing scan session id", () => {
  for (const scanSessionId of [undefined, null, "", "   "]) {
    assertEquals(
      validateVerifyOtpRequest({
        normalizedPhoneE164: PHONE,
        code: "123456",
        scanSessionId,
      }),
      { ok: false, reason: "missing_scan_session" },
      `expected missing_scan_session for ${JSON.stringify(scanSessionId)}`,
    );
  }
});

Deno.test("validateVerifyOtpRequest rejects a malformed scan session id", () => {
  for (
    const scanSessionId of [
      "not-a-uuid",
      "11111111-1111-4111-8111-11111111111", // one char short
      `${SCAN_A} `, // padded — must not be silently trimmed
      12345,
    ]
  ) {
    assertEquals(
      validateVerifyOtpRequest({
        normalizedPhoneE164: PHONE,
        code: "123456",
        scanSessionId,
      }).ok,
      false,
      `expected rejection for ${JSON.stringify(scanSessionId)}`,
    );
  }
});

Deno.test("validateVerifyOtpRequest returns the scan session id verbatim", () => {
  // Canonical event IDs interpolate this exact string. Trimming or case-folding
  // it here would silently change existing `event_id` bytes.
  const upper = SCAN_A.toUpperCase();
  const result = validateVerifyOtpRequest({
    normalizedPhoneE164: PHONE,
    code: "123456",
    scanSessionId: upper,
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.scanSessionId, upper);
});

// ── Pending-row eligibility ─────────────────────────────────────────────────

Deno.test("eligibility accepts the exact phone/scan pending row", () => {
  const row = pendingRow();
  const result = evaluatePendingRowEligibility({
    pendingRow: row,
    phoneE164: PHONE,
    scanSessionId: SCAN_A,
  });

  assertEquals(result, { eligible: true, row });
});

Deno.test("eligibility rejects a missing pending row", () => {
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: null,
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "no_pending_row" },
  );
});

Deno.test("eligibility rejects a null-session (legacy) row", () => {
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: pendingRow({ scan_session_id: null }),
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "session_null" },
  );
});

Deno.test("eligibility rejects a row bound to a different scan", () => {
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: pendingRow({ scan_session_id: SCAN_B }),
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "session_mismatch" },
  );
});

Deno.test("eligibility rejects an already-verified row", () => {
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: pendingRow({ status: "verified" }),
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "status_not_pending" },
  );
});

Deno.test("eligibility rejects an expired row", () => {
  // `phone_verifications` has no `expires_at` column at this baseline; expiry is
  // represented by send-otp moving superseded rows to status `expired`.
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: pendingRow({ status: "expired" }),
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "status_not_pending" },
  );
});

Deno.test("eligibility rejects a phone mismatch", () => {
  assertEquals(
    evaluatePendingRowEligibility({
      pendingRow: pendingRow({ phone_e164: "+13055559999" }),
      phoneE164: PHONE,
      scanSessionId: SCAN_A,
    }),
    { eligible: false, reason: "phone_mismatch" },
  );
});

Deno.test("row age does not alter the pure eligibility predicate", () => {
  // A2a uses Twilio-controlled code expiry and adds no database age window.
  const ancient = pendingRow({ created_at: "2020-01-01T00:00:00.000Z" });
  const fresh = pendingRow({ created_at: "2026-08-04T12:00:00.000Z" });
  const missing = pendingRow({ created_at: null });

  for (const row of [ancient, fresh, missing]) {
    assertEquals(
      evaluatePendingRowEligibility({
        pendingRow: row,
        phoneE164: PHONE,
        scanSessionId: SCAN_A,
      }).eligible,
      true,
      `created_at must not change eligibility (${row.created_at})`,
    );
  }
});

// ── Scan → lead binding ─────────────────────────────────────────────────────

Deno.test("scan binding resolves the lead attached to the exact scan", () => {
  assertEquals(
    evaluateScanLeadBinding({
      pendingRow: pendingRow(),
      scanSession: { id: SCAN_A, lead_id: LEAD_A },
    }),
    { ok: true, leadId: LEAD_A },
  );
});

Deno.test("scan binding rejects a missing scan session", () => {
  assertEquals(
    evaluateScanLeadBinding({
      pendingRow: pendingRow(),
      scanSession: null,
    }),
    { ok: false, reason: "scan_not_found" },
  );
});

Deno.test("scan binding rejects a scan with a null lead", () => {
  assertEquals(
    evaluateScanLeadBinding({
      pendingRow: pendingRow(),
      scanSession: { id: SCAN_A, lead_id: null },
    }),
    { ok: false, reason: "scan_lead_missing" },
  );
});

Deno.test("scan binding rejects a non-null pending lead that differs from the scan lead", () => {
  assertEquals(
    evaluateScanLeadBinding({
      pendingRow: pendingRow({ lead_id: LEAD_B }),
      scanSession: { id: SCAN_A, lead_id: LEAD_A },
    }),
    { ok: false, reason: "lead_binding_mismatch" },
  );
});

Deno.test("scan binding accepts a pending lead that already matches the scan lead", () => {
  assertEquals(
    evaluateScanLeadBinding({
      pendingRow: pendingRow({ lead_id: LEAD_A }),
      scanSession: { id: SCAN_A, lead_id: LEAD_A },
    }),
    { ok: true, leadId: LEAD_A },
  );
});

// ── Compare-and-set result shape ────────────────────────────────────────────

Deno.test("CAS accepts exactly one returned row matching the target id", () => {
  assertEquals(
    evaluateVerificationCasResult({
      expectedRowId: ROW_ID,
      data: [{ id: ROW_ID }],
    }),
    { ok: true, rowId: ROW_ID },
  );
});

Deno.test("CAS fails closed on zero rows, null, and undefined", () => {
  for (const data of [[], null, undefined]) {
    assertEquals(
      evaluateVerificationCasResult({ expectedRowId: ROW_ID, data }),
      { ok: false, reason: "cas_no_rows" },
      `expected cas_no_rows for ${JSON.stringify(data ?? null)}`,
    );
  }
});

Deno.test("CAS fails closed on more than one row", () => {
  assertEquals(
    evaluateVerificationCasResult({
      expectedRowId: ROW_ID,
      data: [{ id: ROW_ID }, { id: "other" }],
    }),
    { ok: false, reason: "cas_multiple_rows" },
  );
});

Deno.test("CAS fails closed on an unexpected result shape", () => {
  const cases: unknown[] = [
    { id: ROW_ID },
    ["not-an-object"],
    [{}],
    [{ id: 42 }],
    [{ id: "a-different-row" }],
  ];

  for (const data of cases) {
    assertEquals(
      evaluateVerificationCasResult({ expectedRowId: ROW_ID, data }).ok,
      false,
      `expected failure for ${JSON.stringify(data)}`,
    );
  }
});

// ── Log masking ─────────────────────────────────────────────────────────────

Deno.test("maskPhoneForLog never emits the full phone number", () => {
  assertEquals(maskPhoneForLog(PHONE), "xxx-xxx-1234");
  assertEquals(maskPhoneForLog(undefined), "xxx-xxx-");
  assertEquals(maskPhoneForLog(PHONE).includes("305"), false);
});
