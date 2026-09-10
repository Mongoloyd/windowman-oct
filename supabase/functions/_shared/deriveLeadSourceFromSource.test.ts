import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { deriveLeadSourceFromSource } from "./deriveLeadSourceFromSource.ts";

Deno.test("deriveLeadSourceFromSource maps known sources", () => {
  assertEquals(deriveLeadSourceFromSource("truth-gate"), "truth-gate");
  assertEquals(deriveLeadSourceFromSource("nextdoor"), "nextdoor");
  assertEquals(
    deriveLeadSourceFromSource("arbitrage-engine"),
    "arbitrage-engine",
  );
  assertEquals(
    deriveLeadSourceFromSource("quote-education-demo"),
    "quote-education-demo",
  );
});

Deno.test("deriveLeadSourceFromSource falls back safely", () => {
  assertEquals(deriveLeadSourceFromSource(null), "direct");
  assertEquals(deriveLeadSourceFromSource(""), "direct");
  assertEquals(deriveLeadSourceFromSource("custom-partner"), "custom-partner");
});
