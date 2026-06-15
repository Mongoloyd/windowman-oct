import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  mergeAttribution,
  mergeQueryParams,
  normalizeWmIntent,
  promoteLeadScalarFields,
  sanitizeAttributionInput,
} from "./attributionMerge.ts";

Deno.test("normalizeWmIntent maps known values and unknown to unknown", () => {
  assertEquals(normalizeWmIntent("has-quote"), "has_quote");
  assertEquals(normalizeWmIntent("no_quote"), "no_quote");
  assertEquals(normalizeWmIntent("garbage"), "unknown");
});

Deno.test("sanitizeAttributionInput drops disallowed keys", () => {
  const out = sanitizeAttributionInput({
    ndclid: "abc",
    email: "secret@example.com",
    wm_intent: "has_quote",
  });
  assertEquals(out.ndclid, "abc");
  assertEquals(out.wm_intent, "has_quote");
  assertEquals("email" in out, false);
});

Deno.test("mergeAttribution fills empty fields without erasing existing", () => {
  const merged = mergeAttribution(
    { ndclid: "keep", fbclid: null },
    { ndclid: "new", fbclid: "meta", wm_intent: "has_quote" },
  );
  assertEquals(merged.ndclid, "keep");
  assertEquals(merged.fbclid, "meta");
  assertEquals(merged.wm_intent, "has_quote");
});

Deno.test("mergeAttribution preserves earliest captured_at", () => {
  const merged = mergeAttribution(
    { captured_at: 2000 },
    { captured_at: 1000 },
  );
  assertEquals(merged.captured_at, 1000);
});

Deno.test("mergeQueryParams first-touch wins", () => {
  const merged = mergeQueryParams(
    { ndclid: "first" },
    { ndclid: "second" },
  );
  assertEquals(merged.ndclid, "first");
});

Deno.test("mergeQueryParams fills when existing empty", () => {
  const merged = mergeQueryParams({}, { wm_intent: "has_quote" });
  assertEquals(merged.wm_intent, "has_quote");
});

Deno.test("promoteLeadScalarFields keeps nd_lead_id in attribution only", () => {
  const promoted = promoteLeadScalarFields({
    nd_lead_id: "ND_LEAD_456",
    utm_source: "nextdoor",
    landing_page: "/",
  });
  assertEquals(promoted.utm_source, "nextdoor");
  assertEquals(promoted.first_page_path, "/");
  assertEquals("nd_lead_id" in promoted, false);
});

Deno.test("promoteLeadScalarFields does not emit leads.intent column", () => {
  const promoted = promoteLeadScalarFields({
    wm_intent: "has_quote",
    utm_source: "nextdoor",
  });
  assertEquals("intent" in promoted, false);
});

Deno.test("sanitizeAttributionInput never throws on malformed input", () => {
  assertEquals(sanitizeAttributionInput(null), {});
  assertEquals(sanitizeAttributionInput("bad"), {});
});
