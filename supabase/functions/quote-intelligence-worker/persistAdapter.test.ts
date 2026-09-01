import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MODULE_KEY, PROMPT_VERSION, SCHEMA_VERSION } from "./contract.ts";
import {
  buildPersistRpcPayload,
  createAtomicPersistSuccessAdapter,
  mapPersistRpcRow,
  PERSIST_RPC_NAME,
  type PersistRpcClient,
  serializeObservationForRpc,
} from "./persistAdapter.ts";
import type { NormalizedObservation, PersistSuccessInput } from "./types.ts";

const IDENTITY = {
  contentSha256: "a".repeat(64),
  moduleKey: MODULE_KEY,
  schemaVersion: SCHEMA_VERSION,
  promptVersion: PROMPT_VERSION,
};

function sampleObservation(
  overrides: Partial<NormalizedObservation> = {},
): NormalizedObservation {
  return {
    field_key: "document_type",
    observation_status: "present",
    provenance: "QUOTED",
    value_boolean: null,
    value_integer: null,
    value_cents: null,
    value_numeric: null,
    value_text: null,
    value_canonical_text: "contractor_quote",
    ...overrides,
  };
}

function fullObservationSet(): NormalizedObservation[] {
  return [
    sampleObservation(),
    sampleObservation({
      field_key: "is_window_door_related",
      value_canonical_text: null,
      value_boolean: false,
    }),
    sampleObservation({
      field_key: "extraction_confidence",
      value_canonical_text: null,
      value_numeric: 0.91,
    }),
    sampleObservation({
      field_key: "contractor_raw_name",
      value_canonical_text: null,
      value_text: "Acme Windows",
    }),
    sampleObservation({
      field_key: "contract_total_cents",
      value_canonical_text: null,
      value_cents: 0,
    }),
    sampleObservation({
      field_key: "total_openings",
      value_canonical_text: null,
      value_integer: 8,
    }),
    sampleObservation({
      field_key: "county_name",
      observation_status: "unknown",
      value_canonical_text: null,
    }),
    sampleObservation({
      field_key: "zip_code",
      value_canonical_text: null,
      value_text: null,
      observation_status: "unknown",
    }),
  ];
}

function samplePersistInput(
  overrides: Partial<PersistSuccessInput> = {},
): PersistSuccessInput {
  return {
    identity: IDENTITY,
    provider: "gemini",
    runtimeModelId: "gemini-2.0-flash",
    validatedPayload: { document_type: "contractor_quote" },
    normalizedPayload: { contract_total_cents: 0 },
    fieldConfidence: { document_type: 0.9 },
    providerCompletionMetadata: { finishReason: "STOP" },
    usageMetadata: {},
    observations: fullObservationSet(),
    ...overrides,
  };
}

Deno.test("serializeObservationForRpc preserves explicit false and zero", () => {
  const serialized = serializeObservationForRpc(
    sampleObservation({
      field_key: "is_window_door_related",
      value_canonical_text: null,
      value_boolean: false,
    }),
  );
  assertEquals(serialized.value_boolean, false);

  const cents = serializeObservationForRpc(
    sampleObservation({
      field_key: "contract_total_cents",
      value_canonical_text: null,
      value_cents: 0,
    }),
  );
  assertEquals(cents.value_cents, 0);
});

Deno.test("serializeObservationForRpc preserves null typed columns", () => {
  const serialized = serializeObservationForRpc(
    sampleObservation({
      field_key: "county_name",
      observation_status: "unknown",
      value_canonical_text: null,
    }),
  );
  assertEquals(serialized.value_boolean, null);
  assertEquals(serialized.value_integer, null);
  assertEquals(serialized.value_cents, null);
  assertEquals(serialized.value_numeric, null);
  assertEquals(serialized.value_text, null);
  assertEquals(serialized.value_canonical_text, null);
});

Deno.test("buildPersistRpcPayload maps extraction metadata and observations", () => {
  const input = samplePersistInput();
  const payload = buildPersistRpcPayload(input);

  assertEquals(payload.p_content_sha256, IDENTITY.contentSha256);
  assertEquals(payload.p_module_key, IDENTITY.moduleKey);
  assertEquals(payload.p_schema_version, IDENTITY.schemaVersion);
  assertEquals(payload.p_prompt_version, IDENTITY.promptVersion);
  assertEquals(payload.p_provider, "gemini");
  assertEquals(payload.p_runtime_model_id, "gemini-2.0-flash");
  assertEquals(payload.p_validated_payload, input.validatedPayload);
  assertEquals(payload.p_normalized_payload, input.normalizedPayload);
  assertEquals(payload.p_field_confidence, input.fieldConfidence);
  assertEquals(
    payload.p_provider_completion_metadata,
    input.providerCompletionMetadata,
  );
  assertEquals(payload.p_usage_metadata, input.usageMetadata);

  const observations = payload.p_observations as Record<string, unknown>[];
  assertEquals(observations.length, 8);
  assert(observations.every((obs) => obs.provenance === "QUOTED"));
});

Deno.test("mapPersistRpcRow maps created=true to new extraction", () => {
  const mapped = mapPersistRpcRow({
    extraction_id: "ext-new",
    created: true,
  });
  assertEquals(mapped, {
    ok: true,
    extractionId: "ext-new",
    reusedExisting: false,
  });
});

Deno.test("mapPersistRpcRow maps created=false to winner reuse", () => {
  const mapped = mapPersistRpcRow({
    extraction_id: "ext-winner",
    created: false,
  });
  assertEquals(mapped, {
    ok: true,
    extractionId: "ext-winner",
    reusedExisting: true,
  });
});

Deno.test("mapPersistRpcRow classifies missing row as persistence failure", () => {
  assertEquals(mapPersistRpcRow(null), {
    ok: false,
    code: "PERSISTENCE_FAILURE",
  });
});

Deno.test("atomic persist adapter calls the exact RPC with payload", async () => {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const input = samplePersistInput();
  const adapter = createAtomicPersistSuccessAdapter(
    {
      rpc: (name, args) => {
        rpcCalls.push({ name, args: args as Record<string, unknown> });
        return Promise.resolve({
          data: [{ extraction_id: "ext-new", created: true }],
          error: null,
        });
      },
    } satisfies PersistRpcClient,
  );

  const result = await adapter(input);

  assertEquals(rpcCalls.length, 1);
  assertEquals(rpcCalls[0]?.name, PERSIST_RPC_NAME);
  assertEquals(rpcCalls[0]?.args, buildPersistRpcPayload(input));
  assertEquals(result, {
    ok: true,
    extractionId: "ext-new",
    reusedExisting: false,
  });
});

Deno.test("atomic persist adapter does not fall back to table writes on RPC error", async () => {
  let rpcCalls = 0;
  const adapter = createAtomicPersistSuccessAdapter(
    {
      rpc: () => {
        rpcCalls += 1;
        return Promise.resolve({
          data: null,
          error: { message: "relation does not exist" },
        });
      },
    } satisfies PersistRpcClient,
  );

  const result = await adapter(samplePersistInput());

  assertEquals(result, { ok: false, code: "PERSISTENCE_FAILURE" });
  assertEquals(rpcCalls, 1);
});

Deno.test("atomic persist adapter never exposes raw RPC errors", async () => {
  const adapter = createAtomicPersistSuccessAdapter({
    rpc: () =>
      Promise.resolve({
        data: null,
        error: { message: "duplicate key value violates unique constraint" },
      }),
  });

  const result = await adapter(samplePersistInput());

  assertEquals(result.ok, false);
  if (!result.ok) {
    assertEquals(result.code, "PERSISTENCE_FAILURE");
    assert(!("message" in result));
  }
});
