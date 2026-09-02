import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  authorizeWorkerRequest,
  WORKER_SECRET_HEADER,
} from "./auth.ts";

Deno.test("authorizeWorkerRequest rejects missing secret configuration", () => {
  const prev = Deno.env.get("REPORT_SUMMARY_WORKER_SECRET");
  Deno.env.delete("REPORT_SUMMARY_WORKER_SECRET");
  try {
    const result = authorizeWorkerRequest(
      new Request("http://local/report-summary-worker", { method: "POST" }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) {
      assertEquals(result.detail, "worker_secret_unconfigured");
    }
  } finally {
    if (prev !== undefined) Deno.env.set("REPORT_SUMMARY_WORKER_SECRET", prev);
  }
});

Deno.test("authorizeWorkerRequest rejects wrong secret", () => {
  Deno.env.set("REPORT_SUMMARY_WORKER_SECRET", "expected-secret");
  try {
    const result = authorizeWorkerRequest(
      new Request("http://local/report-summary-worker", {
        method: "POST",
        headers: { [WORKER_SECRET_HEADER]: "wrong-secret" },
      }),
    );
    assertEquals(result.ok, false);
    if (!result.ok) assertEquals(result.detail, "unauthorized");
  } finally {
    Deno.env.delete("REPORT_SUMMARY_WORKER_SECRET");
  }
});

Deno.test("authorizeWorkerRequest accepts matching secret", () => {
  Deno.env.set("REPORT_SUMMARY_WORKER_SECRET", "expected-secret");
  try {
    const result = authorizeWorkerRequest(
      new Request("http://local/report-summary-worker", {
        method: "POST",
        headers: { [WORKER_SECRET_HEADER]: "expected-secret" },
      }),
    );
    assertEquals(result.ok, true);
  } finally {
    Deno.env.delete("REPORT_SUMMARY_WORKER_SECRET");
  }
});
