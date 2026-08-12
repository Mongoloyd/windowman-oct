import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveMarketingConsent,
  resolveMarketingConsentFromRows,
  type MarketingConsentFetcher,
} from "./resolveMarketingConsent.ts";

Deno.test("latest granted decision is granted", () => {
  const res = resolveMarketingConsentFromRows([
    { decision: "granted", created_at: "2026-08-12T02:00:00Z", id: "2" },
    { decision: "declined", created_at: "2026-08-12T01:00:00Z", id: "1" },
  ]);
  assertEquals(res.state, "granted");
  assertEquals(res.suppressionReason, null);
});

Deno.test("declined maps to denied / consent_declined", () => {
  const res = resolveMarketingConsentFromRows([
    { decision: "declined", created_at: "2026-08-12T02:00:00Z" },
  ]);
  assertEquals(res.state, "denied");
  assertEquals(res.suppressionReason, "consent_declined");
});

Deno.test("withdrawn maps to denied / consent_withdrawn", () => {
  const res = resolveMarketingConsentFromRows([
    { decision: "withdrawn", created_at: "2026-08-12T02:00:00Z" },
  ]);
  assertEquals(res.state, "denied");
  assertEquals(res.suppressionReason, "consent_withdrawn");
});

Deno.test("empty rows are unknown / consent_missing", () => {
  const res = resolveMarketingConsentFromRows([]);
  assertEquals(res.state, "unknown");
  assertEquals(res.suppressionReason, "consent_missing");
});

Deno.test("lookup failure is unknown / consent_lookup_failed", async () => {
  const fetcher: MarketingConsentFetcher = {
    listMarketingDecisions: () => Promise.reject(new Error("db")),
  };
  const res = await resolveMarketingConsent(fetcher, "lead-1");
  assertEquals(res.state, "unknown");
  assertEquals(res.suppressionReason, "consent_lookup_failed");
});
