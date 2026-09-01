import type { QuoteIntelligencePorts } from "./ports.ts";
import type {
  NormalizedObservation,
  PersistSuccessInput,
  PersistSuccessResult,
} from "./types.ts";

export const PERSIST_RPC_NAME = "wm_persist_quote_intelligence_extraction";

export interface PersistRpcClient {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function serializeObservationForRpc(
  observation: NormalizedObservation,
): Record<string, unknown> {
  return {
    field_key: observation.field_key,
    observation_status: observation.observation_status,
    provenance: observation.provenance,
    value_boolean: observation.value_boolean,
    value_integer: observation.value_integer,
    value_cents: observation.value_cents,
    value_numeric: observation.value_numeric,
    value_text: observation.value_text,
    value_canonical_text: observation.value_canonical_text,
  };
}

export function buildPersistRpcPayload(
  input: PersistSuccessInput,
): Record<string, unknown> {
  return {
    p_content_sha256: input.identity.contentSha256,
    p_module_key: input.identity.moduleKey,
    p_schema_version: input.identity.schemaVersion,
    p_prompt_version: input.identity.promptVersion,
    p_provider: input.provider,
    p_runtime_model_id: input.runtimeModelId,
    p_validated_payload: input.validatedPayload,
    p_normalized_payload: input.normalizedPayload,
    p_field_confidence: input.fieldConfidence,
    p_provider_completion_metadata: input.providerCompletionMetadata,
    p_usage_metadata: input.usageMetadata,
    p_observations: input.observations.map(serializeObservationForRpc),
  };
}

export function mapPersistRpcRow(
  row: unknown,
): PersistSuccessResult {
  if (row === null || row === undefined) {
    return { ok: false, code: "PERSISTENCE_FAILURE" };
  }
  const rec = row as Record<string, unknown>;
  const extractionId = asString(rec.extraction_id);
  if (!extractionId) {
    return { ok: false, code: "PERSISTENCE_FAILURE" };
  }
  return {
    ok: true,
    extractionId,
    reusedExisting: rec.created !== true,
  };
}

export function createAtomicPersistSuccessAdapter(
  supabase: PersistRpcClient,
): QuoteIntelligencePorts["persistSuccess"] {
  return async (input) => {
    const { data, error } = await supabase.rpc(
      PERSIST_RPC_NAME,
      buildPersistRpcPayload(input),
    );
    if (error) {
      return { ok: false, code: "PERSISTENCE_FAILURE" };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return mapPersistRpcRow(row);
  };
}
