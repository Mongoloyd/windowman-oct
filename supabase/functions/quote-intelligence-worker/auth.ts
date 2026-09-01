const WORKER_SECRET_ENV = "QUOTE_INTELLIGENCE_WORKER_SECRET";
const WORKER_SECRET_HEADER = "x-quote-intelligence-worker-secret";

export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aa = encoder.encode(a);
  const bb = encoder.encode(b);
  if (aa.length !== bb.length) return false;
  let mismatch = 0;
  for (let i = 0; i < aa.length; i++) {
    mismatch |= aa[i] ^ bb[i];
  }
  return mismatch === 0;
}

export type WorkerAuthResult =
  | { ok: true }
  | {
    ok: false;
    status: 403;
    detail: "worker_secret_unconfigured" | "unauthorized";
  };

export function authorizeWorkerRequest(req: Request): WorkerAuthResult {
  const expected = Deno.env.get(WORKER_SECRET_ENV);
  if (!expected || expected.length === 0) {
    return { ok: false, status: 403, detail: "worker_secret_unconfigured" };
  }
  const provided = req.headers.get(WORKER_SECRET_HEADER) ?? "";
  if (!constantTimeEqual(provided, expected)) {
    return { ok: false, status: 403, detail: "unauthorized" };
  }
  return { ok: true };
}

export { WORKER_SECRET_ENV, WORKER_SECRET_HEADER };
