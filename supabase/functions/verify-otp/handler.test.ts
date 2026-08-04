/**
 * verify-otp handler orchestration suite (Phase A2a, Layer 2).
 *
 * Proves the fail-closed ordering of the exported handler:
 *
 *   valid request → exact pending phone/scan row → exact scan + non-null lead
 *   → QA bypass or Twilio → exact-row compare-and-set → exact-lead update
 *   → canonical success events → verified response
 *
 * Both Supabase and `fetchImpl` are always injected, so production defaults are
 * never used. No test reaches verify.twilio.com or any Supabase project URL:
 * `Deno.serve` is behind `import.meta.main`, the service client is never
 * constructed, and the injected fetch records calls instead of performing them.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  handleVerifyOtpRequest,
  type VerifyOtpSupabaseClient,
} from "./index.ts";
import type { PendingVerificationRow } from "./pendingRowBinding.ts";

// ── Fixtures ────────────────────────────────────────────────────────────────

const PHONE = "+13055551234";
const OTP_CODE = "424242";
const SCAN_A = "11111111-1111-4111-8111-111111111111";
const SCAN_B = "22222222-2222-4222-8222-222222222222";
const LEAD_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const LEAD_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ROW_ID = "99999999-9999-4999-8999-999999999999";
const FIXED_NOW = new Date("2026-08-04T15:30:00.000Z");

const TWILIO_ENV_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SERVICE_SID",
];

const QA_ENV_KEYS = [
  "OTP_QA_BYPASS_ENABLED",
  "OTP_QA_PHONE_E164",
  "OTP_QA_CODE",
  "OTP_QA_PROJECT_REF",
  "WM_SUPABASE_PROJECT_REF",
];

/** Fake, non-secret Twilio config so the outbound request shape is assertable. */
function setFakeTwilioEnv(): void {
  Deno.env.set("TWILIO_ACCOUNT_SID", "AC_fake_sid");
  Deno.env.set("TWILIO_AUTH_TOKEN", "fake_token");
  Deno.env.set("TWILIO_VERIFY_SERVICE_SID", "VA_fake_service");
}

function clearQaBypassEnv(): void {
  for (const key of QA_ENV_KEYS) Deno.env.delete(key);
}

function enableQaBypassEnv(): void {
  Deno.env.set("OTP_QA_BYPASS_ENABLED", "true");
  Deno.env.set("OTP_QA_PHONE_E164", PHONE);
  Deno.env.set("OTP_QA_CODE", OTP_CODE);
  Deno.env.set("OTP_QA_PROJECT_REF", "test-project-ref");
  Deno.env.set("WM_SUPABASE_PROJECT_REF", "test-project-ref");
}

function resetEnv(): void {
  clearQaBypassEnv();
  for (const key of TWILIO_ENV_KEYS) Deno.env.delete(key);
}

function eligiblePendingRow(
  overrides: Partial<PendingVerificationRow> = {},
): PendingVerificationRow {
  return {
    id: ROW_ID,
    phone_e164: PHONE,
    status: "pending",
    scan_session_id: SCAN_A,
    lead_id: null,
    created_at: "2026-08-04T15:00:00.000Z",
    ...overrides,
  };
}

function verifyRequest(
  body: Record<string, unknown> = {},
): Request {
  return new Request("http://localhost/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_e164: PHONE,
      code: OTP_CODE,
      scan_session_id: SCAN_A,
      ...body,
    }),
  });
}

// ── Recording Supabase mock ─────────────────────────────────────────────────

interface MockError {
  code?: string;
  message?: string;
}

interface MockResult {
  data: unknown;
  error: MockError | null;
}

interface RecordedCall {
  table: string;
  op: "select" | "insert" | "update" | "upsert";
  columns: string | null;
  filters: Record<string, unknown>;
  payload: unknown;
}

interface MockBuilder extends PromiseLike<MockResult> {
  select(columns?: string): MockBuilder;
  insert(payload: unknown): MockBuilder;
  update(payload: unknown): MockBuilder;
  upsert(payload: unknown, options?: unknown): MockBuilder;
  eq(column: string, value: unknown): MockBuilder;
  is(column: string, value: unknown): MockBuilder;
  order(column: string, options?: unknown): MockBuilder;
  limit(count: number): MockBuilder;
  maybeSingle(): Promise<MockResult>;
  single(): Promise<MockResult>;
}

interface SupabaseScenario {
  pendingRow: PendingVerificationRow | null;
  pendingRowError?: MockError;
  scanSession?: { id: string; lead_id: string | null } | null;
  scanSessionError?: MockError;
  /** Rows returned by the verification compare-and-set. */
  casData?: unknown;
  casError?: MockError;
  /** Consumed one entry per CAS, for sequential race simulation. */
  casSequence?: unknown[];
  leadUpdateError?: MockError;
}

function createBuilder(
  table: string,
  calls: RecordedCall[],
  respond: (call: RecordedCall) => MockResult,
): MockBuilder {
  const call: RecordedCall = {
    table,
    op: "select",
    columns: null,
    filters: {},
    payload: undefined,
  };
  let settled = false;

  const settle = (): Promise<MockResult> => {
    if (!settled) {
      calls.push(call);
      settled = true;
    }
    return Promise.resolve(respond(call));
  };

  const builder: MockBuilder = {
    select(columns?: string) {
      call.columns = columns ?? null;
      return builder;
    },
    insert(payload: unknown) {
      call.op = "insert";
      call.payload = payload;
      return builder;
    },
    update(payload: unknown) {
      call.op = "update";
      call.payload = payload;
      return builder;
    },
    upsert(payload: unknown) {
      call.op = "upsert";
      call.payload = payload;
      return builder;
    },
    eq(column: string, value: unknown) {
      call.filters[column] = value;
      return builder;
    },
    is(column: string, value: unknown) {
      call.filters[column] = value;
      return builder;
    },
    order() {
      return builder;
    },
    limit() {
      return builder;
    },
    maybeSingle: settle,
    single: settle,
    then<TResult1 = MockResult, TResult2 = never>(
      onfulfilled?:
        | ((value: MockResult) => TResult1 | PromiseLike<TResult1>)
        | null,
      onrejected?:
        | ((reason: unknown) => TResult2 | PromiseLike<TResult2>)
        | null,
    ): PromiseLike<TResult1 | TResult2> {
      return settle().then(onfulfilled, onrejected);
    },
  };

  return builder;
}

interface SupabaseHarness {
  client: VerifyOtpSupabaseClient;
  calls: RecordedCall[];
}

function buildSupabase(scenario: SupabaseScenario): SupabaseHarness {
  const calls: RecordedCall[] = [];
  const casSequence = scenario.casSequence ? [...scenario.casSequence] : null;

  const respond = (call: RecordedCall): MockResult => {
    if (call.table === "phone_verifications") {
      if (call.op === "select") {
        // Attempt-counter read used by the observability helper.
        if (call.columns === "verify_attempt_count") {
          return { data: { verify_attempt_count: 0 }, error: null };
        }
        if (scenario.pendingRowError) {
          return { data: null, error: scenario.pendingRowError };
        }
        return { data: scenario.pendingRow, error: null };
      }

      if (call.op === "update") {
        const payload = (call.payload ?? {}) as Record<string, unknown>;
        // The trusted finalization is the only update that sets `verified`.
        if (payload.status === "verified") {
          if (scenario.casError) {
            return { data: null, error: scenario.casError };
          }
          if (casSequence) {
            return { data: casSequence.shift() ?? [], error: null };
          }
          // `in` rather than `??` so an explicit `null` stays null.
          return {
            data: "casData" in scenario ? scenario.casData : [{ id: ROW_ID }],
            error: null,
          };
        }
        return { data: null, error: null };
      }
    }

    if (call.table === "scan_sessions" && call.op === "select") {
      if (call.columns === "id, lead_id") {
        if (scenario.scanSessionError) {
          return { data: null, error: scenario.scanSessionError };
        }
        return { data: scenario.scanSession ?? null, error: null };
      }
      // Canonical-event slug/attribution reads.
      return { data: null, error: null };
    }

    if (call.table === "leads" && call.op === "update") {
      return { data: null, error: scenario.leadUpdateError ?? null };
    }

    return { data: null, error: null };
  };

  // Single documented cast: the recording double implements only the narrow
  // Postgrest surface this handler uses, while the shared observability and
  // canonical-event helpers require the full `SupabaseClient` signature.
  const client = {
    from(table: string) {
      return createBuilder(table, calls, respond);
    },
  } as unknown as VerifyOtpSupabaseClient;

  return { client, calls };
}

// ── Recording fetch mock ────────────────────────────────────────────────────

interface FetchHarness {
  fetchImpl: typeof globalThis.fetch;
  urls: string[];
}

function buildFetch(
  outcome:
    | { kind: "approved" }
    | { kind: "denied"; body: Record<string, unknown>; status?: number }
    | { kind: "throws"; error: Error },
): FetchHarness {
  const urls: string[] = [];

  const fetchImpl: typeof globalThis.fetch = (input) => {
    urls.push(String(input));
    if (outcome.kind === "throws") {
      return Promise.reject(outcome.error);
    }
    if (outcome.kind === "denied") {
      return Promise.resolve(
        new Response(JSON.stringify(outcome.body), {
          status: outcome.status ?? 400,
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ status: "approved" }), { status: 200 }),
    );
  };

  return { fetchImpl, urls };
}

// ── Assertion helpers ───────────────────────────────────────────────────────

/** The trusted verification write: the compare-and-set to `verified`. */
function verificationFinalizations(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((call) =>
    call.table === "phone_verifications" &&
    call.op === "update" &&
    (call.payload as Record<string, unknown> | undefined)?.status === "verified"
  );
}

function leadVerificationWrites(calls: RecordedCall[]): RecordedCall[] {
  return calls.filter((call) => call.table === "leads" && call.op === "update");
}

function canonicalEventNames(calls: RecordedCall[]): string[] {
  return calls
    .filter((call) => call.table === "wm_event_log" && call.op === "insert")
    .map((call) =>
      String((call.payload as Record<string, unknown>).event_name ?? "")
    );
}

async function readBody(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

/** No Twilio call, no trusted verification write, no lead write, no events. */
function assertNoTrustedSideEffects(
  calls: RecordedCall[],
  urls: string[],
): void {
  assertEquals(urls, [], "Twilio must not be contacted");
  assertEquals(
    verificationFinalizations(calls).length,
    0,
    "verification row must not be finalized",
  );
  assertEquals(
    leadVerificationWrites(calls).length,
    0,
    "lead must not be mutated",
  );
  assertEquals(
    canonicalEventNames(calls),
    [],
    "no canonical success event may be persisted",
  );
}

// ── 1. Missing scan id ──────────────────────────────────────────────────────

Deno.test("1. missing scan_session_id: no Twilio, no trusted write, no event", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({ pendingRow: eligiblePendingRow() });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(
    verifyRequest({ scan_session_id: undefined }),
    {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    },
  );

  assertEquals(response.status, 400);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
  // Fails before any database authority lookup at all.
  assertEquals(supabase.calls.length, 0);
});

Deno.test("1b. malformed scan_session_id fails closed before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({ pendingRow: eligiblePendingRow() });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(
    verifyRequest({ scan_session_id: "not-a-uuid" }),
    {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    },
  );

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
  assertEquals(supabase.calls.length, 0);
});

// ── 2. No pending row ───────────────────────────────────────────────────────

Deno.test("2. no pending row: no Twilio, no verification/lead mutation, no event", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({ pendingRow: null });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

// ── 3. Null-session row ─────────────────────────────────────────────────────

Deno.test("3. null-session row: rejected, no Twilio, no rebinding", async () => {
  resetEnv();
  setFakeTwilioEnv();
  // The legacy fallback is gone: the scan-bound query cannot return this row,
  // and even if it did the predicate rejects it.
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow({ scan_session_id: null }),
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);

  // No query may look for a null scan binding, and nothing may stamp one.
  const nullSessionLookups = supabase.calls.filter((call) =>
    call.table === "phone_verifications" &&
    Object.prototype.hasOwnProperty.call(call.filters, "scan_session_id") &&
    call.filters.scan_session_id === null
  );
  assertEquals(nullSessionLookups.length, 0);

  const scanStamps = supabase.calls.filter((call) =>
    call.op === "update" &&
    call.table === "phone_verifications" &&
    Object.prototype.hasOwnProperty.call(
      (call.payload ?? {}) as Record<string, unknown>,
      "scan_session_id",
    )
  );
  assertEquals(scanStamps.length, 0, "scan_session_id must never be stamped");
});

// ── 4. Cross-scan request ───────────────────────────────────────────────────

Deno.test("4. Scan A row with Scan B request: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow({ scan_session_id: SCAN_A }),
    scanSession: { id: SCAN_B, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(
    verifyRequest({ scan_session_id: SCAN_B }),
    {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    },
  );

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

// ── 5. Scan missing or lead null ────────────────────────────────────────────

Deno.test("5a. scan session missing: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: null,
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

Deno.test("5b. scan session with null lead: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: null },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  // Preserves the pre-A2a integrity-guard status for an unbindable session.
  assertEquals(response.status, 500);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

Deno.test("5c. scan lookup database error: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSessionError: { code: "57014", message: "statement timeout" },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assert(
    !JSON.stringify(body).includes("statement timeout"),
    "raw database error must not reach the browser",
  );
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

Deno.test("5d. pending-row lookup database error: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: null,
    pendingRowError: { code: "42501", message: "permission denied for table" },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assert(!JSON.stringify(body).includes("permission denied"));
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

// ── 6. Pending-row lead mismatch ────────────────────────────────────────────

Deno.test("6. pending-row lead mismatch: rejected before Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow({ lead_id: LEAD_B }),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  assertEquals((await readBody(response)).verified, false);
  assertNoTrustedSideEffects(supabase.calls, fetch.urls);
});

// ── 7. QA bypass without eligibility ────────────────────────────────────────

Deno.test("7. QA bypass without full eligibility: rejected with no writes", async () => {
  resetEnv();
  setFakeTwilioEnv();
  enableQaBypassEnv();
  try {
    const supabase = buildSupabase({ pendingRow: null });
    const fetch = buildFetch({ kind: "approved" });

    const response = await handleVerifyOtpRequest(verifyRequest(), {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    });

    assertEquals(response.status, 400);
    assertEquals((await readBody(response)).verified, false);
    assertNoTrustedSideEffects(supabase.calls, fetch.urls);
  } finally {
    resetEnv();
  }
});

Deno.test("7b. QA bypass cannot substitute for a valid scan or lead", async () => {
  resetEnv();
  setFakeTwilioEnv();
  enableQaBypassEnv();
  try {
    const supabase = buildSupabase({
      pendingRow: eligiblePendingRow(),
      scanSession: { id: SCAN_A, lead_id: null },
    });
    const fetch = buildFetch({ kind: "approved" });

    const response = await handleVerifyOtpRequest(verifyRequest(), {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    });

    assertEquals(response.status, 500);
    assertEquals((await readBody(response)).verified, false);
    assertNoTrustedSideEffects(supabase.calls, fetch.urls);
  } finally {
    resetEnv();
  }
});

Deno.test("7c. QA bypass after full eligibility verifies without calling Twilio", async () => {
  resetEnv();
  setFakeTwilioEnv();
  enableQaBypassEnv();
  try {
    const supabase = buildSupabase({
      pendingRow: eligiblePendingRow(),
      scanSession: { id: SCAN_A, lead_id: LEAD_A },
    });
    const fetch = buildFetch({ kind: "approved" });

    const response = await handleVerifyOtpRequest(verifyRequest(), {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    });

    assertEquals(response.status, 200);
    assertEquals((await readBody(response)).verified, true);
    assertEquals(fetch.urls, [], "QA bypass must not call Twilio");
    assertEquals(verificationFinalizations(supabase.calls).length, 1);
  } finally {
    resetEnv();
  }
});

// ── 8. Twilio non-approved ──────────────────────────────────────────────────

Deno.test("8. Twilio non-approved: no trusted mutation, no success event", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({
    kind: "denied",
    body: { status: "pending", code: 60202, message: "max attempts reached" },
  });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assertEquals(body.error, "Invalid or expired code.");
  assertEquals(fetch.urls.length, 1);
  assertEquals(
    fetch.urls[0],
    "https://verify.twilio.com/v2/Services/VA_fake_service/VerificationCheck",
    "Twilio URL contract must be unchanged",
  );
  assertEquals(verificationFinalizations(supabase.calls).length, 0);
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
});

Deno.test("8b. Twilio 20404 keeps its distinct expired-session message", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({
    kind: "denied",
    body: { code: 20404, message: "not found" },
    status: 404,
  });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 400);
  const body = await readBody(response);
  assertEquals(
    body.error,
    "Verification session expired or not found. Please request a new code.",
  );
  assertEquals(verificationFinalizations(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
});

// ── 9. Twilio throws / times out ────────────────────────────────────────────

Deno.test("9. Twilio throws: no trusted mutation, no success event", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({
    kind: "throws",
    error: new Error("connection reset"),
  });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  const body = await readBody(response);
  assertEquals(body.verified, false);
  assert(response.status >= 500, "indeterminate outcome is a server condition");
  // Distinct from a denial: never presented as a wrong code.
  assertEquals(
    body.error,
    "Verification is temporarily unavailable. Please try again in a moment.",
  );
  assertEquals(verificationFinalizations(supabase.calls).length, 0);
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
  assert(
    !JSON.stringify(body).includes("connection reset"),
    "raw transport error must not reach the browser",
  );
});

Deno.test("9b. Twilio timeout does not consume a code attempt", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const timeout = new Error("timed out");
  timeout.name = "TimeoutError";
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "throws", error: timeout });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals((await readBody(response)).verified, false);
  assertEquals(verificationFinalizations(supabase.calls).length, 0);

  // The attempt counter is only read/written by the increment helper.
  const attemptReads = supabase.calls.filter((call) =>
    call.table === "phone_verifications" &&
    call.columns === "verify_attempt_count"
  );
  assertEquals(
    attemptReads.length,
    0,
    "an infrastructure fault must not burn a verification attempt",
  );
});

// ── 10 & 11. Compare-and-set failures ───────────────────────────────────────

Deno.test("10. CAS returns zero rows: no lead update, no event, not verified", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    casData: [],
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assert(body.verified !== true);
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);

  // The CAS was attempted, and it was guarded on id AND pending status.
  const cas = verificationFinalizations(supabase.calls);
  assertEquals(cas.length, 1);
  assertEquals(cas[0].filters.id, ROW_ID);
  assertEquals(cas[0].filters.status, "pending");
});

Deno.test("11. CAS database error: no lead update, no event, no raw error", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    casError: { code: "23505", message: "duplicate key value violates ..." },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assert(!JSON.stringify(body).includes("duplicate key"));
  assert(!JSON.stringify(body).includes("23505"));
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
});

Deno.test("11b. CAS returning more than one row fails closed", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    casData: [{ id: ROW_ID }, { id: "another-row" }],
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  assertEquals((await readBody(response)).verified, false);
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
});

Deno.test("11c. CAS returning null fails closed", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    casData: null,
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  assertEquals((await readBody(response)).verified, false);
  assertEquals(leadVerificationWrites(supabase.calls).length, 0);
  assertEquals(canonicalEventNames(supabase.calls), []);
});

// ── 12. CAS succeeds, lead update fails ─────────────────────────────────────

Deno.test("12. CAS succeeds but lead update fails: failure response, no events", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    leadUpdateError: { code: "57014", message: "canceling statement" },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 500);
  const body = await readBody(response);
  assertEquals(body.verified, false);
  assertEquals(canonicalEventNames(supabase.calls), []);

  // RESIDUAL A2a NON-ATOMICITY, asserted so it stays visible: the verification
  // row was already finalized while the lead remains unverified. A2b replaces
  // this with transactional finalization (ADR-005 §6.10).
  assertEquals(verificationFinalizations(supabase.calls).length, 1);
  assertEquals(leadVerificationWrites(supabase.calls).length, 1);
});

// ── 13. Genuine success ─────────────────────────────────────────────────────

Deno.test("13. genuine success preserves response fields, events, and id formats", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "approved" });

  const response = await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  assertEquals(response.status, 200);
  assertEquals(await readBody(response), {
    success: true,
    verified: true,
    phone_e164: PHONE,
    phone_verified_event_id: `wmc_phone_verified_lead-${LEAD_A}_scan-${SCAN_A}`,
    report_revealed_event_id:
      `wmc_report_revealed_lead-${LEAD_A}_scan-${SCAN_A}`,
  });

  assertEquals(canonicalEventNames(supabase.calls), [
    "phone_verified",
    "report_revealed",
  ]);

  // Exactly one trusted verification write and one lead write.
  const cas = verificationFinalizations(supabase.calls);
  assertEquals(cas.length, 1);
  assertEquals(cas[0].filters.status, "pending");
  assertEquals(
    (cas[0].payload as Record<string, unknown>).verified_at,
    FIXED_NOW.toISOString(),
  );
  assertEquals(
    (cas[0].payload as Record<string, unknown>).lead_id,
    LEAD_A,
    "the row binds only the lead resolved from the exact scan session",
  );

  const leadWrites = leadVerificationWrites(supabase.calls);
  assertEquals(leadWrites.length, 1);
  assertEquals(leadWrites[0].filters.id, LEAD_A);
  assertEquals(
    (leadWrites[0].payload as Record<string, unknown>).phone_verified,
    true,
  );
  assertEquals(
    (leadWrites[0].payload as Record<string, unknown>).phone_verified_at,
    FIXED_NOW.toISOString(),
  );
});

Deno.test("13b. the pending-row query is bound to phone, pending status, and the exact scan", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "approved" });

  await handleVerifyOtpRequest(verifyRequest(), {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  });

  const lookup = supabase.calls.find((call) =>
    call.table === "phone_verifications" &&
    call.op === "select" &&
    call.columns !== "verify_attempt_count"
  );
  assert(lookup, "the pending-row lookup must happen");
  assertEquals(lookup?.filters.phone_e164, PHONE);
  assertEquals(lookup?.filters.status, "pending");
  assertEquals(lookup?.filters.scan_session_id, SCAN_A);
});

// ── 14. Sequential race simulation ──────────────────────────────────────────

Deno.test("14. sequential race: exactly one success and one set of success events", async () => {
  resetEnv();
  setFakeTwilioEnv();
  // Both requests observe the same pending row, but only the first CAS returns
  // a row; the second observes zero because the status already moved.
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
    casSequence: [[{ id: ROW_ID }], []],
  });
  const fetch = buildFetch({ kind: "approved" });
  const deps = {
    supabase: supabase.client,
    fetchImpl: fetch.fetchImpl,
    now: () => FIXED_NOW,
  };

  const first = await handleVerifyOtpRequest(verifyRequest(), deps);
  const second = await handleVerifyOtpRequest(verifyRequest(), deps);

  assertEquals(first.status, 200);
  assertEquals((await readBody(first)).verified, true);

  assertEquals(second.status, 500);
  assertEquals((await readBody(second)).verified, false);

  // Two CAS attempts, one winner.
  assertEquals(verificationFinalizations(supabase.calls).length, 2);
  assertEquals(
    leadVerificationWrites(supabase.calls).length,
    1,
    "only the CAS winner may mutate the lead",
  );
  assertEquals(canonicalEventNames(supabase.calls), [
    "phone_verified",
    "report_revealed",
  ]);
});

// ── Logging safety ──────────────────────────────────────────────────────────

Deno.test("logs never contain the OTP code, full phone, or Twilio credentials", async () => {
  resetEnv();
  setFakeTwilioEnv();
  const supabase = buildSupabase({
    pendingRow: eligiblePendingRow(),
    scanSession: { id: SCAN_A, lead_id: LEAD_A },
  });
  const fetch = buildFetch({ kind: "approved" });

  const lines: string[] = [];
  const capture = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = capture;
  console.warn = capture;
  console.error = capture;

  try {
    await handleVerifyOtpRequest(verifyRequest(), {
      supabase: supabase.client,
      fetchImpl: fetch.fetchImpl,
      now: () => FIXED_NOW,
    });
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }

  const joined = lines.join("\n");
  assert(!joined.includes(OTP_CODE), "OTP code must never be logged");
  assert(!joined.includes(PHONE), "full phone must never be logged");
  assert(
    !joined.includes("fake_token"),
    "Twilio auth token must never be logged",
  );
  assert(
    !joined.includes("AC_fake_sid"),
    "Twilio account SID must never be logged",
  );
  assert(
    !joined.includes("Basic "),
    "Authorization header must never be logged",
  );
});
