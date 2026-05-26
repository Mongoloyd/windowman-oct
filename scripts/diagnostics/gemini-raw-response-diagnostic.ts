/**
 * Local-only Gemini raw-response diagnostic harness.
 *
 * Mirrors scan-quote Gemini request shape without touching Supabase or production
 * Edge Function behavior. Diagnostic output only.
 *
 * Usage:
 *   deno run --allow-read --allow-net=generativelanguage.googleapis.com \
 *     --allow-env=GEMINI_API_KEY,GEMINI_SCAN_MODEL,GEMINI_SCAN_TIMEOUT_MS \
 *     scripts/diagnostics/gemini-raw-response-diagnostic.ts --image "C:\path\to\quote.png"
 *
 * Optional: --print-raw (may expose customer/quote data)
 */

import { buildGeminiUrl, getScannerRuntimeConfig } from "../../supabase/functions/_shared/scannerConfig.ts";
import {
  extractParseErrorMeta,
  isGeminiOutputTruncated,
  normalizeGeminiJsonText,
} from "../../supabase/functions/_shared/geminiJson.ts";

// Copied from supabase/functions/scan-quote/index.ts (GEMINI_EXTRACTION_PROMPT).
// scan-quote/index.ts cannot be imported — it runs Deno.serve at load time.
const GEMINI_EXTRACTION_PROMPT_MIRROR =
  `You are a forensic document extraction engine for impact window and door quotes.

Analyze the uploaded document and extract ALL structured data into the JSON schema below.

═══════════════════════════════════════════════════════════════════════════════
EXTRACTION RULES
═══════════════════════════════════════════════════════════════════════════════

Rules:
- Set is_window_door_related to true ONLY if this is an impact window, impact door, or hurricane fenestration quote/proposal.
- Set confidence between 0.0 and 1.0 based on how readable and complete the document is.
- Extract every line item you can identify (windows, doors, panels, screens, etc.)
- For each line item, extract brand, series, DP rating, NOA number, dimensions, quantity, unit price, and total price where visible.
- Extract warranty, permit, installation, and cancellation details if present.
- If a field is not explicitly stated in the document, return the key with a literal JSON null value. Do not guess, infer, fabricate, or omit the key.
- Extract payment facts exactly as stated in the document: deposit_percent, deposit_amount, payment_schedule_text, final_payment_before_inspection, subject_to_remeasure_present, and subject_to_remeasure_text. Do not label deposits excessive. Do not call payment terms predatory. Do not determine severity.
- Detect scope gaps such as missing wall repair, debris removal, engineering, or permit fee clarity.
- Detect generic product descriptions that do not clearly identify the manufacturer/series.
- Extract the contractor address if shown.
- Do not infer compliance from branding alone. Only mark fields true when supported by visible document language.
- Extract opening-by-opening schedule details when visible, including room/location, dimensions, and product assignment.
- Extract glass package details for each opening when visible, including whether glass appears to be Low-E, Argon-filled, monolithic laminated, or insulated laminated.
- Detect blanket glass language such as "impact glass throughout" when opening-level glass detail is missing.
- Detect change-order rules, especially whether written homeowner approval is required before extra charges for hidden rot, bad bucks, or substrate conditions.
- Detect whether the quote gives the contractor unilateral price-adjustment power.
- Extract any unit pricing or allowances for hidden rot, substrate damage, or buck replacement.
- Extract installation method specifics including anchoring method, fastener/anchor spacing, waterproofing/sealant method, buck treatment, and any statement that installation follows manufacturer instructions or local code.
- Extract warranty execution details, including who performs service, leak callback timelines, callback process, and exclusions for stucco, paint, or water intrusion.
- If the quote does not say something explicitly, leave the field null. Do not infer premium glass features or approval mechanics from branding alone.

hvhz_zone:
- Set true only if the document explicitly references HVHZ, High-Velocity Hurricane Zone, Miami-Dade, Broward HVHZ, or equivalent high-velocity wind zone/code language.
- Return null if not explicitly stated. Do not infer HVHZ from project location alone.

insurance_proof_mentioned:
- Set true only if the document explicitly mentions or attaches Certificate of Insurance, COI, liability insurance, general liability insurance, workers compensation proof, or proof of insurance.
- Return null if not explicitly stated. Do not infer insurance status from contractor name, logo, or general professionalism.

licensing_proof_mentioned:
- Set true only if the document explicitly shows a Florida contractor license number, license credential, license ID, explicit licensing proof, or "licensed and insured" with license detail.
- Return null if not explicitly stated. Do not infer licensing from contractor name, logo, or general professionalism.

glass_spec_complete (per relevant line item):
- Set true only when the document explicitly includes glass makeup/type (laminated, insulated, monolithic, impact laminated, or equivalent) AND at least one specific performance/detail feature (Low-E, argon, tint, thickness, glass package, or equivalent).
- Set false when glass is mentioned but the specification is incomplete.
- Return null when no glass detail is present. Do not infer glass package completeness from product type alone.

dimensions (per line item):
- Extract dimensions exactly as printed, including units where present (examples: 36" x 60", 3 ft x 5 ft, 914mm x 1524mm, or 36 x 60 if that is exactly what the quote prints).
- Do not normalize units. Do not invent missing units. Do not convert dimensions.
- If dimensions are printed without units, preserve the raw printed dimension text. Do not null it solely because units are missing.
- Return null only if no dimensions are shown.

Return ONLY valid JSON matching this exact schema — no markdown, no explanation:
{
  "document_type": "string",
  "is_window_door_related": boolean,
  "confidence": number,
  "page_count": number | null,
  "contractor_name": "string | null",
  "opening_count": number | null,
  "total_quoted_price": number | null,
  "hvhz_zone": boolean | null,
  "cancellation_policy": "string | null",
  "subject_to_remeasure_present": "boolean | null",
  "subject_to_remeasure_text": "string | null",
  "deposit_percent": "number | null",
  "deposit_amount": "number | null",
  "final_payment_before_inspection": "boolean | null",
  "payment_schedule_text": "string | null",
  "terms_conditions_present": "boolean | null",
  "wall_repair_scope": "string | null",
  "stucco_repair_included": "boolean | null",
  "drywall_repair_included": "boolean | null",
  "paint_touchup_included": "boolean | null",
  "debris_removal_included": "boolean | null",
  "engineering_mentioned": "boolean | null",
  "engineering_fees_included": "boolean | null",
  "permit_fees_itemized": "boolean | null",
  "insurance_proof_mentioned": "boolean | null",
  "licensing_proof_mentioned": "boolean | null",
  "completion_timeline_text": "string | null",
  "lead_paint_disclosure_present": "boolean | null",
  "generic_product_description_present": "boolean | null",
  "contractor_address_text": "string | null",
  "opening_level_glass_specs_present": boolean | null,
  "blanket_glass_language_present": boolean | null,
  "mixed_glass_package_visibility": boolean | null,
  "opening_schedule_present": boolean | null,
  "opening_schedule_room_labels_present": boolean | null,
  "opening_schedule_dimensions_complete": boolean | null,
  "opening_schedule_product_assignments_present": boolean | null,
  "bulk_scope_blob_present": boolean | null,
  "change_order_policy_text": "string | null",
  "written_change_order_required": boolean | null,
  "homeowner_approval_required_for_change_orders": boolean | null,
  "unilateral_price_adjustment_allowed": boolean | null,
  "substrate_condition_clause_present": boolean | null,
  "rot_unit_pricing_present": boolean | null,
  "buck_replacement_unit_pricing_present": boolean | null,
  "substrate_allowance_text": "string | null",
  "remeasure_price_adjustment_cap_present": boolean | null,
  "anchoring_method_text": "string | null",
  "anchor_spacing_specified": boolean | null,
  "fastener_type_specified": boolean | null,
  "waterproofing_method_text": "string | null",
  "sealant_specified": boolean | null,
  "buck_treatment_method_text": "string | null",
  "manufacturer_install_compliance_stated": boolean | null,
  "code_compliance_install_statement_present": boolean | null,
  "warranty_execution_details_present": boolean | null,
  "warranty_service_provider_type": "string | null",
  "warranty_service_provider_name": "string | null",
  "leak_callback_sla_days": number | null,
  "labor_service_sla_days": number | null,
  "callback_process_text": "string | null",
  "post_install_stucco_excluded": boolean | null,
  "post_install_paint_excluded": boolean | null,
  "water_intrusion_damage_excluded": boolean | null,
  "line_items": [
    {
      "description": "string",
      "quantity": number | null,
      "unit_price": number | null,
      "total_price": number | null,
      "brand": "string | null",
      "series": "string | null",
      "dp_rating": "string | null",
      "noa_number": "string | null",
      "dimensions": "string | null",
      "opening_location": "string | null",
      "opening_tag": "string | null",
      "product_assignment_text": "string | null",
      "glass_package_text": "string | null",
      "glass_makeup_type": "string | null",
      "glass_low_e_present": boolean | null,
      "glass_argon_present": boolean | null,
      "glass_tint_text": "string | null",
      "glass_spec_complete": boolean | null
    }
  ],
  "warranty": {
    "labor_years": number | null,
    "manufacturer_years": number | null,
    "transferable": boolean | null,
    "details": "string | null"
  } | null,
  "permits": {
    "included": boolean | null,
    "responsible_party": "string | null",
    "details": "string | null"
  } | null,
  "installation": {
    "scope_detail": "string | null",
    "disposal_included": boolean | null,
    "accessories_mentioned": boolean | null
  } | null
}`;

const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_TIMEOUT_MS = 45_000;
const TEMPERATURE = 0.1;
const RAW_TEXT_PATH = "candidates[0].content.parts[0].text";

type LikelySubtype =
  | "UNESCAPED_STRING_CONTENT"
  | "OUTPUT_TRUNCATION"
  | "OUTPUT_TRUNCATION_WITH_MARKDOWN_WRAPPER"
  | "MARKDOWN_OR_PROSE_WRAPPING"
  | "MARKDOWN_WRAPPER_NORMALIZED"
  | "PROMPT_SCHEMA_AMBIGUITY"
  | "PARSER_NORMALIZATION_BUG"
  | "MODEL_FORMAT_DRIFT"
  | "BLOCKED_OR_EMPTY_RESPONSE"
  | "NORMALIZED_JSON_PARSE_OK"
  | "UNKNOWN";

interface CliArgs {
  help: boolean;
  printRaw: boolean;
  imagePath: string | null;
}

function printHelp(): void {
  console.log(`Local Gemini raw-response diagnostic harness (scan-quote mirror)

Usage:
  deno run --allow-read --allow-net=generativelanguage.googleapis.com \\
    --allow-env=GEMINI_API_KEY,GEMINI_SCAN_MODEL,GEMINI_SCAN_TIMEOUT_MS,GEMINI_SCAN_MAX_OUTPUT_TOKENS \\
    scripts/diagnostics/gemini-raw-response-diagnostic.ts --image "C:\\\\path\\\\to\\\\quote.png"

Options:
  --help        Show this help
  --image PATH  Local image file (.png, .jpg, .jpeg, .webp, .heic)
  --print-raw   Print full raw Gemini text (may expose customer/quote data)

Environment:
  GEMINI_API_KEY           Required
  GEMINI_SCAN_MODEL        Optional, default ${DEFAULT_MODEL}
  GEMINI_SCAN_TIMEOUT_MS   Optional, default ${DEFAULT_TIMEOUT_MS}
  GEMINI_SCAN_MAX_OUTPUT_TOKENS  Optional, default 8192 (via scannerConfig)

Notes:
  - Does not call Supabase or modify production scanner behavior.
  - Prompt is PROMPT_MIRROR_APPROXIMATION (copied from scan-quote/index.ts).
  - Endpoint URL uses buildGeminiUrl from scannerConfig.ts.`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { help: false, printRaw: false, imagePath: null };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--print-raw") {
      args.printRaw = true;
    } else if (arg === "--image") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("ERROR: --image requires a file path.");
        Deno.exit(1);
      }
      args.imagePath = next;
      i++;
    } else if (arg.startsWith("--image=")) {
      args.imagePath = arg.slice("--image=".length);
    } else {
      console.error(`ERROR: Unknown argument: ${arg}`);
      Deno.exit(1);
    }
  }
  return args;
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = Deno.env.get(name);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function readNonEmptyString(name: string, fallback: string): string {
  const raw = Deno.env.get(name);
  if (typeof raw !== "string") return fallback;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function mimeFromPath(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    heic: "image/heic",
  };
  return map[ext] ?? null;
}

/** Mirrors scan-quote base64 encoding (btoa over byte string). */
function encodeBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function preserveFieldNames(text: string): string[] {
  const names: string[] = [];
  const re = /"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    names.push(m[1]);
  }
  return names;
}

function redactText(text: string): string {
  const fieldNames = new Set(preserveFieldNames(text));
  let out = text;

  out = out.replace(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
    "<REDACTED_EMAIL>",
  );
  out = out.replace(
    /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}/g,
    "<REDACTED_PHONE>",
  );

  const sensitiveKeys =
    /"(name|customer|bill_to|contact|contractor_name)"\s*:\s*"([^"]*)"/gi;
  out = out.replace(sensitiveKeys, (_m, key: string) => `"${key}":"<REDACTED_NAME>"`);

  out = out.replace(
    /\b\d+\s+[A-Za-z0-9.'-]+(?:\s+(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court))\.?\b/gi,
    "<REDACTED_ADDRESS>",
  );

  out = out.replace(/"([^"]*)"/g, (full, inner: string) => {
    if (fieldNames.has(inner)) return full;
    let value = inner;
    value = value.replace(/\b[A-Za-z0-9]{8,}\b/g, "<REDACTED_ID>");
    value = value.replace(/\b\d{8,}\b/g, "<REDACTED_ID>");
    if (value !== inner) return `"${value}"`;
    return full;
  });

  out = out.replace(/\b[A-Za-z0-9]{8,}\b/g, (token) => {
    if (fieldNames.has(token)) return token;
    return "<REDACTED_ID>";
  });
  out = out.replace(/\b\d{8,}\b/g, "<REDACTED_ID>");

  return out;
}

function excerptAround(text: string, position: number, width = 160): string {
  const center = Math.max(0, Math.min(position, text.length));
  const half = Math.floor(width / 2);
  const start = Math.max(0, center - half);
  const end = Math.min(text.length, start + width);
  return redactText(text.slice(start, end));
}

function firstNRedacted(text: string, n: number): string {
  return redactText(text.slice(0, n));
}

function lastNRedacted(text: string, n: number): string {
  return redactText(text.slice(Math.max(0, text.length - n)));
}

function extractErrorPosition(message: string): number | null {
  const m = message.match(/position\s+(\d+)/i);
  if (!m) return null;
  const pos = Number.parseInt(m[1], 10);
  return Number.isFinite(pos) ? pos : null;
}

function classifyCharAtError(text: string, position: number | null): string {
  if (position === null || position < 0 || position >= text.length) {
    return "unknown";
  }
  const ch = text[position];
  if (ch === '"' || ch === "'") return "quote";
  if (ch === "\n" || ch === "\r") return "newline";
  if (ch === ",") return "comma";
  if (ch === "{" || ch === "}") return "brace";
  if (ch === "[" || ch === "]") return "bracket";
  if (ch === ":") return "colon";
  return "unknown";
}

function hasPseudoSchemaLanguage(text: string): boolean {
  return (
    /\bnumber\s*\|\s*null\b/i.test(text) ||
    /\bstring\s*\|\s*null\b/i.test(text) ||
    /\bboolean\s*\|\s*null\b/i.test(text) ||
    /\b"string \| null"/i.test(text)
  );
}

function looksLikeUnescapedStringContent(
  text: string,
  position: number | null,
  errorMessage: string,
): boolean {
  if (/Unterminated string/i.test(errorMessage)) return true;
  if (position === null) return false;
  const window = text.slice(
    Math.max(0, position - 40),
    Math.min(text.length, position + 40),
  );
  if (/"\s*[^",:\[\]{}]\s*"/.test(window)) return true;
  if (/\d"\s*x/i.test(window)) return true;
  if (/\n/.test(window) && /"[^"]*$/.test(text.slice(0, position + 1))) {
    return true;
  }
  return false;
}

function classifySubtype(input: {
  rawTextPresent: boolean;
  finishReason: string | null;
  parseError: string | null;
  parseOkRawTrim: boolean;
  parseOkNormalized: boolean;
  normFlags: ReturnType<typeof normalizeGeminiJsonText>["flags"];
  normalizedText: string;
}): LikelySubtype {
  const {
    rawTextPresent,
    finishReason,
    parseError,
    parseOkRawTrim,
    parseOkNormalized,
    normFlags,
    normalizedText,
  } = input;

  if (!rawTextPresent) return "BLOCKED_OR_EMPTY_RESPONSE";

  if (parseOkNormalized) {
    if (normFlags.strippedMarkdownFence && !parseOkRawTrim) {
      return "MARKDOWN_WRAPPER_NORMALIZED";
    }
    return "NORMALIZED_JSON_PARSE_OK";
  }

  const truncated = isGeminiOutputTruncated(finishReason);
  const hasMarkdown = normFlags.startsWithMarkdownFence ||
    normFlags.containsMarkdownFence;

  if (truncated && hasMarkdown) {
    return "OUTPUT_TRUNCATION_WITH_MARKDOWN_WRAPPER";
  }

  if (truncated) {
    return "OUTPUT_TRUNCATION";
  }

  if (hasPseudoSchemaLanguage(normalizedText)) {
    return "PROMPT_SCHEMA_AMBIGUITY";
  }

  if (parseError) {
    const pos = extractErrorPosition(parseError);
    if (looksLikeUnescapedStringContent(normalizedText, pos, parseError)) {
      return "UNESCAPED_STRING_CONTENT";
    }
  }

  if (hasMarkdown && !normFlags.endsWithBraceAfterNormalization) {
    return "MARKDOWN_OR_PROSE_WRAPPING";
  }

  if (!parseOkNormalized) {
    return "MODEL_FORMAT_DRIFT";
  }

  return "UNKNOWN";
}

function printSection(title: string): void {
  console.log(`\n${title}`);
}

function printKv(key: string, value: unknown): void {
  console.log(`- ${key}: ${value}`);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args);
  if (args.help) {
    printHelp();
    return;
  }

  if (!args.imagePath) {
    console.error("ERROR: --image is required. Use --help for usage.");
    Deno.exit(1);
  }

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is required.");
    Deno.exit(1);
  }

  const model = readNonEmptyString("GEMINI_SCAN_MODEL", DEFAULT_MODEL);
  const timeoutMs = readPositiveInt("GEMINI_SCAN_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxOutputTokens = getScannerRuntimeConfig().geminiMaxOutputTokens;
  const mimeType = mimeFromPath(args.imagePath);
  if (!mimeType) {
    console.error(
      `ERROR: Unsupported image extension. Supported: .png, .jpg, .jpeg, .webp, .heic`,
    );
    Deno.exit(1);
  }

  let fileBytes: Uint8Array;
  try {
    fileBytes = await Deno.readFile(args.imagePath);
  } catch (err) {
    console.error(`ERROR: Could not read image: ${String(err)}`);
    Deno.exit(1);
  }

  const base64Data = encodeBase64(fileBytes);
  const geminiUrl = buildGeminiUrl(model, apiKey);
  const payload = {
    contents: [
      {
        parts: [
          { text: GEMINI_EXTRACTION_PROMPT_MIRROR },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Data,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: TEMPERATURE,
      maxOutputTokens: maxOutputTokens,
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort("gemini_timeout"), timeoutMs);

  let response: Response;
  try {
    response = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    console.log("\nLOCAL GEMINI DIAGNOSTIC RESULT");
    printSection("Input:");
    printKv("image_path", args.imagePath);
    printKv("mime_type", mimeType);
    printKv("image_size_bytes", fileBytes.byteLength);
    printSection("Request:");
    printKv("model", model);
    printKv("timeout_ms", timeoutMs);
    printKv("runtime", "Deno");
    printSection("Parse result:");
    printKv("status", "NO_TEXT_TO_PARSE");
    printKv("error", String(err));
    printSection("Interpretation:");
    printKv("likely_subtype", "BLOCKED_OR_EMPTY_RESPONSE");
    Deno.exit(1);
  } finally {
    clearTimeout(timeoutId);
  }

  let geminiJson: Record<string, unknown>;
  try {
    geminiJson = await response.json();
  } catch (err) {
    console.error(`ERROR: Gemini response envelope was not JSON: ${String(err)}`);
    Deno.exit(1);
  }

  const candidate = (geminiJson.candidates as Array<Record<string, unknown>> | undefined)?.[0];
  const finishReason = typeof candidate?.finishReason === "string"
    ? candidate.finishReason
    : null;
  const usage = geminiJson.usageMetadata as Record<string, unknown> | undefined;
  const promptTokenCount = usage?.promptTokenCount ?? "UNAVAILABLE";
  const candidatesTokenCount = usage?.candidatesTokenCount ?? "UNAVAILABLE";
  const totalTokenCount = usage?.totalTokenCount ?? "UNAVAILABLE";

  const rawText = (candidate?.content as { parts?: Array<{ text?: string }> } | undefined)
    ?.parts?.[0]?.text;
  const rawTextPresent = typeof rawText === "string" && rawText.length > 0;

  console.log("\nLOCAL GEMINI DIAGNOSTIC RESULT");

  printSection("Input:");
  printKv("image_path", args.imagePath);
  printKv("mime_type", mimeType);
  printKv("image_size_bytes", fileBytes.byteLength);

  printSection("Request:");
  printKv("model", model);
  printKv("timeout_ms", timeoutMs);
  printKv("temperature", TEMPERATURE);
  printKv("maxOutputTokens", maxOutputTokens);
  printKv("responseMimeType_present", false);
  printKv("responseSchema_present", false);
  printKv("prompt_source", "PROMPT_MIRROR_APPROXIMATION");
  printKv("runtime", "Deno");

  printSection("Response metadata:");
  printKv("response_http_status", response.status);
  printKv("finishReason", finishReason ?? "UNAVAILABLE");
  printKv("promptTokenCount", promptTokenCount);
  printKv("candidatesTokenCount", candidatesTokenCount);
  printKv("totalTokenCount", totalTokenCount);
  printKv("raw_text_present", rawTextPresent);
  printKv("raw_text_path", RAW_TEXT_PATH);

  let parseStatus: "JSON_PARSE_OK" | "JSON_PARSE_FAILED" | "NO_TEXT_TO_PARSE" =
    "NO_TEXT_TO_PARSE";
  let parseError: string | null = null;
  let errorPosition: number | null = null;
  let excerpt = "";
  let charCategory = "unknown";
  let parseOkRawTrim = false;
  let parseOkNormalized = false;
  let normalizedParseStatus: "NORMALIZED_JSON_PARSE_OK" | "NORMALIZED_JSON_PARSE_FAILED" | "NO_TEXT_TO_PARSE" =
    "NO_TEXT_TO_PARSE";
  let normalizedParseError: string | null = null;
  let normFlags = {
    startsWithMarkdownFence: false,
    containsMarkdownFence: false,
    strippedMarkdownFence: false,
    startsWithBraceAfterNormalization: false,
    endsWithBraceAfterNormalization: false,
    rawLength: 0,
    normalizedLength: 0,
  };
  let normalizedText = "";
  let parsed: Record<string, unknown> | null = null;

  if (!rawTextPresent) {
    printKv("raw_text_length", 0);
    printKv("starts_with_brace", false);
    printKv("starts_with_markdown_fence", false);
    printKv("contains_markdown_fence", false);
    printKv("ends_with_brace", false);
    printKv("redacted_first_80", "");
    printKv("redacted_last_80", "");
    if (geminiJson.promptFeedback) {
      printKv("promptFeedback", JSON.stringify(geminiJson.promptFeedback));
    }
  } else {
    const text = rawText as string;
    const trimmed = text.trim();
    printKv("raw_text_length", text.length);
    printKv("starts_with_brace", trimmed.startsWith("{"));
    printKv("starts_with_markdown_fence", trimmed.startsWith("```"));
    printKv("contains_markdown_fence", trimmed.includes("```"));
    printKv("ends_with_brace", trimmed.endsWith("}"));
    printKv("redacted_first_80", firstNRedacted(text, 80));
    printKv("redacted_last_80", lastNRedacted(text, 80));

    try {
      JSON.parse(trimmed);
      parseOkRawTrim = true;
      parseStatus = "JSON_PARSE_OK";
    } catch (err) {
      parseOkRawTrim = false;
      parseStatus = "JSON_PARSE_FAILED";
      parseError = String(err);
      errorPosition = extractErrorPosition(parseError);
      excerpt = errorPosition !== null
        ? excerptAround(trimmed, errorPosition, 160)
        : excerptAround(trimmed, Math.floor(trimmed.length / 2), 160);
      charCategory = classifyCharAtError(trimmed, errorPosition);
    }

    const normalization = normalizeGeminiJsonText(text);
    normalizedText = normalization.normalizedText;
    normFlags = normalization.flags;

    try {
      parsed = JSON.parse(normalizedText) as Record<string, unknown>;
      parseOkNormalized = true;
      normalizedParseStatus = "NORMALIZED_JSON_PARSE_OK";
    } catch (err) {
      parseOkNormalized = false;
      normalizedParseStatus = "NORMALIZED_JSON_PARSE_FAILED";
      normalizedParseError = String(err);
      if (!parseError) {
        const meta = extractParseErrorMeta(err);
        parseError = meta.parseErrorMessage;
        errorPosition = meta.parseErrorPosition;
        excerpt = errorPosition !== null
          ? excerptAround(normalizedText, errorPosition, 160)
          : excerptAround(
            normalizedText,
            Math.floor(normalizedText.length / 2),
            160,
          );
        charCategory = classifyCharAtError(normalizedText, errorPosition);
      }
    }

    if (args.printRaw) {
      console.log(
        "\nWARNING: --print-raw may expose customer/quote data. Do not paste unredacted output into chat.",
      );
      console.log(text);
    }
  }

  printSection("Parse result:");
  printKv("status", parseStatus);
  printKv("normalized_parse_status", normalizedParseStatus);
  printKv("error", parseError ?? "");
  printKv("normalized_parse_error", normalizedParseError ?? "");
  printKv("error_position", errorPosition ?? "");
  printKv("redacted_excerpt_around_error", excerpt);
  printKv("char_at_error_category", charCategory);

  printSection("Normalization:");
  printKv("normalized_raw_text_length", normFlags.normalizedLength);
  printKv("startsWithBraceAfterNormalization", normFlags.startsWithBraceAfterNormalization);
  printKv("endsWithBraceAfterNormalization", normFlags.endsWithBraceAfterNormalization);
  printKv("strippedMarkdownFence", normFlags.strippedMarkdownFence);

  printSection("Structural fingerprint:");
  if (parsed) {
    const keys = Object.keys(parsed);
    printKv("top_level_key_count", keys.length);
    printKv("top_level_keys", keys.join(", "));
    printKv("line_items_present", "line_items" in parsed);
    printKv("line_items_is_array", Array.isArray(parsed.line_items));
    if (Array.isArray(parsed.line_items) && parsed.line_items.length > 0) {
      const first = parsed.line_items[0];
      if (first && typeof first === "object") {
        printKv(
          "first_line_item_keys",
          Object.keys(first as Record<string, unknown>).join(", "),
        );
      } else {
        printKv("first_line_item_keys", "");
      }
    } else {
      printKv("first_line_item_keys", "");
    }
  } else {
    printKv("top_level_key_count", "");
    printKv("top_level_keys", "");
    printKv("line_items_present", false);
    printKv("line_items_is_array", false);
    printKv("first_line_item_keys", "");
  }

  const likelySubtype = classifySubtype({
    rawTextPresent,
    finishReason,
    parseError,
    parseOkRawTrim,
    parseOkNormalized,
    normFlags,
    normalizedText,
  });

  printSection("Interpretation:");
  printKv("likely_subtype", likelySubtype);

  if (!response.ok) {
    Deno.exit(1);
  }
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("FATAL:", err);
    Deno.exit(1);
  });
}
