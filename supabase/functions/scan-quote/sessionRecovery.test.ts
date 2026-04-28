import { assertEquals } from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { decideSessionRecovery } from "./sessionRecovery.ts";

const NOW = Date.parse("2026-04-16T12:00:00Z");

Deno.test("terminal status → skip_terminal (idempotent no-op)", () => {
  for (
    const status of [
      "preview_ready",
      "complete",
      "invalid_document",
      "needs_better_upload",
      "error",
    ]
  ) {
    const d = decideSessionRecovery({ status, updated_at: null }, 3, NOW);
    assertEquals(d.kind, "skip_terminal");
  }
});

Deno.test("idle/uploading → process_fresh", () => {
  for (const status of ["idle", "uploading", null]) {
    const d = decideSessionRecovery(
      { status: status as string | null, updated_at: null },
      3,
      NOW,
    );
    assertEquals(d.kind, "process_fresh");
  }
});

Deno.test("processing younger than threshold → skip_in_flight", () => {
  const d = decideSessionRecovery(
    { status: "processing", updated_at: new Date(NOW - 60_000).toISOString() },
    3,
    NOW,
  );
  assertEquals(d.kind, "skip_in_flight");
});

Deno.test("processing older than threshold → takeover_stale (recovery)", () => {
  const d = decideSessionRecovery(
    {
      status: "processing",
      updated_at: new Date(NOW - 10 * 60_000).toISOString(),
    },
    3,
    NOW,
  );
  assertEquals(d.kind, "takeover_stale");
});

Deno.test("processing with no timestamps → skip_in_flight (cautious)", () => {
  const d = decideSessionRecovery(
    { status: "processing", updated_at: null, created_at: null },
    3,
    NOW,
  );
  assertEquals(d.kind, "skip_in_flight");
});
