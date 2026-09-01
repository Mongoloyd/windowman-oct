import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { ALLOWED_FIELD_KEYS } from "./contract.ts";
import { parseMoneyToCents } from "./money.ts";
import { normalizeProviderExtraction } from "./normalizer.ts";
import { parseProviderPayload } from "./schema.ts";

const identity = {
  contentSha256:
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  moduleKey: "quote_document_header",
  schemaVersion: "v1",
  promptVersion: "p1",
};

Deno.test("explicit $0 is present zero cents, not unknown", () => {
  const parsed = parseProviderPayload({
    document_type: "quote",
    is_window_door_related: true,
    extraction_confidence: 0.8,
    contractor_raw_name: null,
    contract_total: "$0.00",
    total_openings: null,
    county_name: null,
    zip_code: null,
  });
  assertEquals(parsed.ok, true);
  if (!parsed.ok) return;
  const normalized = normalizeProviderExtraction(identity, parsed.value);
  const money = normalized.observations.find((o) =>
    o.field_key === "contract_total_cents"
  );
  assertEquals(money?.observation_status, "present");
  assertEquals(money?.value_cents, 0);
  assertEquals(money?.provenance, "QUOTED");
  assertEquals(normalized.normalizedPayload.contract_total_cents, 0);
});

Deno.test("missing money stays null and unknown, never zero", () => {
  const parsed = parseProviderPayload({
    document_type: null,
    is_window_door_related: null,
    extraction_confidence: null,
    contractor_raw_name: null,
    contract_total: null,
    total_openings: null,
    county_name: null,
    zip_code: null,
  });
  assertEquals(parsed.ok, true);
  if (!parsed.ok) return;
  const normalized = normalizeProviderExtraction(identity, parsed.value);
  const money = normalized.observations.find((o) =>
    o.field_key === "contract_total_cents"
  );
  assertEquals(money?.observation_status, "unknown");
  assertEquals(money?.value_cents, null);
  assertEquals(normalized.normalizedPayload.contract_total_cents, null);
  assertEquals(parseMoneyToCents(null), null);
});

Deno.test("$1,200.00 normalizes to 120000 cents", () => {
  assertEquals(parseMoneyToCents("$1,200.00"), 120000);
});

Deno.test("unexpected provider field keys are rejected", () => {
  const parsed = parseProviderPayload({
    document_type: "quote",
    is_window_door_related: true,
    extraction_confidence: 0.9,
    contractor_raw_name: null,
    contract_total: null,
    total_openings: null,
    county_name: null,
    zip_code: null,
    grade: "A",
    line_items: [],
  });
  assertEquals(parsed.ok, false);
});

Deno.test("normalized observations stay inside the frozen V1 key set", () => {
  const parsed = parseProviderPayload({
    document_type: "quote",
    is_window_door_related: false,
    extraction_confidence: 0.95,
    contractor_raw_name: "Acme",
    contract_total: 10,
    total_openings: 2,
    county_name: "Broward",
    zip_code: "33301",
  });
  assertEquals(parsed.ok, true);
  if (!parsed.ok) return;
  const normalized = normalizeProviderExtraction(identity, parsed.value);
  const keys = normalized.observations.map((o) => o.field_key).sort();
  assertEquals(keys, [...ALLOWED_FIELD_KEYS].sort());
  assertEquals(
    normalized.observations.every((o) => o.provenance === "QUOTED"),
    true,
  );
  assertEquals(normalized.normalizedPayload.contract_total_cents, 1000);
  assertEquals(normalized.normalizedPayload.is_window_door_related, false);
});

Deno.test("false boolean is present false, not coerced to unknown", () => {
  const parsed = parseProviderPayload({
    document_type: null,
    is_window_door_related: false,
    extraction_confidence: 0.9,
    contractor_raw_name: null,
    contract_total: null,
    total_openings: null,
    county_name: null,
    zip_code: null,
  });
  assertEquals(parsed.ok, true);
  if (!parsed.ok) return;
  const normalized = normalizeProviderExtraction(identity, parsed.value);
  const flag = normalized.observations.find((o) =>
    o.field_key === "is_window_door_related"
  );
  assertEquals(flag?.observation_status, "present");
  assertEquals(flag?.value_boolean, false);
});
