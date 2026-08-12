// supabase/functions/submit-diagnosis-intake/index_test.ts
//
// Pure Deno unit tests for server-side lead-authority resolution exported from
// ./index.ts. No network, no env, no live database.
//
// The handler's HTTP/Deno.serve path is import-safe because the server is only
// started under `if (import.meta.main)`, so importing this module does not bind
// a port. Database access for lead resolution is exercised through an injected
// stub `DiagnosisLeadFetcher` (matching start-upload-scan-session's pattern).
//
// Coverage maps to the diagnosis-flow-local-repair sprint:
//   1  valid eligible session → server-derived canonical lead_id is used
//   2  omitted client lead_id → succeeds
//   3  matching legacy client lead_id → compatible
//   4  conflicting legacy client lead_id → rejected before eligibility/writes
//   5  unknown scan session → fails closed
//   6  scan session with lead_id IS NULL → fails closed
//   7  missing related lead → fails closed
//   8  lead/session failing the established eligibility rule → fails closed
//   9  error responses expose no PII
//   10 successful response body fields remain compatible
//
// Run via: deno test supabase/functions/submit-diagnosis-intake/

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  buildCallbackRequestedEventId,
  buildSuccessBody,
  type DiagnosisLeadFetcher,
  INVALID_CONTEXT_ERROR,
  isUuid,
  type LeadEligibilityRow,
  NOT_VERIFIED_ERROR,
  resolveDiagnosisLeadAuthority,
  type ScanSessionLeadRow,
} from "./index.ts";

const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_LEAD_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LEAD_ID = "33333333-3333-4333-8333-333333333333";

interface StubConfig {
  scanSession?: ScanSessionLeadRow | null;
  lead?: LeadEligibilityRow | null;
  verifiedBinding?: boolean;
}

interface StubHandle {
  fetcher: DiagnosisLeadFetcher;
  calls: {
    getScanSessionLead: number;
    getLeadEligibility: number;
    hasVerifiedSessionBinding: number;
  };
}

/** Fully-eligible defaults: canonical lead, phone_verified, verified binding. */
function makeFetcher(cfg: StubConfig = {}): StubHandle {
  const calls = {
    getScanSessionLead: 0,
    getLeadEligibility: 0,
    hasVerifiedSessionBinding: 0,
  };
  const scanSession =
    cfg.scanSession === undefined
      ? { lead_id: CANONICAL_LEAD_ID }
      : cfg.scanSession;
  const lead =
    cfg.lead === undefined ? { phone_verified: true } : cfg.lead;
  const verifiedBinding =
    cfg.verifiedBinding === undefined ? true : cfg.verifiedBinding;

  return {
    calls,
    fetcher: {
      getScanSessionLead: (_id: string) => {
        calls.getScanSessionLead++;
        return Promise.resolve(scanSession);
      },
      getLeadEligibility: (_id: string) => {
        calls.getLeadEligibility++;
        return Promise.resolve(lead);
      },
      hasVerifiedSessionBinding: (_s: string, _l: string) => {
        calls.hasVerifiedSessionBinding++;
        return Promise.resolve(verifiedBinding);
      },
    },
  };
}

// ── isUuid guard ─────────────────────────────────────────────────────────────

Deno.test("isUuid accepts a canonical uuid and rejects junk", () => {
  assert(isUuid(SCAN_SESSION_ID));
  assert(!isUuid("not-a-uuid"));
  assert(!isUuid(undefined));
  assert(!isUuid(123));
});

// ── 1. valid eligible session → server-derived canonical lead_id ─────────────

Deno.test("valid eligible session resolves the server-derived canonical lead_id", async () => {
  const { fetcher } = makeFetcher();
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(res.ok);
  assertEquals(res.leadId, CANONICAL_LEAD_ID);
});

// ── 2. omitted client lead_id → succeeds ─────────────────────────────────────

Deno.test("omitted client lead_id still succeeds", async () => {
  const { fetcher } = makeFetcher();
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
    clientLeadId: undefined,
  });
  assert(res.ok);
  assertEquals(res.leadId, CANONICAL_LEAD_ID);
});

Deno.test("null client lead_id still succeeds", async () => {
  const { fetcher } = makeFetcher();
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
    clientLeadId: null,
  });
  assert(res.ok);
  assertEquals(res.leadId, CANONICAL_LEAD_ID);
});

// ── 3. matching legacy client lead_id → compatible ───────────────────────────

Deno.test("matching legacy client lead_id remains compatible", async () => {
  const { fetcher } = makeFetcher();
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
    clientLeadId: CANONICAL_LEAD_ID,
  });
  assert(res.ok);
  assertEquals(res.leadId, CANONICAL_LEAD_ID);
});

// ── 4. conflicting legacy client lead_id → rejected before eligibility/writes ─

Deno.test("conflicting legacy client lead_id is rejected before eligibility lookups", async () => {
  const { fetcher, calls } = makeFetcher();
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
    clientLeadId: OTHER_LEAD_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 400);
  assertEquals(res.error, INVALID_CONTEXT_ERROR);
  // Rejected before any eligibility lookup — and therefore before any writes.
  assertEquals(calls.getLeadEligibility, 0);
  assertEquals(calls.hasVerifiedSessionBinding, 0);
});

// ── 5. unknown scan session → fails closed ───────────────────────────────────

Deno.test("unknown scan session fails closed", async () => {
  const { fetcher, calls } = makeFetcher({ scanSession: null });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 400);
  assertEquals(res.error, INVALID_CONTEXT_ERROR);
  assertEquals(calls.getLeadEligibility, 0);
});

// ── 6. scan session with lead_id IS NULL → fails closed ──────────────────────

Deno.test("scan session with null lead_id fails closed", async () => {
  const { fetcher } = makeFetcher({ scanSession: { lead_id: null } });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 400);
  assertEquals(res.error, INVALID_CONTEXT_ERROR);
});

// ── 7. missing related lead → fails closed ───────────────────────────────────

Deno.test("missing related lead fails closed", async () => {
  const { fetcher } = makeFetcher({ lead: null });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 400);
  assertEquals(res.error, INVALID_CONTEXT_ERROR);
});

// ── 8. failing the established eligibility rule → fails closed ────────────────

Deno.test("lead not phone_verified fails closed (403)", async () => {
  const { fetcher, calls } = makeFetcher({ lead: { phone_verified: false } });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 403);
  assertEquals(res.error, NOT_VERIFIED_ERROR);
  // Never reaches the session-binding check once phone_verified is false.
  assertEquals(calls.hasVerifiedSessionBinding, 0);
});

Deno.test("phone_verified null fails closed (403)", async () => {
  const { fetcher } = makeFetcher({ lead: { phone_verified: null } });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 403);
});

Deno.test("no verified session binding fails closed (403)", async () => {
  const { fetcher } = makeFetcher({ verifiedBinding: false });
  const res = await resolveDiagnosisLeadAuthority(fetcher, {
    scanSessionId: SCAN_SESSION_ID,
  });
  assert(!res.ok);
  assertEquals(res.status, 403);
  assertEquals(res.error, NOT_VERIFIED_ERROR);
});

// ── 9. error responses expose no PII ─────────────────────────────────────────

Deno.test("failure errors are generic and expose no lead PII", async () => {
  const piiName = "Jane Homeowner";
  const piiPhone = "+13055551234";
  const cases = [
    await resolveDiagnosisLeadAuthority(makeFetcher({ scanSession: null }).fetcher, {
      scanSessionId: SCAN_SESSION_ID,
    }),
    await resolveDiagnosisLeadAuthority(
      makeFetcher({ lead: { phone_verified: false } }).fetcher,
      { scanSessionId: SCAN_SESSION_ID },
    ),
    await resolveDiagnosisLeadAuthority(
      makeFetcher({ verifiedBinding: false }).fetcher,
      { scanSessionId: SCAN_SESSION_ID },
    ),
  ];
  for (const res of cases) {
    assert(!res.ok);
    // No canonical id, name, or phone leaks into the client-visible error.
    assert(!res.error.includes(CANONICAL_LEAD_ID));
    assert(!res.error.includes(piiName));
    assert(!res.error.includes(piiPhone));
  }
  // The only two failure strings are the fixed generic constants.
  assert(
    [INVALID_CONTEXT_ERROR, NOT_VERIFIED_ERROR].includes(
      (cases[0] as { error: string }).error,
    ),
  );
});

// ── 10. successful response body fields remain compatible ────────────────────

Deno.test("buildSuccessBody returns the durable-boundary contract", () => {
  const body = buildSuccessBody({
    eventId: "wmc_callback_requested_lead-a_scan-b",
    diagnosisIntakeId: "di_1",
    voiceFollowupId: "vf_1",
    reused: false,
    metaDispatchStatus: "pending",
  });
  assertEquals(body.success, true);
  assertEquals(body.diagnosis_intake_id, "di_1");
  assertEquals(body.voice_followup_id, "vf_1");
  assertEquals(body.event_id, "wmc_callback_requested_lead-a_scan-b");
  assertEquals(body.reused, false);
  assertEquals(body.meta_dispatch_status, "pending");
  const json = JSON.stringify(body);
  assert(!json.includes("lead_id"));
  assert(!json.includes("phone"));
});

Deno.test("callback event id is stable for the verified lead and scan", () => {
  assertEquals(
    buildCallbackRequestedEventId({
      leadId: CANONICAL_LEAD_ID,
      scanSessionId: SCAN_SESSION_ID,
    }),
    `wmc_callback_requested_lead-${CANONICAL_LEAD_ID}_scan-${SCAN_SESSION_ID}`,
  );
});
