// ═══════════════════════════════════════════════════════════════════════════════
// verify-otp/pendingRowBinding.ts
//
// Pure, side-effect-free eligibility predicates for OTP verification.
//
// Extracted from index.ts so the fail-closed authority chain can be unit-tested
// without importing the Deno.serve entrypoint, a Supabase client, Twilio, or any
// tracking helper. This module has ZERO imports on purpose: it must stay
// trivially auditable as pure logic.
//
// Phase A2a containment scope:
//   - a verification may only proceed for ONE exact scan-bound pending row;
//   - the scan session must exist and carry a non-null lead;
//   - an existing non-null pending lead must equal the scan's lead;
//   - row age is NOT an eligibility input. `phone_verifications` has no
//     `expires_at` column at this baseline, and code expiry stays owned by
//     Twilio Verify. Do not infer an age window here.
//
// The production entry module (index.ts) imports from here; this module must
// never import test files, assertion libraries, or test-runner registration.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Canonical pending status written by `send-otp` when it inserts a fresh
 * verification row. Superseded rows are moved to `expired` by `send-otp`.
 */
export const PENDING_STATUS = "pending";

/**
 * Strict US E.164, applied AFTER `_shared/normalizePhone.ts` has canonicalized
 * the request value. Mirrors the belt-and-suspenders check already used by
 * `verify-otp` and `send-otp`.
 */
const US_E164_RE = /^\+1\d{10}$/;

/**
 * Same UUID contract already enforced by `_shared/otpQaBypass.ts`. Kept local
 * so this module stays import-free; `otpQaBypass.ts` does not export its regex.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Fields selected from `phone_verifications` to establish eligibility. */
export interface PendingVerificationRow {
  id: string;
  phone_e164: string;
  status: string;
  scan_session_id: string | null;
  lead_id: string | null;
  /**
   * Selected for ordering/forensics only. Deliberately NOT read by any
   * predicate in this module — see the A2a scope note above.
   */
  created_at?: string | null;
}

/** Fields selected from `scan_sessions` to establish the lead binding. */
export interface ScanSessionLeadRow {
  id?: string | null;
  lead_id: string | null;
}

export type VerifyOtpRequestRejection =
  | "missing_phone_or_code"
  | "invalid_phone"
  | "missing_scan_session"
  | "invalid_scan_session";

export type VerifyOtpRequestValidation =
  | {
    ok: true;
    phoneE164: string;
    code: string;
    scanSessionId: string;
  }
  | { ok: false; reason: VerifyOtpRequestRejection };

/**
 * Deterministic request validation that must pass before any database
 * authority lookup, QA bypass, or Twilio call.
 *
 * `normalizedPhoneE164` is expected to already be the output of
 * `_shared/normalizePhone.ts`.
 *
 * `scanSessionId` is returned VERBATIM when valid. It must not be trimmed or
 * case-folded here: the same string feeds the row filter, the QA-bypass
 * evaluation, and the canonical event IDs, so normalizing it would silently
 * change existing `event_id` bytes.
 */
export function validateVerifyOtpRequest(input: {
  normalizedPhoneE164: unknown;
  code: unknown;
  scanSessionId: unknown;
}): VerifyOtpRequestValidation {
  const phoneE164 = typeof input.normalizedPhoneE164 === "string"
    ? input.normalizedPhoneE164
    : "";
  const code = typeof input.code === "string" ? input.code.trim() : "";

  if (!phoneE164 || !code) {
    return { ok: false, reason: "missing_phone_or_code" };
  }

  if (!US_E164_RE.test(phoneE164)) {
    return { ok: false, reason: "invalid_phone" };
  }

  const rawScanSessionId = input.scanSessionId;
  if (
    typeof rawScanSessionId !== "string" || rawScanSessionId.trim().length === 0
  ) {
    return { ok: false, reason: "missing_scan_session" };
  }

  if (!UUID_RE.test(rawScanSessionId)) {
    return { ok: false, reason: "invalid_scan_session" };
  }

  return { ok: true, phoneE164, code, scanSessionId: rawScanSessionId };
}

export type PendingRowIneligibleReason =
  | "no_pending_row"
  | "phone_mismatch"
  | "status_not_pending"
  | "session_null"
  | "session_mismatch";

export type PendingRowEligibility =
  | { eligible: true; row: PendingVerificationRow }
  | { eligible: false; reason: PendingRowIneligibleReason };

/**
 * Requires exactly the one pending row that `send-otp` bound to THIS scan.
 *
 * The caller's query already filters on phone, pending status, and scan
 * session, so in practice only `no_pending_row` is reachable. The remaining
 * branches are defence-in-depth against a query-builder regression silently
 * widening that filter — a null-session or foreign-scan row must never become
 * verification authority, and must never be re-bound to the requested scan.
 */
export function evaluatePendingRowEligibility(input: {
  pendingRow: PendingVerificationRow | null | undefined;
  phoneE164: string;
  scanSessionId: string;
}): PendingRowEligibility {
  const { pendingRow, phoneE164, scanSessionId } = input;

  if (!pendingRow) {
    return { eligible: false, reason: "no_pending_row" };
  }

  if (pendingRow.phone_e164 !== phoneE164) {
    return { eligible: false, reason: "phone_mismatch" };
  }

  if (pendingRow.status !== PENDING_STATUS) {
    return { eligible: false, reason: "status_not_pending" };
  }

  if (
    pendingRow.scan_session_id === null ||
    pendingRow.scan_session_id === undefined
  ) {
    return { eligible: false, reason: "session_null" };
  }

  if (pendingRow.scan_session_id !== scanSessionId) {
    return { eligible: false, reason: "session_mismatch" };
  }

  return { eligible: true, row: pendingRow };
}

export type ScanLeadBindingFailureReason =
  | "scan_not_found"
  | "scan_lead_missing"
  | "lead_binding_mismatch";

export type ScanLeadBinding =
  | { ok: true; leadId: string }
  | { ok: false; reason: ScanLeadBindingFailureReason };

/**
 * Resolves the ONLY lead that verification may mutate: the lead attached to
 * the exact requested scan session. A browser-supplied lead is never trusted.
 *
 * `get_analysis_full` authorizes on `phone_verifications.lead_id = scan_sessions.lead_id`,
 * so an already-bound pending row whose lead disagrees with the scan's lead is
 * a binding conflict and must fail closed rather than be silently overwritten.
 */
export function evaluateScanLeadBinding(input: {
  pendingRow: PendingVerificationRow;
  scanSession: ScanSessionLeadRow | null | undefined;
}): ScanLeadBinding {
  const { pendingRow, scanSession } = input;

  if (!scanSession) {
    return { ok: false, reason: "scan_not_found" };
  }

  const scanLeadId = typeof scanSession.lead_id === "string"
    ? scanSession.lead_id
    : "";

  if (!scanLeadId) {
    return { ok: false, reason: "scan_lead_missing" };
  }

  if (pendingRow.lead_id !== null && pendingRow.lead_id !== undefined) {
    if (pendingRow.lead_id !== scanLeadId) {
      return { ok: false, reason: "lead_binding_mismatch" };
    }
  }

  return { ok: true, leadId: scanLeadId };
}

export type VerificationCasFailureReason =
  | "cas_no_rows"
  | "cas_multiple_rows"
  | "cas_unexpected_shape";

export type VerificationCasOutcome =
  | { ok: true; rowId: string }
  | { ok: false; reason: VerificationCasFailureReason };

/**
 * Validates the shape of an exact-row compare-and-set result.
 *
 * Finalization succeeds only when the conditional update returned EXACTLY the
 * one pending row it targeted. Zero rows means another request already
 * finalized it (or the status moved off `pending`); more than one row or an
 * unexpected shape means the guard did not behave as written. All of those
 * fail closed, with no lead mutation and no canonical success events.
 */
export function evaluateVerificationCasResult(input: {
  expectedRowId: string;
  data: unknown;
}): VerificationCasOutcome {
  const { expectedRowId, data } = input;

  if (data === null || data === undefined) {
    return { ok: false, reason: "cas_no_rows" };
  }

  if (!Array.isArray(data)) {
    return { ok: false, reason: "cas_unexpected_shape" };
  }

  if (data.length === 0) {
    return { ok: false, reason: "cas_no_rows" };
  }

  if (data.length > 1) {
    return { ok: false, reason: "cas_multiple_rows" };
  }

  const row = data[0];
  if (typeof row !== "object" || row === null) {
    return { ok: false, reason: "cas_unexpected_shape" };
  }

  const rowId = (row as { id?: unknown }).id;
  if (typeof rowId !== "string" || rowId !== expectedRowId) {
    return { ok: false, reason: "cas_unexpected_shape" };
  }

  return { ok: true, rowId };
}

/**
 * Masked phone for server logs: `xxx-xxx-1234`. Never log a full phone number.
 * Format matches the existing `verify-otp` / `send-otp` log convention.
 */
export function maskPhoneForLog(phoneE164: unknown): string {
  const value = typeof phoneE164 === "string" ? phoneE164 : "";
  return `xxx-xxx-${value.slice(-4)}`;
}
