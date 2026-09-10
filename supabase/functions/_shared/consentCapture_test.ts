import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  consentEventsToRpcJson,
  consentPersistFailureStatus,
  type ParsedConsentRequest,
  persistConsentBatch,
  persistConsentThenRunSuccessEffects,
  resolveAdvertisingMeasurementConsent,
  validateConsentRequest,
  validateHandoffContractorConsentConsistency,
} from "./consentCapture.ts";

Deno.test("validateConsentRequest requires service grant for truth-gate", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "marketing_communications",
          decision: "declined",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "service_consent_required");
});

Deno.test("validateConsentRequest accepts marketing declined when presented", () => {
  const ok = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "service_communications",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
        {
          purpose: "marketing_communications",
          decision: "declined",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(ok.ok, true);
});

Deno.test("advertising measurement consent accepts granted and declined states", () => {
  for (const decision of ["granted", "declined"] as const) {
    const parsed = validateConsentRequest(
      {
        schemaVersion: "1",
        submissionId: "11111111-1111-4111-8111-111111111111",
        privacyPolicyVersion: "2026-08-01",
        termsVersion: "2026-04-14",
        source: "windowman-first-quote",
        events: [
          {
            purpose: "service_communications",
            decision: "granted",
            disclosureVersion: "2026-08-01",
          },
          {
            purpose: "advertising_measurement",
            decision,
            disclosureVersion: "2026-08-01",
          },
        ],
      },
      "windowman-first-quote",
    );
    assertEquals(parsed.ok, true);
    if (parsed.ok) {
      assertEquals(
        resolveAdvertisingMeasurementConsent(parsed.consent),
        decision === "granted" ? "granted" : "denied",
      );
    }
  }
});

Deno.test("advertising measurement consent is unknown when not recorded", () => {
  assertEquals(
    resolveAdvertisingMeasurementConsent({
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "windowman-first-quote",
      events: [{
        purpose: "service_communications",
        decision: "granted",
        disclosureVersion: "2026-08-01",
      }],
    }),
    "unknown",
  );
});

Deno.test("consentEventsToRpcJson maps disclosure version snake_case", () => {
  const rows = consentEventsToRpcJson([
    {
      purpose: "service_communications",
      decision: "granted",
      disclosureVersion: "2026-08-01",
    },
  ]);
  assertEquals(rows[0].disclosure_version, "2026-08-01");
});

Deno.test("validateConsentRequest rejects unknown schema version", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "99",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "service_communications",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "invalid_consent_schema");
});

Deno.test("validateConsentRequest rejects invalid submission UUID", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "not-a-uuid",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "service_communications",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "invalid_submission_id");
});

Deno.test("validateConsentRequest rejects duplicate purposes", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "service_communications",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
        {
          purpose: "service_communications",
          decision: "declined",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "duplicate_consent_purpose");
});

Deno.test("validateConsentRequest rejects unsupported purpose", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "unknown_purpose",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "invalid_consent_purpose");
});

Deno.test("validateConsentRequest rejects unsupported decision", () => {
  const bad = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "11111111-1111-4111-8111-111111111111",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "truth-gate",
      events: [
        {
          purpose: "service_communications",
          decision: "maybe",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "truth-gate",
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "invalid_consent_decision");
});

const contractorGrantedEnvelope = {
  schemaVersion: "1" as const,
  submissionId: "11111111-1111-4111-8111-111111111111",
  privacyPolicyVersion: "2026-08-01",
  termsVersion: "2026-04-14",
  source: "homeowner-context",
  events: [
    {
      purpose: "contractor_sharing",
      decision: "granted",
      disclosureVersion: "2026-08-01",
    },
  ],
};

Deno.test("validateHandoffContractorConsentConsistency rejects accepted handoff without grant", () => {
  const bad = validateHandoffContractorConsentConsistency("accepted_today", {
    ...contractorGrantedEnvelope,
    events: [
      {
        purpose: "contractor_sharing",
        decision: "declined",
        disclosureVersion: "2026-08-01",
      },
    ],
  });
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "contractor_consent_mismatch");
});

Deno.test("validateHandoffContractorConsentConsistency rejects report_only with grant", () => {
  const bad = validateHandoffContractorConsentConsistency(
    "report_only",
    contractorGrantedEnvelope,
  );
  assertEquals(bad.ok, false);
  if (!bad.ok) assertEquals(bad.code, "contractor_consent_mismatch");
});

Deno.test("validateHandoffContractorConsentConsistency accepts matching accepted handoff", () => {
  const ok = validateHandoffContractorConsentConsistency(
    "accepted_tomorrow",
    contractorGrantedEnvelope,
  );
  assertEquals(ok.ok, true);
});

Deno.test("validateHandoffContractorConsentConsistency accepts skip-only declined consent", () => {
  const ok = validateHandoffContractorConsentConsistency(null, {
    ...contractorGrantedEnvelope,
    events: [
      {
        purpose: "contractor_sharing",
        decision: "declined",
        disclosureVersion: "2026-08-01",
      },
    ],
  });
  assertEquals(ok.ok, true);
});

// ── Persistence idempotency / conflict / ordering semantics ────────────────

const persistEnvelope: ParsedConsentRequest = {
  schemaVersion: "1",
  submissionId: "11111111-1111-4111-8111-111111111111",
  privacyPolicyVersion: "2026-08-01",
  termsVersion: "2026-04-14",
  source: "truth-gate",
  events: [
    {
      purpose: "service_communications",
      decision: "granted",
      disclosureVersion: "2026-08-01",
    },
  ],
};

function fakeAdmin(error: { code?: string; message?: string } | null) {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  return {
    calls,
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return Promise.resolve({ error });
    },
  };
}

Deno.test("quote education handoff persists its append-only consent batch", async () => {
  const parsed = validateConsentRequest(
    {
      schemaVersion: "1",
      submissionId: "33333333-3333-4333-8333-333333333333",
      privacyPolicyVersion: "2026-08-01",
      termsVersion: "2026-04-14",
      source: "quote-education-demo",
      events: [
        {
          purpose: "service_communications",
          decision: "granted",
          disclosureVersion: "2026-08-01",
        },
      ],
    },
    "quote-education-demo",
  );
  assertEquals(parsed.ok, true);
  if (!parsed.ok) return;

  const admin = fakeAdmin(null);
  const result = await persistConsentBatch(admin, {
    leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "22222222-2222-4222-8222-222222222222",
    consent: parsed.consent,
  });

  assertEquals(result.ok, true);
  assertEquals(admin.calls, [{
    fn: "persist_lead_consent_batch",
    args: {
      p_lead_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      p_session_id: "22222222-2222-4222-8222-222222222222",
      p_submission_id: "33333333-3333-4333-8333-333333333333",
      p_consent_schema_version: "1",
      p_privacy_policy_version: "2026-08-01",
      p_terms_version: "2026-04-14",
      p_source: "quote-education-demo",
      p_events: [{
        purpose: "service_communications",
        decision: "granted",
        disclosure_version: "2026-08-01",
      }],
    },
  }]);
});

Deno.test("persistConsentBatch identical duplicate resolves ok (idempotent RPC)", async () => {
  const admin = fakeAdmin(null);
  const result = await persistConsentBatch(admin, {
    leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "22222222-2222-4222-8222-222222222222",
    consent: persistEnvelope,
  });
  assertEquals(result.ok, true);
  assertEquals(admin.calls.length, 1);
  assertEquals(admin.calls[0].fn, "persist_lead_consent_batch");
  assertEquals(
    admin.calls[0].args.p_submission_id,
    persistEnvelope.submissionId,
  );
});

Deno.test("persistConsentBatch maps conflicting duplicate to consent_submission_conflict", async () => {
  const admin = fakeAdmin({
    code: "23505",
    message: "consent_submission_conflict",
  });
  const result = await persistConsentBatch(admin, {
    leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "22222222-2222-4222-8222-222222222222",
    consent: persistEnvelope,
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "consent_submission_conflict");
});

Deno.test("persistConsentBatch maps other errors to consent_persist_failed", async () => {
  const admin = fakeAdmin({ code: "XX000", message: "connection reset" });
  const result = await persistConsentBatch(admin, {
    leadId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    sessionId: "22222222-2222-4222-8222-222222222222",
    consent: persistEnvelope,
  });
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.code, "consent_persist_failed");
});

Deno.test("persistConsentThenRunSuccessEffects runs no success effect when persist fails", async () => {
  let effectsRan = 0;
  const result = await persistConsentThenRunSuccessEffects({
    persist: () =>
      Promise.resolve({
        ok: false as const,
        code: "consent_persist_failed",
        message: "Could not save consent records.",
      }),
    runSuccessEffects: () => {
      effectsRan += 1;
      return Promise.resolve();
    },
  });
  assertEquals(result.ok, false);
  assertEquals(effectsRan, 0);
});

Deno.test("persistConsentThenRunSuccessEffects runs success effects after persistence succeeds", async () => {
  const order: string[] = [];
  const result = await persistConsentThenRunSuccessEffects({
    persist: () => {
      order.push("persist");
      return Promise.resolve({ ok: true as const });
    },
    runSuccessEffects: () => {
      order.push("effects");
      return Promise.resolve();
    },
  });
  assertEquals(result.ok, true);
  assertEquals(order, ["persist", "effects"]);
});

Deno.test("consentPersistFailureStatus maps conflict to 409 and other failures to 500", () => {
  assertEquals(consentPersistFailureStatus("consent_submission_conflict"), 409);
  assertEquals(consentPersistFailureStatus("consent_persist_failed"), 500);
});
