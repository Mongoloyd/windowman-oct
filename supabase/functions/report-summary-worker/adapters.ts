import {
  createClient,
  type SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";
import type { AnalysisRowForSummary } from "../_shared/reportSummary/buildSummarySourceFromAnalysis.ts";
import { callReportSummaryProvider } from "../_shared/reportSummary/reportSummaryProvider.ts";
import { DEFAULT_SUMMARY_LEASE_SECONDS } from "./contract.ts";
import type {
  CompleteSummaryInput,
  ReportSummaryWorkerPorts,
  SummaryClaim,
} from "./types.ts";

export function createServiceRoleClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function firstRow<T>(data: T[] | null | undefined): T | null {
  return Array.isArray(data) && data.length > 0 ? data[0] : null;
}

export function createSupabasePorts(
  supabase: SupabaseClient,
): ReportSummaryWorkerPorts {
  return {
    async pickCandidate(promptVersion) {
      const { data, error } = await supabase.rpc(
        "wm_pick_report_summary_candidate",
        { p_prompt_version: promptVersion },
      );
      if (error) return null;
      const row = firstRow(data as Array<{ analysis_id: string }>);
      return row ? { analysis_id: row.analysis_id } : null;
    },

    async loadAnalysis(analysisId) {
      const { data, error } = await supabase
        .from("analyses")
        .select("id, grade, rubric_version, flags, full_json, proof_of_read")
        .eq("id", analysisId)
        .maybeSingle();
      if (error || !data) return null;
      return data as AnalysisRowForSummary;
    },

    async getTerminalSummary(analysisId, promptVersion, inputPackHash) {
      const { data, error } = await supabase
        .from("wm_report_summaries")
        .select("status")
        .eq("analysis_id", analysisId)
        .eq("prompt_version", promptVersion)
        .eq("input_pack_hash", inputPackHash)
        .in("status", ["ready", "insufficient_facts"])
        .maybeSingle();
      if (error || !data) return null;
      return { status: String(data.status) };
    },

    async claimGeneration(input) {
      const { data, error } = await supabase.rpc(
        "wm_claim_report_summary_generation",
        {
          p_analysis_id: input.analysis_id,
          p_prompt_version: input.prompt_version,
          p_input_pack_hash: input.input_pack_hash,
          p_worker_id: input.worker_id,
          p_lease_seconds: input.lease_seconds,
        },
      );
      if (error) return null;
      const row = firstRow(data as Array<Record<string, unknown>>);
      if (!row || typeof row.summary_id !== "string") return null;
      if (typeof row.claim_token !== "string") return null;
      return {
        summary_id: row.summary_id,
        claim_token: row.claim_token,
        prior_status: typeof row.prior_status === "string"
          ? row.prior_status
          : null,
        already_terminal: row.already_terminal === true,
      } satisfies SummaryClaim;
    },

    async completeSummary(input: CompleteSummaryInput) {
      const { data, error } = await supabase.rpc(
        "wm_complete_report_summary",
        {
          p_summary_id: input.summary_id,
          p_analysis_id: input.analysis_id,
          p_worker_id: input.worker_id,
          p_claim_token: input.claim_token,
          p_status: input.status,
          p_summary_json: input.summary_json ?? null,
          p_runtime_model_id: input.runtime_model_id ?? null,
          p_failure_class: input.failure_class ?? null,
        },
      );
      if (error) return false;
      return data === true;
    },

    callProvider: callReportSummaryProvider,
  };
}

export function workerConfigFromEnv(): { leaseSeconds: number } {
  const lease = Number(Deno.env.get("REPORT_SUMMARY_LEASE_SECONDS"));
  return {
    leaseSeconds: Number.isFinite(lease) && lease > 0
      ? lease
      : DEFAULT_SUMMARY_LEASE_SECONDS,
  };
}
