import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authorizeWorkerRequest,
  WORKER_SECRET_ENV,
  WORKER_SECRET_HEADER,
} from "./auth.ts";
import { handleQuoteIntelligenceWorkerRequest } from "./index.ts";

Deno.test("missing worker secret configuration is 403", () => {
  const prev = Deno.env.get(WORKER_SECRET_ENV);
  Deno.env.delete(WORKER_SECRET_ENV);
  const result = authorizeWorkerRequest(
    new Request("http://local/quote-intelligence-worker", {
      method: "POST",
      headers: { [WORKER_SECRET_HEADER]: "x" },
    }),
  );
  if (prev !== undefined) Deno.env.set(WORKER_SECRET_ENV, prev);
  assertEquals(result.ok, false);
  if (!result.ok) assertEquals(result.status, 403);
});

Deno.test("wrong worker secret is 403", () => {
  const prev = Deno.env.get(WORKER_SECRET_ENV);
  Deno.env.set(WORKER_SECRET_ENV, "expected-secret");
  const result = authorizeWorkerRequest(
    new Request("http://local/quote-intelligence-worker", {
      method: "POST",
      headers: { [WORKER_SECRET_HEADER]: "other" },
    }),
  );
  if (prev !== undefined) Deno.env.set(WORKER_SECRET_ENV, prev);
  else Deno.env.delete(WORKER_SECRET_ENV);
  assertEquals(result.ok, false);
});

Deno.test("handler rejects unauthenticated callers before work", async () => {
  const prev = Deno.env.get(WORKER_SECRET_ENV);
  Deno.env.set(WORKER_SECRET_ENV, "expected-secret");
  const response = await handleQuoteIntelligenceWorkerRequest(
    new Request("http://local/quote-intelligence-worker", { method: "POST" }),
  );
  if (prev !== undefined) Deno.env.set(WORKER_SECRET_ENV, prev);
  else Deno.env.delete(WORKER_SECRET_ENV);
  assertEquals(response.status, 403);
  const body = await response.json();
  assertEquals(body.detail, "unauthorized");
});
