import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  NORMALIZATION_VERSION,
  multiplyCentsByQuantity,
  normalizeAnalysis,
  parseMoneyToCents,
  type NormalizeAnalysisMeta,
} from "./normalizeAnalysis.ts";

const ANALYSIS_ID = "11111111-1111-1111-1111-111111111111";
const OBSERVATION_ID = "22222222-2222-2222-2222-222222222222";

const baseMeta: NormalizeAnalysisMeta = {
  leadId: "33333333-3333-3333-3333-333333333333",
  countyName: "Palm Beach",
  zipCode: "33401",
  confidenceScore: 0.92,
  scannedAt: "2026-08-06T12:00:00.000Z",
};

type ObservationRow = Record<string, unknown> & { id: string; analysis_id: string };
type FailureRow = Record<string, unknown>;

function createMockSupabase() {
  const observationsByAnalysis = new Map<string, ObservationRow>();
  let lineItems: Record<string, unknown>[] = [];
  const failures: FailureRow[] = [];
  let upsertCallCount = 0;
  let lastUpsertOnConflict: string | undefined;
  let lineInsertCount = 0;
  let lineDeleteCount = 0;

  const supabase = {
    from(table: string) {
      if (table === "quote_observations") {
        return {
          upsert(payload: Record<string, unknown>, opts?: { onConflict?: string }) {
            upsertCallCount += 1;
            lastUpsertOnConflict = opts?.onConflict;
            const analysisId = String(payload.analysis_id);
            const existing = observationsByAnalysis.get(analysisId);
            const row: ObservationRow = {
              ...(existing ?? {}),
              ...payload,
              id: existing?.id ?? OBSERVATION_ID,
              analysis_id: analysisId,
            };
            observationsByAnalysis.set(analysisId, row);
            return {
              select(_cols: string) {
                return {
                  single() {
                    return Promise.resolve({ data: { id: row.id }, error: null });
                  },
                };
              },
            };
          },
        };
      }

      if (table === "quote_line_items") {
        return {
          delete() {
            return {
              eq(_col: string, observationId: string) {
                lineDeleteCount += 1;
                lineItems = lineItems.filter(
                  (r) => r.observation_id !== observationId,
                );
                return Promise.resolve({ error: null });
              },
            };
          },
          insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
            const batch = Array.isArray(rows) ? rows : [rows];
            lineInsertCount += 1;
            lineItems.push(...batch);
            return Promise.resolve({ error: null });
          },
        };
      }

      if (table === "normalization_failures") {
        return {
          insert(row: FailureRow) {
            failures.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;

  return {
    supabase,
    getObservation: (analysisId: string) =>
      observationsByAnalysis.get(analysisId),
    getLineItems: () => lineItems,
    getFailures: () => failures,
    getUpsertCallCount: () => upsertCallCount,
    getLastUpsertOnConflict: () => lastUpsertOnConflict,
    getLineInsertCount: () => lineInsertCount,
    getLineDeleteCount: () => lineDeleteCount,
  };
}

function fullPayloadFullJson(): Record<string, unknown> {
  return {
    derived_metrics: {
      county_benchmark: { county_key: "palm_beach_fl" },
      totals: { contract_total: 1240.5 },
      counts: { total_openings: 3 },
    },
    extraction: {
      contractor_name: "  Acme Windows  ",
      total_quoted_price: 999,
      opening_count: 1,
      line_items: [
        {
          description: "PGT WinGuard double hung window 36x48",
          dimensions: "36 x 48",
          quantity: 2,
          unit_price: "$620.25",
          total_price: 1240.5,
          brand: "PGT",
          series: "WinGuard",
          dp_rating: "DP-50",
          noa_number: "NOA-123",
          opening_location: "Master BR",
          opening_tag: "W-1",
          product_assignment_text: "Impact window",
          glass_package_text: "Low-E / Argon",
          glass_makeup_type: "laminated",
          glass_low_e_present: true,
          glass_argon_present: true,
          glass_tint_text: "clear",
          glass_spec_complete: true,
        },
        {
          description: "Permit fees",
          quantity: 1,
          unit_price: 150,
        },
      ],
    },
  };
}

Deno.test("parseMoneyToCents: deterministic decimal contract", () => {
  assertEquals(parseMoneyToCents("$1,240.50"), 124050);
  assertEquals(parseMoneyToCents(" 19.99 "), 1999);
  assertEquals(parseMoneyToCents(1.005), 101);
  assertEquals(parseMoneyToCents(-1.005), -101);
  assertEquals(parseMoneyToCents(0.29), 29);
  assertEquals(parseMoneyToCents(19.99), 1999);
  assertEquals(parseMoneyToCents("not-a-price"), null);
  assertEquals(parseMoneyToCents(null), null);
  assertEquals(parseMoneyToCents("garbage"), null);
  assertEquals(parseMoneyToCents("12abc34"), null);
  assertEquals(parseMoneyToCents("USD 12.34"), null);
  assertEquals(parseMoneyToCents("--12.34"), null);
  assertEquals(parseMoneyToCents("12.34.56"), null);
  assertEquals(parseMoneyToCents(Number.NaN), null);
  assertEquals(parseMoneyToCents(Number.POSITIVE_INFINITY), null);
  assertEquals(parseMoneyToCents("90071992547410.00"), null);
});

Deno.test("multiplyCentsByQuantity: fractional quantity half-up", () => {
  assertEquals(multiplyCentsByQuantity(1999, 1.5), 2999);
  assertEquals(multiplyCentsByQuantity(-1999, 1.5), -2999);
});

Deno.test("normalizeAnalysis: full payload maps header, cents, classifier, and flags", async () => {
  const mock = createMockSupabase();
  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullPayloadFullJson(),
    baseMeta,
  );

  assertEquals(result.success, true);
  assertEquals(result.observationId, OBSERVATION_ID);

  const obs = mock.getObservation(ANALYSIS_ID);
  assert(obs);
  assertEquals(obs.analysis_id, ANALYSIS_ID);
  assertEquals(obs.lead_id, baseMeta.leadId);
  assertEquals(obs.benchmark_county_key, "palm_beach_fl");
  assertEquals(obs.contractor_raw_name, "Acme Windows");
  assertEquals(obs.contract_total_cents, 124050);
  assertEquals(obs.total_openings, 3);
  assertEquals(obs.product_line_count, 1);
  assertEquals(obs.adder_line_count, 1);
  assertEquals(obs.line_item_count, 2);
  assertEquals(obs.has_line_item_detail, true);
  assertEquals(obs.has_priced_lines, true);
  assertEquals(obs.has_dimension_text, true);
  assertEquals(obs.normalization_version, NORMALIZATION_VERSION);
  assertEquals(obs.extraction_confidence, baseMeta.confidenceScore);
  assertEquals(obs.scanned_at, baseMeta.scannedAt);
  assert(Array.isArray(obs.source_extraction_keys));

  const lines = mock.getLineItems();
  assertEquals(lines.length, 2);
  const windowLine = lines.find((l) => l.line_index === 0);
  assert(windowLine);
  assertEquals(windowLine.line_category, "window");
  assertEquals(windowLine.is_scope_adder, false);
  assertEquals(windowLine.unit_price_cents, 62025);
  assertEquals(windowLine.extended_price_cents, 124050);
  const permitLine = lines.find((l) => l.line_index === 1);
  assert(permitLine);
  assertEquals(permitLine.line_category, "permit");
  assertEquals(permitLine.is_scope_adder, true);
});

Deno.test("normalizeAnalysis: summary-only payload writes header without child rows", async () => {
  const mock = createMockSupabase();
  const fullJson: Record<string, unknown> = {
    derived_metrics: {
      totals: { contract_total: 5000 },
      counts: { total_openings: 8 },
    },
    extraction: {
      contractor_name: "Solo Quote Co",
      line_items: [],
    },
  };

  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  assertEquals(result.success, true);
  const obs = mock.getObservation(ANALYSIS_ID);
  assert(obs);
  assertEquals(obs.has_line_item_detail, false);
  assertEquals(obs.line_item_count, 0);
  assertEquals(obs.contract_total_cents, 500000);
  assertEquals(mock.getLineItems().length, 0);
});

Deno.test("normalizeAnalysis: idempotent upsert on analysis_id and stable line count", async () => {
  const mock = createMockSupabase();
  const fullJson = fullPayloadFullJson();

  const first = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  const linesAfterFirst = mock.getLineItems().length;
  assertEquals(first.success, true);
  assertEquals(mock.getUpsertCallCount(), 1);
  assertEquals(mock.getLastUpsertOnConflict(), "analysis_id");

  const second = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  assertEquals(second.success, true);
  assertEquals(mock.getUpsertCallCount(), 2);
  assertEquals(mock.getLastUpsertOnConflict(), "analysis_id");
  assertEquals(mock.getObservation(ANALYSIS_ID)?.id, OBSERVATION_ID);
  assertEquals(mock.getLineItems().length, linesAfterFirst);
  assertEquals(linesAfterFirst, 2);
});

Deno.test("normalizeAnalysis: missing extraction logs failure and returns success false", async () => {
  const mock = createMockSupabase();
  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    { derived_metrics: {} },
    baseMeta,
  );
  assertEquals(result.success, false);
  assert(mock.getObservation(ANALYSIS_ID) === undefined);
  const failures = mock.getFailures();
  assertEquals(failures.length, 1);
  assertEquals(failures[0].failure_stage, "parse_header");
  assertEquals(failures[0].normalization_version, NORMALIZATION_VERSION);
});

Deno.test("normalizeAnalysis: parses raw dimensions when width/height missing", async () => {
  const mock = createMockSupabase();
  const fullJson: Record<string, unknown> = {
    extraction: {
      contractor_name: "Regex Dim Co",
      line_items: [
        {
          description: "Impact window living room",
          width: null,
          height: null,
          dimensions: "37.5 x 74",
          quantity: 1,
          unit_price: 224,
          total_price: 224,
          brand: "PGT",
          series: "WinGuard",
        },
      ],
    },
  };

  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  assertEquals(result.success, true);

  const obs = mock.getObservation(ANALYSIS_ID);
  assert(obs);
  assertEquals(obs.is_stats_eligible, true);
  assertEquals(obs.total_united_inches, 111.5);

  const lines = mock.getLineItems();
  assertEquals(lines.length, 1);
  const line = lines[0];
  assertEquals(line.width_inches, 37.5);
  assertEquals(line.height_inches, 74);
  assertEquals(line.united_inches, 111.5);
  assertEquals(line.extended_price_cents, 22400);
  assertEquals(line.cents_per_united_inch, 201);
});

Deno.test("normalizeAnalysis: negative extended price rounds cents per united inch", async () => {
  const mock = createMockSupabase();
  const fullJson: Record<string, unknown> = {
    extraction: {
      contractor_name: "Discount Dim Co",
      line_items: [
        {
          description: "Impact window credit",
          dimensions: "37.5 x 74",
          quantity: 1,
          total_price: -224,
        },
      ],
    },
  };

  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  assertEquals(result.success, true);
  const line = mock.getLineItems()[0];
  assertEquals(line.extended_price_cents, -22400);
  assertEquals(line.united_inches, 111.5);
  assertEquals(line.cents_per_united_inch, -201);
});

Deno.test("normalizeAnalysis: fractional quantity in total_united_inches", async () => {
  const mock = createMockSupabase();
  const fullJson: Record<string, unknown> = {
    extraction: {
      contractor_name: "Fractional Qty Co",
      line_items: [
        {
          description: "Impact window",
          dimensions: "37.5 x 74",
          quantity: 1.5,
          unit_price: 100,
          total_price: 150,
        },
      ],
    },
  };

  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    fullJson,
    baseMeta,
  );
  assertEquals(result.success, true);
  const obs = mock.getObservation(ANALYSIS_ID);
  assert(obs);
  assertEquals(obs.total_united_inches, 167.25);
  const line = mock.getLineItems()[0];
  assertEquals(line.quantity, 1.5);
});

Deno.test("normalizeAnalysis: explicit total_price overrides unit fallback", async () => {
  const mock = createMockSupabase();
  const fullJson: Record<string, unknown> = {
    extraction: {
      contractor_name: "Override Co",
      line_items: [
        {
          description: "Window line",
          quantity: 2,
          unit_price: 1999,
          total_price: 5000,
        },
      ],
    },
  };

  await normalizeAnalysis(mock.supabase, ANALYSIS_ID, fullJson, baseMeta);
  const line = mock.getLineItems()[0];
  assertEquals(line.extended_price_cents, 500000);
  assertEquals(line.unit_price_cents, 199900);
});

Deno.test("normalizeAnalysis: non-array line_items logs parse_lines with truncated excerpt", async () => {
  const mock = createMockSupabase();
  const badValue = "x".repeat(600);
  const result = await normalizeAnalysis(
    mock.supabase,
    ANALYSIS_ID,
    {
      extraction: {
        contractor_name: "Bad Lines Inc",
        line_items: badValue,
      },
    },
    baseMeta,
  );
  assertEquals(result.success, false);
  const failures = mock.getFailures();
  assertEquals(failures.length, 1);
  assertEquals(failures[0].failure_stage, "parse_lines");
  const excerpt = String(failures[0].raw_excerpt ?? "");
  assert(excerpt.length <= 500);
});
