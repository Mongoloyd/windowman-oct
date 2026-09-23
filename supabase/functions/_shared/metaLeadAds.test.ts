import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { authorizeMetaWorker } from "./metaLeadAdsAuth.ts";
import { buildMetaQualifiedPayload } from "./metaLeadAdsFeedback.ts";
import { createGhlAdapter } from "./metaLeadAdsGhl.ts";
import {
  handleProcessMetaLeadRequest,
  parseSignedReceipt,
  prepareMetaLeadCompletion,
} from "../process-meta-lead/index.ts";
import { handleProcessMetaOutboxRequest } from "../process-meta-outbox/index.ts";

Deno.test("completion preserves distinct ad set and ad names", async () => {
  const prepared = await prepareMetaLeadCompletion(
    {} as Parameters<typeof prepareMetaLeadCompletion>[0],
    {
      id: crypto.randomUUID(),
      platform_lead_id: "attribution-regression",
      page_id: null,
      form_id: null,
      ad_id: null,
      platform_created_time: null,
      graph_payload: null,
      is_test: false,
      lease_token: crypto.randomUUID(),
      received_at: new Date().toISOString(),
    },
    {
      id: "attribution-regression",
      email: "synthetic@example.test",
      adset_name: "Synthetic audience",
      ad_name: "Synthetic creative",
    },
  );
  assert(prepared.ok);
  assertEquals(prepared.attributionInput.adset_name, "Synthetic audience");
  assertEquals(prepared.attributionInput.ad_name, "Synthetic creative");
});

Deno.test("worker requires the configured secret on the expected header", () => {
  assertEquals(
    authorizeMetaWorker(new Request("https://example.test"), "secret"),
    false,
  );
  assertEquals(
    authorizeMetaWorker(
      new Request("https://example.test", {
        headers: { "x-meta-worker-secret": "wrong" },
      }),
      "secret",
    ),
    false,
  );
  assertEquals(
    authorizeMetaWorker(
      new Request("https://example.test", {
        headers: { "x-meta-worker-secret": "secret" },
      }),
      "secret",
    ),
    true,
  );
});

Deno.test("both Meta workers fail closed before opening a database client", async () => {
  for (
    const handle of [
      handleProcessMetaLeadRequest,
      handleProcessMetaOutboxRequest,
    ]
  ) {
    const unauthorized = await handle(
      new Request("https://example.test", { method: "POST" }),
      (key) => key === "META_WORKER_SECRET" ? "secret" : undefined,
    );
    assertEquals(unauthorized.status, 401);
    const unconfigured = await handle(
      new Request("https://example.test", {
        method: "POST",
        headers: { "x-meta-worker-secret": "secret" },
      }),
      (key) => key === "META_WORKER_SECRET" ? "secret" : undefined,
    );
    assertEquals(unconfigured.status, 503);
  }
});

Deno.test("GHL adapter sends only one approved location and upserts by identity", async () => {
  let calls = 0;
  const adapter = createGhlAdapter("server-token", async (input, init) => {
    calls += 1;
    const request = new Request(input, init);
    assertEquals(
      request.url,
      "https://services.leadconnectorhq.com/contacts/upsert",
    );
    assertEquals(request.method, "POST");
    assertEquals(request.headers.get("Version"), "2023-02-21");
    const body = JSON.parse(await request.text());
    assertEquals(body.locationId, "approved-location");
    assertEquals(body.email, "lead@example.com");
    assertEquals(body.createNewIfDuplicateAllowed, false);
    return Response.json({
      contact: { id: "contact-1", locationId: "approved-location" },
    });
  });
  const result = await adapter.upsertQualifiedContact("approved-location", {
    firstName: "A",
    lastName: "Lead",
    email: "lead@example.com",
    phone: null,
  });
  assertEquals(result, { ok: true, contactId: "contact-1", status: 200 });
  assertEquals(calls, 1);
});

Deno.test("GHL adapter classifies retryable failures and rejects a wrong location", async () => {
  const retry = createGhlAdapter(
    "server-token",
    () => Promise.resolve(new Response("rate-limited", { status: 429 })),
  );
  assertEquals(
    await retry.upsertQualifiedContact("loc", {
      firstName: null,
      lastName: null,
      email: "lead@example.com",
      phone: null,
    }),
    { ok: false, code: "ghl_rate_limited", status: 429, retryable: true },
  );
  const mismatch = createGhlAdapter(
    "server-token",
    () =>
      Promise.resolve(
        Response.json({ contact: { id: "contact-1", locationId: "other" } }),
      ),
  );
  assertEquals(
    await mismatch.upsertQualifiedContact("loc", {
      firstName: null,
      lastName: null,
      email: "lead@example.com",
      phone: null,
    }),
    { ok: false, code: "ghl_contact_mismatch", status: 200, retryable: false },
  );
});

Deno.test("Meta qualification payload uses the original lead ID and hashes identity", async () => {
  const payload = await buildMetaQualifiedPayload({
    clientSlug: "pilot",
    eventId: "wm_meta_qualified_123",
    qualifiedAt: "2026-09-22T12:00:00.000Z",
    platformLeadId: "123",
    email: " LEAD@Example.com ",
    phone: " +14155550199 ",
  }, "TEST123");
  assert(payload);
  assertEquals(payload.test_event_code, "TEST123");
  const event = (payload.data as Array<Record<string, unknown>>)[0];
  assertEquals(event.event_name, "QualifiedLead");
  assertEquals(event.action_source, "system_generated");
  assertEquals(event.event_id, "wm_meta_qualified_123");
  const userData = event.user_data as Record<string, unknown>;
  assertEquals(userData.lead_id, "123");
  assertEquals((userData.em as string[])[0].length, 64);
  assertEquals((userData.ph as string[])[0].length, 64);
  assert(!JSON.stringify(payload).includes("LEAD@Example.com"));
  assert(!JSON.stringify(payload).includes("4155550199"));
  assertEquals(
    (event.custom_data as Record<string, unknown>).event_source,
    "crm",
  );
});

Deno.test("Meta qualification payload rejects missing milestone or lead ID", async () => {
  assertEquals(
    await buildMetaQualifiedPayload({
      clientSlug: "pilot",
      eventId: "event",
      qualifiedAt: "bad-date",
      platformLeadId: "123",
      email: null,
      phone: null,
    }),
    null,
  );
  assertEquals(
    await buildMetaQualifiedPayload({
      clientSlug: "pilot",
      eventId: "event",
      qualifiedAt: "2026-09-22T12:00:00Z",
      platformLeadId: "",
      email: null,
      phone: null,
    }),
    null,
  );
});

Deno.test("Meta qualification hashes only structurally valid E.164 phone strings", async () => {
  for (const phone of ["+1234567", "14155550199", "+0123456789", "", null]) {
    const payload = await buildMetaQualifiedPayload({
      clientSlug: "pilot",
      eventId: "event",
      qualifiedAt: "2026-09-22T12:00:00Z",
      platformLeadId: "123",
      email: null,
      phone,
    });
    assert(payload);
    const event = (payload.data as Array<Record<string, unknown>>)[0];
    const userData = event.user_data as Record<string, unknown>;
    assertEquals("ph" in userData, false);
  }
  const valid = await buildMetaQualifiedPayload({
    clientSlug: "pilot",
    eventId: "event",
    qualifiedAt: "2026-09-22T12:00:00Z",
    platformLeadId: "123",
    email: null,
    phone: "+441234567890",
  });
  assert(valid);
  const userData = (valid.data as Array<Record<string, unknown>>)[0]
    .user_data as Record<string, unknown>;
  assertEquals((userData.ph as string[])[0].length, 64);
});

Deno.test("signed receipt parser preserves a valid sibling and indexes malformed leadgen", () => {
  const body = JSON.stringify({
    object: "page",
    entry: [{
      id: "page-1",
      changes: [
        { field: "leadgen", value: { form_id: "form-1" } },
        {
          field: "leadgen",
          value: { leadgen_id: "lead-1", form_id: "form-1", page_id: "page-1" },
        },
      ],
    }],
  });
  const parsed = parseSignedReceipt(btoa(body));
  assertEquals(parsed.events.length, 1);
  assertEquals(parsed.events[0].leadgen_id, "lead-1");
  assertEquals(parsed.issues, [{
    code: "invalid_leadgen_id",
    entry_index: 0,
    change_index: 0,
  }]);
  assertEquals(parsed.issueCount, 1);
  assertEquals(
    parseSignedReceipt(btoa("not-json")).issues[0].code,
    "invalid_json",
  );
});

Deno.test("raw receipt worker completes mixed batch before inbox claim", async () => {
  const calls: string[] = [];
  const body = JSON.stringify({
    object: "page",
    entry: [{
      id: "page-1",
      changes: [
        { field: "leadgen", value: {} },
        {
          field: "leadgen",
          value: { leadgen_id: "lead-1", form_id: "form-1", page_id: "page-1" },
        },
      ],
    }],
  });
  const fake = {
    rpc(name: string, args: Record<string, unknown>) {
      calls.push(name);
      if (name === "meta_claim_webhook_receipts") {
        return Promise.resolve({
          data: [{
            id: "receipt",
            body_base64: btoa(body),
            lease_token: "lease",
          }],
          error: null,
        });
      }
      if (name === "meta_complete_webhook_receipt") {
        assertEquals((args.p_events as unknown[]).length, 1);
        assertEquals(
          (args.p_issues as Array<Record<string, unknown>>)[0].code,
          "invalid_leadgen_id",
        );
      }
      return Promise.resolve({
        data: name === "meta_claim_lead_inbox" ? [] : "complete",
        error: null,
      });
    },
  };
  const response = await handleProcessMetaLeadRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { "x-meta-worker-secret": "secret" },
    }),
    (key) =>
      ({
        META_WORKER_SECRET: "secret",
        SUPABASE_URL: "https://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "key",
      })[key],
    fake as unknown as Parameters<typeof handleProcessMetaLeadRequest>[2],
  );
  assertEquals(response.status, 200);
  assertEquals(calls, [
    "meta_claim_webhook_receipts",
    "meta_complete_webhook_receipt",
    "meta_claim_lead_inbox",
  ]);
});

Deno.test("GHL and Meta lanes settle independently under delivery and claim failures", async () => {
  const cases = [
    { ghl: "ok", meta: "ok", status: 200, delivered: 2, failed: 0 },
    { ghl: "fail", meta: "ok", status: 200, delivered: 1, failed: 1 },
    { ghl: "ok", meta: "fail", status: 200, delivered: 1, failed: 1 },
    { ghl: "fail", meta: "fail", status: 200, delivered: 0, failed: 2 },
    { ghl: "claim", meta: "ok", status: 503, delivered: 1, failed: 0 },
  ] as const;
  for (const scenario of cases) {
    const calls: string[] = [];
    const fake = {
      rpc(name: string, args: Record<string, unknown>) {
        calls.push(`${name}:${args.p_job_kind ?? args.p_id ?? ""}`);
        if (name === "meta_claim_integration_outbox") {
          const lane = args.p_job_kind === "ghl_contact" ? "ghl" : "meta";
          if (scenario[lane] === "claim") {
            return Promise.resolve({
              data: null,
              error: { code: "unavailable" },
            });
          }
          return Promise.resolve({
            data: [{
              id: args.p_job_kind,
              job_kind: args.p_job_kind,
              lease_token: "lease",
            }],
            error: null,
          });
        }
        return Promise.resolve({ data: true, error: null });
      },
    };
    const response = await handleProcessMetaOutboxRequest(
      new Request("https://example.test", {
        method: "POST",
        headers: { "x-meta-worker-secret": "secret" },
      }),
      (key) =>
        ({
          META_WORKER_SECRET: "secret",
          SUPABASE_URL: "https://example.test",
          SUPABASE_SERVICE_ROLE_KEY: "key",
          META_GHL_DELIVERY_ENABLED: "true",
          GHL_PRIVATE_INTEGRATION_TOKEN: "token",
          GHL_LOCATION_ID: "loc",
          META_CRM_FEEDBACK_ENABLED: "true",
          META_CRM_TEST_EVENT_CODE: "TEST",
        } as Record<string, string>)[key],
      {
        supabase: fake as unknown as NonNullable<
          Parameters<typeof handleProcessMetaOutboxRequest>[2]
        >["supabase"],
        deliverJob: (_db, job) =>
          Promise.resolve(
            scenario[job.job_kind === "ghl_contact" ? "ghl" : "meta"] === "fail"
              ? {
                ok: false,
                code: "mock_failure",
                status: 503,
                retryable: true,
              }
              : { ok: true, status: 200 },
          ),
      },
    );
    const result = await response.json();
    assertEquals(response.status, scenario.status);
    assertEquals(result.delivered, scenario.delivered);
    assertEquals(result.failed, scenario.failed);
    assertEquals(
      calls.filter((call) => call.startsWith("meta_claim_integration_outbox"))
        .length,
      2,
    );
  }
});

Deno.test("unconfirmed outbox completion reports recovery pending without blocking the other lane", async () => {
  const fake = {
    rpc(name: string, args: Record<string, unknown>) {
      if (name === "meta_claim_integration_outbox") {
        return Promise.resolve({
          data: [{
            id: args.p_job_kind,
            job_kind: args.p_job_kind,
            lease_token: "lease",
          }],
          error: null,
        });
      }
      return Promise.resolve({
        data: null,
        error: args.p_id === "ghl_contact" ? { code: "db_unavailable" } : null,
      });
    },
  };
  const response = await handleProcessMetaOutboxRequest(
    new Request("https://example.test", {
      method: "POST",
      headers: { "x-meta-worker-secret": "secret" },
    }),
    (key) =>
      ({
        META_WORKER_SECRET: "secret",
        SUPABASE_URL: "https://example.test",
        SUPABASE_SERVICE_ROLE_KEY: "key",
        META_GHL_DELIVERY_ENABLED: "true",
        GHL_PRIVATE_INTEGRATION_TOKEN: "token",
        GHL_LOCATION_ID: "loc",
        META_CRM_FEEDBACK_ENABLED: "true",
        META_CRM_TEST_EVENT_CODE: "TEST",
      } as Record<string, string>)[key],
    {
      supabase: fake as unknown as NonNullable<
        Parameters<typeof handleProcessMetaOutboxRequest>[2]
      >["supabase"],
      deliverJob: () => Promise.resolve({ ok: true, status: 200 }),
    },
  );
  assertEquals(response.status, 503);
  const body = await response.json();
  assertEquals(body.delivered, 1);
  assertEquals(body.recovery_pending, true);
});
