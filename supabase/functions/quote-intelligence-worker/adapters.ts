import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { DEFAULT_PROVIDER_TIMEOUT_MS } from "./contract.ts";
import { type QuoteIntelligencePorts } from "./ports.ts";
import { createAtomicPersistSuccessAdapter } from "./persistAdapter.ts";
import { callGeminiExtraction } from "./provider.ts";
import type {
  CasCompleteInput,
  ClaimedJob,
  ContentLease,
  ExtractionIdentity,
  ExtractionRecord,
  QuoteFileRef,
} from "./types.ts";

const QUOTES_BUCKET = "quotes";

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createSupabasePorts(
  supabase: SupabaseClient,
  options?: { providerTimeoutMs?: number },
): QuoteIntelligencePorts {
  const timeoutMs = options?.providerTimeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;

  return {
    atomicPersistenceAvailable: true,
    persistSuccess: createAtomicPersistSuccessAdapter({
      rpc: async (fn, args) => {
        const { data, error } = await supabase.rpc(fn, args as never);
        return {
          data,
          error: error ? { message: error.message } : null,
        };
      },
    }),
    now: () => new Date(),

    async claimJobs(limit, workerId, leaseSeconds) {
      const { data, error } = await supabase.rpc(
        "wm_claim_quote_intelligence_jobs",
        {
          p_limit: limit,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        },
      );
      if (error || !Array.isArray(data)) return [];
      return data as ClaimedJob[];
    },

    async getQuoteFile(quoteFileId) {
      const { data, error } = await supabase
        .from("quote_files")
        .select("id, storage_path")
        .eq("id", quoteFileId)
        .maybeSingle();
      if (error || !data) return null;
      const path = asString((data as QuoteFileRef).storage_path);
      if (!path) return null;
      return { id: quoteFileId, storage_path: path };
    },

    async downloadQuoteBytes(storagePath) {
      const { data, error } = await supabase.storage
        .from(QUOTES_BUCKET)
        .download(storagePath);
      if (error || !data) return null;
      const buffer = await data.arrayBuffer();
      return new Uint8Array(buffer);
    },

    async lookupExtraction(identity: ExtractionIdentity) {
      const { data, error } = await supabase
        .from("wm_quote_intelligence_extractions")
        .select("id")
        .eq("content_sha256", identity.contentSha256)
        .eq("module_key", identity.moduleKey)
        .eq("schema_version", identity.schemaVersion)
        .eq("prompt_version", identity.promptVersion)
        .maybeSingle();
      if (error || !data) return null;
      const id = asString((data as ExtractionRecord).id);
      return id ? { id } : null;
    },

    async acquireContentLease(identity, workerId, leaseSeconds) {
      const { data, error } = await supabase.rpc(
        "wm_acquire_quote_intelligence_content_lease",
        {
          p_content_sha256: identity.contentSha256,
          p_module_key: identity.moduleKey,
          p_schema_version: identity.schemaVersion,
          p_prompt_version: identity.promptVersion,
          p_worker_id: workerId,
          p_lease_seconds: leaseSeconds,
        },
      );
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row) {
        return {
          acquired: false,
          already_extracted: false,
          lease_id: null,
          claim_token: null,
          lease_expires_at: null,
          existing_extraction_id: null,
        } satisfies ContentLease;
      }
      const rec = row as Record<string, unknown>;
      return {
        acquired: rec.acquired === true,
        already_extracted: rec.already_extracted === true,
        lease_id: asString(rec.lease_id),
        claim_token: asString(rec.claim_token),
        lease_expires_at: asString(rec.lease_expires_at),
        existing_extraction_id: asString(rec.existing_extraction_id),
      };
    },

    async releaseContentLease(identity, workerId, claimToken) {
      const { data, error } = await supabase.rpc(
        "wm_release_quote_intelligence_content_lease",
        {
          p_content_sha256: identity.contentSha256,
          p_module_key: identity.moduleKey,
          p_schema_version: identity.schemaVersion,
          p_prompt_version: identity.promptVersion,
          p_worker_id: workerId,
          p_claim_token: claimToken,
        },
      );
      return !error && data === true;
    },

    async casComplete(input: CasCompleteInput) {
      const { data, error } = await supabase.rpc(
        "wm_cas_complete_quote_intelligence_job",
        {
          p_job_id: input.jobId,
          p_worker_id: input.workerId,
          p_claim_token: input.claimToken,
          p_status: input.status,
          p_result_disposition: input.resultDisposition ?? null,
          p_extraction_id: input.extractionId ?? null,
          p_content_sha256: input.contentSha256 ?? null,
          p_error_code: input.errorCode ?? null,
          p_error_detail: input.errorDetail ?? null,
          p_next_attempt_at: input.nextAttemptAt ?? null,
        },
      );
      return !error && data === true;
    },

    async callProvider(bytes, mimeType) {
      return await callGeminiExtraction(bytes, mimeType, timeoutMs);
    },
  };
}
