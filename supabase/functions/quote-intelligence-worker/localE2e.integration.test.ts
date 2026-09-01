/**
 * Local-only Async Quote Intelligence lifecycle proof.
 *
 * REAL local PostgREST RPCs, REAL private Storage, REAL worker adapters
 * and orchestrator. FAKE deterministic provider. SYNTHETIC quote bytes.
 *
 * Skips unless SUPABASE_URL (or API_URL) is http://127.0.0.1 and a local
 * service-role credential is present. Refuses non-local hosts.
 *
 * Do not print, commit, or copy that credential. Do not run against remote.
 * Do not select analyses.full_json. Do not call Gemini.
 */

import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { createSupabasePorts } from "./adapters.ts";
import {
  ALLOWED_FIELD_KEYS,
  MODULE_KEY,
  PROMPT_VERSION,
  SCHEMA_VERSION,
} from "./contract.ts";
import { sha256Hex } from "./hash.ts";
import {
  DEFAULT_WORKER_CONFIG,
  runQuoteIntelligenceWorker,
} from "./orchestrator.ts";
import type { QuoteIntelligencePorts } from "./ports.ts";
import type { CasCompleteInput } from "./types.ts";

const FIXTURE_PREFIX = "qi-e2e-local";

function fixtureBytes(label: string): Uint8Array {
  return new TextEncoder().encode(
    `wm-qi-e2e-v1:${label}:${crypto.randomUUID()}`,
  );
}

const VALID_PROVIDER_JSON = JSON.stringify({
  document_type: "contractor_quote",
  is_window_door_related: false,
  extraction_confidence: 0.91,
  contractor_raw_name: "E2E Synthetic Windows",
  contract_total: "$0.00",
  total_openings: 8,
  county_name: "Miami-Dade",
  zip_code: null,
});

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
const RUN_LOCAL = isLocalApiUrl(LOCAL_URL) && LOCAL_SERVICE_ROLE.length > 0;

interface FixtureIds {
  quoteFileId: string;
  scanSessionId: string;
  analysisId: string;
  storagePath: string;
}

interface DiscoverRow {
  scanned_candidates: number | string;
  eligible_candidates: number | string;
  jobs_created: number | string;
  jobs_already_present: number | string;
  jobs_skipped: number | string;
}

function asNumber(value: number | string | null | undefined): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.length > 0) return Number(value);
  return NaN;
}

function createLocalClient(): SupabaseClient {
  return createClient(LOCAL_URL, LOCAL_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function fakeValidProvider(): QuoteIntelligencePorts["callProvider"] {
  return async () => ({
    ok: true,
    text: VALID_PROVIDER_JSON,
    modelId: "fake-e2e-v1",
    metadata: { source: "fake_e2e" },
  });
}

function fakeInvalidProvider(): QuoteIntelligencePorts["callProvider"] {
  return async () => ({
    ok: true,
    text: JSON.stringify({
      document_type: "contractor_quote",
      is_window_door_related: true,
      extraction_confidence: 0.9,
      contractor_raw_name: "x",
      contract_total: "1",
      total_openings: 1,
      county_name: "x",
      zip_code: "33139",
      grade: "A",
    }),
    modelId: "fake-e2e-invalid",
    metadata: { source: "fake_e2e" },
  });
}

function wrapPorts(
  real: QuoteIntelligencePorts,
  overrides: Partial<QuoteIntelligencePorts>,
): QuoteIntelligencePorts {
  return { ...real, ...overrides };
}

async function discoverV1(
  supabase: SupabaseClient,
): Promise<DiscoverRow> {
  const { data, error } = await supabase.rpc(
    "wm_discover_quote_intelligence_jobs",
    {
      p_limit: 1000,
      p_module_key: MODULE_KEY,
      p_schema_version: SCHEMA_VERSION,
      p_prompt_version: PROMPT_VERSION,
    },
  );
  assertEquals(error, null);
  const row = Array.isArray(data) ? data[0] : data;
  assert(row != null);
  return row as DiscoverRow;
}

async function uploadAndInsertEligibleQuote(
  supabase: SupabaseClient,
  bytes: Uint8Array,
  suffix: string,
): Promise<FixtureIds> {
  const storagePath = `${FIXTURE_PREFIX}/${crypto.randomUUID()}-${suffix}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("quotes")
    .upload(storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  assertEquals(uploadError, null);

  const { data: quoteFile, error: quoteErr } = await supabase
    .from("quote_files")
    .insert({ storage_path: storagePath })
    .select("id")
    .single();
  assertEquals(quoteErr, null);
  assert(quoteFile?.id);

  const { data: session, error: sessionErr } = await supabase
    .from("scan_sessions")
    .insert({
      quote_file_id: quoteFile.id,
      status: "preview_ready",
    })
    .select("id")
    .single();
  assertEquals(sessionErr, null);
  assert(session?.id);

  const { data: analysis, error: analysisErr } = await supabase
    .from("analyses")
    .insert({
      scan_session_id: session.id,
      analysis_status: "complete",
    })
    .select("id")
    .single();
  assertEquals(analysisErr, null);
  assert(analysis?.id);

  return {
    quoteFileId: quoteFile.id as string,
    scanSessionId: session.id as string,
    analysisId: analysis.id as string,
    storagePath,
  };
}

async function countJobsForQuote(
  supabase: SupabaseClient,
  quoteFileId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("wm_quote_intelligence_jobs")
    .select("id", { count: "exact", head: true })
    .eq("quote_file_id", quoteFileId)
    .eq("module_key", MODULE_KEY)
    .eq("schema_version", SCHEMA_VERSION)
    .eq("prompt_version", PROMPT_VERSION);
  assertEquals(error, null);
  return count ?? 0;
}

async function loadJob(
  supabase: SupabaseClient,
  quoteFileId: string,
): Promise<Record<string, unknown>> {
  const { data, error } = await supabase
    .from("wm_quote_intelligence_jobs")
    .select(
      "id, status, attempt_count, worker_id, claim_token, lease_expires_at, extraction_id, content_sha256, result_disposition, error_code, error_detail, module_key, schema_version, prompt_version, quote_file_id, scan_session_id, analysis_id",
    )
    .eq("quote_file_id", quoteFileId)
    .eq("module_key", MODULE_KEY)
    .eq("schema_version", SCHEMA_VERSION)
    .eq("prompt_version", PROMPT_VERSION)
    .maybeSingle();
  assertEquals(error, null);
  assert(data != null);
  return data as Record<string, unknown>;
}

async function countExtractions(
  supabase: SupabaseClient,
  sha: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("wm_quote_intelligence_extractions")
    .select("id", { count: "exact", head: true })
    .eq("content_sha256", sha)
    .eq("module_key", MODULE_KEY)
    .eq("schema_version", SCHEMA_VERSION)
    .eq("prompt_version", PROMPT_VERSION);
  assertEquals(error, null);
  return count ?? 0;
}

async function loadObservations(
  supabase: SupabaseClient,
  extractionId: string,
): Promise<
  Array<{
    field_key: string;
    observation_status: string;
    provenance: string;
    value_boolean: boolean | null;
    value_integer: number | null;
    value_cents: number | null;
    value_numeric: number | null;
    value_text: string | null;
    value_canonical_text: string | null;
  }>
> {
  const { data, error } = await supabase
    .from("wm_quote_intelligence_field_observations")
    .select(
      "field_key, observation_status, provenance, value_boolean, value_integer, value_cents, value_numeric, value_text, value_canonical_text",
    )
    .eq("extraction_id", extractionId);
  assertEquals(error, null);
  return (data ?? []) as Array<{
    field_key: string;
    observation_status: string;
    provenance: string;
    value_boolean: boolean | null;
    value_integer: number | null;
    value_cents: number | null;
    value_numeric: number | null;
    value_text: string | null;
    value_canonical_text: string | null;
  }>;
}

async function cleanupLeftoverE2eRows(
  supabase: SupabaseClient,
): Promise<void> {
  const { data: leftover } = await supabase
    .from("quote_files")
    .select("id, storage_path")
    .like("storage_path", `${FIXTURE_PREFIX}/%`);
  const rows = (leftover ?? []) as Array<{ id: string; storage_path: string }>;
  if (rows.length === 0) return;
  const ids = rows.map((row) => row.id);
  await supabase.from("wm_quote_intelligence_jobs").delete().in(
    "quote_file_id",
    ids,
  );
  const { data: sessions } = await supabase
    .from("scan_sessions")
    .select("id")
    .in("quote_file_id", ids);
  const sessionIds = ((sessions ?? []) as Array<{ id: string }>).map((row) =>
    row.id
  );
  if (sessionIds.length > 0) {
    await supabase.from("analyses").delete().in("scan_session_id", sessionIds);
    await supabase.from("scan_sessions").delete().in("id", sessionIds);
  }
  await supabase.from("quote_files").delete().in("id", ids);
  await supabase.storage.from("quotes").remove(
    rows.map((row) => row.storage_path),
  );
}

async function cleanupFixtures(
  supabase: SupabaseClient,
  fixtures: FixtureIds[],
): Promise<void> {
  const quoteFileIds = fixtures.map((f) => f.quoteFileId);
  const paths = fixtures.map((f) => f.storagePath);
  if (quoteFileIds.length > 0) {
    await supabase
      .from("wm_quote_intelligence_jobs")
      .delete()
      .in("quote_file_id", quoteFileIds);
    await supabase.from("analyses").delete().in(
      "scan_session_id",
      fixtures.map((f) => f.scanSessionId),
    );
    await supabase.from("scan_sessions").delete().in(
      "id",
      fixtures.map((f) => f.scanSessionId),
    );
    await supabase.from("quote_files").delete().in("id", quoteFileIds);
  }
  if (paths.length > 0) {
    await supabase.storage.from("quotes").remove(paths);
  }
}

Deno.test({
  name:
    "local e2e: discovery → claim → private file → fake provider → persist → complete",
  ignore: !RUN_LOCAL,
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    assert(
      isLocalApiUrl(LOCAL_URL),
      "refusing non-local Supabase URL",
    );
    const supabase = createLocalClient();
    const real = createSupabasePorts(supabase);
    const fixtures: FixtureIds[] = [];
    const successBytes = fixtureBytes("success");
    const invalidBytes = fixtureBytes("invalid");
    const ownershipBytes = fixtureBytes("ownership");
    const expectedSuccessSha = await sha256Hex(successBytes);
    const expectedInvalidSha = await sha256Hex(invalidBytes);

    try {
      await cleanupLeftoverE2eRows(supabase);
      const success = await uploadAndInsertEligibleQuote(
        supabase,
        successBytes,
        "success",
      );
      fixtures.push(success);

      const firstDiscover = await discoverV1(supabase);
      assertEquals(await countJobsForQuote(supabase, success.quoteFileId), 1);
      assert(asNumber(firstDiscover.jobs_created) >= 1);
      const pending = await loadJob(supabase, success.quoteFileId);
      assertEquals(pending.status, "pending");
      assertEquals(pending.module_key, MODULE_KEY);
      assertEquals(pending.schema_version, SCHEMA_VERSION);
      assertEquals(pending.prompt_version, PROMPT_VERSION);
      assertEquals(pending.quote_file_id, success.quoteFileId);
      assertEquals(pending.scan_session_id, success.scanSessionId);
      assertEquals(pending.analysis_id, success.analysisId);
      assertEquals(pending.attempt_count, 0);

      let downloadedBytes = 0;
      let leaseAcquired = false;
      let leaseReleased = false;
      const successPorts = wrapPorts(real, {
        downloadQuoteBytes: async (storagePath) => {
          const bytes = await real.downloadQuoteBytes(storagePath);
          downloadedBytes = bytes?.byteLength ?? 0;
          return bytes;
        },
        acquireContentLease: async (identity, workerId, leaseSeconds) => {
          const lease = await real.acquireContentLease(
            identity,
            workerId,
            leaseSeconds,
          );
          leaseAcquired = lease.acquired;
          return lease;
        },
        releaseContentLease: async (identity, workerId, claimToken) => {
          const ok = await real.releaseContentLease(
            identity,
            workerId,
            claimToken,
          );
          leaseReleased = ok;
          return ok;
        },
        callProvider: fakeValidProvider(),
      });

      const successWorkerId = `qi-e2e-success-${crypto.randomUUID()}`;
      const successOut = await runQuoteIntelligenceWorker(
        successPorts,
        successWorkerId,
        DEFAULT_WORKER_CONFIG,
      );
      assertEquals(successOut.ok, true);
      assertEquals(successOut.disposition, "extracted");
      assertEquals(successOut.providerCalls, 1);
      assert(successOut.extractionId);
      assert(downloadedBytes > 0);
      assertEquals(leaseAcquired, true);
      assertEquals(leaseReleased, true);

      const completed = await loadJob(supabase, success.quoteFileId);
      assertEquals(completed.status, "completed");
      assertEquals(completed.attempt_count, 1);
      assertEquals(completed.worker_id, successWorkerId);
      assertEquals(completed.extraction_id, successOut.extractionId);
      assertEquals(completed.content_sha256, expectedSuccessSha);
      assertEquals(completed.result_disposition, "extracted");
      assert(typeof completed.claim_token === "string");
      assert(completed.lease_expires_at != null);

      assertEquals(await countJobsForQuote(supabase, success.quoteFileId), 1);
      assertEquals(await countExtractions(supabase, expectedSuccessSha), 1);

      const observations = await loadObservations(
        supabase,
        successOut.extractionId as string,
      );
      assertEquals(observations.length, ALLOWED_FIELD_KEYS.length);
      assert(observations.every((row) => row.provenance === "QUOTED"));
      const keys = observations.map((row) => row.field_key).sort();
      assertEquals([...ALLOWED_FIELD_KEYS].slice().sort(), keys);

      const money = observations.find((row) =>
        row.field_key === "contract_total_cents"
      );
      const flag = observations.find((row) =>
        row.field_key === "is_window_door_related"
      );
      const zip = observations.find((row) => row.field_key === "zip_code");
      const openings = observations.find((row) =>
        row.field_key === "total_openings"
      );
      assertEquals(money?.value_cents, 0);
      assertEquals(money?.observation_status, "present");
      assertEquals(flag?.value_boolean, false);
      assertEquals(zip?.value_text, null);
      assertEquals(zip?.observation_status, "unknown");
      assertEquals(openings?.value_integer, 8);

      const replay = await discoverV1(supabase);
      assertEquals(asNumber(replay.jobs_created), 0);
      assertEquals(await countJobsForQuote(supabase, success.quoteFileId), 1);
      assertEquals(await countExtractions(supabase, expectedSuccessSha), 1);

      const duplicate = await uploadAndInsertEligibleQuote(
        supabase,
        successBytes,
        "dedup",
      );
      fixtures.push(duplicate);
      const dupDiscover = await discoverV1(supabase);
      assert(asNumber(dupDiscover.jobs_created) >= 1);
      assertEquals(await countJobsForQuote(supabase, duplicate.quoteFileId), 1);

      let dedupProviderCalls = 0;
      const dedupPorts = wrapPorts(real, {
        callProvider: async (bytes, mimeType) => {
          dedupProviderCalls += 1;
          return await fakeValidProvider()(bytes, mimeType);
        },
      });
      const dedupOut = await runQuoteIntelligenceWorker(
        dedupPorts,
        `qi-e2e-dedup-${crypto.randomUUID()}`,
        DEFAULT_WORKER_CONFIG,
      );
      assertEquals(dedupOut.ok, true);
      assertEquals(dedupOut.providerCalls, 0);
      assertEquals(dedupProviderCalls, 0);
      assertEquals(dedupOut.disposition, "skipped_existing_extraction");
      assertEquals(dedupOut.extractionId, successOut.extractionId);
      const dedupJob = await loadJob(supabase, duplicate.quoteFileId);
      assertEquals(dedupJob.status, "completed");
      assertEquals(dedupJob.extraction_id, successOut.extractionId);
      assertEquals(await countExtractions(supabase, expectedSuccessSha), 1);

      const invalid = await uploadAndInsertEligibleQuote(
        supabase,
        invalidBytes,
        "invalid",
      );
      fixtures.push(invalid);
      await discoverV1(supabase);
      assertEquals(await countJobsForQuote(supabase, invalid.quoteFileId), 1);

      const invalidOut = await runQuoteIntelligenceWorker(
        wrapPorts(real, { callProvider: fakeInvalidProvider() }),
        `qi-e2e-invalid-${crypto.randomUUID()}`,
        DEFAULT_WORKER_CONFIG,
      );
      assertEquals(invalidOut.ok, false);
      assertEquals(invalidOut.failureCode, "PROVIDER_INVALID_OUTPUT");
      assertEquals(invalidOut.providerCalls, 1);
      assertEquals(invalidOut.extractionId, null);
      assertEquals(invalidOut.disposition, "retryable_error");
      assertEquals(invalidOut.detail, "provider_invalid_output");
      const invalidJob = await loadJob(supabase, invalid.quoteFileId);
      assertEquals(invalidJob.status, "retryable_failed");
      assertEquals(invalidJob.result_disposition, "retryable_error");
      assertEquals(invalidJob.extraction_id, null);
      assertEquals(invalidJob.error_code, "provider_invalid_output");
      assertEquals(invalidJob.error_detail, "provider_invalid_output");
      assertEquals(await countExtractions(supabase, expectedInvalidSha), 0);
      const { count: invalidObs, error: invalidObsErr } = await supabase
        .from("wm_quote_intelligence_field_observations")
        .select("id", { count: "exact", head: true })
        .eq(
          "extraction_id",
          "00000000-0000-4000-8000-000000000000",
        );
      assertEquals(invalidObsErr, null);
      assertEquals(invalidObs, 0);

      const ownership = await uploadAndInsertEligibleQuote(
        supabase,
        ownershipBytes,
        "ownership",
      );
      fixtures.push(ownership);
      await discoverV1(supabase);
      const staleToken = crypto.randomUUID();
      let staleCasCalls = 0;
      let claimedToken: string | null = null;
      const ownershipPorts = wrapPorts(real, {
        claimJobs: async (limit, workerId, leaseSeconds) => {
          const jobs = await real.claimJobs(limit, workerId, leaseSeconds);
          claimedToken = jobs[0]?.claim_token ?? null;
          return jobs;
        },
        callProvider: fakeValidProvider(),
        casComplete: async (input: CasCompleteInput) => {
          staleCasCalls += 1;
          return await real.casComplete({
            ...input,
            claimToken: staleToken,
          });
        },
      });
      const ownershipOut = await runQuoteIntelligenceWorker(
        ownershipPorts,
        `qi-e2e-owner-${crypto.randomUUID()}`,
        DEFAULT_WORKER_CONFIG,
      );
      assertEquals(ownershipOut.ok, false);
      assertEquals(ownershipOut.failureCode, "OWNERSHIP_LOST");
      assert(staleCasCalls >= 1);
      assert(claimedToken != null);
      const ownedJob = await loadJob(supabase, ownership.quoteFileId);
      assertEquals(ownedJob.status, "processing");
      assertEquals(ownedJob.claim_token, claimedToken);
      assert(ownedJob.claim_token !== staleToken);
      assertEquals(ownedJob.extraction_id, null);
    } finally {
      await cleanupFixtures(supabase, fixtures);
    }
  },
});
