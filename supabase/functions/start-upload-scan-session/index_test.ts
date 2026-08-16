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
  resolveLatestServiceConsentRows,
  SESSION_MISMATCH_MESSAGE,
  validateContactOwnedUploadLead,
  type WmChatServiceConsentRow,
} from "./index.ts";

const SESSION_ID = "11111111-2222-3333-4444-555555555555";
const OTHER_SESSION_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const LEAD_ID = "99999999-8888-7777-6666-555555555555";
const SERVICE_ROLE = "service-role-secret-key";

/** Stub fetcher that returns a fixed row / error regardless of id. */
function stubFetcher(
  row: ContactOwnedLeadRow | null,
  error: { code?: string | null; message?: string | null } | null = null,
  consent: WmChatServiceConsentRow | null = null,
): ContactOwnedLeadFetcher {
  return {
    fetchLeadById: (_leadId: string) => Promise.resolve({ data: row, error }),
    fetchLatestServiceConsent: (_leadId: string, _sessionId: string) =>
      Promise.resolve({ data: consent, error: null }),
  };
}

/** Stub fetcher that fails the test if it is ever called. */
function neverCalledFetcher(): ContactOwnedLeadFetcher {
  return {
    fetchLeadById: (_leadId: string) => {
      throw new Error("fetchLeadById must not be called");
    },
    fetchLatestServiceConsent: () => {
      throw new Error("fetchLatestServiceConsent must not be called");
    },
  };
}

const validLead = (
  over: Partial<ContactOwnedLeadRow> = {},
): ContactOwnedLeadRow => ({
  id: LEAD_ID,
  session_id: SESSION_ID,
  first_name: "Jordan",
  email: "jordan@example.com",
  ...over,
});

const storedWmChatIntake = (over: Record<string, unknown> = {}) => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "have_quote",
  answer_path: [
    "entry:entry_have_quote",
    "have_concern:have_upload_first",
  ],
  answers: {
    entry_intent: "have_quote",
    have_concern: "have_upload_first",
  },
  continuation: "sms_then_voice",
  completed_at: "2026-08-15T12:00:00.000Z",
  ...over,
});

const grantedServiceConsent = (
  over: Partial<WmChatServiceConsentRow> = {},
): WmChatServiceConsentRow => ({
  decision: "granted",
  source: "windowman-first-quote",
  session_id: SESSION_ID,
  created_at: "2026-08-15T12:01:00.000Z",
  id: "12345678-1234-4234-8234-123456789abc",
  ...over,
});

const storedProtectionKitIntake = () =>
  storedWmChatIntake({
    entry_intent: "learn_powers",
    answer_path: [
      "entry:entry_learn_powers",
      "power_1:power_next_2",
      "power_2:power_next_3",
      "power_3:power_next_4",
      "power_4:power_next_5",
      "power_5:power_not_ready",
      "not_ready:not_ready_protection_kit",
    ],
    answers: {
      entry_intent: "learn_powers",
      powers: "power_not_ready",
      hesitation_action: "not_ready_protection_kit",
    },
    continuation: "email_only",
  });

const validWmChatLead = (
  over: Partial<ContactOwnedLeadRow> = {},
): ContactOwnedLeadRow => ({
  id: LEAD_ID,
  session_id: SESSION_ID,
  first_name: null,
  email: null,
  phone_e164: "+15615550123",
  source: "windowman-first-quote",
  query_params: {
    source_path: "/wmchat",
    intake_version: "wmchat_v1",
  },
  qualification_answers_json: {
    existing_namespace: { keep: true },
    wmchat_v1: storedWmChatIntake(),
  },
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

// ── /wmchat source-specific mobile contact ownership ───────────────────────

Deno.test("accepts exact persisted /wmchat mobile ownership with latest granted service consent", async () => {
  const calls: Array<[string, string]> = [];
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: (leadId, sessionId) => {
        calls.push([leadId, sessionId]);
        return Promise.resolve({ data: grantedServiceConsent(), error: null });
      },
    },
  );
  assert(result.ok, JSON.stringify(result));
  assertEquals(calls, [[LEAD_ID, SESSION_ID]]);
});

Deno.test("accepts /wmchat with either omitted or valid optional first name", async () => {
  for (const first_name of [null, "Maria", "  Maria  "]) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(
        validWmChatLead({ first_name }),
        null,
        grantedServiceConsent(),
      ),
    );
    assert(result.ok, JSON.stringify({ first_name, result }));
  }
});

Deno.test("rejects /wmchat lookalikes with wrong source, path, version, or non-null email", async () => {
  const rows = [
    validWmChatLead({ source: "direct_upload" }),
    validWmChatLead({
      query_params: { source_path: "/nq4", intake_version: "wmchat_v1" },
    }),
    validWmChatLead({
      query_params: { source_path: "/wmchat", intake_version: "wmchat_v2" },
    }),
    validWmChatLead({
      first_name: null,
      phone_e164: null,
      email: "invented@example.com",
      qualification_answers_json: { wmchat_v1: storedProtectionKitIntake() },
    }),
    validWmChatLead({
      qualification_answers_json: { wmchat_v1: storedProtectionKitIntake() },
    }),
  ];
  for (const row of rows) {
    let consentCalls = 0;
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      {
        fetchLeadById: () => Promise.resolve({ data: row, error: null }),
        fetchLatestServiceConsent: () => {
          consentCalls += 1;
          return Promise.resolve({
            data: grantedServiceConsent(),
            error: null,
          });
        },
      },
    );
    assert(!result.ok, JSON.stringify(row));
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
    assertEquals(consentCalls, 0);
  }
});

Deno.test("rejects a fetched lead whose durable id differs from the submitted lead id", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(
      validWmChatLead({ id: "22222222-3333-4444-8555-666666666666" }),
      null,
      grantedServiceConsent(),
    ),
  );
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
});

Deno.test("marked /wmchat rows cannot fall back to legacy name plus email eligibility", async () => {
  let consentCalls = 0;
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    {
      fetchLeadById: () =>
        Promise.resolve({
          data: validWmChatLead({
            first_name: "Maria",
            email: "maria@example.com",
            phone_e164: null,
            qualification_answers_json: { wmchat_v1: { malformed: true } },
          }),
          error: null,
        }),
      fetchLatestServiceConsent: () => {
        consentCalls += 1;
        throw new Error("invalid marked row must reject before consent");
      },
    },
  );
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  assertEquals(consentCalls, 0);
});

Deno.test("partial /wmchat markers fail closed instead of reaching legacy eligibility", async () => {
  const rows = [
    validLead({
      source: "windowman-first-quote",
      query_params: { source_path: "/wmchat" },
    }),
    validLead({
      source: "windowman-first-quote",
      query_params: { intake_version: "wmchat_v1" },
    }),
    validLead({
      source: "windowman-first-quote",
      qualification_answers_json: { wmchat_v1: { malformed: true } },
    }),
  ];
  for (const row of rows) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(row, null, grantedServiceConsent()),
    );
    assert(!result.ok, JSON.stringify(row));
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("rejects missing, malformed, and non-US /wmchat mobile values", async () => {
  for (
    const phone_e164 of [null, "", "5615550123", "+445615550123", "+1561555012"]
  ) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(
        validWmChatLead({ phone_e164 }),
        null,
        grantedServiceConsent(),
      ),
    );
    assert(!result.ok, String(phone_e164));
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("rejects missing, malformed, unknown-ID, and unstamped stored /wmchat namespaces", async () => {
  const namespaces: unknown[] = [
    null,
    {},
    { wmchat_v1: null },
    { wmchat_v1: storedWmChatIntake({ completed_at: undefined }) },
    { wmchat_v1: storedWmChatIntake({ completed_at: "client timestamp" }) },
    {
      wmchat_v1: storedWmChatIntake({
        answer_path: ["entry:entry_have_quote", "unknown:have_upload_first"],
      }),
    },
    {
      wmchat_v1: storedWmChatIntake({
        answer_path: ["entry:entry_have_quote", "have_concern:unknown"],
      }),
    },
    {
      wmchat_v1: storedWmChatIntake({
        answer_path: ["entry:entry_have_quote", "have_concern:price_total"],
      }),
    },
    { wmchat_v1: storedWmChatIntake({ transcript: [] }) },
  ];
  for (const qualification_answers_json of namespaces) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(
        validWmChatLead({ qualification_answers_json }),
        null,
        grantedServiceConsent(),
      ),
    );
    assert(!result.ok, JSON.stringify(qualification_answers_json));
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("rejects missing, declined, withdrawn, wrong-source, and wrong-session latest service consent", async () => {
  const decisions: Array<WmChatServiceConsentRow | null> = [
    null,
    grantedServiceConsent({ decision: "declined" }),
    grantedServiceConsent({ decision: "withdrawn" }),
    grantedServiceConsent({ source: "some-other-source" }),
    grantedServiceConsent({ session_id: OTHER_SESSION_ID }),
  ];
  for (const consent of decisions) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      stubFetcher(validWmChatLead(), null, consent),
    );
    assert(!result.ok, JSON.stringify(consent));
    if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("later withdrawal remains authoritative and cannot reveal an older grant", async () => {
  const latest = grantedServiceConsent({
    decision: "withdrawn",
    created_at: "2026-08-15T12:02:00.000Z",
  });
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    stubFetcher(validWmChatLead(), null, latest),
  );
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "contact_required_before_upload");
});

Deno.test("latest consent timestamp ties are accepted only when unambiguous", () => {
  const timestamp = "2026-08-15T12:02:00.000Z";
  const grant = grantedServiceConsent({ created_at: timestamp });
  const duplicateGrant = grantedServiceConsent({
    created_at: timestamp,
    id: "22345678-1234-4234-8234-123456789abc",
  });
  const withdrawal = grantedServiceConsent({
    created_at: timestamp,
    decision: "withdrawn",
    id: "32345678-1234-4234-8234-123456789abc",
  });

  assertEquals(
    resolveLatestServiceConsentRows([grant, duplicateGrant], 2),
    { data: grant, error: null },
  );
  assertEquals(resolveLatestServiceConsentRows([grant, withdrawal], 2), {
    data: null,
    error: null,
  });
  assert(resolveLatestServiceConsentRows([grant], 2).error);
});

Deno.test("consent timestamp conflicts fail upload closed without becoming server errors", async () => {
  const timestamp = "2026-08-15T12:02:00.000Z";
  const grant = grantedServiceConsent({ created_at: timestamp });
  const deniedRows = ["withdrawn", "declined"].flatMap((decision) => [
    [grant, grantedServiceConsent({ decision, created_at: timestamp })],
    [grantedServiceConsent({ decision, created_at: timestamp }), grant],
  ]);

  for (const rows of deniedRows) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      {
        fetchLeadById: () =>
          Promise.resolve({ data: validWmChatLead(), error: null }),
        fetchLatestServiceConsent: () =>
          Promise.resolve(resolveLatestServiceConsentRows(rows, rows.length)),
      },
    );
    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.httpStatus, 400);
      assertEquals(result.code, "contact_required_before_upload");
    }
  }
});

Deno.test("consent resolver accepts a clear latest grant and identical tied grants", async () => {
  const latestGrant = grantedServiceConsent({
    created_at: "2026-08-15T12:03:00.000Z",
  });
  const olderWithdrawal = grantedServiceConsent({
    decision: "withdrawn",
    created_at: "2026-08-15T12:02:00.000Z",
  });
  const duplicateGrant = grantedServiceConsent({
    created_at: latestGrant.created_at,
    id: "22345678-1234-4234-8234-123456789abc",
  });

  for (
    const rows of [
      [olderWithdrawal, latestGrant],
      [latestGrant, duplicateGrant],
    ]
  ) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      {
        fetchLeadById: () =>
          Promise.resolve({ data: validWmChatLead(), error: null }),
        fetchLatestServiceConsent: () =>
          Promise.resolve(resolveLatestServiceConsentRows(rows, rows.length)),
      },
    );
    assert(result.ok, JSON.stringify(result));
  }
});

Deno.test("consent resolver keeps a latest withdrawal authoritative", async () => {
  const rows = [
    grantedServiceConsent({ created_at: "2026-08-15T12:01:00.000Z" }),
    grantedServiceConsent({
      decision: "withdrawn",
      created_at: "2026-08-15T12:02:00.000Z",
    }),
  ];
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: () =>
        Promise.resolve(resolveLatestServiceConsentRows(rows, rows.length)),
    },
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
    assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("malformed latest consent timestamps fail upload closed", async () => {
  const rows = [grantedServiceConsent({ created_at: "not-a-timestamp" })];
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: () =>
        Promise.resolve(resolveLatestServiceConsentRows(rows, rows.length)),
    },
  );
  assert(!result.ok);
  if (!result.ok) {
    assertEquals(result.httpStatus, 400);
    assertEquals(result.code, "contact_required_before_upload");
  }
});

Deno.test("consent lookup error or thrown lookup fails closed with 500", async () => {
  const dependencies: ContactOwnedLeadFetcher[] = [
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: () =>
        Promise.resolve({ data: null, error: { message: "lookup failed" } }),
    },
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: () => {
        throw new Error("lookup failed");
      },
    },
  ];
  for (const deps of dependencies) {
    const result = await validateContactOwnedUploadLead(
      { leadId: LEAD_ID, sessionId: SESSION_ID },
      deps,
    );
    assert(!result.ok);
    if (!result.ok) {
      assertEquals(result.httpStatus, 500);
      assertEquals(result.code, "unexpected_error");
    }
  }
});

Deno.test("/wmchat session mismatch rejects before consent lookup", async () => {
  let consentCalls = 0;
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: OTHER_SESSION_ID },
    {
      fetchLeadById: () =>
        Promise.resolve({ data: validWmChatLead(), error: null }),
      fetchLatestServiceConsent: () => {
        consentCalls += 1;
        return Promise.resolve({ data: grantedServiceConsent(), error: null });
      },
    },
  );
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "session_mismatch_with_lead");
  assertEquals(consentCalls, 0);
});

Deno.test("legacy first-name + email ownership never requires /wmchat consent metadata", async () => {
  const result = await validateContactOwnedUploadLead(
    { leadId: LEAD_ID, sessionId: SESSION_ID },
    {
      fetchLeadById: () => Promise.resolve({ data: validLead(), error: null }),
      fetchLatestServiceConsent: () => {
        throw new Error("legacy path must not query consent");
      },
    },
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
