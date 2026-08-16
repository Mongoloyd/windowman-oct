import {
  assert,
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildWmChatInsertQualification,
  isMatchingWmChatReuseLead,
  isValidCaptureIdentity,
  parseAndValidate,
  persistWmChatRequiredCaptureData,
} from "./index.ts";

const SESSION_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const SUBMISSION_ID = "11111111-2222-4333-8444-555555555555";
const LEAD_ID = "99999999-8888-4777-8666-555555555555";

const validIntake = () => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "have_quote",
  answer_path: [
    "entry:entry_have_quote",
    "have_concern:have_price",
    "have_detail_price:price_total",
  ],
  answers: {
    entry_intent: "have_quote",
    have_concern: "have_price",
    have_detail: "price_total",
  },
  continuation: "sms_then_voice",
});

const serviceConsent = () => ({
  schemaVersion: "1",
  submissionId: SUBMISSION_ID,
  privacyPolicyVersion: "2026-08-01",
  termsVersion: "2026-04-14",
  source: "windowman-first-quote",
  events: [
    {
      purpose: "service_communications",
      decision: "granted",
      disclosureVersion: "2026-08-01",
    },
  ],
});

const validWmChatBody = () => ({
  session_id: SESSION_ID,
  first_name: null,
  email: null,
  phone_e164: "+15615550123",
  county: null,
  project_type: null,
  window_count: null,
  quote_range: null,
  source: "windowman-first-quote",
  attribution: { wm_intent: "has_quote", utm_source: "meta" },
  query_params: {
    source_path: "/wmchat",
    intake_version: "wmchat_v1",
    wm_intent: "has_quote",
  },
  consent: serviceConsent(),
  wmchat_intake: validIntake(),
});

const validProtectionKitIntake = () => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
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

const validProtectionKitBody = () => ({
  ...validWmChatBody(),
  first_name: null,
  email: "Maria@Example.com",
  phone_e164: null,
  wmchat_capture_kind: "protection_kit",
  query_params: {
    source_path: "/wmchat",
    intake_version: "wmchat_v1",
    wm_intent: "no_quote",
    capture_kind: "protection_kit",
    entry_point: "wm_chat",
  },
  wmchat_intake: validProtectionKitIntake(),
});

const legacyBody = (source = "truth-gate") => ({
  session_id: SESSION_ID,
  first_name: "Legacy",
  email: "legacy@example.com",
  phone_e164: "+15615550123",
  source,
  attribution: {},
  query_params: {},
  consent: {
    ...serviceConsent(),
    source,
  },
});

Deno.test("exact /wmchat accepts mobile-only contact with omitted optional name", () => {
  const result = parseAndValidate(validWmChatBody());
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.payload.first_name, null);
    assertEquals(result.payload.email, null);
    assertEquals(result.payload.phone_e164, "+15615550123");
    assertEquals(result.payload.source, "windowman-first-quote");
    assert(result.payload.wmchat_intake);
    assert(result.payload.wmchat_stored);
    assertMatch(
      result.payload.wmchat_stored.completed_at,
      /^\d{4}-\d{2}-\d{2}T/,
    );
  }
});

Deno.test("exact Protection Kit contract accepts normalized email-only contact", () => {
  const result = parseAndValidate(validProtectionKitBody());
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.payload.first_name, null);
    assertEquals(result.payload.phone_e164, null);
    assertEquals(result.payload.email, "maria@example.com");
    assertEquals(result.payload.wmchat_capture_kind, "protection_kit");
    assertEquals(result.payload.wmchat_intake?.continuation, "email_only");
    assertEquals(
      result.payload.query_params.entry_point,
      "wm_chat",
    );
  }
});

Deno.test("Protection Kit requires exact top-level, query, terminal-path, and email-only markers", () => {
  const wrongBodies = [
    { ...validProtectionKitBody(), wmchat_capture_kind: undefined },
    { ...validProtectionKitBody(), wmchat_capture_kind: "demo" },
    {
      ...validProtectionKitBody(),
      query_params: {
        ...validProtectionKitBody().query_params,
        capture_kind: "demo",
      },
    },
    {
      ...validProtectionKitBody(),
      query_params: {
        ...validProtectionKitBody().query_params,
        entry_point: "homepage",
      },
    },
    {
      ...validProtectionKitBody(),
      wmchat_intake: {
        ...validProtectionKitIntake(),
        continuation: "sms_then_voice",
      },
    },
    { ...validProtectionKitBody(), first_name: "Maria" },
    { ...validProtectionKitBody(), phone_e164: "+15615550123" },
  ];

  for (const body of wrongBodies) {
    const result = parseAndValidate(body);
    assert(!result.ok);
  }

  for (
    const email of [
      null,
      "",
      "not-an-email",
      `${"a".repeat(249)}@x.test`,
    ]
  ) {
    const result = parseAndValidate({ ...validProtectionKitBody(), email });
    assert(!result.ok, String(email));
    if (!result.ok) assertEquals(result.code, "invalid_wmchat_email");
  }
});

Deno.test("email-only reuse verifies source, session, normalized email, and null mobile contact", () => {
  const base = {
    id: LEAD_ID,
    session_id: SESSION_ID,
    source: "windowman-first-quote",
    email: "maria@example.com",
    first_name: null,
    phone_e164: null,
  };
  const expected = {
    mode: "protection_kit" as const,
    email: "maria@example.com",
  };
  assert(isMatchingWmChatReuseLead(base, SESSION_ID, expected));
  assert(
    !isMatchingWmChatReuseLead(
      { ...base, source: "truth-gate" },
      SESSION_ID,
      expected,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      { ...base, session_id: "bbbbbbbb-cccc-4ddd-8eee-ffffffffffff" },
      SESSION_ID,
      expected,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      { ...base, email: "other@example.com" },
      SESSION_ID,
      expected,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      { ...base, phone_e164: "+15615550123" },
      SESSION_ID,
      expected,
    ),
  );
});

Deno.test("wmchat reuse is bound to the exact capture mode and mobile contact", () => {
  const mobileLead = {
    id: LEAD_ID,
    session_id: SESSION_ID,
    source: "windowman-first-quote",
    email: null,
    first_name: "Maria",
    phone_e164: "+15615550123",
  };
  const expectedMobile = {
    mode: "mobile" as const,
    phoneE164: "+15615550123",
    firstName: "Maria",
  };

  assert(isMatchingWmChatReuseLead(mobileLead, SESSION_ID, expectedMobile));
  assert(
    !isMatchingWmChatReuseLead(
      { ...mobileLead, phone_e164: "+19545550123" },
      SESSION_ID,
      expectedMobile,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      { ...mobileLead, first_name: null },
      SESSION_ID,
      expectedMobile,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      { ...mobileLead, email: "maria@example.com", phone_e164: null },
      SESSION_ID,
      expectedMobile,
    ),
  );
  assert(
    !isMatchingWmChatReuseLead(
      mobileLead,
      SESSION_ID,
      {
        mode: "protection_kit",
        email: "maria@example.com",
      },
    ),
  );
});

Deno.test("exact /wmchat accepts a valid optional name and rejects invalid names", () => {
  const named = parseAndValidate({
    ...validWmChatBody(),
    first_name: "  Maria  ",
  });
  assert(named.ok);
  if (named.ok) assertEquals(named.payload.first_name, "Maria");

  for (const first_name of [undefined, "", "M", "x".repeat(101), 123]) {
    const result = parseAndValidate({ ...validWmChatBody(), first_name });
    assert(!result.ok, String(first_name));
    if (!result.ok) assertEquals(result.code, "invalid_first_name");
  }
});

Deno.test("null email is exact-wmchat-only and a supplied email is rejected", () => {
  const supplied = parseAndValidate({
    ...validWmChatBody(),
    email: "maria@example.com",
  });
  assert(!supplied.ok);
  if (!supplied.ok) assertEquals(supplied.code, "invalid_wmchat_email");

  for (
    const source of [
      "truth-gate",
      "nextdoor",
      "windowman-first-quote",
    ]
  ) {
    const result = parseAndValidate({ ...legacyBody(source), email: null });
    assert(!result.ok, source);
    if (!result.ok) assertEquals(result.code, "invalid_email");
  }
});

Deno.test("exact /wmchat requires a US +1 E.164 mobile", () => {
  for (
    const phone_e164 of [
      null,
      "",
      "5615550123",
      "+445615550123",
      "+1561555012",
      "+156155501234",
    ]
  ) {
    const result = parseAndValidate({ ...validWmChatBody(), phone_e164 });
    assert(!result.ok, String(phone_e164));
    if (!result.ok) assertEquals(result.code, "invalid_wmchat_phone");
  }
});

Deno.test("source, source_path, and intake_version must agree exactly", () => {
  const wrongSource = validWmChatBody();
  wrongSource.source = "truth-gate";
  wrongSource.consent.source = "truth-gate";

  const wrongPath = validWmChatBody();
  wrongPath.query_params.source_path = "/nq4";

  const wrongVersion = validWmChatBody();
  wrongVersion.query_params.intake_version = "wmchat_v2";

  const arrayMarkers = {
    ...validWmChatBody(),
    query_params: {
      source_path: ["/wmchat"],
      intake_version: ["wmchat_v1"],
    },
  };

  for (const body of [wrongSource, wrongPath, wrongVersion, arrayMarkers]) {
    const result = parseAndValidate(body);
    assert(!result.ok);
    if (!result.ok) assertEquals(result.code, "invalid_wmchat_contract");
  }
});

Deno.test("service authorization is required and marketing presentation is rejected", () => {
  const missingService = validWmChatBody();
  missingService.consent.events = [{
    purpose: "marketing_communications",
    decision: "declined",
    disclosureVersion: "2026-08-01",
  }];
  const missing = parseAndValidate(missingService);
  assert(!missing.ok);
  if (!missing.ok) assertEquals(missing.code, "service_consent_required");

  const marketingGrant = validWmChatBody();
  marketingGrant.consent.events.push({
    purpose: "marketing_communications",
    decision: "granted",
    disclosureVersion: "2026-08-01",
  });
  const marketing = parseAndValidate(marketingGrant);
  assert(!marketing.ok);
  if (!marketing.ok) assertEquals(marketing.code, "invalid_wmchat_consent");

  const contractorGrant = validWmChatBody();
  contractorGrant.consent.events.push({
    purpose: "contractor_sharing",
    decision: "granted",
    disclosureVersion: "2026-08-01",
  });
  const contractor = parseAndValidate(contractorGrant);
  assert(!contractor.ok);
  if (!contractor.ok) {
    assertEquals(contractor.code, "invalid_wmchat_consent");
  }
});

Deno.test("legacy caller requirements and optional malformed-phone behavior remain unchanged", () => {
  const valid = parseAndValidate(legacyBody());
  assert(valid.ok);
  if (valid.ok) {
    assertEquals(valid.payload.first_name, "Legacy");
    assertEquals(valid.payload.email, "legacy@example.com");
    assertEquals(valid.payload.wmchat_intake, null);
  }

  const malformedOptionalPhone = parseAndValidate({
    ...legacyBody(),
    phone_e164: "not-a-phone",
  });
  assert(malformedOptionalPhone.ok);
  if (malformedOptionalPhone.ok) {
    assertEquals(malformedOptionalPhone.payload.phone_e164, null);
  }
});

Deno.test("retry preserves submitted session and consent submission identity", () => {
  const first = parseAndValidate(validWmChatBody());
  const retry = parseAndValidate(validWmChatBody());
  assert(first.ok && retry.ok);
  if (first.ok && retry.ok) {
    assertEquals(first.payload.session_id, retry.payload.session_id);
    assertEquals(
      first.payload.consent.submissionId,
      retry.payload.consent.submissionId,
    );
  }
});

Deno.test("new-lead qualification contains only the validated wmchat_v1 namespace", () => {
  const parsed = parseAndValidate(validWmChatBody());
  assert(parsed.ok);
  if (!parsed.ok || !parsed.payload.wmchat_stored) return;
  const qualification = buildWmChatInsertQualification(
    parsed.payload.wmchat_stored,
  );
  assertEquals(Object.keys(qualification), ["wmchat_v1"]);
  assertEquals(
    qualification.wmchat_v1,
    parsed.payload.wmchat_stored,
  );
});

Deno.test("required-data ordering stops on consent failure", async () => {
  const order: string[] = [];
  const result = await persistWmChatRequiredCaptureData({
    verifyLead: () => {
      order.push("verify");
      return Promise.resolve({ ok: true });
    },
    persistConsent: () => {
      order.push("consent");
      return Promise.resolve({
        ok: false,
        code: "consent_persist_failed",
        message: "failed",
      });
    },
    persistNamespace: () => {
      order.push("namespace");
      return Promise.resolve({ ok: true });
    },
    runSuccessEffects: () => {
      order.push("effects");
      return Promise.resolve();
    },
  });
  assert(!result.ok);
  assertEquals(order, ["verify", "consent"]);
});

Deno.test("namespace failure blocks every conversion/success effect and can retry", async () => {
  const order: string[] = [];
  let namespaceAttempts = 0;
  const run = () =>
    persistWmChatRequiredCaptureData({
      verifyLead: () => {
        order.push("verify");
        return Promise.resolve({ ok: true });
      },
      persistConsent: () => {
        order.push("consent");
        return Promise.resolve({ ok: true });
      },
      persistNamespace: () => {
        order.push("namespace");
        namespaceAttempts += 1;
        return Promise.resolve(
          namespaceAttempts === 1
            ? {
              ok: false as const,
              code: "wmchat_namespace_persist_failed",
              message: "failed",
            }
            : { ok: true as const },
        );
      },
      runSuccessEffects: () => {
        order.push("effects");
        return Promise.resolve();
      },
    });

  const first = await run();
  assert(!first.ok);
  assertEquals(order, ["verify", "consent", "namespace"]);

  const retry = await run();
  assert(retry.ok);
  assertEquals(order, [
    "verify",
    "consent",
    "namespace",
    "verify",
    "consent",
    "namespace",
    "effects",
  ]);
});

Deno.test("success identity requires real UUIDs and the submitted session", () => {
  assert(isValidCaptureIdentity(LEAD_ID, SESSION_ID, SESSION_ID));
  assert(!isValidCaptureIdentity(null, SESSION_ID, SESSION_ID));
  assert(!isValidCaptureIdentity(LEAD_ID, null, SESSION_ID));
  assert(!isValidCaptureIdentity(LEAD_ID, "not-a-uuid", SESSION_ID));
  assert(
    !isValidCaptureIdentity(
      LEAD_ID,
      "22222222-3333-4444-8555-666666666666",
      SESSION_ID,
    ),
  );
});
