import {
  assert,
  assertEquals,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildFullSummaryFactPackV1 } from "./buildFullSummaryFactPackV1.ts";
import { hashFactPack } from "./hashFactPack.ts";
import { parseAndValidateProviderSummary } from "./parseProviderSummaryResponse.ts";
import {
  buildFixtureMixedSource,
  buildFixtureSparseSource,
} from "./reportSummary.fixtures.ts";
import {
  callReportSummaryProvider,
  type ReportSummaryProviderFailureClass,
} from "./reportSummaryProvider.ts";
import {
  DEFAULT_REPORT_SUMMARY_MODEL_ID,
  resolveReportSummaryModelId,
} from "./summaryProviderConfig.ts";
import {
  buildSummaryPromptP1UserMessage,
  SUMMARY_PROMPT_P1_SYSTEM,
} from "./summaryPromptP1.ts";
import { REPORT_SUMMARY_VERSION, SUMMARY_PROMPT_VERSION } from "./types.ts";

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
      row?.event === "report_summary_provider_failure"
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

async function buildValidSummaryPayload(
  factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource()),
) {
  const inputPackHash = await hashFactPack(factPack);
  const evidenceKeys = [
    ...factPack.top_findings.map((item) => item.evidence_key),
    ...factPack.positive_findings.map((item) => item.evidence_key),
  ].slice(0, 3);

  return {
    summary_version: REPORT_SUMMARY_VERSION,
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body:
      "This quote includes subject-to-remeasure language that deserves clarification before signing, and several openings are missing DP ratings. The estimate does document warranty terms, which is a helpful starting point. Before you sign, ask for written DP ratings for every proposed product.",
    evidence_keys: evidenceKeys,
    action_step: factPack.action_questions[0] ?? null,
    highlights: [
      {
        kind: "concern",
        text: "Remeasure language may allow post-signing price changes.",
        evidence_keys: [
          factPack.top_findings[0]?.evidence_key ?? evidenceKeys[0],
        ],
      },
    ],
    status: "ready",
    input_pack_hash: inputPackHash,
  };
}

function geminiResponse(text: string): Response {
  return new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

Deno.test("resolveReportSummaryModelId defaults independently from scanner/QI", () => {
  withEnv("REPORT_SUMMARY_GEMINI_MODEL", undefined, () => {
    withEnv("QI_GEMINI_MODEL", "qi-only-model", () => {
      withEnv("GEMINI_SCAN_MODEL", "scanner-only-model", () => {
        assertEquals(
          resolveReportSummaryModelId(),
          DEFAULT_REPORT_SUMMARY_MODEL_ID,
        );
      });
    });
  });
});

Deno.test("REPORT_SUMMARY_GEMINI_MODEL override wins over default", () => {
  withEnv("REPORT_SUMMARY_GEMINI_MODEL", "gemini-summary-override", () => {
    assertEquals(resolveReportSummaryModelId(), "gemini-summary-override");
  });
});

Deno.test("successful valid provider response", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  const inputPackHash = await hashFactPack(factPack);

  await withEnv("GEMINI_API_KEY", "test-gemini-key", async () => {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      assert(url.includes(DEFAULT_REPORT_SUMMARY_MODEL_ID));
      const body = JSON.parse(String(init?.body));
      assertEquals(body.generationConfig.responseMimeType, "application/json");
      assertEquals(body.contents[0].parts[0].text, SUMMARY_PROMPT_P1_SYSTEM);
      const userText = body.contents[0].parts[1].text as string;
      assert(userText.includes("input_pack_hash:"));
      assert(userText.includes(inputPackHash));
      assert(userText.includes("full_summary_fact_pack_v1"));
      assertFalse(userText.includes("test-gemini-key"));
      return Promise.resolve(geminiResponse(JSON.stringify(payload)));
    }) as FetchImpl;

    const result = await callReportSummaryProvider(factPack, {
      apiKey: "test-gemini-key",
    });
    restoreFetch();
    assertEquals(result.ok, true);
    if (result.ok) {
      assertEquals(result.summary.input_pack_hash, inputPackHash);
      assertEquals(result.modelId, DEFAULT_REPORT_SUMMARY_MODEL_ID);
    }
    assertEquals(parseFailureLogs().length, 0);
  });
  restoreLogs();
});

Deno.test("summary-specific model override is used in request URL", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);

  globalThis.fetch = ((input: RequestInfo | URL) => {
    assert(String(input).includes("gemini-summary-override"));
    return Promise.resolve(geminiResponse(JSON.stringify(payload)));
  }) as FetchImpl;

  await withEnv(
    "REPORT_SUMMARY_GEMINI_MODEL",
    "gemini-summary-override",
    async () => {
      const result = await callReportSummaryProvider(factPack, {
        apiKey: "test-gemini-key",
        modelId: "gemini-summary-override",
      });
      assertEquals(result.ok, true);
      if (result.ok) assertEquals(result.modelId, "gemini-summary-override");
    },
  );
  restoreFetch();
  restoreLogs();
});

Deno.test("missing API key logs missing_api_key without secrets", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const result = await callReportSummaryProvider(factPack, { apiKey: null });
  assertEquals(result, {
    ok: false,
    failureClass: "missing_api_key",
    retryable: true,
  });
  const failure = parseFailureLogs();
  assertEquals(failure.length, 1);
  assertEquals(failure[0].failure_class, "missing_api_key");
  assertFalse(
    logs.some((line) => line.includes("GEMINI") && line.includes("secret")),
  );
  restoreLogs();
});

Deno.test("HTTP 4xx logs http_error with status only", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response("RAW_PROVIDER_SECRET_BODY_SHOULD_NOT_LOG", { status: 404 }),
    )) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertEquals(result, {
    ok: false,
    failureClass: "http_error",
    retryable: false,
  });
  const failure = parseFailureLogs();
  assertEquals(failure[0].http_status, 404);
  assertFalse(logs.some((line) => line.includes("RAW_PROVIDER_SECRET_BODY")));
  assertFalse(logs.some((line) => line.includes("test-gemini-key")));
  restoreLogs();
});

Deno.test("HTTP 5xx logs http_error retryable true", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch =
    (() =>
      Promise.resolve(new Response("RAW_BODY", { status: 503 }))) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertEquals(result, {
    ok: false,
    failureClass: "http_error",
    retryable: true,
  });
  restoreLogs();
});

Deno.test("timeout logs timeout class", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => {
    const signal = init?.signal;
    return new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => {
        reject(new DOMException("The operation was aborted.", "AbortError"));
      });
    });
  }) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
    timeoutMs: 20,
  });
  restoreFetch();
  assertEquals(result, { ok: false, failureClass: "timeout", retryable: true });
  restoreLogs();
});

Deno.test("fetch exception logs fetch_exception without exception text", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch =
    (() => Promise.reject(new Error("network down"))) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertEquals(result, {
    ok: false,
    failureClass: "fetch_exception",
    retryable: true,
  });
  assertFalse(logs.some((line) => line.includes("network down")));
  restoreLogs();
});

Deno.test("empty candidate logs empty_candidate", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(
        JSON.stringify({ candidates: [{ content: { parts: [{}] } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    )) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertEquals(result, {
    ok: false,
    failureClass: "empty_candidate",
    retryable: true,
  });
  restoreLogs();
});

Deno.test("malformed JSON returns invalid_json", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch =
    (() => Promise.resolve(geminiResponse("not-json"))) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertEquals(result, {
    ok: false,
    failureClass: "invalid_json",
    retryable: false,
  });
  restoreLogs();
});

Deno.test("wrong summary_version returns invalid_summary_contract", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  payload.summary_version = "wrong" as typeof payload.summary_version;
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    await hashFactPack(factPack),
  );
  assertEquals(parsed.ok, false);
  if (!parsed.ok) {
    assertEquals(parsed.failureClass, "invalid_summary_contract");
  }
});

Deno.test("wrong prompt_version returns invalid_summary_contract", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  payload.prompt_version = "wrong" as typeof payload.prompt_version;
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    await hashFactPack(factPack),
  );
  assertEquals(parsed.ok, false);
  if (!parsed.ok) {
    assertEquals(parsed.failureClass, "invalid_summary_contract");
  }
});

Deno.test("wrong input_pack_hash returns input_pack_hash_mismatch", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  payload.input_pack_hash = "a".repeat(64);
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    await hashFactPack(factPack),
  );
  assertEquals(parsed.ok, false);
  if (!parsed.ok) {
    assertEquals(parsed.failureClass, "input_pack_hash_mismatch");
  }
});

Deno.test("unknown evidence_key returns evidence_grounding_failure", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  payload.evidence_keys = ["invented_key"];
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    await hashFactPack(factPack),
  );
  assertEquals(parsed.ok, false);
  if (!parsed.ok) {
    assertEquals(parsed.failureClass, "evidence_grounding_failure");
  }
});

Deno.test("valid grounded evidence_keys accepted", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    await hashFactPack(factPack),
  );
  assertEquals(parsed.ok, true);
});

Deno.test("sparse fact pack allows insufficient_facts status", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureSparseSource());
  const inputPackHash = await hashFactPack(factPack);
  const payload = {
    summary_version: REPORT_SUMMARY_VERSION,
    prompt_version: SUMMARY_PROMPT_VERSION,
    summary_body:
      "The available review facts are limited, so this summary stays brief.",
    evidence_keys: [] as string[],
    action_step: null,
    highlights: [] as Array<Record<string, unknown>>,
    status: "insufficient_facts",
    input_pack_hash: inputPackHash,
  };
  const parsed = parseAndValidateProviderSummary(
    JSON.stringify(payload),
    factPack,
    inputPackHash,
  );
  assertEquals(parsed.ok, true);
});

Deno.test("logs do not contain fact-pack payload or API key", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const body = String(init?.body ?? "");
    assertFalse(body.includes("super-secret-gemini-key-value"));
    assert(body.includes("subject_to_remeasure_clause"));
    return Promise.resolve(new Response("fail", { status: 500 }));
  }) as FetchImpl;
  await callReportSummaryProvider(factPack, {
    apiKey: "super-secret-gemini-key-value",
  });
  restoreFetch();
  assertFalse(
    logs.some((line) => line.includes("super-secret-gemini-key-value")),
  );
  assertFalse(
    logs.some((line) => line.includes("subject_to_remeasure_clause")),
  );
  assertFalse(
    logs.some((line) => line.includes(SUMMARY_PROMPT_P1_SYSTEM.slice(0, 40))),
  );
  restoreLogs();
});

Deno.test("user message builder includes hash and fact pack only", async () => {
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const hash = await hashFactPack(factPack);
  const message = buildSummaryPromptP1UserMessage(
    JSON.stringify(factPack),
    hash,
  );
  assert(message.includes(hash));
  assert(message.includes("full_summary_fact_pack_v1"));
  assertFalse(message.includes("full_json"));
});

function assertFailureClass(
  result: { ok: boolean; failureClass?: ReportSummaryProviderFailureClass },
  expected: ReportSummaryProviderFailureClass,
): void {
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.failureClass, expected);
}

Deno.test("provider maps parse failures to failure classes", async () => {
  captureLogs();
  const factPack = buildFullSummaryFactPackV1(buildFixtureMixedSource());
  const payload = await buildValidSummaryPayload(factPack);
  payload.evidence_keys = ["invented_key"];
  globalThis.fetch =
    (() =>
      Promise.resolve(geminiResponse(JSON.stringify(payload)))) as FetchImpl;
  const result = await callReportSummaryProvider(factPack, {
    apiKey: "test-gemini-key",
  });
  restoreFetch();
  assertFailureClass(result, "evidence_grounding_failure");
  restoreLogs();
});
