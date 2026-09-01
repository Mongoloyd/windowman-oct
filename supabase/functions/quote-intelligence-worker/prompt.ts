import {
  ALLOWED_FIELD_KEYS,
  MODULE_KEY,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from "./contract.ts";

export const QUOTE_DOCUMENT_HEADER_PROMPT =
  `You extract visible document-level facts from a residential window/door contractor quote.

Module: ${MODULE_KEY}
Schema: ${SCHEMA_VERSION}
Prompt: ${PROMPT_VERSION}

Rules:
- Extract only facts printed on the document. Do not guess.
- Do not extract opening-by-opening or line-item rows.
- Do not calculate scores, grades, percentages, or market judgments.
- Do not convert money into cents. Return the visible total as printed (number or string).
- If a field is not visible, return JSON null for that key.
- Return ONLY JSON matching this schema, no markdown:

{
  "document_type": string | null,
  "is_window_door_related": boolean | null,
  "extraction_confidence": number | null,
  "contractor_raw_name": string | null,
  "contract_total": string | number | null,
  "total_openings": integer | null,
  "county_name": string | null,
  "zip_code": string | null
}

Allowed observation keys after normalization: ${ALLOWED_FIELD_KEYS.join(", ")}.
extraction_confidence must be between 0 and 1 when present.`;
