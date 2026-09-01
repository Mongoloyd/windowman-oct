import {
  DEFAULT_RUNTIME_MODEL_ID,
  MODULE_KEY,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from "./contract.ts";
import { QUOTE_DOCUMENT_HEADER_PROMPT } from "./prompt.ts";
import { normalizeGeminiJsonText } from "./geminiJson.ts";

export interface ProviderCallResult {
  ok: true;
  text: string;
  modelId: string;
  metadata: Record<string, unknown>;
}

export interface ProviderCallFailure {
  ok: false;
  retryable: boolean;
}

export type QiGeminiFailureClass =
  | "missing_api_key"
  | "http_error"
  | "empty_candidate"
  | "timeout"
  | "fetch_exception";

export function resolveRuntimeModelId(): string {
  const override = Deno.env.get("QI_GEMINI_MODEL");
  if (typeof override === "string") {
    const trimmed = override.trim();
    if (trimmed.length > 0) return trimmed;
  }
  return DEFAULT_RUNTIME_MODEL_ID;
}

function logQiGeminiProviderFailure(fields: {
  model_id: string;
  failure_class: QiGeminiFailureClass;
  retryable: boolean;
  http_status?: number;
}): void {
  const payload: Record<string, unknown> = {
    event: "qi_gemini_provider_failure",
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

function buildGeminiUrl(model: string, apiKey: string): string {
  const encoded = encodeURIComponent(model);
  return `https://generativelanguage.googleapis.com/v1beta/models/${encoded}:generateContent?key=${apiKey}`;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isGeminiTimeout(err: unknown): boolean {
  return (err instanceof DOMException && err.name === "AbortError") ||
    String(err).includes("gemini_timeout");
}

export async function callGeminiExtraction(
  bytes: Uint8Array,
  mimeType: string,
  timeoutMs: number,
): Promise<ProviderCallResult | ProviderCallFailure> {
  const model = resolveRuntimeModelId();
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    logQiGeminiProviderFailure({
      model_id: model,
      failure_class: "missing_api_key",
      retryable: true,
    });
    return { ok: false, retryable: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("gemini_timeout"), timeoutMs);
  try {
    const response = await fetch(buildGeminiUrl(model, apiKey), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: QUOTE_DOCUMENT_HEADER_PROMPT },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: toBase64(bytes),
                },
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 2048,
        },
      }),
    });
    if (!response.ok) {
      await response.text().catch(() => "");
      const retryable = response.status >= 500;
      logQiGeminiProviderFailure({
        model_id: model,
        failure_class: "http_error",
        http_status: response.status,
        retryable,
      });
      return { ok: false, retryable };
    }
    const body = await response.json();
    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== "string" || rawText.length === 0) {
      logQiGeminiProviderFailure({
        model_id: model,
        failure_class: "empty_candidate",
        retryable: true,
      });
      return { ok: false, retryable: true };
    }
    return {
      ok: true,
      text: normalizeGeminiJsonText(rawText).normalizedText,
      modelId: model,
      metadata: {
        module_key: MODULE_KEY,
        schema_version: SCHEMA_VERSION,
        prompt_version: PROMPT_VERSION,
      },
    };
  } catch (err) {
    const failureClass: QiGeminiFailureClass = isGeminiTimeout(err)
      ? "timeout"
      : "fetch_exception";
    logQiGeminiProviderFailure({
      model_id: model,
      failure_class: failureClass,
      retryable: true,
    });
    return { ok: false, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
