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

Deno.test("mergeQueryParams adds missing incoming keys without overwriting existing query params", () => {
  const merged = mergeQueryParams(
    { utm_source: "nextdoor", referrer: "https://nextdoor.com" },
    {
      window_type: "impact",
      opening_count_bucket: "6_10",
      timeline: "asap",
    },
  );
  assertEquals(merged.utm_source, "nextdoor");
  assertEquals(merged.referrer, "https://nextdoor.com");
  assertEquals(merged.window_type, "impact");
  assertEquals(merged.opening_count_bucket, "6_10");
  assertEquals(merged.timeline, "asap");
});

Deno.test("mergeQueryParams preserves existing Track C values over incoming duplicates", () => {
  const merged = mergeQueryParams(
    { window_type: "impact" },
    { window_type: "not_sure" },
  );
  assertEquals(merged.window_type, "impact");
});

Deno.test("mergeQueryParams preserves Track B query params while adding Track C qualification", () => {
  const merged = mergeQueryParams(
    { utm_source: "nextdoor", wm_intent: "no_quote", zip: "33301" },
    {
      window_type: "impact",
      opening_count_bucket: "1_5",
      timeline: "researching",
    },
  );
  assertEquals(merged.utm_source, "nextdoor");
  assertEquals(merged.wm_intent, "no_quote");
  assertEquals(merged.zip, "33301");
  assertEquals(merged.window_type, "impact");
  assertEquals(merged.opening_count_bucket, "1_5");
  assertEquals(merged.timeline, "researching");
  assertEquals(Object.keys(merged).length, 6);
});

Deno.test("mergeQueryParams respects max key cap with existing keys prioritized", () => {
  const existing: Record<string, string> = {};
  for (let i = 0; i < 50; i++) {
    existing[`existing_key_${i}`] = `value_${i}`;
  }

  const merged = mergeQueryParams(existing, {
    window_type: "impact",
    timeline: "asap",
  });

  assertEquals(Object.keys(merged).length, 50);
  assertEquals("window_type" in merged, false);
  assertEquals("timeline" in merged, false);
  assertEquals(merged.existing_key_0, "value_0");
  assertEquals(merged.existing_key_49, "value_49");
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
