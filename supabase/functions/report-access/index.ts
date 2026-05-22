/**
 * report-access — Production-safe service-role proxy for private report RPCs.
 *
 * Both get_analysis_preview and get_analysis_full are SECURITY DEFINER functions
 * executable only by service_role. The browser anon/publishable key cannot call
 * them directly. This Edge Function bridges that gap without exposing the
 * service-role key to the browser.
 *
 * POST { mode: "preview", scan_session_id: string }
 *   → { ok: true, mode: "preview", data: PreviewRow }
 *
 * POST { mode: "full", scan_session_id: string, phone_e164: string }
 *   → { ok: true, mode: "full", authorized: true, data: FullRow }
 *   → { ok: true, mode: "full", authorized: false, locked: true, reason: "unauthorized" }
 *
 * Security invariants:
 * - Only the service-role key is used internally; never the anon key.
 * - full_json is never returned in preview mode (belt-and-suspenders strip).
 * - Internal DB errors, env vars, and stack traces are never sent to the browser.
 * - No imports from _shared (isolation from potentially polluted shared paths).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ── CORS ──────────────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// E.164: + followed by 1-3 digit country code and at least 7 digits, max 15 total.
const E164_RE = /^\+[1-9]\d{7,14}$/;

// ── V2 source projection (authorized full only) ───────────────────────────────

const V2_SOURCE_VERSION = "v2-source-2026-05";

type JsonRecord = Record<string, unknown>;

interface V2QuoteMathSource {
  line_items?: unknown[];
  contractor_name?: string | null;
  opening_count?: number | null;
  total_quoted_price?: number | null;
  derived_totals?: { contract_total?: number | null } | null;
}

interface V2ChangeOrderSource {
  change_order_policy_text?: string | null;
  written_change_order_required?: boolean | null;
  homeowner_approval_required_for_change_orders?: boolean | null;
  unilateral_price_adjustment_allowed?: boolean | null;
  substrate_condition_clause_present?: boolean | null;
  rot_unit_pricing_present?: boolean | null;
  buck_replacement_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  remeasure_price_adjustment_cap_present?: boolean | null;
}

interface V2ScopeGapInstallationSource {
  scope_detail?: string | null;
  disposal_included?: boolean | null;
}

interface V2ScopeGapPermitsSource {
  included?: boolean | null;
  responsible_party?: string | null;
  details?: string | null;
}

interface V2ScopeGapSource {
  debris_removal_included?: boolean | null;
  installation?: V2ScopeGapInstallationSource | null;
  rot_unit_pricing_present?: boolean | null;
  substrate_allowance_text?: string | null;
  substrate_condition_clause_present?: boolean | null;
  waterproofing_method_text?: string | null;
  stucco_repair_included?: boolean | null;
  post_install_stucco_excluded?: boolean | null;
  wall_repair_scope?: string | null;
  permit_fees_itemized?: boolean | null;
  permits?: V2ScopeGapPermitsSource | null;
}

interface V2SourceProjection {
  quote_math?: V2QuoteMathSource | null;
  change_order?: V2ChangeOrderSource | null;
  scope_gap?: V2ScopeGapSource | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asTrimmedStringField(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return null;
  return value.trim();
}

const NUMERIC_STRING_RE = /^-?\d+(\.\d+)?$/;
const RANGE_PATTERN_RE = /(\d[\d,.$\s]*\s*[-–—]\s*\d)|(\d[\d,.$\s]*\s+to\s+\d)/i;

function asNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.includes("%")) return null;
  if (RANGE_PATTERN_RE.test(trimmed)) return null;
  const cleaned = trimmed.replace(/[$,\s]/g, "");
  if (!NUMERIC_STRING_RE.test(cleaned)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBooleanOrNull(value: unknown): boolean | null {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function getRecord(
  record: JsonRecord | null | undefined,
  key: string,
): JsonRecord | null {
  if (!record) return null;
  const value = record[key];
  return isRecord(value) ? value : null;
}

function hasDefinedKey(record: JsonRecord, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function lineItemsAreUseful(lineItems: unknown[]): boolean {
  for (const rawItem of lineItems) {
    if (!isRecord(rawItem)) continue;
    if (asString(rawItem.description) !== null) return true;
  }
  return false;
}

function buildV2QuoteMathSource(
  extraction: JsonRecord,
  derivedMetrics: JsonRecord | null,
): V2QuoteMathSource | null {
  const quoteMath: V2QuoteMathSource = {};
  let useful = false;

  const rawLineItems = asArray(extraction.line_items);
  if (lineItemsAreUseful(rawLineItems)) {
    quoteMath.line_items = rawLineItems;
    useful = true;
  }

  if (hasDefinedKey(extraction, "contractor_name")) {
    quoteMath.contractor_name = asString(extraction.contractor_name);
    useful = true;
  }

  if (hasDefinedKey(extraction, "opening_count")) {
    quoteMath.opening_count = asNumber(extraction.opening_count);
    useful = true;
  }

  if (hasDefinedKey(extraction, "total_quoted_price")) {
    quoteMath.total_quoted_price = asNumber(extraction.total_quoted_price);
    useful = true;
  }

  const totals = derivedMetrics ? getRecord(derivedMetrics, "totals") : null;
  if (totals && hasDefinedKey(totals, "contract_total")) {
    quoteMath.derived_totals = { contract_total: asNumber(totals.contract_total) };
    useful = true;
  }

  return useful ? quoteMath : null;
}

function buildV2ChangeOrderSource(extraction: JsonRecord): V2ChangeOrderSource | null {
  const changeOrder: V2ChangeOrderSource = {};
  let useful = false;

  const stringKeys = ["change_order_policy_text", "substrate_allowance_text"] as const;
  for (const key of stringKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    changeOrder[key] = asTrimmedStringField(extraction[key]);
    useful = true;
  }

  const booleanKeys = [
    "written_change_order_required",
    "homeowner_approval_required_for_change_orders",
    "unilateral_price_adjustment_allowed",
    "substrate_condition_clause_present",
    "rot_unit_pricing_present",
    "buck_replacement_unit_pricing_present",
    "remeasure_price_adjustment_cap_present",
  ] as const;
  for (const key of booleanKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    changeOrder[key] = asBooleanOrNull(extraction[key]);
    useful = true;
  }

  return useful ? changeOrder : null;
}

function buildV2ScopeGapInstallationSource(
  installation: JsonRecord,
): V2ScopeGapInstallationSource | null {
  const installationOut: V2ScopeGapInstallationSource = {};
  let useful = false;

  if (hasDefinedKey(installation, "scope_detail")) {
    installationOut.scope_detail = asTrimmedStringField(installation.scope_detail);
    useful = true;
  }
  if (hasDefinedKey(installation, "disposal_included")) {
    installationOut.disposal_included = asBooleanOrNull(installation.disposal_included);
    useful = true;
  }

  return useful ? installationOut : null;
}

function buildV2ScopeGapPermitsSource(permits: JsonRecord): V2ScopeGapPermitsSource | null {
  const permitsOut: V2ScopeGapPermitsSource = {};
  let useful = false;

  if (hasDefinedKey(permits, "included")) {
    permitsOut.included = asBooleanOrNull(permits.included);
    useful = true;
  }
  if (hasDefinedKey(permits, "responsible_party")) {
    permitsOut.responsible_party = asTrimmedStringField(permits.responsible_party);
    useful = true;
  }
  if (hasDefinedKey(permits, "details")) {
    permitsOut.details = asTrimmedStringField(permits.details);
    useful = true;
  }

  return useful ? permitsOut : null;
}

function buildV2ScopeGapSource(extraction: JsonRecord): V2ScopeGapSource | null {
  const scopeGap: V2ScopeGapSource = {};
  let useful = false;

  const booleanKeys = [
    "debris_removal_included",
    "rot_unit_pricing_present",
    "substrate_condition_clause_present",
    "stucco_repair_included",
    "post_install_stucco_excluded",
    "permit_fees_itemized",
  ] as const;

  for (const key of booleanKeys) {
    if (!hasDefinedKey(extraction, key)) continue;
    scopeGap[key] = asBooleanOrNull(extraction[key]);
    useful = true;
  }

  if (hasDefinedKey(extraction, "substrate_allowance_text")) {
    scopeGap.substrate_allowance_text = asTrimmedStringField(
      extraction.substrate_allowance_text,
    );
    useful = true;
  }
  if (hasDefinedKey(extraction, "waterproofing_method_text")) {
    scopeGap.waterproofing_method_text = asTrimmedStringField(
      extraction.waterproofing_method_text,
    );
    useful = true;
  }
  if (hasDefinedKey(extraction, "wall_repair_scope")) {
    scopeGap.wall_repair_scope = asTrimmedStringField(extraction.wall_repair_scope);
    useful = true;
  }

  const installation = getRecord(extraction, "installation");
  if (installation) {
    const installationOut = buildV2ScopeGapInstallationSource(installation);
    if (installationOut) {
      scopeGap.installation = installationOut;
      useful = true;
    }
  }

  const permits = getRecord(extraction, "permits");
  if (permits) {
    const permitsOut = buildV2ScopeGapPermitsSource(permits);
    if (permitsOut) {
      scopeGap.permits = permitsOut;
      useful = true;
    }
  }

  return useful ? scopeGap : null;
}

/** Curated V2 projection from authorized row full_json only (not raw full_json export). */
function buildV2SourceProjection(row: JsonRecord): V2SourceProjection | null {
  const fullJson = row.full_json;
  if (!isRecord(fullJson)) return null;

  const extraction = getRecord(fullJson, "extraction");
  if (!extraction) return null;

  const derivedMetrics = getRecord(fullJson, "derived_metrics");

  const quoteMath = buildV2QuoteMathSource(extraction, derivedMetrics);
  const changeOrder = buildV2ChangeOrderSource(extraction);
  const scopeGap = buildV2ScopeGapSource(extraction);

  if (!quoteMath && !changeOrder && !scopeGap) {
    return null;
  }

  const projection: V2SourceProjection = {};
  if (quoteMath) projection.quote_math = quoteMath;
  if (changeOrder) projection.change_order = changeOrder;
  if (scopeGap) projection.scope_gap = scopeGap;

  return projection;
}

/** Attach v2_source fields only when projection is useful (authorized full path only). */
function withV2SourceOnAuthorizedFullData(
  row: JsonRecord,
): JsonRecord {
  const v2Source = buildV2SourceProjection(row);
  if (!v2Source) return row;
  return {
    ...row,
    v2_source_version: V2_SOURCE_VERSION,
    v2_source: v2Source,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ ok: false, error: "Invalid request" }, 405);
  }

  // ── Parse body ──────────────────────────────────────────────────────────────

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  const params = body as Record<string, unknown>;
  const mode = params.mode;
  const scanSessionId = params.scan_session_id;

  // ── Validate mode ───────────────────────────────────────────────────────────

  if (mode !== "preview" && mode !== "full") {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  // ── Validate scan_session_id ────────────────────────────────────────────────

  if (typeof scanSessionId !== "string" || !UUID_RE.test(scanSessionId)) {
    return json({ ok: false, error: "Invalid request" }, 400);
  }

  // ── Validate phone_e164 for full mode ───────────────────────────────────────

  if (mode === "full") {
    const phone = params.phone_e164;
    if (typeof phone !== "string" || !E164_RE.test(phone.trim())) {
      return json({ ok: false, error: "Invalid request" }, 400);
    }
  }

  // ── Service-role client ─────────────────────────────────────────────────────
  // Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from Supabase-managed env.
  // These are never read from the request or exposed in any response.

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    // Missing env is a deployment configuration error, not a client error.
    console.error("[report-access] Missing required environment variables");
    return json({ ok: false, error: "Report processing failed" }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // ── Preview mode ──────────────────────────────────────────────────────────────

  if (mode === "preview") {
    try {
      const { data: rows, error: rpcErr } = await supabase.rpc(
        "get_analysis_preview",
        { p_scan_session_id: scanSessionId },
      );

      if (rpcErr) {
        console.error(
          "[report-access] get_analysis_preview RPC error:",
          rpcErr.message,
        );
        return json({ ok: false, error: "Report processing failed" }, 500);
      }

      const row: Record<string, unknown> | null = Array.isArray(rows)
        ? (rows[0] ?? null)
        : (rows as Record<string, unknown> | null) ?? null;

      if (!row || typeof row.grade !== "string" || !row.grade) {
        return json({ ok: false, error: "Report not found" }, 404);
      }

      // Belt-and-suspenders: get_analysis_preview does not return full_json,
      // but strip it defensively in case the RPC definition ever changes.
      const { full_json: _fullJsonStripped, ...safeRow } = row;

      return json({ ok: true, mode: "preview", data: safeRow });
    } catch (err) {
      console.error(
        "[report-access] preview exception:",
        err instanceof Error ? err.message : String(err),
      );
      return json({ ok: false, error: "Report processing failed" }, 500);
    }
  }

  // ── Full mode ─────────────────────────────────────────────────────────────────

  const phoneE164 = (params.phone_e164 as string).trim();

  try {
    // supabase.rpc is untyped in Edge Functions (no Database generic here);
    // cast to any is consistent with the pattern used in compare-quotes and
    // generate-negotiation-script for this same RPC.
    const { data: rows, error: rpcErr } = await (supabase.rpc as (
      fn: string,
      args: Record<string, string>,
    ) => ReturnType<typeof supabase.rpc>)(
      "get_analysis_full",
      { p_scan_session_id: scanSessionId, p_phone_e164: phoneE164 },
    );

    if (rpcErr) {
      console.error(
        "[report-access] get_analysis_full RPC error:",
        rpcErr.message,
      );
      return json({ ok: false, error: "Report processing failed" }, 500);
    }

    const row: Record<string, unknown> | null = Array.isArray(rows)
      ? (rows[0] ?? null)
      : (rows as Record<string, unknown> | null) ?? null;

    if (!row || typeof row.grade !== "string" || !row.grade) {
      return json({ ok: false, error: "Report not found" }, 404);
    }

    // Backend sentinel: phone/session mismatch or phone not yet verified.
    if (row.grade === "__UNAUTHORIZED__") {
      return json({
        ok: true,
        mode: "full",
        authorized: false,
        locked: true,
        reason: "unauthorized",
      });
    }

    return json({
      ok: true,
      mode: "full",
      authorized: true,
      data: withV2SourceOnAuthorizedFullData(row),
    });
  } catch (err) {
    console.error(
      "[report-access] full exception:",
      err instanceof Error ? err.message : String(err),
    );
    return json({ ok: false, error: "Report processing failed" }, 500);
  }
});
