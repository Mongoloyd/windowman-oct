import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  lookupTwilioBasicPhone,
  type TwilioLookupFetch,
} from "./twilioLookup.ts";

const PHONE = "+15615550123";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    calling_country_code: "1",
    country_code: "US",
    phone_number: PHONE,
    valid: true,
    validation_errors: null,
    ...overrides,
  };
}

function lookup(
  fetchImpl: TwilioLookupFetch,
  overrides: Partial<Parameters<typeof lookupTwilioBasicPhone>[0]> = {},
) {
  return lookupTwilioBasicPhone({
    phoneE164: PHONE,
    enabled: true,
    accountSid: "AC_test",
    authToken: "secret_test",
    fetchImpl,
    ...overrides,
  });
}

Deno.test("Basic Lookup accepts an exact canonical US response without paid Fields", async () => {
  let requestedUrl = "";
  let authorization = "";
  const result = await lookup((input, init) => {
    requestedUrl = String(input);
    authorization = new Headers(init?.headers).get("authorization") ?? "";
    return Promise.resolve(Response.json(validBody()));
  });

  assertEquals(result, { kind: "valid", canonicalPhoneE164: PHONE });
  assertStringIncludes(
    requestedUrl,
    "https://lookups.twilio.com/v2/PhoneNumbers/%2B15615550123",
  );
  assert(!requestedUrl.includes("?"));
  assert(!requestedUrl.toLowerCase().includes("fields"));
  assertStringIncludes(authorization, "Basic ");
  assert(!authorization.includes("secret_test"));
});

Deno.test("Basic Lookup maps valid false and only keeps bounded safe validation codes", async () => {
  const result = await lookup(() =>
    Promise.resolve(
      Response.json(
        validBody({
          valid: false,
          validation_errors: [
            "TOO_LONG",
            "contains a raw phone +15615550123",
            ...Array.from({ length: 10 }, (_, index) => `SAFE_${index}`),
          ],
        }),
      ),
    )
  );

  assertEquals(result.kind, "invalid");
  if (result.kind === "invalid") {
    assertEquals(result.validationErrors.length, 8);
    assertEquals(result.validationErrors[0], "TOO_LONG");
    assert(!result.validationErrors.join("|").includes("5615550123"));
  }
});

Deno.test("Basic Lookup treats contradictory or incomplete valid responses as unavailable", async () => {
  for (
    const body of [
      validBody({ phone_number: "+19545550123" }),
      validBody({ country_code: "CA" }),
      validBody({ calling_country_code: null }),
      validBody({ valid: "true" }),
      null,
    ]
  ) {
    const result = await lookup(() => Promise.resolve(Response.json(body)));
    assertEquals(result, { kind: "unavailable", reason: "malformed" });
  }
});

Deno.test("Basic Lookup fails closed for disabled or missing configuration", async () => {
  const unusedFetch = (() => {
    throw new Error("fetch must not run");
  }) as TwilioLookupFetch;

  assertEquals(
    await lookup(unusedFetch, { enabled: false }),
    { kind: "unavailable", reason: "disabled" },
  );
  assertEquals(
    await lookup(unusedFetch, { accountSid: null }),
    { kind: "unavailable", reason: "misconfigured" },
  );
  assertEquals(
    await lookup(unusedFetch, { authToken: "" }),
    { kind: "unavailable", reason: "misconfigured" },
  );
});

Deno.test("Basic Lookup treats non-2xx and malformed JSON as unavailable", async () => {
  assertEquals(
    await lookup(() => Promise.resolve(new Response("no", { status: 429 }))),
    { kind: "unavailable", reason: "upstream" },
  );
  assertEquals(
    await lookup(() =>
      Promise.resolve(
        new Response("not-json", {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
    ),
    { kind: "unavailable", reason: "malformed" },
  );
});

Deno.test("Basic Lookup aborts a stalled upstream request", async () => {
  const stalledFetch =
    ((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      })) as TwilioLookupFetch;

  assertEquals(
    await lookup(stalledFetch, { timeoutMs: 1 }),
    { kind: "unavailable", reason: "timeout" },
  );
});

Deno.test("Basic Lookup rejects a non-US E.164 input without calling Twilio", async () => {
  let called = false;
  const result = await lookup(
    (() => {
      called = true;
      return Promise.resolve(Response.json(validBody()));
    }) as TwilioLookupFetch,
    { phoneE164: "+445615550123" },
  );

  assertEquals(result, {
    kind: "invalid",
    validationErrors: ["INVALID_FORMAT"],
  });
  assertEquals(called, false);
});
