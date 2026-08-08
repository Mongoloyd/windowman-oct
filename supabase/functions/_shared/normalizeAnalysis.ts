/**
 * Pure normalization transform: maps one analysis `full_json` into
 * `quote_observations` + `quote_line_items`, with defensive failure logging.
 *
 * NOT atomic: header upsert and child delete/insert are sequential client calls.
 * A crash between them can leave a header with stale children until retry.
 * Re-running `normalizeAnalysis()` is idempotent (upsert on `analysis_id`, full
 * line replace) and is the approved recovery mechanism for Sprint 1.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { classifyLineItem, n, type ItemBucket } from "./metrics.ts";

export const NORMALIZATION_VERSION = "v1";

const RAW_EXCERPT_MAX = 500;

const PRODUCT_CATEGORIES = new Set<ItemBucket>(["window", "door", "screen"]);

const DECIMAL_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

export type NormalizationFailureStage =
  | "read"
  | "parse_header"
  | "parse_lines"
  | "write";

export interface NormalizeAnalysisMeta {
  leadId: string | null;
  countyName: string | null;
  zipCode: string | null;
  /** From `analyses.confidence_score`. */
  confidenceScore: number | null;
  /** From `analyses.created_at`, ISO string. */
  scannedAt: string;
}

export interface NormalizeAnalysisResult {
  success: boolean;
  observationId?: string;
  error?: string;
}

function bigIntPow10(exp: number): bigint {
  let result = 1n;
  for (let i = 0; i < exp; i++) result *= 10n;
  return result;
}

function bigintToSafeInteger(value: bigint): number | null {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  ) {
    return null;
  }
  return Number(value);
}

/** Half-up on |numerator/denominator|, then restore sign of the ratio. */
function signedHalfUpDivide(
  numerator: bigint,
  denominator: bigint,
): bigint | null {
  if (denominator <= 0n) return null;
  const negative = numerator < 0n;
  const absNum = negative ? -numerator : numerator;
  const quotient = (absNum + denominator / 2n) / denominator;
  return negative ? -quotient : quotient;
}

/** Strip only $, commas, and whitespace; reject any other non-numeric characters. */
function normalizeFormattedDecimalString(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const stripped = trimmed.replace(/[\$,\s]/g, "");
  if (!stripped || stripped === "-" || stripped === "." || stripped === "-.") {
    return null;
  }
  if (/e/i.test(stripped)) return null;
  if (!/^[-.\d]+$/.test(stripped)) return null;
  if ((stripped.match(/-/g) ?? []).length > 1) return null;
  if (stripped.includes("-") && !stripped.startsWith("-")) return null;
  if ((stripped.match(/\./g) ?? []).length > 1) return null;
  if (!/\d/.test(stripped)) return null;

  return stripped;
}

function normalizeDecimalInput(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    const asString = value.toString();
    if (/e/i.test(asString)) return null;
    return asString;
  }
  if (typeof value === "string") {
    return normalizeFormattedDecimalString(value);
  }
  return null;
}

function parseDecimalParts(
  decimal: string,
): { negative: boolean; whole: string; frac: string } | null {
  const match = decimal.match(DECIMAL_PATTERN);
  if (!match) return null;
  return {
    negative: match[1] === "-",
    whole: match[2],
    frac: match[3] ?? "",
  };
}

function decimalStringToCents(decimal: string): number | null {
  const parts = parseDecimalParts(decimal);
  if (!parts) return null;

  const { negative, whole, frac } = parts;
  const fracLen = frac.length;
  const den = bigIntPow10(fracLen);
  const wholeBig = BigInt(whole);
  const fracBig = frac.length > 0 ? BigInt(frac) : 0n;
  let dollarsNumerator = wholeBig * den + fracBig;
  if (negative) dollarsNumerator = -dollarsNumerator;

  const centsBig = fracLen > 0
    ? signedHalfUpDivide(dollarsNumerator * 100n, den)
    : dollarsNumerator * 100n;
  if (centsBig === null) return null;
  return bigintToSafeInteger(centsBig);
}

/** Deterministic dollar-scale → integer cents (half-up at sub-cent precision). */
export function parseMoneyToCents(value: unknown): number | null {
  const decimal = normalizeDecimalInput(value);
  if (decimal === null) return null;
  return decimalStringToCents(decimal);
}

/** Unit cents × fractional quantity with half-up rounding to whole cents. */
export function multiplyCentsByQuantity(
  unitCents: number,
  quantity: unknown,
): number | null {
  if (!Number.isSafeInteger(unitCents)) return null;

  const qtyDecimal = normalizeDecimalInput(quantity);
  if (qtyDecimal === null) return null;
  const parts = parseDecimalParts(qtyDecimal);
  if (!parts || parts.negative) return null;

  const fracLen = parts.frac.length;
  const den = bigIntPow10(fracLen);
  const qtyNumerator = BigInt(parts.whole) * den +
    (parts.frac.length > 0 ? BigInt(parts.frac) : 0n);
  if (qtyNumerator <= 0n) return null;

  const product = signedHalfUpDivide(BigInt(unitCents) * qtyNumerator, den);
  if (product === null) return null;
  return bigintToSafeInteger(product);
}

function truncateExcerpt(value: string): string {
  if (value.length <= RAW_EXCERPT_MAX) return value;
  return value.slice(0, RAW_EXCERPT_MAX);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNullableString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asNullableBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function asNullableInt(value: unknown): number | null {
  const num = n(value);
  if (num === null || !Number.isFinite(num)) return null;
  const int = Math.trunc(num);
  return int === num ? int : null;
}

function asNullableQuantity(value: unknown): number | null {
  const decimal = normalizeDecimalInput(value);
  if (decimal === null) return null;
  if (!parseDecimalParts(decimal)) return null;
  const num = Number(decimal);
  if (!Number.isFinite(num)) return null;
  return num;
}

function asPositiveInches(value: unknown): number | null {
  const num = asNullableQuantity(value);
  if (num === null || num <= 0) return null;
  return num;
}

const DIMENSION_PAIR_PATTERN =
  /(\d+(?:\.\d+)?)\s*(?:["″'′]|in(?:ch(?:es)?)?\.?)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:["″'′]|in(?:ch(?:es)?)?\.?)?/i;

function parseDimensions(
  raw: string | null | undefined,
): { width_inches: number; height_inches: number } | null {
  if (raw == null || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const match = trimmed.match(DIMENSION_PAIR_PATTERN);
    if (!match) return null;
    const width_inches = Number.parseFloat(match[1]);
    const height_inches = Number.parseFloat(match[2]);
    if (
      !Number.isFinite(width_inches) ||
      !Number.isFinite(height_inches) ||
      width_inches <= 0 ||
      height_inches <= 0
    ) {
      return null;
    }
    return { width_inches, height_inches };
  } catch {
    return null;
  }
}

function resolveLineDimensions(
  item: Record<string, unknown>,
): { width_inches: number; height_inches: number } | null {
  const fromWidth = asPositiveInches(item.width);
  const fromHeight = asPositiveInches(item.height);
  if (fromWidth !== null && fromHeight !== null) {
    return { width_inches: fromWidth, height_inches: fromHeight };
  }

  const rawText = asNullableString(item.dimensions) ??
    asNullableString(item.raw_dimensions);
  return parseDimensions(rawText);
}

function unitedInchesFromPair(pair: {
  width_inches: number;
  height_inches: number;
}): number {
  return pair.width_inches + pair.height_inches;
}

function centsPerUnitedInch(
  extendedPriceCents: number | null,
  unitedInches: number | null,
): number | null {
  if (
    extendedPriceCents === null ||
    unitedInches === null ||
    unitedInches <= 0 ||
    !Number.isSafeInteger(extendedPriceCents)
  ) {
    return null;
  }

  const uiDecimal = normalizeDecimalInput(unitedInches);
  if (uiDecimal === null) return null;
  const parts = parseDecimalParts(uiDecimal);
  if (!parts || parts.negative) return null;

  const fracLen = parts.frac.length;
  const den = bigIntPow10(fracLen);
  const uiNumerator = BigInt(parts.whole) * den +
    (parts.frac.length > 0 ? BigInt(parts.frac) : 0n);
  if (uiNumerator <= 0n) return null;

  const quotient = signedHalfUpDivide(
    BigInt(extendedPriceCents) * den,
    uiNumerator,
  );
  if (quotient === null) return null;
  return bigintToSafeInteger(quotient);
}

function lineCategoryForDescription(description: string): ItemBucket {
  return classifyLineItem(description);
}

function isScopeAdder(category: ItemBucket): boolean {
  return !PRODUCT_CATEGORIES.has(category);
}

function readBenchmarkCountyKey(fullJson: Record<string, unknown>): string | null {
  const derived = fullJson.derived_metrics;
  if (!isPlainObject(derived)) return null;
  const benchmark = derived.county_benchmark;
  if (!isPlainObject(benchmark)) return null;
  return asNullableString(benchmark.county_key);
}

function readContractTotalDollars(
  fullJson: Record<string, unknown>,
): unknown {
  const derived = fullJson.derived_metrics;
  if (isPlainObject(derived)) {
    const totals = derived.totals;
    if (isPlainObject(totals) && totals.contract_total !== undefined) {
      return totals.contract_total;
    }
  }
  const extraction = fullJson.extraction;
  if (isPlainObject(extraction)) {
    return extraction.total_quoted_price;
  }
  return undefined;
}

function readTotalOpenings(fullJson: Record<string, unknown>): number | null {
  const derived = fullJson.derived_metrics;
  if (isPlainObject(derived)) {
    const counts = derived.counts;
    if (isPlainObject(counts)) {
      const fromDerived = asNullableInt(counts.total_openings);
      if (fromDerived !== null) return fromDerived;
    }
  }
  const extraction = fullJson.extraction;
  if (isPlainObject(extraction)) {
    return asNullableInt(extraction.opening_count);
  }
  return null;
}

function extendedPriceCents(
  item: Record<string, unknown>,
): number | null {
  const fromTotal = parseMoneyToCents(item.total_price);
  if (fromTotal !== null) return fromTotal;
  const unitCents = parseMoneyToCents(item.unit_price);
  const qty = asNullableQuantity(item.quantity);
  if (unitCents !== null && qty !== null && qty > 0) {
    return multiplyCentsByQuantity(unitCents, qty);
  }
  return null;
}

type ProcessedLine = {
  line_index: number;
  raw_description: string;
  raw_dimensions: string | null;
  line_category: ItemBucket;
  is_scope_adder: boolean;
  quantity: number | null;
  unit_price_cents: number | null;
  extended_price_cents: number | null;
  brand: string | null;
  series: string | null;
  dp_rating: string | null;
  noa_number: string | null;
  opening_location: string | null;
  opening_tag: string | null;
  product_assignment_text: string | null;
  glass_package_text: string | null;
  glass_makeup_type: string | null;
  glass_low_e_present: boolean | null;
  glass_argon_present: boolean | null;
  glass_tint_text: string | null;
  glass_spec_complete: boolean | null;
  width_inches: number | null;
  height_inches: number | null;
  united_inches: number | null;
  cents_per_united_inch: number | null;
};

async function logNormalizationFailure(
  supabase: SupabaseClient,
  params: {
    analysisId: string;
    failureStage: NormalizationFailureStage;
    reason: string;
    fieldName?: string | null;
    lineIndex?: number | null;
    rawExcerpt?: string | null;
  },
): Promise<void> {
  try {
    await supabase.from("normalization_failures").insert({
      analysis_id: params.analysisId,
      failure_stage: params.failureStage,
      reason: params.reason,
      field_name: params.fieldName ?? null,
      line_index: params.lineIndex ?? null,
      raw_excerpt: params.rawExcerpt
        ? truncateExcerpt(params.rawExcerpt)
        : null,
      normalization_version: NORMALIZATION_VERSION,
    });
  } catch {
    // Never recurse failure logging.
  }
}

type LineItemsParseResult =
  | { ok: true; lines: ProcessedLine[] }
  | { ok: false; error: string };

async function processLineItems(
  lineItemsRaw: unknown,
  logFailure: (
    stage: NormalizationFailureStage,
    reason: string,
    opts?: { fieldName?: string; lineIndex?: number; rawExcerpt?: string },
  ) => Promise<void>,
): Promise<LineItemsParseResult> {
  if (lineItemsRaw === undefined || lineItemsRaw === null) {
    return { ok: true, lines: [] };
  }
  if (Array.isArray(lineItemsRaw) && lineItemsRaw.length === 0) {
    return { ok: true, lines: [] };
  }
  if (!Array.isArray(lineItemsRaw)) {
    const reason = "extraction.line_items is not an array";
    await logFailure("parse_lines", reason, {
      fieldName: "line_items",
      rawExcerpt: truncateExcerpt(JSON.stringify(lineItemsRaw)),
    });
    return { ok: false, error: reason };
  }

  return (async (): Promise<LineItemsParseResult> => {
    const processed: ProcessedLine[] = [];
    for (let index = 0; index < lineItemsRaw.length; index++) {
      const raw = lineItemsRaw[index];
      if (!isPlainObject(raw)) {
        await logFailure(
          "parse_lines",
          "line item is not an object",
          {
            lineIndex: index,
            fieldName: "line_items[]",
            rawExcerpt: truncateExcerpt(JSON.stringify(raw)),
          },
        );
        continue;
      }
      const description = raw.description;
      if (typeof description !== "string" || !description.trim()) {
        await logFailure(
          "parse_lines",
          "line item missing required string description",
          {
            lineIndex: index,
            fieldName: "description",
            rawExcerpt: truncateExcerpt(JSON.stringify(raw)),
          },
        );
        continue;
      }

      const category = lineCategoryForDescription(description);
      const rawDimensionsText = asNullableString(raw.dimensions) ??
        asNullableString(raw.raw_dimensions);
      const dimensionPair = resolveLineDimensions(raw);
      const extendedCents = extendedPriceCents(raw);
      const unitedInches = dimensionPair
        ? unitedInchesFromPair(dimensionPair)
        : null;
      processed.push({
        line_index: index,
        raw_description: description.trim(),
        raw_dimensions: rawDimensionsText,
        line_category: category,
        is_scope_adder: isScopeAdder(category),
        quantity: asNullableQuantity(raw.quantity),
        unit_price_cents: parseMoneyToCents(raw.unit_price),
        extended_price_cents: extendedCents,
        width_inches: dimensionPair?.width_inches ?? null,
        height_inches: dimensionPair?.height_inches ?? null,
        united_inches: unitedInches,
        cents_per_united_inch: centsPerUnitedInch(extendedCents, unitedInches),
        brand: asNullableString(raw.brand),
        series: asNullableString(raw.series),
        dp_rating: asNullableString(raw.dp_rating),
        noa_number: asNullableString(raw.noa_number),
        opening_location: asNullableString(raw.opening_location),
        opening_tag: asNullableString(raw.opening_tag),
        product_assignment_text: asNullableString(raw.product_assignment_text),
        glass_package_text: asNullableString(raw.glass_package_text),
        glass_makeup_type: asNullableString(raw.glass_makeup_type),
        glass_low_e_present: asNullableBoolean(raw.glass_low_e_present),
        glass_argon_present: asNullableBoolean(raw.glass_argon_present),
        glass_tint_text: asNullableString(raw.glass_tint_text),
        glass_spec_complete: asNullableBoolean(raw.glass_spec_complete),
      });
    }
    return { ok: true, lines: processed };
  })();
}

export async function normalizeAnalysis(
  supabase: SupabaseClient,
  analysisId: string,
  fullJson: Record<string, unknown>,
  meta: NormalizeAnalysisMeta,
): Promise<NormalizeAnalysisResult> {
  const logFailure = async (
    stage: NormalizationFailureStage,
    reason: string,
    opts?: { fieldName?: string; lineIndex?: number; rawExcerpt?: string },
  ) => {
    await logNormalizationFailure(supabase, {
      analysisId,
      failureStage: stage,
      reason,
      fieldName: opts?.fieldName,
      lineIndex: opts?.lineIndex,
      rawExcerpt: opts?.rawExcerpt,
    });
  };

  try {
    if (!isPlainObject(fullJson)) {
      await logFailure("read", "full_json is not an object");
      return { success: false, error: "full_json is not an object" };
    }

    const extraction = fullJson.extraction;
    if (!isPlainObject(extraction)) {
      await logFailure("parse_header", "full_json.extraction is missing or invalid");
      return {
        success: false,
        error: "full_json.extraction is missing or invalid",
      };
    }

    const lineParse = await processLineItems(extraction.line_items, logFailure);
    if (!lineParse.ok) {
      return { success: false, error: lineParse.error };
    }
    const processedLines = lineParse.lines;

    const productLineCount = processedLines.filter((l) => !l.is_scope_adder)
      .length;
    const adderLineCount = processedLines.filter((l) => l.is_scope_adder).length;
    const lineItemCount = processedLines.length;
    const hasPricedLines = processedLines.some(
      (l) => l.unit_price_cents !== null || l.extended_price_cents !== null,
    );
    const hasDimensionText = processedLines.some(
      (l) =>
        (l.raw_dimensions !== null && l.raw_dimensions.length > 0) ||
        l.united_inches !== null,
    );

    const totalUnitedInches = processedLines.reduce((sum, line) => {
      if (line.is_scope_adder || line.united_inches === null) return sum;
      const qty = line.quantity != null && line.quantity > 0 ? line.quantity : 1;
      return sum + line.united_inches * qty;
    }, 0);

    const isStatsEligible = processedLines.some(
      (line) =>
        !line.is_scope_adder &&
        line.united_inches !== null &&
        line.extended_price_cents !== null,
    );

    const observationPayload = {
      analysis_id: analysisId,
      lead_id: meta.leadId,
      county_name: meta.countyName,
      zip_code: meta.zipCode,
      benchmark_county_key: readBenchmarkCountyKey(fullJson),
      contractor_raw_name: asNullableString(extraction.contractor_name),
      contract_total_cents: parseMoneyToCents(readContractTotalDollars(fullJson)),
      total_openings: readTotalOpenings(fullJson),
      product_line_count: productLineCount,
      adder_line_count: adderLineCount,
      line_item_count: lineItemCount,
      has_line_item_detail: lineItemCount > 0,
      has_priced_lines: hasPricedLines,
      has_dimension_text: hasDimensionText,
      total_united_inches: totalUnitedInches > 0 ? totalUnitedInches : null,
      is_stats_eligible: isStatsEligible,
      extraction_confidence: meta.confidenceScore,
      scanned_at: meta.scannedAt,
      normalization_version: NORMALIZATION_VERSION,
      source_extraction_keys: Object.keys(extraction),
    };

    const { data: observationRow, error: upsertError } = await supabase
      .from("quote_observations")
      .upsert(observationPayload, { onConflict: "analysis_id" })
      .select("id")
      .single();

    if (upsertError || !observationRow?.id) {
      const message = upsertError?.message ?? "quote_observations upsert failed";
      await logFailure("write", message, {
        fieldName: "quote_observations",
        rawExcerpt: truncateExcerpt(message),
      });
      return { success: false, error: message };
    }

    const observationId = observationRow.id as string;

    const { error: deleteError } = await supabase
      .from("quote_line_items")
      .delete()
      .eq("observation_id", observationId);

    if (deleteError) {
      await logFailure("write", deleteError.message, {
        fieldName: "quote_line_items.delete",
        rawExcerpt: truncateExcerpt(deleteError.message),
      });
      return { success: false, error: deleteError.message };
    }

    if (processedLines.length > 0) {
      const insertRows = processedLines.map((line) => ({
        observation_id: observationId,
        line_index: line.line_index,
        raw_description: line.raw_description,
        raw_dimensions: line.raw_dimensions,
        line_category: line.line_category,
        is_scope_adder: line.is_scope_adder,
        quantity: line.quantity,
        unit_price_cents: line.unit_price_cents,
        extended_price_cents: line.extended_price_cents,
        brand: line.brand,
        series: line.series,
        dp_rating: line.dp_rating,
        noa_number: line.noa_number,
        opening_location: line.opening_location,
        opening_tag: line.opening_tag,
        product_assignment_text: line.product_assignment_text,
        glass_package_text: line.glass_package_text,
        glass_makeup_type: line.glass_makeup_type,
        glass_low_e_present: line.glass_low_e_present,
        glass_argon_present: line.glass_argon_present,
        glass_tint_text: line.glass_tint_text,
        glass_spec_complete: line.glass_spec_complete,
        width_inches: line.width_inches,
        height_inches: line.height_inches,
        united_inches: line.united_inches,
        cents_per_united_inch: line.cents_per_united_inch,
      }));

      const { error: insertError } = await supabase
        .from("quote_line_items")
        .insert(insertRows);

      if (insertError) {
        await logFailure("write", insertError.message, {
          fieldName: "quote_line_items.insert",
          rawExcerpt: truncateExcerpt(insertError.message),
        });
        return { success: false, error: insertError.message };
      }
    }

    return { success: true, observationId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logFailure("write", message, {
      rawExcerpt: truncateExcerpt(message),
    });
    return { success: false, error: message };
  }
}
