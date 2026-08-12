// Orchestration tests for submit-diagnosis-intake handleRequest.
// Run via: deno test supabase/functions/submit-diagnosis-intake/

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCallbackRequestedEventId,
  handleRequest,
} from "./index.ts";

const SCAN_SESSION_ID = "11111111-1111-4111-8111-111111111111";
const CANONICAL_LEAD_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_LEAD_ID = "33333333-3333-4333-8333-333333333333";
const OTHER_SCAN_ID = "44444444-4444-4444-8444-444444444444";
const ANALYSIS_ID = "55555555-5555-4555-8555-555555555555";
const OTHER_ANALYSIS_ID = "66666666-6666-4666-8666-666666666666";
const SUBMISSION_ID = "77777777-7777-4777-8777-777777777777";
const SUBMISSION_ID_2 = "88888888-8888-4888-8888-888888888888";
const PHONE = "5551112222";

type Row = Record<string, unknown>;

class FakeDb {
  tables: Record<string, Row[]> = {
    scan_sessions: [],
    leads: [],
    phone_verifications: [],
    analyses: [],
    diagnosis_intakes: [],
    voice_followups: [],
    lead_consent_events: [],
    lead_events: [],
    wm_event_log: [],
    wm_platform_dispatch_log: [],
    wm_quote_facts: [],
  };
  webhookCalls = 0;
  consentLookupShouldFail = false;
  canonicalEventInsertAttempts = 0;

  seedEligible(opts?: { analysisId?: string | null }) {
    this.tables.scan_sessions.push({
      id: SCAN_SESSION_ID,
      lead_id: CANONICAL_LEAD_ID,
      client_slug: "direct",
      attribution: {},
      query_params: {},
    });
    this.tables.leads.push({
      id: CANONICAL_LEAD_ID,
      phone_verified: true,
      phone_e164: "+15551112222",
      phone_verified_at: "2026-08-12T00:00:00.000Z",
      session_id: "sess-1",
      client_slug: "direct",
      fbp: "fb.1.1",
      fbc: null,
      attribution: {},
      query_params: {},
    });
    this.tables.phone_verifications.push({
      id: crypto.randomUUID(),
      scan_session_id: SCAN_SESSION_ID,
      lead_id: CANONICAL_LEAD_ID,
      status: "verified",
    });
    const analysisId = opts?.analysisId === undefined
      ? ANALYSIS_ID
      : opts.analysisId;
    if (analysisId) {
      this.tables.analyses.push({
        id: analysisId,
        scan_session_id: SCAN_SESSION_ID,
        client_slug: "direct",
      });
    }
  }

  from(table: string) {
    return new FakeQuery(this, table);
  }
}

class FakeQuery {
  private filters: Array<[string, unknown]> = [];
  private pendingInsert: Row | Row[] | null = null;
  private pendingUpsert: {
    rows: Row[];
    onConflict?: string;
    ignoreDuplicates?: boolean;
  } | null = null;
  private pendingUpdate: Row | null = null;
  private op: "select" | "insert" | "upsert" | "update" = "select";

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string) {
    return this;
  }
  insert(payload: Row | Row[]) {
    this.op = "insert";
    this.pendingInsert = payload;
    return this;
  }
  upsert(
    payload: Row | Row[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) {
    this.op = "upsert";
    this.pendingUpsert = {
      rows: Array.isArray(payload) ? payload : [payload],
      onConflict: options?.onConflict,
      ignoreDuplicates: options?.ignoreDuplicates,
    };
    return this;
  }
  update(payload: Row) {
    this.op = "update";
    this.pendingUpdate = payload;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push([column, value]);
    return this;
  }
  order(_column: string, _opts?: { ascending: boolean }) {
    return this;
  }
  limit(_n: number) {
    return this;
  }

  private matches(row: Row): boolean {
    return this.filters.every(([col, val]) => row[col] === val);
  }

  private uniqueError(message: string) {
    return {
      data: null,
      error: { code: "23505", message },
    };
  }

  private execute(mode: "maybeSingle" | "single" | "many") {
    if (this.table === "lead_consent_events" && this.db.consentLookupShouldFail) {
      return Promise.resolve({
        data: null,
        error: { message: "consent lookup failed" },
      });
    }

    if (this.op === "insert" && this.pendingInsert) {
      if (this.table === "wm_event_log") {
        this.db.canonicalEventInsertAttempts++;
      }
      const rows = Array.isArray(this.pendingInsert)
        ? this.pendingInsert
        : [this.pendingInsert];
      const written: Row[] = [];
      for (const row of rows) {
        const withId: Row = { id: crypto.randomUUID(), ...row };
        if (
          this.table === "diagnosis_intakes" &&
          this.db.tables.diagnosis_intakes.some(
            (r) =>
              r.diagnosis_submission_id &&
              r.diagnosis_submission_id === withId.diagnosis_submission_id,
          )
        ) {
          return Promise.resolve(
            this.uniqueError("duplicate key diagnosis_submission_id"),
          );
        }
        if (
          this.table === "voice_followups" &&
          this.db.tables.voice_followups.some(
            (r) =>
              r.diagnosis_submission_id &&
              r.diagnosis_submission_id === withId.diagnosis_submission_id,
          )
        ) {
          return Promise.resolve(
            this.uniqueError("duplicate key diagnosis_submission_id"),
          );
        }
        if (
          this.table === "voice_followups" &&
          withId.scan_session_id &&
          withId.call_intent === "general_callback" &&
          withId.cta_source === "diagnosis_final_cta" &&
          this.db.tables.voice_followups.some(
            (r) =>
              r.scan_session_id === withId.scan_session_id &&
              r.call_intent === "general_callback" &&
              r.cta_source === "diagnosis_final_cta",
          )
        ) {
          return Promise.resolve(
            this.uniqueError("duplicate key scan_session_id"),
          );
        }
        if (
          this.table === "wm_event_log" &&
          this.db.tables.wm_event_log.some((r) => r.event_id === withId.event_id)
        ) {
          return Promise.resolve(
            this.uniqueError("duplicate key wm_event_log_event_id"),
          );
        }
        this.db.tables[this.table].push(withId);
        written.push(withId);
      }
      const data = mode === "many" ? written : written[0] ?? null;
      return Promise.resolve({ data, error: null });
    }

    if (this.op === "upsert" && this.pendingUpsert) {
      for (const row of this.pendingUpsert.rows) {
        const conflict = this.pendingUpsert.onConflict ?? "";
        if (conflict.includes("event_log_id") && conflict.includes("platform_name")) {
          const idx = this.db.tables[this.table].findIndex(
            (r) =>
              r.event_log_id === row.event_log_id &&
              r.platform_name === row.platform_name,
          );
          if (idx >= 0) {
            if (this.pendingUpsert.ignoreDuplicates) {
              continue;
            }
            this.db.tables[this.table][idx] = {
              ...this.db.tables[this.table][idx],
              ...row,
            };
            continue;
          }
        }
        this.db.tables[this.table].push({ id: crypto.randomUUID(), ...row });
      }
      return Promise.resolve({ data: this.pendingUpsert.rows, error: null });
    }

    if (this.op === "update" && this.pendingUpdate) {
      for (const row of this.db.tables[this.table]) {
        if (this.matches(row)) Object.assign(row, this.pendingUpdate);
      }
      return Promise.resolve({ data: null, error: null });
    }

    const matched = (this.db.tables[this.table] ?? []).filter((r) =>
      this.matches(r)
    );
    if (this.table === "lead_consent_events") {
      matched.sort((a, b) => {
        const at = String(b.created_at ?? "");
        const bt = String(a.created_at ?? "");
        if (at !== bt) return at < bt ? -1 : 1;
        return String(b.id ?? "").localeCompare(String(a.id ?? ""));
      });
    }
    if (mode === "many") {
      return Promise.resolve({ data: matched, error: null });
    }
    if (mode === "single") {
      return Promise.resolve({
        data: matched[0] ?? null,
        error: matched[0] ? null : { message: "not found" },
      });
    }
    return Promise.resolve({
      data: matched[0] ?? null,
      error: null,
    });
  }

  maybeSingle() {
    return this.execute("maybeSingle");
  }
  single() {
    return this.execute("single");
  }
  then(
    resolve: (v: unknown) => unknown,
    reject?: (e: unknown) => unknown,
  ) {
    return this.execute("many").then(resolve, reject);
  }
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    scan_session_id: SCAN_SESSION_ID,
    diagnosis_submission_id: SUBMISSION_ID,
    analysis_id: ANALYSIS_ID,
    report_grade: "C",
    primary_diagnosis: "price_shock",
    secondary_clarifiers: { codes: ["too_high"] },
    window_intelligence: { styles: [] },
    counter_offer: { terms_selected: ["lower_price"] },
    top_insights_snapshot: { items: [] },
    confidence: "0.70",
    prescription_path: "price",
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new Request("http://local/submit-diagnosis-intake", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

Deno.test("invalid diagnosis_submission_id → 400", async () => {
  const db = new FakeDb();
  const res = await handleRequest(
    makeRequest(validBody({ diagnosis_submission_id: "not-a-uuid" })),
    { supabase: db as never },
  );
  assertEquals(res.status, 400);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
});

Deno.test("missing scan session → 400 and no writes", async () => {
  const db = new FakeDb();
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  assertEquals(res.status, 400);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
  assertEquals(db.tables.voice_followups.length, 0);
});

Deno.test("client lead conflict → rejected, no writes", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const res = await handleRequest(
    makeRequest(validBody({ lead_id: OTHER_LEAD_ID })),
    { supabase: db as never },
  );
  assertEquals(res.status, 400);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
  assertEquals(db.tables.voice_followups.length, 0);
});

Deno.test("unverified lead → 403, no writes", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.leads[0].phone_verified = false;
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  assertEquals(res.status, 403);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
});

Deno.test("verified phone but wrong scan binding → 403, no writes", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.phone_verifications[0].scan_session_id = OTHER_SCAN_ID;
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  assertEquals(res.status, 403);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
  assertEquals(db.tables.voice_followups.length, 0);
});

Deno.test("analysis from another scan → rejected", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.analyses[0].scan_session_id = OTHER_SCAN_ID;
  const res = await handleRequest(
    makeRequest(validBody({ analysis_id: OTHER_ANALYSIS_ID })),
    { supabase: db as never },
  );
  // analysis id not in table OR mismatched session
  assertEquals(res.status, 400);
  assertEquals(db.tables.diagnosis_intakes.length, 0);
});

Deno.test("first submission writes one of each durable record", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.lead_consent_events.push({
    id: "c1",
    lead_id: CANONICAL_LEAD_ID,
    purpose: "marketing_communications",
    decision: "granted",
    created_at: "2026-08-12T01:00:00.000Z",
  });
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  assertEquals(res.status, 200);
  const json = await res.json();
  assertEquals(json.success, true);
  assertEquals(db.tables.diagnosis_intakes.length, 1);
  assertEquals(db.tables.voice_followups.length, 1);
  assertEquals(db.tables.wm_event_log.length, 1);
  const meta = db.tables.wm_platform_dispatch_log.filter((r) =>
    r.platform_name === "meta"
  );
  assertEquals(meta.length, 1);
  assertEquals(meta[0].dispatch_status, "pending");
  assertEquals(
    db.tables.wm_platform_dispatch_log.filter((r) =>
      r.platform_name !== "meta"
    ).length,
    0,
  );
  assertEquals(
    json.event_id,
    buildCallbackRequestedEventId({
      leadId: CANONICAL_LEAD_ID,
      scanSessionId: SCAN_SESSION_ID,
    }),
  );
  const payload = db.tables.wm_event_log[0].payload as Record<string, unknown>;
  const identity = payload.identity as Record<string, unknown>;
  assertEquals(typeof identity.phoneHash, "string");
  assertEquals(identity.phone, undefined);
  assert(!JSON.stringify(payload).includes(PHONE));
  assert(!JSON.stringify(payload).includes("+15551112222"));
});

Deno.test("same diagnosis_submission_id twice reuses ids", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const first = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const firstJson = await first.json();
  const second = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const secondJson = await second.json();
  assertEquals(second.status, 200);
  assertEquals(secondJson.diagnosis_intake_id, firstJson.diagnosis_intake_id);
  assertEquals(secondJson.voice_followup_id, firstJson.voice_followup_id);
  assertEquals(secondJson.event_id, firstJson.event_id);
  assertEquals(secondJson.reused, true);
  assertEquals(db.tables.diagnosis_intakes.length, 1);
  assertEquals(db.tables.voice_followups.length, 1);
  assertEquals(db.tables.wm_event_log.length, 1);
  assertEquals(db.tables.wm_platform_dispatch_log.length, 1);
});

Deno.test("two concurrent submissions with the same id → one logical operation", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const [a, b] = await Promise.all([
    handleRequest(makeRequest(validBody()), { supabase: db as never }),
    handleRequest(makeRequest(validBody()), { supabase: db as never }),
  ]);
  assertEquals(a.status, 200);
  assertEquals(b.status, 200);
  const aj = await a.json();
  const bj = await b.json();
  assertEquals(aj.event_id, bj.event_id);
  assertEquals(db.tables.diagnosis_intakes.length, 1);
  assertEquals(db.tables.voice_followups.length, 1);
  assertEquals(db.tables.wm_event_log.length, 1);
});

Deno.test("same submission id bound to another scan → 409", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const first = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  assertEquals(first.status, 200);
  db.tables.scan_sessions.push({
    id: OTHER_SCAN_ID,
    lead_id: OTHER_LEAD_ID,
  });
  db.tables.leads.push({
    id: OTHER_LEAD_ID,
    phone_verified: true,
    phone_e164: "+15553334444",
    phone_verified_at: "2026-08-12T00:00:00.000Z",
    session_id: "sess-2",
  });
  db.tables.phone_verifications.push({
    id: crypto.randomUUID(),
    scan_session_id: OTHER_SCAN_ID,
    lead_id: OTHER_LEAD_ID,
    status: "verified",
  });
  const res = await handleRequest(
    makeRequest(validBody({
      scan_session_id: OTHER_SCAN_ID,
      analysis_id: null,
    })),
    { supabase: db as never },
  );
  assertEquals(res.status, 409);
  assertEquals(db.tables.diagnosis_intakes.length, 1);
  assertEquals(db.tables.diagnosis_intakes[0].lead_id, CANONICAL_LEAD_ID);
});

Deno.test("new diagnosis_submission_id for the same scan reuses the callback and webhook", async () => {
  const db = new FakeDb();
  db.seedEligible();
  Deno.env.set("PHONECALL_BOT_WEBHOOK_URL", "https://example.test/webhook");
  let webhookCalls = 0;
  const fetchImpl = (() => {
    webhookCalls++;
    return Promise.resolve(new Response("ok", { status: 200 }));
  }) as typeof fetch;

  try {
    const first = await handleRequest(makeRequest(validBody()), {
      supabase: db as never,
      fetchImpl,
    });
    const firstJson = await first.json();
    const second = await handleRequest(
      makeRequest(validBody({ diagnosis_submission_id: SUBMISSION_ID_2 })),
      { supabase: db as never, fetchImpl },
    );
    const secondJson = await second.json();

    assertEquals(first.status, 200);
    assertEquals(second.status, 200);
    assertEquals(secondJson.reused, true);
    assertEquals(secondJson.voice_followup_id, firstJson.voice_followup_id);
    assertEquals(secondJson.event_id, firstJson.event_id);
    assertEquals(db.tables.diagnosis_intakes.length, 2);
    assertEquals(db.tables.voice_followups.length, 1);
    assertEquals(db.tables.wm_event_log.length, 1);
    assertEquals(db.tables.wm_platform_dispatch_log.length, 1);
    assertEquals(
      db.tables.wm_platform_dispatch_log[0].platform_name,
      "meta",
    );
    assertEquals(db.canonicalEventInsertAttempts, 1);
    assertEquals(webhookCalls, 1);
  } finally {
    Deno.env.delete("PHONECALL_BOT_WEBHOOK_URL");
  }
});

Deno.test("new submission id leaves an already sent Meta row untouched", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.lead_consent_events.push({
    id: "c1",
    lead_id: CANONICAL_LEAD_ID,
    purpose: "marketing_communications",
    decision: "granted",
    created_at: "2026-08-12T01:00:00.000Z",
  });

  const first = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const firstJson = await first.json();
  const metaRow = db.tables.wm_platform_dispatch_log[0];
  metaRow.dispatch_status = "sent";
  metaRow.attempt_count = 1;
  metaRow.dispatched_at = "2026-08-12T02:00:00.000Z";

  const second = await handleRequest(
    makeRequest(validBody({ diagnosis_submission_id: SUBMISSION_ID_2 })),
    { supabase: db as never },
  );
  const secondJson = await second.json();

  assertEquals(second.status, 200);
  assertEquals(secondJson.event_id, firstJson.event_id);
  assertEquals(secondJson.meta_dispatch_status, "suppressed");
  assertEquals(db.tables.wm_event_log.length, 1);
  assertEquals(db.tables.wm_platform_dispatch_log.length, 1);
  assertEquals(metaRow.dispatch_status, "sent");
  assertEquals(metaRow.attempt_count, 1);
  assertEquals(metaRow.dispatched_at, "2026-08-12T02:00:00.000Z");
  assertEquals(db.canonicalEventInsertAttempts, 1);
});

Deno.test("an existing callback event heals a missing Meta outbox row", async () => {
  const db = new FakeDb();
  db.seedEligible();

  const first = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const firstJson = await first.json();
  db.tables.wm_platform_dispatch_log.length = 0;

  const second = await handleRequest(
    makeRequest(validBody({ diagnosis_submission_id: SUBMISSION_ID_2 })),
    { supabase: db as never },
  );
  const secondJson = await second.json();

  assertEquals(second.status, 200);
  assertEquals(secondJson.event_id, firstJson.event_id);
  assertEquals(db.tables.wm_event_log.length, 1);
  assertEquals(db.tables.wm_platform_dispatch_log.length, 1);
  assertEquals(db.tables.wm_platform_dispatch_log[0].platform_name, "meta");
  assertEquals(db.canonicalEventInsertAttempts, 2);
});

Deno.test("concurrent new submission ids for the same scan queue one callback", async () => {
  const db = new FakeDb();
  db.seedEligible();
  Deno.env.set("PHONECALL_BOT_WEBHOOK_URL", "https://example.test/webhook");
  let webhookCalls = 0;
  const fetchImpl = (() => {
    webhookCalls++;
    return Promise.resolve(new Response("ok", { status: 200 }));
  }) as typeof fetch;

  try {
    const [first, second] = await Promise.all([
      handleRequest(makeRequest(validBody()), {
        supabase: db as never,
        fetchImpl,
      }),
      handleRequest(
        makeRequest(validBody({ diagnosis_submission_id: SUBMISSION_ID_2 })),
        { supabase: db as never, fetchImpl },
      ),
    ]);
    const firstJson = await first.json();
    const secondJson = await second.json();

    assertEquals(first.status, 200);
    assertEquals(second.status, 200);
    assertEquals(firstJson.voice_followup_id, secondJson.voice_followup_id);
    assertEquals(db.tables.diagnosis_intakes.length, 2);
    assertEquals(db.tables.voice_followups.length, 1);
    assertEquals(webhookCalls, 1);
  } finally {
    Deno.env.delete("PHONECALL_BOT_WEBHOOK_URL");
  }
});

Deno.test("a different scan session can queue a new diagnosis callback", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.scan_sessions.push({
    id: OTHER_SCAN_ID,
    lead_id: CANONICAL_LEAD_ID,
    client_slug: "direct",
    attribution: {},
    query_params: {},
  });
  db.tables.phone_verifications.push({
    id: crypto.randomUUID(),
    scan_session_id: OTHER_SCAN_ID,
    lead_id: CANONICAL_LEAD_ID,
    status: "verified",
  });

  await handleRequest(makeRequest(validBody()), { supabase: db as never });
  const second = await handleRequest(
    makeRequest(validBody({
      scan_session_id: OTHER_SCAN_ID,
      diagnosis_submission_id: SUBMISSION_ID_2,
      analysis_id: null,
    })),
    { supabase: db as never },
  );

  assertEquals(second.status, 200);
  assertEquals(db.tables.voice_followups.length, 2);
});

Deno.test("consent declined → Meta suppressed", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.lead_consent_events.push({
    id: "c1",
    lead_id: CANONICAL_LEAD_ID,
    purpose: "marketing_communications",
    decision: "declined",
    created_at: "2026-08-12T01:00:00.000Z",
  });
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const json = await res.json();
  assertEquals(res.status, 200);
  assertEquals(json.meta_dispatch_status, "suppressed");
  assertEquals(db.tables.wm_platform_dispatch_log[0].dispatch_status, "suppressed");
  assertEquals(
    db.tables.wm_platform_dispatch_log[0].error_message,
    "consent_declined",
  );
  assertEquals(db.tables.voice_followups.length, 1);
});

Deno.test("consent withdrawn → Meta suppressed", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.tables.lead_consent_events.push({
    id: "c1",
    lead_id: CANONICAL_LEAD_ID,
    purpose: "marketing_communications",
    decision: "withdrawn",
    created_at: "2026-08-12T01:00:00.000Z",
  });
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const json = await res.json();
  assertEquals(json.meta_dispatch_status, "suppressed");
  assertEquals(
    db.tables.wm_platform_dispatch_log[0].error_message,
    "consent_withdrawn",
  );
});

Deno.test("consent missing → Meta suppressed", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const json = await res.json();
  assertEquals(json.meta_dispatch_status, "suppressed");
  assertEquals(
    db.tables.wm_platform_dispatch_log[0].error_message,
    "consent_missing",
  );
});

Deno.test("consent lookup failure → callback durable, Meta suppressed", async () => {
  const db = new FakeDb();
  db.seedEligible();
  db.consentLookupShouldFail = true;
  const res = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
  });
  const json = await res.json();
  assertEquals(res.status, 200);
  assertEquals(db.tables.voice_followups.length, 1);
  assertEquals(json.meta_dispatch_status, "suppressed");
  assertEquals(
    db.tables.wm_platform_dispatch_log[0].error_message,
    "consent_lookup_failed",
  );
});

Deno.test("webhook failure keeps durable callback and does not duplicate on retry", async () => {
  const db = new FakeDb();
  db.seedEligible();
  Deno.env.set("PHONECALL_BOT_WEBHOOK_URL", "https://example.test/webhook");
  let calls = 0;
  const fetchImpl = ((
    _url: string | URL,
    _init?: RequestInit,
  ) => {
    calls++;
    return Promise.resolve(new Response("fail", { status: 500 }));
  }) as typeof fetch;
  const first = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
    fetchImpl,
  });
  assertEquals(first.status, 200);
  assertEquals(db.tables.voice_followups.length, 1);
  assertEquals(calls, 1);
  const second = await handleRequest(makeRequest(validBody()), {
    supabase: db as never,
    fetchImpl,
  });
  assertEquals(second.status, 200);
  assertEquals(calls, 1);
  assertEquals(db.tables.voice_followups.length, 1);
  Deno.env.delete("PHONECALL_BOT_WEBHOOK_URL");
});

Deno.test("webhook fetch errors do not leak tokenized URLs to logs", async () => {
  const db = new FakeDb();
  db.seedEligible();
  const secretUrl = "https://example.test/webhook?token=super-secret";
  Deno.env.set("PHONECALL_BOT_WEBHOOK_URL", secretUrl);
  const originalConsoleError = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);

  try {
    const fetchImpl = (() =>
      Promise.reject(new TypeError(`fetch failed for ${secretUrl}`))) as typeof fetch;
    const response = await handleRequest(makeRequest(validBody()), {
      supabase: db as never,
      fetchImpl,
    });

    assertEquals(response.status, 200);
    assertEquals(db.tables.voice_followups.length, 1);
    assertEquals(logged, [[
      "[submit-diagnosis-intake] webhook request failed",
    ]]);
    assertEquals(JSON.stringify(logged).includes("super-secret"), false);
  } finally {
    console.error = originalConsoleError;
    Deno.env.delete("PHONECALL_BOT_WEBHOOK_URL");
  }
});
