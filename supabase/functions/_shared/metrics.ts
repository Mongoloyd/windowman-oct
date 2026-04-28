/**
 * _shared/metrics.ts — Shared financial metric utilities.
 *
 * Pure functions only. Zero external dependencies. Zero side effects.
 * Used by: scan-quote, calculate-estimate-metrics.
 *
 * ⚠️  DO NOT add Supabase, Gemini, Twilio, or any I/O dependencies here.
 * This file must remain a leaf-level utility module.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type ItemBucket =
  | "window"
  | "door"
  | "screen"
  | "install"
  | "permit"
  | "trim"
  | "demo"
  | "discount"
  | "tax"
  | "other";

export interface MetricLineItem {
  description?: string;
  quantity?: number | null;
  unit_price?: number | null;
  total_price?: number | null;
  brand?: string | null;
  series?: string | null;
  dp_rating?: string | null;
  noa_number?: string | null;
  dimensions?: string | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// NUMERIC HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

export function n(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[^0-9.\-]/g, "");
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function round2(v: number | null): number | null {
  if (v === null || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

export function safeDiv(num: number | null, den: number | null): number | null {
  if (num === null || den === null || den <= 0) return null;
  return round2(num / den);
}

export function pct(num: number, den: number): number | null {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return null;
  return round2((num / den) * 100);
}

export function median(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0
    ? round2((clean[mid - 1] + clean[mid]) / 2)
    : round2(clean[mid]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// LINE ITEM CLASSIFICATION
// ═══════════════════════════════════════════════════════════════════════════════

export function classifyLineItem(description?: string): ItemBucket {
  const d = (description ?? "").toLowerCase().trim();
  if (!d) return "other";

  if (/\bdiscount\b|\bcredit\b|\brebate\b/.test(d)) return "discount";
  if (/\btax\b|\bsales tax\b/.test(d)) return "tax";
  if (/\bpermit\b/.test(d)) return "permit";
  if (
    /\binstall\b|\blabor\b|\binstallation\b|\bcaulk\b|\bseal\b|\bfoam\b/.test(d)
  ) return "install";
  if (
    /\bdemo\b|\bremove\b|\bremoval\b|\bdisposal\b|\bhaul\b|\bcleanup\b/.test(d)
  ) return "demo";
  if (/\btrim\b|\bstucco\b|\bflashing\b|\bwrap\b|\bwood\b/.test(d)) {
    return "trim";
  }
  if (/\bscreen\b|\bmesh\b/.test(d)) return "screen";
  if (/\bdoor\b|\bslider\b|\bentry\b|\bfrench\b/.test(d)) return "door";
  if (
    /\bwindow\b|\bsingle hung\b|\bdouble hung\b|\bcasement\b|\bpicture\b|\bawning\b/
      .test(d)
  ) return "window";

  return "other";
}

export function isCoreOpening(bucket: ItemBucket): boolean {
  return bucket === "window" || bucket === "door";
}

export function itemQuantity(item: MetricLineItem, bucket: ItemBucket): number {
  const q = n(item.quantity);
  if (q !== null && q > 0) return q;
  if (isCoreOpening(bucket)) return 1;
  return 0;
}

export function itemExtendedPrice(item: MetricLineItem): number | null {
  const total = n(item.total_price);
  if (total !== null) return total;
  const unit = n(item.unit_price);
  const qty = n(item.quantity);
  if (unit !== null && qty !== null && qty > 0) return round2(unit * qty);
  return null;
}
