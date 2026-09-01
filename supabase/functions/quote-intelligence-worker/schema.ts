import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";
import { ALLOWED_FIELD_KEY_SET } from "./contract.ts";

/**
 * Untrusted provider JSON. Money stays as visible document value;
 * TypeScript converts to cents. Unexpected keys fail strict parse.
 */
export const ProviderExtractionSchema = z.object({
  document_type: z.string().nullable(),
  is_window_door_related: z.boolean().nullable(),
  extraction_confidence: z.number().min(0).max(1).nullable(),
  contractor_raw_name: z.string().nullable(),
  contract_total: z.union([z.string(), z.number()]).nullable(),
  total_openings: z.number().int().nullable(),
  county_name: z.string().nullable(),
  zip_code: z.string().nullable(),
}).strict();

export type ProviderExtraction = z.infer<typeof ProviderExtractionSchema>;

export type ProviderParseResult =
  | { ok: true; value: ProviderExtraction }
  | { ok: false; reason: "malformed_json" | "invalid_contract" };

export function parseProviderJsonText(raw: string): ProviderParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed_json" };
  }
  return parseProviderPayload(parsed);
}

export function parseProviderPayload(value: unknown): ProviderParseResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, reason: "invalid_contract" };
  }
  const keys = Object.keys(value as Record<string, unknown>);
  for (const key of keys) {
    if (key === "contract_total") continue;
    if (key === "extraction_confidence" || ALLOWED_FIELD_KEY_SET.has(key)) {
      continue;
    }
    if (!ALLOWED_FIELD_KEY_SET.has(key) && key !== "contract_total") {
      return { ok: false, reason: "invalid_contract" };
    }
  }
  const result = ProviderExtractionSchema.safeParse(value);
  if (!result.success) {
    return { ok: false, reason: "invalid_contract" };
  }
  return { ok: true, value: result.data };
}
