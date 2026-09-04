import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  type FacebookLeadAdHandlerDependencies,
  handleImportFacebookLeadAdRequest,
  normalizePayload,
} from "./index.ts";

const APP_SECRET = "test-meta-app-secret";

function envReader(values: Record<string, string | undefined>) {
  return (name: string) => values[name];
}

async function signatureFor(rawBody: string, secret = APP_SECRET) {
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
      new TextEncoder().encode(rawBody),
    ),
  );
  const hex = Array.from(
    digest,
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
  return `sha256=${hex}`;
}

function fakeSupabase(
  insert: (table: string, payload: unknown) => Promise<{
    data: unknown;
    error: unknown;
  }>,
): NonNullable<FacebookLeadAdHandlerDependencies["supabase"]> {
  return {
    from(table: string) {
      return {
        insert(payload: unknown) {
          return insert(table, payload);
        },
      };
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

Deno.test("native webhook stores its receipt before Graph fetch and uses the trusted importer", async () => {
  const order: string[] = [];
  const receiptPayloads: Record<string, unknown>[] = [];
  const trustedPayloads: Record<string, unknown>[] = [];
  const rawBody = JSON.stringify(leadgenEnvelope);

  const supabase = fakeSupabase((table, payload) => {
    order.push(`db:${table}`);
    receiptPayloads.push(payload as Record<string, unknown>);
    return Promise.resolve({ data: null, error: null });
  });

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
      env: envReader({
        META_APP_SECRET: APP_SECRET,
        META_PAGE_ACCESS_TOKEN: "page-access-token",
        META_GRAPH_API_VERSION: "v25.0",
        META_WEBHOOK_TEST_MODE: "true",
      }),
      supabase,
      fetchImpl: (_input, init) => {
        order.push("graph");
        assertEquals(
          new Headers(init?.headers).get("authorization"),
          "Bearer page-access-token",
        );
        return Promise.resolve(
          new Response(
            JSON.stringify({
              id: "lead-123",
              created_time: "2026-09-04T12:00:00+0000",
              form_id: "form-456",
              field_data: [
                { name: "email", values: ["lead@example.com"] },
                { name: "full_name", values: ["Test Lead"] },
              ],
            }),
            { status: 200 },
          ),
        );
      },
      importPayload: (_client, payload) => {
        order.push("trusted-import");
        trustedPayloads.push(payload);
        const normalized = normalizePayload(payload);
        assert(normalized.ok);
        if (normalized.ok) {
          assertEquals(normalized.payload.platformLeadId, "lead-123");
          assertEquals(normalized.payload.email, "lead@example.com");
          assertEquals(normalized.payload.fullName, "Test Lead");
        }
        return Promise.resolve(
          new Response(
            JSON.stringify({
              success: true,
              lead_id: "local-lead-id",
              attribution_id: "local-attribution-id",
              reused: false,
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            },
          ),
        );
      },
      now: () => new Date("2026-09-04T12:00:00.000Z"),
    },
  );

  assertEquals(response.status, 200);
  assertEquals(order, ["db:event_logs", "graph", "trusted-import"]);
  const receiptPayload = receiptPayloads[0];
  const trustedPayload = trustedPayloads[0];
  assert(receiptPayload);
  assert(trustedPayload);
  assertEquals(receiptPayload.event_name, "facebook_leadgen_webhook_received");
  assertEquals(
    (receiptPayload.metadata as Record<string, unknown>).raw_payload,
    leadgenEnvelope,
  );
  assertEquals(
    trustedPayload.field_data,
    [
      { name: "email", values: ["lead@example.com"] },
      { name: "full_name", values: ["Test Lead"] },
    ],
  );
  const responseBody = await response.json();
  assertEquals(responseBody.test_mode, true);
  assertEquals(responseBody.downstream_actions, "suppressed");
  assert(
    !order.some((entry) =>
      entry.includes("voice_followups") || entry.includes("webhook_deliveries")
    ),
  );
});

Deno.test("receipt failure aborts before Graph retrieval", async () => {
  let graphCalls = 0;
  const rawBody = JSON.stringify(leadgenEnvelope);
  const supabase = fakeSupabase(() =>
    Promise.resolve({ data: null, error: { message: "write failed" } })
  );

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
      env: envReader({
        META_APP_SECRET: APP_SECRET,
        META_PAGE_ACCESS_TOKEN: "page-access-token",
        META_GRAPH_API_VERSION: "v25.0",
      }),
      supabase,
      fetchImpl: () => {
        graphCalls += 1;
        return Promise.resolve(new Response("{}", { status: 200 }));
      },
    },
  );

  assertEquals(response.status, 500);
  assertEquals((await response.json()).error, "webhook_receipt_failed");
  assertEquals(graphCalls, 0);
});

Deno.test("the existing trusted-secret import path remains available", async () => {
  let importedBody: Record<string, unknown> | null = null;
  const originalPayload = {
    platform_lead_id: "legacy-123",
    email: "legacy@example.com",
  };
  const supabase = fakeSupabase(() =>
    Promise.resolve({ data: null, error: null })
  );

  const response = await handleImportFacebookLeadAdRequest(
    new Request("https://example.test/import-facebook-lead-ad", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-import-secret": "trusted-import-secret",
      },
      body: JSON.stringify(originalPayload),
    }),
    {
      env: envReader({
        FACEBOOK_LEAD_AD_IMPORT_SECRET: "trusted-import-secret",
      }),
      supabase,
      importPayload: (_client, body) => {
        importedBody = body;
        return Promise.resolve(
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      },
    },
  );

  assertEquals(response.status, 200);
  assertEquals(importedBody, originalPayload);
});
