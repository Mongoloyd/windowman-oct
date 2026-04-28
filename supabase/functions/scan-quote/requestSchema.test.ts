import {
  assert,
  assertEquals,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.168.0/testing/asserts.ts";
import { parseScanQuoteRequest } from "./requestSchema.ts";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

Deno.test("rejects missing scan_session_id", () => {
  const r = parseScanQuoteRequest({});
  assertEquals(r.ok, false);
});

Deno.test("rejects non-uuid scan_session_id", () => {
  const r = parseScanQuoteRequest({ scan_session_id: "not-a-uuid" });
  assertEquals(r.ok, false);
});

Deno.test("accepts a minimal valid body", () => {
  const r = parseScanQuoteRequest({ scan_session_id: VALID_UUID });
  assert(r.ok);
  if (r.ok) assertEquals(r.value.scan_session_id, VALID_UUID);
});

Deno.test("accepts event_id and dev bypass fields", () => {
  const r = parseScanQuoteRequest({
    scan_session_id: VALID_UUID,
    event_id: "evt_abc123",
    dev_extraction_override: { foo: "bar" },
    dev_secret: "shh",
  });
  assert(r.ok);
});

Deno.test("rejects empty event_id", () => {
  const r = parseScanQuoteRequest({
    scan_session_id: VALID_UUID,
    event_id: "",
  });
  assertEquals(r.ok, false);
});
