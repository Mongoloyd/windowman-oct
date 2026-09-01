/**
 * Local-only persistAdapter ↔ PostgREST proof.
 *
 * Skips unless SUPABASE_URL (or API_URL) is http://127.0.0.1 and a local
 * service-role credential is present in the process environment.
 *
 * Do not print, commit, or copy that credential. Do not run this against
 * a remote host.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createAtomicPersistSuccessAdapter } from "./persistAdapter.ts";
import type { NormalizedObservation, PersistSuccessInput } from "./types.ts";

function envValue(...keys: string[]): string {
  for (const key of keys) {
    try {
      const value = Deno.env.get(key);
      if (typeof value === "string" && value.length > 0) return value;
    } catch {
      // Missing --allow-env for this key: skip local integration.
    }
  }
  return "";
}

function isLocalApiUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === "127.0.0.1" &&
      (parsed.protocol === "http:" || parsed.protocol === "https:");
  } catch {
    return false;
  }
}

const LOCAL_URL = envValue("SUPABASE_URL", "API_URL");
const LOCAL_SERVICE_ROLE = envValue(
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
);
const LOCAL_ANON = envValue("SUPABASE_ANON_KEY", "ANON_KEY");
const RUN_LOCAL = isLocalApiUrl(LOCAL_URL) && LOCAL_SERVICE_ROLE.length > 0;

function randomSha(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

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

function localObservationSet(): NormalizedObservation[] {
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
      observation_status: "unknown",
      value_canonical_text: null,
      value_text: null,
    }),
  ];
}

function persistInput(sha: string): PersistSuccessInput {
  return {
    identity: {
      contentSha256: sha,
      moduleKey: "qi_local_persist_adapter",
      schemaVersion: "v1",
      promptVersion: "p1",
    },
    provider: "gemini",
    runtimeModelId: "gemini-3.1-flash-lite",
    validatedPayload: { document_type: "contractor_quote" },
    normalizedPayload: { contract_total_cents: 0 },
    fieldConfidence: { document_type: 0.9 },
    providerCompletionMetadata: {},
    usageMetadata: {},
    observations: localObservationSet(),
  };
}

function createLocalAdapter() {
  const supabase = createClient(LOCAL_URL, LOCAL_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    supabase,
    persistSuccess: createAtomicPersistSuccessAdapter({
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn, args as never);
        return {
          data,
          error: error ? { message: error.message } : null,
        };
      },
    }),
  };
}

Deno.test({
  name: "local persist adapter creates extraction with explicit 0 and false",
  ignore: !RUN_LOCAL,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { persistSuccess, supabase } = createLocalAdapter();
    const sha = randomSha();
    const created = await persistSuccess(persistInput(sha));
    assertEquals(created.ok, true);
    if (!created.ok) return;
    assertEquals(created.reusedExisting, false);
    assert(created.extractionId.length > 0);

    const { data, error } = await supabase
      .from("wm_quote_intelligence_field_observations")
      .select("field_key, value_cents, value_boolean")
      .eq("extraction_id", created.extractionId);
    assertEquals(error, null);
    const rows = (data ?? []) as Array<{
      field_key: string;
      value_cents: number | null;
      value_boolean: boolean | null;
    }>;
    assertEquals(rows.length, 8);
    const cents = rows.find((r) => r.field_key === "contract_total_cents");
    const flag = rows.find((r) => r.field_key === "is_window_door_related");
    assertEquals(cents?.value_cents, 0);
    assertEquals(flag?.value_boolean, false);
  },
});

Deno.test({
  name: "local persist adapter reuses winner when created=false",
  ignore: !RUN_LOCAL,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { persistSuccess, supabase } = createLocalAdapter();
    const sha = randomSha();
    const first = await persistSuccess(persistInput(sha));
    assertEquals(first.ok, true);
    if (!first.ok) return;
    const second = await persistSuccess({
      ...persistInput(sha),
      runtimeModelId: "loser-model",
      validatedPayload: { loser: true },
    });
    assertEquals(second.ok, true);
    if (!second.ok) return;
    assertEquals(second.reusedExisting, true);
    assertEquals(second.extractionId, first.extractionId);

    const { count, error } = await supabase
      .from("wm_quote_intelligence_field_observations")
      .select("id", { count: "exact", head: true })
      .eq("extraction_id", first.extractionId);
    assertEquals(error, null);
    assertEquals(count, 8);

    const { data: extraction, error: extErr } = await supabase
      .from("wm_quote_intelligence_extractions")
      .select("runtime_model_id, validated_payload")
      .eq("id", first.extractionId)
      .maybeSingle();
    assertEquals(extErr, null);
    assertEquals(
      (extraction as { runtime_model_id?: string } | null)?.runtime_model_id,
      "gemini-3.1-flash-lite",
    );
  },
});

Deno.test({
  name: "local persist adapter invalid observation leaves no orphan extraction",
  ignore: !RUN_LOCAL,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const { persistSuccess, supabase } = createLocalAdapter();
    const sha = randomSha();
    const invalid = persistInput(sha);
    invalid.observations = invalid.observations.map((obs) =>
      obs.field_key === "contract_total_cents"
        ? {
          ...obs,
          observation_status: "present" as const,
          value_cents: null,
        }
        : obs
    );
    const result = await persistSuccess(invalid);
    assertEquals(result.ok, false);
    if (result.ok) return;
    assertEquals(result.code, "PERSISTENCE_FAILURE");
    assert(!("message" in result));

    const { data, error } = await supabase
      .from("wm_quote_intelligence_extractions")
      .select("id")
      .eq("content_sha256", sha)
      .eq("module_key", "qi_local_persist_adapter")
      .maybeSingle();
    assertEquals(error, null);
    assertEquals(data, null);
  },
});

Deno.test({
  name: "local persist RPC is not executable with anon key",
  ignore: !RUN_LOCAL || LOCAL_ANON.length === 0,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const anon = createClient(LOCAL_URL, LOCAL_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc(
      "wm_persist_quote_intelligence_extraction",
      {
        p_content_sha256: randomSha(),
        p_module_key: "qi_local_persist_adapter",
        p_schema_version: "v1",
        p_prompt_version: "p1",
        p_provider: "test",
        p_runtime_model_id: "test-model",
        p_validated_payload: {},
        p_normalized_payload: {},
        p_observations: [],
      },
    );
    assert(error !== null);
  },
});
