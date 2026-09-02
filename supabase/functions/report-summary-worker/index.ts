import { authorizeWorkerRequest } from "./auth.ts";
import {
  createServiceRoleClient,
  createSupabasePorts,
  workerConfigFromEnv,
} from "./adapters.ts";
import { runReportSummaryWorker } from "./orchestrator.ts";
import type { ReportSummaryWorkerPorts, WorkerResult } from "./types.ts";

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function publicWorkerBody(result: WorkerResult): Record<string, unknown> {
  return {
    ok: result.ok,
    disposition: result.disposition,
    analysis_id: result.analysis_id,
    summary_id: result.summary_id,
    provider_calls: result.provider_calls,
    detail: result.detail,
  };
}

export async function handleReportSummaryWorkerRequest(
  req: Request,
  ports?: ReportSummaryWorkerPorts,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, detail: "method_not_allowed" });
  }

  const auth = authorizeWorkerRequest(req);
  if (!auth.ok) {
    return jsonResponse(auth.status, { ok: false, detail: auth.detail });
  }

  const resolvedPorts = ports ?? createSupabasePorts(createServiceRoleClient());
  const workerId = `rs-${crypto.randomUUID()}`;
  const outcome = await runReportSummaryWorker(
    resolvedPorts,
    workerId,
    workerConfigFromEnv(),
  );
  return jsonResponse(200, publicWorkerBody(outcome));
}

if (import.meta.main) {
  Deno.serve((req) => handleReportSummaryWorkerRequest(req));
}
