import { authorizeWorkerRequest } from "./auth.ts";
import { DEFAULT_PROVIDER_TIMEOUT_MS } from "./contract.ts";
import {
  DEFAULT_WORKER_CONFIG,
  runQuoteIntelligenceWorker,
  type WorkerConfig,
} from "./orchestrator.ts";
import { createServiceRoleClient, createSupabasePorts } from "./adapters.ts";
import type { QuoteIntelligencePorts } from "./ports.ts";
import type { WorkerResult } from "./types.ts";

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
    code: result.failureCode,
    job_id: result.jobId,
    extraction_id: result.extractionId,
    disposition: result.disposition,
    provider_calls: result.providerCalls,
    detail: result.detail,
  };
}

export function workerConfigFromEnv(): WorkerConfig {
  const timeout = Number(Deno.env.get("QI_GEMINI_TIMEOUT_MS"));
  return {
    ...DEFAULT_WORKER_CONFIG,
    providerTimeoutMs: Number.isFinite(timeout) && timeout > 0
      ? timeout
      : DEFAULT_PROVIDER_TIMEOUT_MS,
  };
}

export async function handleQuoteIntelligenceWorkerRequest(
  req: Request,
  ports?: QuoteIntelligencePorts,
): Promise<Response> {
  if (req.method !== "POST") {
    return jsonResponse(405, { ok: false, detail: "method_not_allowed" });
  }

  const auth = authorizeWorkerRequest(req);
  if (!auth.ok) {
    return jsonResponse(auth.status, { ok: false, detail: auth.detail });
  }

  const resolvedPorts = ports ??
    createSupabasePorts(createServiceRoleClient(), {
      providerTimeoutMs: workerConfigFromEnv().providerTimeoutMs,
    });
  const workerId = `qi-${crypto.randomUUID()}`;
  const outcome = await runQuoteIntelligenceWorker(
    resolvedPorts,
    workerId,
    workerConfigFromEnv(),
  );
  return jsonResponse(200, publicWorkerBody(outcome));
}

if (import.meta.main) {
  Deno.serve((req) => handleQuoteIntelligenceWorkerRequest(req));
}
