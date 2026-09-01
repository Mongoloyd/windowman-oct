import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { callGeminiExtraction, resolveRuntimeModelId } from "./provider.ts";
import { DEFAULT_RUNTIME_MODEL_ID } from "./contract.ts";
import { QUOTE_DOCUMENT_HEADER_PROMPT } from "./prompt.ts";

const FILE_BYTES = new TextEncoder().encode("quote-bytes-v1");
const MIME = "image/png";

type FetchImpl = typeof fetch;

const logs: string[] = [];
const originalFetch = globalThis.fetch;
const originalConsoleError = console.error;

function captureLogs(): void {
  logs.length = 0;
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
  };
}

function restoreLogs(): void {
  console.error = originalConsoleError;
}

function restoreFetch(): void {
  globalThis.fetch = originalFetch;
}

function parseFailureLogs(): Array<Record<string, unknown>> {
  return logs
    .map((line) => {
      try {
        return JSON.parse(line) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((row): row is Record<string, unknown> =>
      row?.event === "qi_gemini_provider_failure"
    );
}

function withEnv(
  key: string,
  value: string | undefined,
  fn: () => Promise<void> | void,
): Promise<void> | void {
  const prev = Deno.env.get(key);
  if (value === undefined) Deno.env.delete(key);
  else Deno.env.set(key, value);
  try {
    return fn();
  } finally {
    if (prev === undefined) Deno.env.delete(key);
    else Deno.env.set(key, prev);
  }
}

Deno.test("resolveRuntimeModelId defaults to gemini-3.1-flash-lite", () => {
  withEnv("QI_GEMINI_MODEL", undefined, () => {
    assertEquals(resolveRuntimeModelId(), DEFAULT_RUNTIME_MODEL_ID);
    assertEquals(resolveRuntimeModelId(), "gemini-3.1-flash-lite");
  });
});

Deno.test("QI_GEMINI_MODEL override wins over default", () => {
  withEnv("QI_GEMINI_MODEL", "gemini-override-model", () => {
    assertEquals(resolveRuntimeModelId(), "gemini-override-model");
  });
});

Deno.test("success path unchanged and emits no provider failure log", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    await withEnv("QI_GEMINI_MODEL", undefined, async () => {
      globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        assert(url.includes("gemini-3.1-flash-lite"));
        assertEquals(init?.method, "POST");
        const body = JSON.parse(String(init?.body));
        assertEquals(
          body.contents[0].parts[0].text,
          QUOTE_DOCUMENT_HEADER_PROMPT,
        );
        return Promise.resolve(
          new Response(
            JSON.stringify({
              candidates: [{
                content: {
                  parts: [{ text: '{"document_type":"Estimate"}' }],
                },
              }],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          ),
        );
      }) as FetchImpl;

      const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
      restoreFetch();
      assertEquals(result.ok, true);
      if (result.ok) {
        assertEquals(result.modelId, "gemini-3.1-flash-lite");
        assertEquals(result.text, '{"document_type":"Estimate"}');
      }
      assertEquals(parseFailureLogs().length, 0);
    });
  });
  restoreLogs();
});

Deno.test("missing API key logs missing_api_key without secrets", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", undefined, async () => {
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    assertEquals(result, { ok: false, retryable: true });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "missing_api_key");
    assertEquals(failure[0].model_id, DEFAULT_RUNTIME_MODEL_ID);
    assertEquals(failure[0].retryable, true);
    assertFalse(
      logs.some((line) => line.includes("GEMINI") && line.includes("key")),
    );
  });
  restoreLogs();
});

Deno.test("HTTP 4xx logs http_error with status only and retryable false", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response("RAW_PROVIDER_SECRET_BODY_SHOULD_NOT_LOG", {
          status: 404,
        }),
      )) as FetchImpl;
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    restoreFetch();
    assertEquals(result, { ok: false, retryable: false });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "http_error");
    assertEquals(failure[0].http_status, 404);
    assertEquals(failure[0].retryable, false);
    assertFalse(logs.some((line) => line.includes("RAW_PROVIDER_SECRET_BODY")));
    assertFalse(logs.some((line) => line.includes("test-gemini-key")));
  });
  restoreLogs();
});

Deno.test("HTTP 5xx logs http_error with status only and retryable true", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response("RAW_PROVIDER_SECRET_BODY_SHOULD_NOT_LOG", {
          status: 503,
        }),
      )) as FetchImpl;
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    restoreFetch();
    assertEquals(result, { ok: false, retryable: true });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "http_error");
    assertEquals(failure[0].http_status, 503);
    assertEquals(failure[0].retryable, true);
    assertFalse(logs.some((line) => line.includes("RAW_PROVIDER_SECRET_BODY")));
  });
  restoreLogs();
});

Deno.test("empty candidate logs empty_candidate", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({ candidates: [{ content: { parts: [{}] } }] }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      )) as FetchImpl;
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    restoreFetch();
    assertEquals(result, { ok: false, retryable: true });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "empty_candidate");
  });
  restoreLogs();
});

Deno.test("timeout logs timeout class", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal;
      return new Promise((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }) as FetchImpl;
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 20);
    restoreFetch();
    assertEquals(result, { ok: false, retryable: true });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "timeout");
  });
  restoreLogs();
});

Deno.test("fetch exception logs fetch_exception class", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = (() =>
      Promise.reject(new Error("network down"))) as FetchImpl;
    const result = await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    restoreFetch();
    assertEquals(result, { ok: false, retryable: true });
    const failure = parseFailureLogs();
    assertEquals(failure.length, 1);
    assertEquals(failure[0].failure_class, "fetch_exception");
    assertFalse(logs.some((line) => line.includes("network down")));
  });
  restoreLogs();
});

Deno.test("request body is never logged", async () => {
  captureLogs();
  await withEnv("GEMINI_API_KEY", "super-secret-gemini-key-value", async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const body = String(init?.body ?? "");
      assert(body.includes("quote-bytes-v1") === false);
      assert(body.includes("inline_data"));
      assertFalse(body.includes("super-secret-gemini-key-value"));
      return Promise.resolve(new Response("fail", { status: 500 }));
    }) as FetchImpl;
    await callGeminiExtraction(FILE_BYTES, MIME, 5_000);
    restoreFetch();
    assertFalse(
      logs.some((line) => line.includes("super-secret-gemini-key-value")),
    );
    assertFalse(logs.some((line) => line.includes("inline_data")));
    assertFalse(
      logs.some((line) =>
        line.includes(QUOTE_DOCUMENT_HEADER_PROMPT.slice(0, 40))
      ),
    );
  });
  restoreLogs();
});
