import { buildGeminiUrl } from "../scannerConfig.ts";
import { hashFactPack } from "./hashFactPack.ts";
import {
  parseAndValidateProviderSummary,
  type ReportSummaryParseFailureClass,
} from "./parseProviderSummaryResponse.ts";
import {
  DEFAULT_REPORT_SUMMARY_TEMPERATURE,
  resolveReportSummaryMaxOutputTokens,
  resolveReportSummaryModelId,
  resolveReportSummaryTimeoutMs,
} from "./summaryProviderConfig.ts";
import {
  buildSummaryPromptP1UserMessage,
  SUMMARY_PROMPT_P1_SYSTEM,
} from "./summaryPromptP1.ts";
import type { FullSummaryFactPackV1, ReportSummaryV1 } from "./types.ts";

export type ReportSummaryProviderFailureClass =
  | "missing_api_key"
  | "http_error"
  | "timeout"
  | "fetch_exception"
  | "empty_candidate"
  | ReportSummaryParseFailureClass;

export type ReportSummaryProviderSuccess = {
  ok: true;
  summary: ReportSummaryV1;
  modelId: string;
  inputPackHash: string;
};

export type ReportSummaryProviderFailure = {
  ok: false;
  failureClass: ReportSummaryProviderFailureClass;
  retryable: boolean;
};

export type ReportSummaryProviderResult =
  | ReportSummaryProviderSuccess
  | ReportSummaryProviderFailure;

export type ReportSummaryProviderOptions = {
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
  apiKey?: string | null;
  modelId?: string;
};

function logReportSummaryProviderFailure(fields: {
  model_id: string;
  failure_class: ReportSummaryProviderFailureClass;
  retryable: boolean;
  http_status?: number;
}): void {
  const payload: Record<string, unknown> = {
    event: "report_summary_provider_failure",
    ts: new Date().toISOString(),
    model_id: fields.model_id,
    failure_class: fields.failure_class,
    retryable: fields.retryable,
  };
  if (fields.http_status !== undefined) {
    payload.http_status = fields.http_status;
  }
  console.error(JSON.stringify(payload));
}

function isGeminiTimeout(err: unknown): boolean {
  return (err instanceof DOMException && err.name === "AbortError") ||
    String(err).includes("gemini_timeout");
}

function buildGeminiRequestBody(
  factPackJson: string,
  userMessage: string,
): Record<string, unknown> {
  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: SUMMARY_PROMPT_P1_SYSTEM },
          { text: userMessage },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
      temperature: DEFAULT_REPORT_SUMMARY_TEMPERATURE,
      maxOutputTokens: resolveReportSummaryMaxOutputTokens(),
    },
  };
}

/**
 * Summary-specific Gemini provider — prose over FullSummaryFactPackV1 only.
 */
export async function callReportSummaryProvider(
  factPack: FullSummaryFactPackV1,
  options: ReportSummaryProviderOptions = {},
): Promise<ReportSummaryProviderResult> {
  const modelId = options.modelId ?? resolveReportSummaryModelId();
  const timeoutMs = options.timeoutMs ?? resolveReportSummaryTimeoutMs();
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiKey = options.apiKey !== undefined
    ? options.apiKey
    : Deno.env.get("GEMINI_API_KEY");

  const inputPackHash = await hashFactPack(factPack);
  const factPackJson = JSON.stringify(factPack);
  const userMessage = buildSummaryPromptP1UserMessage(
    factPackJson,
    inputPackHash,
  );

  if (!apiKey) {
    logReportSummaryProviderFailure({
      model_id: modelId,
      failure_class: "missing_api_key",
      retryable: true,
    });
    return { ok: false, failureClass: "missing_api_key", retryable: true };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("gemini_timeout"), timeoutMs);

  try {
    const response = await fetchImpl(
      buildGeminiUrl(modelId, apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(buildGeminiRequestBody(factPackJson, userMessage)),
      },
    );

    if (!response.ok) {
      await response.text().catch(() => "");
      const retryable = response.status >= 500;
      logReportSummaryProviderFailure({
        model_id: modelId,
        failure_class: "http_error",
        http_status: response.status,
        retryable,
      });
      return {
        ok: false,
        failureClass: "http_error",
        retryable,
      };
    }

    const body = await response.json();
    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== "string" || rawText.length === 0) {
      logReportSummaryProviderFailure({
        model_id: modelId,
        failure_class: "empty_candidate",
        retryable: true,
      });
      return {
        ok: false,
        failureClass: "empty_candidate",
        retryable: true,
      };
    }

    const parsed = parseAndValidateProviderSummary(
      rawText,
      factPack,
      inputPackHash,
    );
    if (!parsed.ok) {
      logReportSummaryProviderFailure({
        model_id: modelId,
        failure_class: parsed.failureClass,
        retryable: parsed.retryable,
      });
      return {
        ok: false,
        failureClass: parsed.failureClass,
        retryable: parsed.retryable,
      };
    }

    return {
      ok: true,
      summary: parsed.summary,
      modelId,
      inputPackHash,
    };
  } catch (err) {
    const failureClass: ReportSummaryProviderFailureClass = isGeminiTimeout(err)
      ? "timeout"
      : "fetch_exception";
    logReportSummaryProviderFailure({
      model_id: modelId,
      failure_class: failureClass,
      retryable: true,
    });
    return { ok: false, failureClass, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
