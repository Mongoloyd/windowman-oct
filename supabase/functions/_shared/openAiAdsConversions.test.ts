import {
  deepStrictEqual as assertEquals,
  ok as assert,
} from "node:assert/strict";
import {
  buildOpenAiAdsLeadCreatedRequest,
  buildOpenAiAdsLeadEventId,
  hashOpenAiAdsEmail,
  type OpenAiAdsLeadCreatedInput,
  parseOpenAiAdsClientContext,
  readOpenAiAdsRuntimeConfig,
  resolveOpenAiAdsSourceUrl,
  scheduleOpenAiAdsConversion,
  sendOpenAiAdsLeadCreated,
} from "./openAiAdsConversions.ts";

const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const EVENT_ID = `wm_openai_lead_created_${LEAD_ID}`;
const TIMESTAMP_MS = 1773892800000;

function leadInput(
  overrides: Partial<OpenAiAdsLeadCreatedInput> = {},
): OpenAiAdsLeadCreatedInput {
  return {
    eventId: EVENT_ID,
    timestampMs: TIMESTAMP_MS,
    email: " Homeowner@Example.com ",
    context: {
      measurementConsent: true,
      sourceUrl: "https://windowman.app/quote-check?oppref=secret#form",
      oppref: "opaque%2Foppref%3Dvalue",
      obref: "browser-reference-123",
    },
    requestOrigin: "https://windowman.app",
    canonicalSiteOrigin: "https://windowman.app",
    ipAddress: "203.0.113.10",
    userAgent: "WindowMan test user agent",
    ...overrides,
  };
}

Deno.test("parseOpenAiAdsClientContext requires explicit granted consent", () => {
  assertEquals(
    parseOpenAiAdsClientContext({
      openai_ads: {
        measurementConsent: false,
        sourceUrl: "https://windowman.app/",
      },
    }),
    null,
  );
  assertEquals(parseOpenAiAdsClientContext({ openai_ads: {} }), null);
  assertEquals(parseOpenAiAdsClientContext({}), null);
});

Deno.test("parseOpenAiAdsClientContext preserves opaque references unchanged", () => {
  const context = parseOpenAiAdsClientContext({
    openai_ads: {
      measurementConsent: true,
      sourceUrl: "https://windowman.app/?oppref=url-value",
      oppref: "opaque%2Foppref%3Dvalue",
      obref: " opaque-browser-reference ",
    },
  });

  assertEquals(context, {
    measurementConsent: true,
    sourceUrl: "https://windowman.app/?oppref=url-value",
    oppref: "opaque%2Foppref%3Dvalue",
    obref: " opaque-browser-reference ",
  });
});

Deno.test("buildOpenAiAdsLeadEventId is deterministic from the persisted lead", () => {
  assertEquals(buildOpenAiAdsLeadEventId(LEAD_ID), EVENT_ID);
});

Deno.test("readOpenAiAdsRuntimeConfig uses server-only env names", () => {
  const requestedNames: string[] = [];

  assertEquals(
    readOpenAiAdsRuntimeConfig((name) => {
      requestedNames.push(name);
      return undefined;
    }),
    {
      pixelId: null,
      apiKey: null,
      canonicalSiteOrigin: null,
    },
  );
  assertEquals(requestedNames, [
    "OPENAI_ADS_PIXEL_ID",
    "OPENAI_ADS_CONVERSIONS_API_KEY",
    "OPENAI_ADS_SITE_ORIGIN",
  ]);
});

Deno.test("resolveOpenAiAdsSourceUrl strips query and fragment for a trusted browser origin", () => {
  assertEquals(
    resolveOpenAiAdsSourceUrl({
      browserSourceUrl:
        "https://windowman.netlify.app/quote-check?oppref=opaque#form",
      requestOrigin: "https://windowman.netlify.app",
      canonicalSiteOrigin: "https://windowman.app",
    }),
    "https://windowman.netlify.app/quote-check",
  );
});

Deno.test("resolveOpenAiAdsSourceUrl rejects an untrusted browser origin and prefers canonical fallback", () => {
  assertEquals(
    resolveOpenAiAdsSourceUrl({
      browserSourceUrl: "https://evil.example/steal?email=raw#fragment",
      requestOrigin: "https://evil.example",
      canonicalSiteOrigin: "https://windowman.app",
    }),
    "https://windowman.app/",
  );
});

Deno.test("resolveOpenAiAdsSourceUrl fails closed without any trusted origin", () => {
  assertEquals(
    resolveOpenAiAdsSourceUrl({
      browserSourceUrl: "javascript:alert(1)",
      requestOrigin: "https://evil.example",
      canonicalSiteOrigin: null,
    }),
    null,
  );
});

Deno.test("hashOpenAiAdsEmail normalizes and SHA-256 hashes email", async () => {
  assertEquals(
    await hashOpenAiAdsEmail(" Homeowner@Example.com "),
    "a3fb7a6a82b1471d0422e4fd16c99264a8a86860687c12520f41ac90dab7b0db",
  );
});

Deno.test("buildOpenAiAdsLeadCreatedRequest uses current schema and no raw PII", async () => {
  const request = await buildOpenAiAdsLeadCreatedRequest(leadInput());
  assert(request);

  assertEquals(request.validate_only, false);
  assertEquals(request.events[0], {
    id: EVENT_ID,
    type: "lead_created",
    timestamp_ms: TIMESTAMP_MS,
    source_url: "https://windowman.app/quote-check",
    action_source: "web",
    oppref: "opaque%2Foppref%3Dvalue",
    user: {
      email_sha256:
        "a3fb7a6a82b1471d0422e4fd16c99264a8a86860687c12520f41ac90dab7b0db",
      obref: "browser-reference-123",
      ip_address: "203.0.113.10",
      user_agent: "WindowMan test user agent",
    },
    data: { type: "customer_action" },
  });

  const serialized = JSON.stringify(request);
  assert(!serialized.includes("Homeowner@Example.com"));
  assert(!serialized.includes("phone"));
  assert(!serialized.includes("event_id"));
  assert(!serialized.includes("event_name"));
  assert(!serialized.includes("event_time_epoch_ms"));
});

Deno.test("sendOpenAiAdsLeadCreated keeps the key in Authorization only", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl =
    (async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

  const result = await sendOpenAiAdsLeadCreated(
    {
      ...leadInput(),
      pixelId: "NaEYyiZGt6Hh6zVoNP5RqM",
      apiKey: "placeholder-server-key",
    },
    { fetchImpl, timeoutMs: 100 },
  );

  assertEquals(result, { ok: true, providerStatus: 200 });
  assertEquals(
    capturedUrl,
    "https://bzr.openai.com/v1/events?pid=NaEYyiZGt6Hh6zVoNP5RqM",
  );
  assertEquals(
    new Headers(capturedInit?.headers).get("Authorization"),
    "Bearer placeholder-server-key",
  );
  assert(!String(capturedInit?.body).includes("placeholder-server-key"));
});

Deno.test("sendOpenAiAdsLeadCreated contains provider and network failures", async () => {
  const providerFailure = await sendOpenAiAdsLeadCreated(
    {
      ...leadInput(),
      pixelId: "NaEYyiZGt6Hh6zVoNP5RqM",
      apiKey: "placeholder-server-key",
    },
    {
      fetchImpl:
        (async () => new Response("{}", { status: 400 })) as typeof fetch,
    },
  );
  assertEquals(providerFailure, {
    ok: false,
    reason: "provider_error",
    providerStatus: 400,
  });

  const networkFailure = await sendOpenAiAdsLeadCreated(
    {
      ...leadInput(),
      pixelId: "NaEYyiZGt6Hh6zVoNP5RqM",
      apiKey: "placeholder-server-key",
    },
    {
      fetchImpl: (async () => {
        throw new Error("offline");
      }) as typeof fetch,
    },
  );
  assertEquals(networkFailure, { ok: false, reason: "network_error" });
});

Deno.test("sendOpenAiAdsLeadCreated bounds a hanging request with timeout", async () => {
  const hangingFetch =
    ((_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      })) as typeof fetch;

  const result = await sendOpenAiAdsLeadCreated(
    {
      ...leadInput(),
      pixelId: "NaEYyiZGt6Hh6zVoNP5RqM",
      apiKey: "placeholder-server-key",
    },
    { fetchImpl: hangingFetch, timeoutMs: 1 },
  );

  assertEquals(result, { ok: false, reason: "network_error" });
});

Deno.test("scheduleOpenAiAdsConversion registers a non-blocking background task", async () => {
  const runtimeGlobal = globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil(promise: Promise<unknown>): void };
  };
  const previous = runtimeGlobal.EdgeRuntime;
  let scheduled: Promise<unknown> | null = null;
  runtimeGlobal.EdgeRuntime = {
    waitUntil(promise) {
      scheduled = promise;
    },
  };

  try {
    scheduleOpenAiAdsConversion(
      EVENT_ID,
      Promise.resolve({ ok: true, providerStatus: 200 }),
    );
    assert(scheduled);
    await scheduled;
  } finally {
    runtimeGlobal.EdgeRuntime = previous;
  }
});
