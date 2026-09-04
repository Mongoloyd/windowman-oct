import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import {
  buildTrustedImportPayload,
  extractMetaLeadgenEvents,
  fetchMetaGraphLead,
  isMetaWebhookTestMode,
  resolveMetaVerification,
  verifyMetaWebhookSignature,
} from "./metaWebhook.ts";

Deno.test("Meta verification accepts the configured token and returns the challenge", () => {
  const url = new URL(
    "https://example.test/webhook?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=123456",
  );

  assertEquals(resolveMetaVerification(url, "verify-me"), {
    ok: true,
    challenge: "123456",
  });
});

Deno.test("Meta verification fails closed for missing config or a mismatched token", () => {
  const url = new URL(
    "https://example.test/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=123456",
  );

  assertEquals(resolveMetaVerification(url, undefined), {
    ok: false,
    error: "not_configured",
  });
  assertEquals(resolveMetaVerification(url, "verify-me"), {
    ok: false,
    error: "verification_failed",
  });
});

Deno.test("X-Hub-Signature-256 validation matches the RFC 4231 SHA-256 vector", async () => {
  const rawBody = new TextEncoder().encode("Hi There");
  const appSecret = "\x0b".repeat(20);
  const signature =
    "sha256=b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7";

  assert(await verifyMetaWebhookSignature(rawBody, signature, appSecret));
  assert(
    !(await verifyMetaWebhookSignature(
      rawBody,
      signature.replace(/.$/, "0"),
      appSecret,
    )),
  );
  assert(!(await verifyMetaWebhookSignature(rawBody, "sha1=bad", appSecret)));
  assert(!(await verifyMetaWebhookSignature(rawBody, null, appSecret)));
});

Deno.test("leadgen extraction accepts page events, normalizes time, and deduplicates retries", () => {
  const payload = {
    object: "page",
    entry: [{
      id: "page-from-entry",
      changes: [{
        field: "leadgen",
        value: {
          leadgen_id: "lead-123",
          form_id: "form-456",
          ad_id: "ad-789",
          created_time: 1_630_087_926,
        },
      }, {
        field: "leadgen",
        value: { leadgen_id: "lead-123" },
      }, {
        field: "feed",
        value: { item: "ignored" },
      }],
    }],
  };

  assertEquals(extractMetaLeadgenEvents(payload), [{
    leadgenId: "lead-123",
    pageId: "page-from-entry",
    formId: "form-456",
    adId: "ad-789",
    createdTime: "2021-08-27T18:12:06.000Z",
  }]);
  assertEquals(extractMetaLeadgenEvents({ object: "user", entry: [] }), []);
});

Deno.test("META_WEBHOOK_TEST_MODE defaults on and requires explicit false to disable", () => {
  assertEquals(isMetaWebhookTestMode(undefined), true);
  assertEquals(isMetaWebhookTestMode("true"), true);
  assertEquals(isMetaWebhookTestMode("unexpected"), true);
  assertEquals(isMetaWebhookTestMode(" FALSE "), false);
});

Deno.test("Graph retrieval uses a bearer token, a versioned URL, and explicit lead fields", async () => {
  const requestedUrls: URL[] = [];
  let authorization: string | null = null;
  const fetchImpl = (
    input: string | URL | Request,
    init?: RequestInit,
  ): Promise<Response> => {
    requestedUrls.push(new URL(String(input)));
    authorization = new Headers(init?.headers).get("authorization");
    return Promise.resolve(
      new Response(
        JSON.stringify({
          id: "lead-123",
          created_time: "2026-09-04T12:00:00+0000",
          field_data: [{ name: "email", values: ["lead@example.com"] }],
        }),
        { status: 200 },
      ),
    );
  };

  const result = await fetchMetaGraphLead("lead-123", {
    accessToken: "page-token-secret",
    apiVersion: "v25.0",
    fetchImpl,
  });

  assert(result.ok);
  const requestedUrl = requestedUrls[0];
  assert(requestedUrl);
  assertEquals(requestedUrl.origin, "https://graph.facebook.com");
  assertEquals(requestedUrl.pathname, "/v25.0/lead-123");
  assertEquals(
    requestedUrl.searchParams.get("fields"),
    "id,created_time,ad_id,form_id,field_data",
  );
  assertEquals(requestedUrl.searchParams.has("access_token"), false);
  assertEquals(authorization, "Bearer page-token-secret");
});

Deno.test("Graph retrieval rejects invalid config and malformed lead responses", async () => {
  let fetchCount = 0;
  const fetchImpl = (): Promise<Response> => {
    fetchCount += 1;
    return Promise.resolve(
      new Response(JSON.stringify({ id: "lead-123" }), { status: 200 }),
    );
  };

  assertEquals(
    await fetchMetaGraphLead("lead-123", {
      accessToken: "token",
      apiVersion: "latest",
      fetchImpl,
    }),
    {
      ok: false,
      error: "meta_graph_invalid_config",
      upstreamStatus: null,
    },
  );
  assertEquals(fetchCount, 0);

  assertEquals(
    await fetchMetaGraphLead("lead-123", {
      accessToken: "token",
      apiVersion: "v25.0",
      fetchImpl,
    }),
    {
      ok: false,
      error: "meta_graph_invalid_response",
      upstreamStatus: 200,
    },
  );
});

Deno.test("Graph field_data is passed into the trusted importer payload unchanged", () => {
  const fieldData = [{ name: "email", values: ["lead@example.com"] }];
  const result = buildTrustedImportPayload(
    { id: "lead-123", field_data: fieldData },
    {
      leadgenId: "lead-123",
      pageId: "page-1",
      formId: "form-1",
      adId: "ad-1",
      createdTime: "2026-09-04T12:00:00.000Z",
    },
    true,
  );

  assertEquals(result.field_data, fieldData);
  assertEquals(result.platform_lead_id, "lead-123");
  assertEquals(result.form_id, "form-1");
  assertEquals(
    (result.raw_payload as Record<string, unknown>).meta_webhook_context,
    {
      leadgen_id: "lead-123",
      page_id: "page-1",
      form_id: "form-1",
      ad_id: "ad-1",
      created_time: "2026-09-04T12:00:00.000Z",
      test_mode: true,
    },
  );
});
