/**
 * windowman-concierge — Public acquisition concierge (Gemini, structured JSON only).
 *
 * Pre-login routing chat. Does NOT touch scan-quote, OTP, report-access,
 * scoring, analyses, or storage.
 *
 * POST { sessionId?, message, messages?, source?, contextMeta? }
 * Returns WindowManConciergeResponse (validated; never raw Gemini text).
 *
 * Required secrets: GEMINI_API_KEY
 * Optional: GEMINI_CONCIERGE_MODEL, GEMINI_MODEL (default: gemini-3.1-flash-lite)
 */

import { z } from "https://esm.sh/zod@3.23.8";
import { normalizeGeminiJsonText } from "../_shared/geminiJson.ts";
import { buildGeminiUrl } from "../_shared/scannerConfig.ts";
import {
  WINDOWMAN_ALLOWED_ACTIONS,
  WINDOWMAN_PERSONALITY_PROMPT,
  type WindowManAction,
  type WindowManConciergeResponse,
  type WindowManIntent,
} from "../_shared/windowmanPersonality.ts";

const FUNCTION_NAME = "windowman-concierge";
const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const BLOCKED_GEMINI_MODELS = [
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-flash-preview",
  "gemini-2.5-flash",
] as const;

const WINDOWMAN_ALLOWED_INTENTS = [
  "has_quote",
  "no_quote",
  "question",
  "scan_later",
  "pre_quote",
  "high_intent",
  "unknown",
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_MESSAGE_LENGTH = 1_200;
const MAX_HISTORY_TURNS = 8;
const GEMINI_TEMPERATURE = 0.4;
const GEMINI_MAX_OUTPUT_TOKENS = 1_200;
const GEMINI_TIMEOUT_MS = 8_000;
// Hard cap on raw request body size (bytes) to bound abuse / Gemini cost.
const MAX_BODY_BYTES = 8 * 1024;

// ── Zod schemas ──────────────────────────────────────────────────────────────

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
});

const ContextMetaSchema = z.object({
  source: z.string().trim().max(100).optional(),
  pagePath: z.string().trim().max(500).optional(),
  hasQuote: z.boolean().optional(),
  zip: z.string().trim().max(20).optional(),
  windowCount: z.number().int().min(0).max(500).optional(),
  quoteAmount: z.number().min(0).max(10_000_000).optional(),
  homeType: z.string().trim().max(100).optional(),
  projectType: z.string().trim().max(100).optional(),
  utmSource: z.string().trim().max(200).optional(),
  utmMedium: z.string().trim().max(200).optional(),
  utmCampaign: z.string().trim().max(200).optional(),
  clientSlug: z.string().trim().max(100).optional(),
}).strict().optional();

const RequestSchema = z.object({
  sessionId: z.string().trim().max(128).optional(),
  message: z.string().trim().min(1, "message_required").max(MAX_MESSAGE_LENGTH),
  messages: z.array(MessageSchema).max(MAX_HISTORY_TURNS).optional(),
  source: z.string().trim().max(100).optional(),
  contextMeta: ContextMetaSchema,
}).strict();

const CollectedContextSchema = z.object({
  has_quote: z.boolean().optional(),
  zip: z.string().trim().max(20).optional(),
  window_count: z.number().int().min(0).max(500).optional(),
  quote_amount: z.number().min(0).max(10_000_000).optional(),
  concern: z.string().trim().max(500).optional(),
  timeframe: z.string().trim().max(200).optional(),
}).strict().optional();

const SuggestedActionSchema = z.object({
  label: z.string().trim().min(1).max(80),
  action: z.enum(WINDOWMAN_ALLOWED_ACTIONS),
});

const GeminiOutputSchema = z.object({
  reply: z.string().trim().min(1).max(4_000),
  intent: z.enum(WINDOWMAN_ALLOWED_INTENTS),
  suggested_actions: z.array(SuggestedActionSchema).min(1).max(6),
  collected_context: CollectedContextSchema,
}).strict();

// ── Helpers ────────────────────────────────────────────────────────────────────

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveGeminiModel(): string {
  const candidate =
    Deno.env.get("GEMINI_CONCIERGE_MODEL") ??
    Deno.env.get("GEMINI_MODEL") ??
    DEFAULT_MODEL;

  const normalized = candidate.trim().toLowerCase();
  if (!normalized) return DEFAULT_MODEL;

  const isBlocked = BLOCKED_GEMINI_MODELS.some(
    (blocked) => normalized === blocked.toLowerCase(),
  );
  const looksPreview = normalized.includes("preview") ||
    normalized.includes("experimental");

  if (isBlocked || looksPreview) {
    console.warn(`[${FUNCTION_NAME}] Blocked Gemini model override`, {
      candidate: normalized.slice(0, 80),
    });
    return DEFAULT_MODEL;
  }

  return candidate.trim();
}

function buildFallbackResponse(sessionId?: string): WindowManConciergeResponse {
  return {
    reply:
      "I can help with that, but I need to keep this focused. Do you already have a window estimate you want checked?",
    intent: "unknown",
    suggested_actions: [
      { label: "Yes — check my estimate", action: "upload_now" },
      { label: "No — help me before I get quoted", action: "pre_quote_checklist" },
      { label: "Ask another question", action: "ask_another_question" },
    ],
    sessionId,
  };
}

function clampSuggestedActions(
  actions: Array<{ label: string; action: string }>,
): Array<{ label: string; action: WindowManAction }> {
  const allowed = new Set<string>(WINDOWMAN_ALLOWED_ACTIONS);
  const seen = new Set<string>();
  const clamped: Array<{ label: string; action: WindowManAction }> = [];

  for (const item of actions) {
    if (!allowed.has(item.action) || seen.has(item.action)) continue;
    seen.add(item.action);
    clamped.push({
      label: item.label.slice(0, 80),
      action: item.action as WindowManAction,
    });
    if (clamped.length >= 4) break;
  }

  if (clamped.length === 0) {
    return buildFallbackResponse().suggested_actions;
  }

  return clamped;
}

function buildGeminiUserPayload(
  message: string,
  messages: z.infer<typeof MessageSchema>[] | undefined,
  contextMeta: z.infer<typeof ContextMetaSchema>,
  source: string | undefined,
): string {
  const parts: string[] = [];

  if (source) parts.push(`Source: ${source}`);
  if (contextMeta && Object.keys(contextMeta).length > 0) {
    parts.push(`Known context: ${JSON.stringify(contextMeta)}`);
  }

  if (messages && messages.length > 0) {
    parts.push("Conversation history:");
    for (const turn of messages.slice(-MAX_HISTORY_TURNS)) {
      parts.push(`${turn.role}: ${turn.content}`);
    }
  }

  parts.push(`user: ${message}`);
  return parts.join("\n");
}

async function callGeminiConcierge(
  userPayload: string,
  apiKey: string,
  model: string,
): Promise<string | null> {
  const geminiUrl = buildGeminiUrl(model, apiKey);
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort("gemini_timeout"),
    GEMINI_TIMEOUT_MS,
  );

  try {
    const resp = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: WINDOWMAN_PERSONALITY_PROMPT },
              { text: userPayload },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: GEMINI_TEMPERATURE,
          maxOutputTokens: GEMINI_MAX_OUTPUT_TOKENS,
        },
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      const errText = await resp.text().catch(() => "");
      console.error(`[${FUNCTION_NAME}] Gemini API error`, {
        status: resp.status,
        model,
        detail: errText.slice(0, 240),
      });
      return null;
    }

    const geminiJson = await resp.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (typeof rawText !== "string" || !rawText.trim()) {
      console.error(`[${FUNCTION_NAME}] Empty Gemini response`, { model });
      return null;
    }

    return rawText;
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] Gemini request failed`, {
      model,
      error: String(err).slice(0, 240),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function parseAndValidateGeminiOutput(
  rawText: string,
  sessionId?: string,
): WindowManConciergeResponse {
  const { normalizedText } = normalizeGeminiJsonText(rawText);

  let parsed: unknown;
  try {
    parsed = JSON.parse(normalizedText);
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] JSON parse failed`, {
      error: String(err).slice(0, 120),
    });
    return buildFallbackResponse(sessionId);
  }

  const validated = GeminiOutputSchema.safeParse(parsed);
  if (!validated.success) {
    console.error(`[${FUNCTION_NAME}] Zod validation failed`, {
      issues: validated.error.issues.slice(0, 5),
    });
    return buildFallbackResponse(sessionId);
  }

  const data = validated.data;

  return {
    reply: data.reply,
    intent: data.intent as WindowManIntent,
    suggested_actions: clampSuggestedActions(data.suggested_actions),
    collected_context: data.collected_context,
    sessionId,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json(405, { error: "method_not_allowed" });
  }

  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  // TODO(rate-limit): Add IP/session rate limiting when concierge volume warrants it.
  // No shared utility exists in repo; mirror send-otp inline pattern if needed.
  // Durable rate limiting requires a storage-backed limiter and must be implemented in a separate sprint.

  // Enforce a hard request-body size cap before parsing to bound abuse and
  // Gemini cost. Content-Length is only an early hint; the post-read byte
  // count is authoritative so a missing/spoofed header cannot bypass the cap.
  const declaredLength = Number(req.headers.get("content-length") ?? "");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    console.warn(`[${FUNCTION_NAME}] payload_too_large`, {
      request_id: requestId,
      payload_size: declaredLength,
    });
    return json(413, { error: "payload_too_large" });
  }

  const rawBody = await req.text();
  const payloadSize = new TextEncoder().encode(rawBody).length;
  if (payloadSize > MAX_BODY_BYTES) {
    console.warn(`[${FUNCTION_NAME}] payload_too_large`, {
      request_id: requestId,
      payload_size: payloadSize,
    });
    return json(413, { error: "payload_too_large" });
  }

  let raw: unknown;
  try {
    raw = JSON.parse(rawBody);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const parsed = RequestSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    // Log only the safe failure code + field name + size — never raw input.
    console.warn(`[${FUNCTION_NAME}] validation_failed`, {
      request_id: requestId,
      code: first?.message ?? "invalid_request",
      field: first?.path?.[0] ?? null,
      payload_size: payloadSize,
    });
    return json(400, {
      error: first?.message ?? "invalid_request",
      field: first?.path?.[0] ?? null,
    });
  }

  const { sessionId, message, messages, source, contextMeta } = parsed.data;

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.error(`[${FUNCTION_NAME}] GEMINI_API_KEY not configured`);
    return json(503, buildFallbackResponse(sessionId));
  }

  const model = resolveGeminiModel();
  const userPayload = buildGeminiUserPayload(
    message,
    messages,
    contextMeta,
    source,
  );

  const rawGeminiText = await callGeminiConcierge(userPayload, geminiKey, model);
  if (!rawGeminiText) {
    console.warn(`[${FUNCTION_NAME}] gemini_fallback`, {
      request_id: requestId,
      model,
      duration_ms: Date.now() - startedAt,
    });
    return json(200, buildFallbackResponse(sessionId));
  }

  const response = parseAndValidateGeminiOutput(rawGeminiText, sessionId);
  console.log(`[${FUNCTION_NAME}] completed`, {
    request_id: requestId,
    model,
    duration_ms: Date.now() - startedAt,
  });
  return json(200, response);
});
