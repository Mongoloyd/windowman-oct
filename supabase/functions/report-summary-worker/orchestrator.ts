import {
  buildFullSummaryFactPackV1,
  factPackHasMinimumFacts,
} from "../_shared/reportSummary/buildFullSummaryFactPackV1.ts";
import { buildSummarySourceFromAnalysisRow } from "../_shared/reportSummary/buildSummarySourceFromAnalysis.ts";
import { hashFactPack } from "../_shared/reportSummary/hashFactPack.ts";
import {
  SUMMARY_PROMPT_VERSION,
} from "../_shared/reportSummary/types.ts";
import type {
  ReportSummaryWorkerPorts,
  WorkerConfig,
  WorkerResult,
} from "./types.ts";

function result(
  partial: Partial<WorkerResult> & Pick<WorkerResult, "ok" | "detail">,
): WorkerResult {
  return {
    disposition: null,
    analysis_id: null,
    summary_id: null,
    provider_calls: 0,
    ...partial,
  };
}

/**
 * Processes at most one eligible completed analysis per invocation.
 * Summary failure never mutates analysis_status, grade, or reveal authority.
 */
export async function runReportSummaryWorker(
  ports: ReportSummaryWorkerPorts,
  workerId: string,
  config: WorkerConfig,
): Promise<WorkerResult> {
  const candidate = await ports.pickCandidate(SUMMARY_PROMPT_VERSION);
  if (!candidate) {
    return result({ ok: true, disposition: "no_work", detail: "no_eligible_analysis" });
  }

  const analysisId = candidate.analysis_id;
  const analysis = await ports.loadAnalysis(analysisId);
  if (!analysis) {
    return result({
      ok: false,
      disposition: "analysis_unreadable",
      analysis_id: analysisId,
      detail: "analysis_load_failed",
    });
  }

  const source = buildSummarySourceFromAnalysisRow(analysis);
  if (!source) {
    return result({
      ok: false,
      disposition: "analysis_unreadable",
      analysis_id: analysisId,
      detail: "summary_source_unavailable",
    });
  }

  const factPack = buildFullSummaryFactPackV1(source);
  const inputPackHash = await hashFactPack(factPack);

  const terminal = await ports.getTerminalSummary(
    analysisId,
    SUMMARY_PROMPT_VERSION,
    inputPackHash,
  );
  if (
    terminal?.status === "ready" || terminal?.status === "insufficient_facts"
  ) {
    return result({
      ok: true,
      disposition: "skipped_current",
      analysis_id: analysisId,
      detail: "summary_already_current",
    });
  }

  const claim = await ports.claimGeneration({
    analysis_id: analysisId,
    prompt_version: SUMMARY_PROMPT_VERSION,
    input_pack_hash: inputPackHash,
    worker_id: workerId,
    lease_seconds: config.leaseSeconds,
  });

  if (!claim) {
    return result({
      ok: true,
      disposition: "claim_conflict",
      analysis_id: analysisId,
      detail: "claim_unavailable",
    });
  }

  if (claim.already_terminal) {
    return result({
      ok: true,
      disposition: "skipped_current",
      analysis_id: analysisId,
      summary_id: claim.summary_id,
      detail: "summary_already_terminal",
    });
  }

  const ownership = {
    summary_id: claim.summary_id,
    analysis_id: analysisId,
    worker_id: workerId,
    claim_token: claim.claim_token,
  };

  if (!factPackHasMinimumFacts(factPack)) {
    const completed = await ports.completeSummary({
      ...ownership,
      status: "insufficient_facts",
      summary_json: {
        summary_version: "report_summary_v1",
        prompt_version: SUMMARY_PROMPT_VERSION,
        summary_body: "",
        evidence_keys: [],
        action_step: null,
        highlights: [],
        status: "insufficient_facts",
        input_pack_hash: inputPackHash,
      },
      runtime_model_id: null,
    });
    if (!completed) {
      return result({
        ok: false,
        disposition: "ownership_lost",
        analysis_id: analysisId,
        summary_id: claim.summary_id,
        detail: "ownership_lost",
      });
    }
    return result({
      ok: true,
      disposition: "insufficient_facts",
      analysis_id: analysisId,
      summary_id: claim.summary_id,
      detail: "deterministic_insufficient_facts",
    });
  }

  const providerResult = await ports.callProvider(factPack);
  if (!providerResult.ok) {
    const completed = await ports.completeSummary({
      ...ownership,
      status: "failed",
      failure_class: providerResult.failureClass,
    });
    if (!completed) {
      return result({
        ok: false,
        disposition: "ownership_lost",
        analysis_id: analysisId,
        summary_id: claim.summary_id,
        provider_calls: 1,
        detail: "ownership_lost",
      });
    }
    return result({
      ok: false,
      disposition: "failed",
      analysis_id: analysisId,
      summary_id: claim.summary_id,
      provider_calls: 1,
      detail: providerResult.failureClass,
    });
  }

  const summary = providerResult.summary;
  const completed = await ports.completeSummary({
    ...ownership,
    status: summary.status === "ready" ? "ready" : "insufficient_facts",
    summary_json: summary,
    runtime_model_id: providerResult.modelId,
  });

  if (!completed) {
    return result({
      ok: false,
      disposition: "ownership_lost",
      analysis_id: analysisId,
      summary_id: claim.summary_id,
      provider_calls: 1,
      detail: "ownership_lost",
    });
  }

  return result({
    ok: true,
    disposition: summary.status === "ready" ? "ready" : "insufficient_facts",
    analysis_id: analysisId,
    summary_id: claim.summary_id,
    provider_calls: 1,
    detail: summary.status,
  });
}
