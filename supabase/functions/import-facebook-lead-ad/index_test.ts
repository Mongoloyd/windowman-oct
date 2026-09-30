import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  type FacebookLeadAdHandlerDependencies,
  handleImportFacebookLeadAdRequest,
} from "./index.ts";

const APP_SECRET = "test-meta-app-secret";

function envReader(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

async function signatureFor(rawBody: string | Uint8Array, secret = APP_SECRET) {
  const bodyBytes = typeof rawBody === "string"
    ? new TextEncoder().encode(rawBody)
    : rawBody;
  const signatureInput = new Uint8Array(bodyBytes).buffer;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      signatureInput,
    ),
  );
  const hex = Array.from(
    digest,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256=${hex}`;
}

function assertNoWebhookResponseLeaks(body: unknown) {
  const serialized = JSON.stringify(body);
  for (
    const forbidden of [
      "lead_id",
      "attribution_id",
      "email",
      "phone",
      "field_data",
      "page-access-token",
    ]
  ) {
    assertEquals(serialized.includes(forbidden), false);
  }
}

function createLeadgenEnvelope(leadIds: string[]) {
  return {
    object: "page",
    entry: [{
      id: "page-1",
      time: 1_788_523_200,
      changes: leadIds.map((leadgenId, index) => ({
        field: "leadgen",
        value: {
          leadgen_id: leadgenId,
          form_id: `form-${index + 1}`,
          page_id: "page-1",
          ad_id: `ad-${index + 1}`,
          created_time: 1_788_523_200 + index,
        },
      })),
    }],
  };
}

function fakeSupabase(
  rpc: (name: string, payload: unknown) => Promise<{
    data: unknown;
    error: unknown;
  }>,
): NonNullable<FacebookLeadAdHandlerDependencies["supabase"]> {
  return {
    rpc,
    from(table: string) {
      const result = {
        data: table === "meta_form_consent_rules" ? [] : null,
        error: null,
      };
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(resolve(result)),
      };
      return query;
    },
  } as unknown as NonNullable<
    FacebookLeadAdHandlerDependencies["supabase"]
  >;
}

const leadgenEnvelope = {
  object: "page",
  entry: [{
    id: "page-1",
    time: 1_788_523_200,
    changes: [{
      field: "leadgen",
      value: {
        leadgen_id: "lead-123",
        form_id: "form-456",
        page_id: "page-1",
        created_time: 1_788_523_200,
      },
    }],
  }],
};

const batchLeadgenEnvelope = createLeadgenEnvelope([
  "lead-1",
  "lead-2",
  "lead-3",
  "lead-4",
]);

Deno.test("GET verification returns Meta's plain-text challenge", async () => {
  const response = await handleImportFacebookLeadAdRequest(
    new Request(
      "https://example.test/import-facebook-lead-ad?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=987654",
      { method: "GET" },
    ),
    { env: envReader({ META_WEBHOOK_VERIFY_TOKEN: "verify-me" }) },
  );

  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("content-type"),
    "text/plain; charset=utf-8",
  );
  assertEquals(await response.text(), "987654");
});

Deno.test("GET verification rejects a wrong token", async () => {
  const response = await handleImportFacebookLeadAdRequest(
    new Request(
      "https://example.test/import-facebook-lead-ad?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=987654",
      { method: "GET" },
    ),
    { env: envReader({ META_WEBHOOK_VERIFY_TOKEN: "verify-me" }) },
  );

  assertEquals(response.status, 403);
});

Deno.test("POST rejects a mismatched X-Hub-Signature-256 with 401", async () => {
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": `sha256=${"0".repeat(64)}`,
      },
      body: JSON.stringify(leadgenEnvelope),
    }),
    { env: envReader({ META_APP_SECRET: APP_SECRET }) },
  );

  assertEquals(response.status, 401);
  assertEquals(await response.json(), {
    success: false,
    error: "unauthorized",
  });
});

Deno.test("native webhook durably accepts an authenticated empty body", async () => {
  let storedBody: unknown;
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "x-hub-signature-256": await signatureFor("") },
      body: "",
    }),
    {
      env: envReader({ META_APP_SECRET: APP_SECRET }),
      supabase: fakeSupabase((_name, payload) => {
        storedBody = (payload as Record<string, unknown>).p_body_base64;
        return Promise.resolve({ data: crypto.randomUUID(), error: null });
      }),
    },
  );
  assertEquals(response.status, 200);
  assertEquals(storedBody, "");
});

Deno.test("native webhook persists signed malformed UTF-8 before acknowledgment", async () => {
  const rawBody = Uint8Array.from([
    0x7b,
    0x22,
    0x61,
    0x22,
    0x3a,
    0xff,
    0x7d,
  ]);

  const calls: string[] = [];
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": await signatureFor(rawBody),
      },
      body: rawBody,
    }),
    {
      env: envReader({ META_APP_SECRET: APP_SECRET }),
      supabase: fakeSupabase((name) => {
        calls.push(name);
        return Promise.resolve({
          data: "00000000-0000-4000-8000-000000000001",
          error: null,
        });
      }),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(calls, ["meta_receive_webhook_receipt"]);
  assertEquals(await response.json(), { success: true, queued: true });
});

Deno.test("signed webhook stores original bytes before structural parsing", async () => {
  const rawBody = JSON.stringify(batchLeadgenEnvelope);
  const calls: Array<{ name: string; payload: Record<string, unknown> }> = [];
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "X-Hub-Signature-256": await signatureFor(rawBody) },
      body: rawBody,
    }),
    {
      env: envReader({ META_APP_SECRET: APP_SECRET }),
      supabase: fakeSupabase((name, payload) => {
        calls.push({ name, payload: payload as Record<string, unknown> });
        return Promise.resolve({
          data: "00000000-0000-4000-8000-000000000001",
          error: null,
        });
      }),
    },
  );
  assertEquals(response.status, 200);
  const responseBody = await response.json();
  assertEquals(responseBody, { success: true, queued: true });
  assertNoWebhookResponseLeaks(responseBody);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].name, "meta_receive_webhook_receipt");
  assertEquals(calls[0].payload.p_global_test_mode, true);
  assertEquals(atob(calls[0].payload.p_body_base64 as string), rawBody);
  assertEquals((calls[0].payload.p_body_sha256 as string).length, 64);
});

Deno.test("signed leadgen change without an ID remains durable", async () => {
  const rawBody = JSON.stringify({
    object: "page",
    entry: [{ changes: [{ field: "leadgen", value: { form_id: "form-1" } }] }],
  });
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "X-Hub-Signature-256": await signatureFor(rawBody) },
      body: rawBody,
    }),
    {
      env: envReader({ META_APP_SECRET: APP_SECRET }),
      supabase: fakeSupabase(() =>
        Promise.resolve({
          data: "00000000-0000-4000-8000-000000000001",
          error: null,
        })
      ),
    },
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { success: true, queued: true });
});

Deno.test("receipt failure is not acknowledged", async () => {
  const rawBody = JSON.stringify(leadgenEnvelope);
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "X-Hub-Signature-256": await signatureFor(rawBody) },
      body: rawBody,
    }),
    {
      env: envReader({ META_APP_SECRET: APP_SECRET }),
      supabase: fakeSupabase(() =>
        Promise.resolve({ data: null, error: { code: "PGRST000" } })
      ),
    },
  );
  assertEquals(response.status, 500);
  assertEquals((await response.json()).error, "webhook_receipt_failed");
});

Deno.test("trusted-secret import persists test lead synchronously and returns legacy IDs", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const body = {
    platform_lead_id: "trusted-1",
    form_id: "form-1",
    email: "person@example.com",
    is_test: true,
  };
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "x-import-secret": "trusted-secret" },
      body: JSON.stringify(body),
    }),
    {
      env: envReader({
        FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-secret",
        META_WEBHOOK_TEST_MODE: "false",
      }),
      supabase: fakeSupabase((_name, payload) => {
        calls.push(payload as Record<string, unknown>);
        return Promise.resolve({
          data: [{
            lead_id: "lead-uuid",
            attribution_id: "attr-uuid",
            reused: false,
          }],
          error: null,
        });
      }),
    },
  );
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    success: true,
    lead_id: "lead-uuid",
    attribution_id: "attr-uuid",
    reused: false,
  });
  assertEquals(calls[0].p_is_test, true);
  assertEquals(calls[0].p_platform_lead_id, "trusted-1");
  assertEquals(calls[0].p_graph_payload, body);
});

Deno.test("trusted import without is_test stays live and replay reports reused", async () => {
  const states: boolean[] = [];
  for (const reused of [false, true]) {
    const response = await handleImportFacebookLeadAdRequest(
      new Request("https://example.test/import-facebook-lead-ad", {
        method: "POST",
        headers: { authorization: "Bearer trusted-secret" },
        body: JSON.stringify({
          platform_lead_id: "trusted-live",
          email: "lead@example.com",
        }),
      }),
      {
        env: envReader({
          FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-secret",
          META_WEBHOOK_TEST_MODE: "true",
        }),
        supabase: fakeSupabase((_name, payload) => {
          states.push(
            (payload as Record<string, unknown>).p_is_test as boolean,
          );
          return Promise.resolve({
            data: [{
              lead_id: "same-lead",
              attribution_id: "same-attr",
              reused,
            }],
            error: null,
          });
        }),
      },
    );
    assertEquals(response.status, 200);
    assertEquals(await response.json(), {
      success: true,
      lead_id: "same-lead",
      attribution_id: "same-attr",
      reused,
    });
  }
  assertEquals(states, [false, false]);
});

Deno.test("signature takes precedence over a valid trusted secret", async () => {
  let persisted = false;
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: {
        "x-import-secret": "trusted-secret",
        "x-hub-signature-256": `sha256=${"0".repeat(64)}`,
      },
      body: JSON.stringify(leadgenEnvelope),
    }),
    {
      env: envReader({
        FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-secret",
        META_APP_SECRET: APP_SECRET,
      }),
      supabase: fakeSupabase(() => {
        persisted = true;
        return Promise.resolve({ data: null, error: null });
      }),
    },
  );
  assertEquals(response.status, 401);
  assertEquals(persisted, false);
});

Deno.test("even an empty signature header cannot fall through to trusted import", async () => {
  let persisted = false;
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: {
        "x-import-secret": "trusted-secret",
        "x-hub-signature-256": "",
      },
      body: JSON.stringify({
        platform_lead_id: "lead-1",
        email: "lead@example.com",
      }),
    }),
    {
      env: envReader({
        FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-secret",
        META_APP_SECRET: APP_SECRET,
      }),
      supabase: fakeSupabase(() => {
        persisted = true;
        return Promise.resolve({ data: null, error: null });
      }),
    },
  );
  assertEquals(response.status, 401);
  assertEquals(persisted, false);
});

Deno.test("trusted live Make payload preserves five answers without inventing consent", async () => {
  const calls: Array<Record<string, unknown>> = [];
  const customAnswers = {
    project_stage: 'Comparing "quotes"',
    qualification_openings: "6-10",
    property_type: "Single family",
    time_frame: "Within 3 months",
    quote_age: "Less than 30 days",
  };
  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: { "x-import-secret": "trusted-secret" },
      body: JSON.stringify({
        leadgen_id: "make-five-answer-live",
        page_id: "1288490644343316",
        form_id: "1436331951156800",
        email: " Make.Five@Example.invalid ",
        phone_number: "(202) 555-0187",
        first_name: "Integration",
        zip_code: "33101",
        is_test: false,
        ...customAnswers,
      }),
    }),
    {
      env: envReader({ FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-secret" }),
      supabase: fakeSupabase((name, payload) => {
        assertEquals(name, "meta_import_trusted_lead");
        calls.push(payload as Record<string, unknown>);
        return Promise.resolve({
          data: [{
            lead_id: "lead-five",
            attribution_id: "attr-five",
            reused: false,
          }],
          error: null,
        });
      }),
    },
  );
  assertEquals(response.status, 200);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].p_is_test, false);
  assertEquals(calls[0].p_consents, []);
  assertEquals(calls[0].p_lead, {
    session_id: "fbla_make-five-answer-live",
    first_name: "Integration",
    last_name: null,
    email: "make.five@example.invalid",
    phone_e164: "+12025550187",
    county: null,
    zip: "33101",
    qualification_answers_json: {
      native_lead: { custom_answers: customAnswers },
    },
  });
});
