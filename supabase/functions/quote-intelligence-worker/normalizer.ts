import { LOW_CONFIDENCE_THRESHOLD } from "./contract.ts";
import { parseMoneyToCents } from "./money.ts";
import type { ProviderExtraction } from "./schema.ts";
import type {
  ExtractionIdentity,
  NormalizedIntelligence,
  NormalizedObservation,
  ObservationStatus,
} from "./types.ts";

function emptyObservation(
  fieldKey: string,
  status: ObservationStatus,
): NormalizedObservation {
  return {
    field_key: fieldKey,
    observation_status: status,
    provenance: "QUOTED",
    value_boolean: null,
    value_integer: null,
    value_cents: null,
    value_numeric: null,
    value_text: null,
    value_canonical_text: null,
  };
}

function trimText(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function statusForValue(
  hasValue: boolean,
  confidence: number | null,
  invalid: boolean,
): ObservationStatus {
  if (invalid) return "invalid";
  if (!hasValue) return "unknown";
  if (
    confidence !== null &&
    Number.isFinite(confidence) &&
    confidence < LOW_CONFIDENCE_THRESHOLD
  ) {
    return "low_confidence";
  }
  return "present";
}

export function normalizeProviderExtraction(
  identity: ExtractionIdentity,
  extracted: ProviderExtraction,
): NormalizedIntelligence {
  const confidence = extracted.extraction_confidence;
  const observations: NormalizedObservation[] = [];
  const fieldConfidence: Record<string, number | null> = {};
  const normalizedPayload: Record<string, unknown> = {};

  const documentType = trimText(extracted.document_type);
  {
    const obs = emptyObservation(
      "document_type",
      statusForValue(documentType !== null, confidence, false),
    );
    if (obs.observation_status !== "unknown") {
      obs.value_canonical_text = documentType;
    }
    observations.push(obs);
    normalizedPayload.document_type = documentType;
    fieldConfidence.document_type = confidence;
  }

  {
    const hasValue = extracted.is_window_door_related !== null;
    const obs = emptyObservation(
      "is_window_door_related",
      statusForValue(hasValue, confidence, false),
    );
    if (hasValue) obs.value_boolean = extracted.is_window_door_related;
    observations.push(obs);
    normalizedPayload.is_window_door_related = extracted.is_window_door_related;
    fieldConfidence.is_window_door_related = confidence;
  }

  {
    const confInvalid = confidence !== null &&
      (!Number.isFinite(confidence) || confidence < 0 || confidence > 1);
    const obs = emptyObservation(
      "extraction_confidence",
      statusForValue(confidence !== null, confidence, confInvalid),
    );
    if (obs.observation_status !== "unknown" && !confInvalid) {
      obs.value_numeric = confidence;
    }
    observations.push(obs);
    normalizedPayload.extraction_confidence = confInvalid ? null : confidence;
    fieldConfidence.extraction_confidence = confidence;
  }

  {
    const name = trimText(extracted.contractor_raw_name);
    const obs = emptyObservation(
      "contractor_raw_name",
      statusForValue(name !== null, confidence, false),
    );
    if (name !== null) obs.value_text = name;
    observations.push(obs);
    normalizedPayload.contractor_raw_name = name;
    fieldConfidence.contractor_raw_name = confidence;
  }

  {
    const rawTotal = extracted.contract_total;
    const missing = rawTotal === null ||
      (typeof rawTotal === "string" && rawTotal.trim() === "");
    const cents = missing ? null : parseMoneyToCents(rawTotal);
    const invalid = !missing && cents === null;
    const obs = emptyObservation(
      "contract_total_cents",
      statusForValue(!missing && cents !== null, confidence, invalid),
    );
    if (!missing && cents !== null) obs.value_cents = cents;
    observations.push(obs);
    normalizedPayload.contract_total_cents = missing || invalid ? null : cents;
    fieldConfidence.contract_total_cents = confidence;
  }

  {
    const openings = extracted.total_openings;
    const invalid = openings !== null &&
      (!Number.isInteger(openings) || openings < 0);
    const obs = emptyObservation(
      "total_openings",
      statusForValue(openings !== null && !invalid, confidence, invalid),
    );
    if (openings !== null && !invalid) obs.value_integer = openings;
    observations.push(obs);
    normalizedPayload.total_openings = openings !== null && !invalid
      ? openings
      : null;
    fieldConfidence.total_openings = confidence;
  }

  {
    const county = trimText(extracted.county_name);
    const obs = emptyObservation(
      "county_name",
      statusForValue(county !== null, confidence, false),
    );
    if (county !== null) obs.value_text = county;
    observations.push(obs);
    normalizedPayload.county_name = county;
    fieldConfidence.county_name = confidence;
  }

  {
    const zip = trimText(extracted.zip_code);
    const obs = emptyObservation(
      "zip_code",
      statusForValue(zip !== null, confidence, false),
    );
    if (zip !== null) obs.value_text = zip;
    observations.push(obs);
    normalizedPayload.zip_code = zip;
    fieldConfidence.zip_code = confidence;
  }

  return {
    identity,
    validatedPayload: { ...extracted },
    normalizedPayload,
    observations,
    fieldConfidence,
  };
}
