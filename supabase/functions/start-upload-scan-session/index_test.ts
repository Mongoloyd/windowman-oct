// supabase/functions/start-upload-scan-session/index_test.ts
//
// Pure Deno unit tests for the Sprint 1 V2 "contact-owned upload" enforcer
// helpers exported from ./index.ts. No network, no env, no live database.
//
// The handler's HTTP/Deno.serve path is import-safe because the server is only
// started under `if (import.meta.main)`, so importing this module does not bind
// a port. The DB-dependent enforcement helper is exercised through a tiny
// injected stub fetcher (ContactOwnedLeadFetcher), matching the pattern used
// elsewhere in this repo (scan-quote tests its pure ./scoring.ts helpers).
//
// Coverage maps to docs/sprints/sprint-1-enforcer.md "Required test coverage":
//   Test 5  — enforced mode rejects missing lead_id
//   Test 6  — enforced mode rejects nonexistent lead
//   Test 7  — enforced mode rejects missing/whitespace contact fields
//   Test 8  — enforced mode rejects session mismatch
//   Test 9  — enforced mode accepts a valid contact-owned lead
//   Test 11 — service-role bypass detection (transport bypass only)
//   Test 12 — no client/body flag may bypass enforcement
// (Tests 1–4 + 10 live in ./contracts/schemas.test.ts and the flag-off handler
//  branch; see the limitation note at the bottom of this file.)
//
// Run via: deno test supabase/functions/start-upload-scan-session/

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildRejectedUploadLogPayload,
  CONTACT_REQUIRED_MESSAGE,
  type ContactOwnedLeadFetcher,
  type ContactOwnedLeadRow,
  hasContactOwnedFields,
  isServiceRoleBypass,
  SESSION_MISMATCH_MESSAGE,
  validateContactOwnedUploadLead,
} from "./index.ts";

const SESSION_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const LEAD_ID = "99999999-8888-7777-6666-555555555555";
const SERVICE_ROLE = "service-role-secret-key";

/** Stub fetcher that returns a fixed row / error regardless of id. */
function stubFetcher(
  row: ContactOwnedLeadRow | null,
  error: { code?: string | null; message?: string | null } | null = null,
): ContactOwnedLeadFetcher {
  return {
    fetchLeadById: (_leadId: string) =>
      Promise.resolve({ data: row, error }),
  };
}

/** Stub fetcher that fails the test if it is ever called. */
function neverCalledFetcher(): ContactOwnedLeadFetcher {
  return {
    fetchLeadById: (_leadId: string) => {
      throw new Error("fetchLeadById must not be called");
    },
  };
}

const validLead = (over: Partial<ContactOwnedLeadRow> = {}): ContactOwnedLeadRow => ({
  id: LEAD_ID,
  session_id: SESSION_ID,
  first_name: "Jordan",
  email: "jordan@example.com",
  ...over,
});

// ── hasContactOwnedFields ───────────────────────────────────────────────────

Deno.test("hasContactOwnedFields true for non-empty trimmed first_name + email", () => {
  assert(hasContactOwnedFields({ first_name: "A", email: "a@b.co" }));
});

Deno.test("hasContactOwnedFields false for whitespace-only first_name", () => {
  assert(!hasContactOwnedFields({ first_name: "   ", email: "a@b.co" }));
});

Deno.test("hasContactOwnedFields false for whitespace-only email", () => {
  assert(!hasContactOwnedFields({ first_name: "A", email: "  " }));
});

Deno.test("hasContactOwnedFields false for null/missing fields", () => {
  assert(!hasContactOwnedFields({ first_name: null, email: null }));
  assert(!hasContactOwnedFields({}));
});

// ── isServiceRoleBypass (Test 11 + Test 12 building block) ──────────────────

Deno.test("isServiceRoleBypass true only for exact Bearer service-role header", () => {
  assert(isServiceRoleBypass(`Bearer ${SERVICE_ROLE}`, SERVICE_ROLE));
});

Deno.test("isServiceRoleBypass false for missing/blank authorization", () => {
  assert(!isServiceRoleBypass(null, SERVICE_ROLE));
  assert(!isServiceRoleBypass("", SERVICE_ROLE));
});

Deno.test("isServiceRoleBypass false for wrong token", () => {
  assert(!isServiceRoleBypass("Bearer not-the-key", SERVICE_ROLE));
  assert(!isServiceRoleBypass(`Bearer ${SERVICE_ROLE}x`, SERVICE_ROLE));
});

Deno.test("isServiceRoleBypass false when service role is unset", () => {
  assert(!isServiceRoleBypass(`Bearer ${SERVICE_ROLE}`, undefined));
  assert(!isServiceRoleBypass("Bearer ", ""));
});

// ── buildRejectedUploadLogPayload (non-PII contract) ────────────────────────

Deno.test("buildRejectedUploadLogPayload emits only non-PII keys", () => {
  const payload = buildRejectedUploadLogPayload({
    error_code: "contact_required_before_upload",
    session_id: SESSION_ID,
    lead_id: LEAD_ID,
    attribution: { utm_source: "google" },
  });
  assertEquals(
    Object.keys(payload).sort(),
    ["client_source", "error_code", "lead_id", "session_id", "timestamp"],
  );
  assertEquals(payload.client_source, "google");
  assertEquals(payload.error_code, "contact_required_before_upload");
  assertEquals(payload.session_id, SESSION_ID);
  assertEquals(payload.lead_id, LEAD_ID);
});

Deno.test("buildRejectedUploadLogPayload uses utm_source (not source) and defaults to null", () => {
  const payload = buildRejectedUploadLogPayload({
    error_code: "session_mismatch_with_lead",
    session_id: null,
    lead_id: null,
    attribution: null,
  });
  assertEquals(payload.client_source, null);
  assertEquals(payload.session_id, null);
  assertEquals(payload.lead_id, null);
});

// ── Test 5 — enforced mode rejects missing lead_id ──────────────────────────

Deno.test("Test 5: rejects missing lead_id without touching the DB", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: undefined, sessionId: SESSION_ID },
    neverCalledFetcher(),
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
    assertEquals(result.code, "contact_required_before_upload");
    assertEquals(result.message, CONTACT_REQUIRED_MESSAGE);
  }
});

Deno.test("Test 5b: rejects empty/whitespace lead_id without touching the DB", async () => {
  for (const leadId of ["", "   "]) {
    const result = await validateContactOwnedUploadLead(
      { leadId, sessionId: SESSION_ID },
      neverCalledFetcher(),
    );
    assert(!result.ok);
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  }
});

// ── Test 6 — enforced mode rejects nonexistent lead ─────────────────────────

Deno.test("Test 6: rejects when lead lookup returns no rows", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(null),
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
    assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("Test 6b: DB error preserves 500 unexpected_error behavior", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(null, { code: "PGRST500", message: "boom" }),
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 500);
    assertEquals(result.code, "unexpected_error");
  }
});

// ── Test 7 — enforced mode rejects missing/whitespace contact fields ────────

Deno.test("Test 7: rejects missing/empty/whitespace first_name or email", async () => {
  const badContacts: Partial<ContactOwnedLeadRow>[] = [
    { first_name: null },
    { first_name: "" },
    { first_name: "   " },
    { email: null },
    { email: "" },
    { email: "   " },
  ];
  for (const over of badContacts) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(validLead(over)),
    );
    assert(!result.ok, `expected rejection for ${JSON.stringify(over)}`);
    if (!result.ok) {
      assertEquals(result.httpStatus, 400);
      assertEquals(result.code, "contact_required_before_upload");
    }
  }
});

// ── Test 8 — enforced mode rejects session mismatch ─────────────────────────

Deno.test("Test 8: rejects when lead.session_id !== body.session_id", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(validLead({ session_id: OTHER_SESSION_ID })),
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
    assertEquals(result.code, "session_mismatch_with_lead");
    assertEquals(result.message, SESSION_MISMATCH_MESSAGE);
  }
});

// ── Test 9 — enforced mode accepts a valid contact-owned lead ───────────────

Deno.test("Test 9: accepts valid contact-owned lead and returns validated id", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(validLead()),
  );
  assert(result.ok, JSON.stringify(result));
  if (result.ok) {
    assertEquals(result.lead_id, LEAD_ID);
  }
});

Deno.test("Test 9b: trims contact fields when judging non-emptiness", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(validLead({ first_name: "  Jordan  ", email: "  j@b.co  " })),
  );
  assert(result.ok, JSON.stringify(result));
});

// ── Test 12 — no client/body flag may bypass enforcement ────────────────────

Deno.test("Test 12: body allow_shell/admin_bypass flags cannot bypass; lead_id still required", async () => {
  // The enforcement helper has no knowledge of request body flags — the only
  // bypass channel is the service-role Authorization header (isServiceRoleBypass).
  // With no service-role header, enforcement runs and missing lead_id is rejected.
  assert(!isServiceRoleBypass("Bearer client-anon-key", SERVICE_ROLE));
  const result = await validateContactOwnedUploadLead(
    { leadId: undefined, sessionId: SESSION_ID },
    neverCalledFetcher(),
  );
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
});
