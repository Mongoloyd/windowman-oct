import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stripConsentForLeadsInsert } from "./leadInsertPayload.ts";

Deno.test("stripConsentForLeadsInsert removes consent from lead insert shape", () => {
  const payload = {
    session_id: "11111111-1111-4111-8111-111111111111",
    email: "jane@example.com",
    source: "truth-gate",
    consent: {
      schemaVersion: "1",
      events: [{ purpose: "service_communications", decision: "granted" }],
    },
  };

  const row = stripConsentForLeadsInsert(payload);

  assertEquals("consent" in row, false);
  assertEquals(row.email, "jane@example.com");
  assertEquals(row.source, "truth-gate");
});
