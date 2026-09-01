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

export async function callGeminiExtraction(
  bytes: Uint8Array,
  mimeType: string,
  timeoutMs: number,
): Promise<ProviderCallResult | ProviderCallFailure> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    return { ok: false, retryable: true };
  }
  const model = Deno.env.get("QI_GEMINI_MODEL") ?? DEFAULT_RUNTIME_MODEL_ID;
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
      return { ok: false, retryable: response.status >= 500 };
    }
    const body = await response.json();
    const rawText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof rawText !== "string" || rawText.length === 0) {
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
  } catch {
    return { ok: false, retryable: true };
  } finally {
    clearTimeout(timer);
  }
}
