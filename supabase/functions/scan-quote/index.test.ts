// deno-lint-ignore no-import-prefix
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import {
  assert,
  assertEquals,
  assertExists,
  // deno-lint-ignore no-import-prefix
} from "https://deno.land/std@0.224.0/assert/mod.ts";
// deno-lint-ignore no-import-prefix
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  computeGrade,
  type ExtractionResult,
  GRADE_THRESHOLDS,
  letterGrade,
} from "./scoring.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/scan-quote`;

type PersistedAnalysis = {
  scan_session_id: string;
  analysis_status: string;
  grade: string | null;
  proof_of_read: unknown;
  preview_json: unknown;
  full_json: unknown;
};

type PersistedSession = {
  id: string;
  status: string;
};

function anonClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function serviceRoleClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function buildTextPdf(text: string): Uint8Array {
  const streamContent = `BT /F1 12 Tf 72 720 Td (${
    text.replace(/[()\\]/g, "\\$&").replace(/\n/g, ") Tj T* (")
  }) Tj ET`;
  const stream = new TextEncoder().encode(streamContent);

  const objects = [
    `1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj`,
    `2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj`,
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj`,
    `4 0 obj<</Length ${stream.length}>>stream\n${
      new TextDecoder().decode(stream)
    }\nendstream endobj`,
    `5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj`,
  ];

  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (const obj of objects) {
    offsets.push(body.length);
    body += obj + "\n";
  }
  const xrefOffset = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    body += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer<</Size ${
    objects.length + 1
  }/Root 1 0 R>>\nstartxref\n${xrefOffset}\n%%EOF`;
  return new TextEncoder().encode(body);
}

async function setupTestSession(fileContent: Uint8Array, fileName: string) {
  const supabase = anonClient();
  const sessionTag = crypto.randomUUID();
  const storagePath = `test/${sessionTag}/${fileName}`;
  const quoteFileId = crypto.randomUUID();
  const scanSessionId = crypto.randomUUID();

  const contentType = fileName.endsWith(".pdf")
    ? "application/pdf"
    : "image/png";
  const { error: upErr } = await supabase.storage
    .from("quotes")
    .upload(storagePath, fileContent, { contentType });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);

  const { error: qfErr } = await supabase
    .from("quote_files")
    .insert({ id: quoteFileId, storage_path: storagePath, status: "pending" });
  if (qfErr) throw new Error(`quote_files insert failed: ${qfErr.message}`);

  const { error: ssErr } = await supabase
    .from("scan_sessions")
    .insert({
      id: scanSessionId,
      status: "uploading",
      quote_file_id: quoteFileId,
    });
  if (ssErr) throw new Error(`scan_sessions insert failed: ${ssErr.message}`);

  return { scanSessionId, quoteFileId, storagePath };
}

async function invokeScan(scanSessionId: string) {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ scan_session_id: scanSessionId }),
  });
  const respBody = await resp.json();
  return { status: resp.status, body: respBody };
}

async function fetchPersistedState(scanSessionId: string) {
  const supabase = serviceRoleClient();

  const [
    { data: rawAnalysis, error: analysisError },
    { data: rawSession, error: sessionError },
  ] = await Promise.all([
    supabase
      .from("analyses")
      .select(
        "scan_session_id, analysis_status, grade, proof_of_read, preview_json, full_json",
      )
      .eq("scan_session_id", scanSessionId)
      .maybeSingle(),
    supabase
      .from("scan_sessions")
      .select("id, status")
      .eq("id", scanSessionId)
      .single(),
  ]);

  if (analysisError) {
    throw new Error(`analyses fetch failed: ${analysisError.message}`);
  }
  if (sessionError) {
    throw new Error(`scan_sessions fetch failed: ${sessionError.message}`);
  }

  return {
    analysis: rawAnalysis as PersistedAnalysis | null,
    session: rawSession as PersistedSession,
  };
}

function assertStoredFailureState(
  analysis: PersistedAnalysis | null,
  session: PersistedSession,
  expectedStatus: string,
) {
  assertExists(analysis, `Expected an analyses row for ${expectedStatus}`);
  assertEquals(analysis.analysis_status, expectedStatus);
  assertEquals(session.status, expectedStatus);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS (existing — require live Supabase)
// ═══════════════════════════════════════════════════════════════════════════════

Deno.test("valid quote → complete with grade", async () => {
  const quoteText = [
    "ACME Windows and Doors - Impact Window Quote",
    "Contractor: ACME Windows LLC",
    "Date: 2025-01-15",
    "HVHZ Zone: Yes",
    "Permit: Included handled by contractor",
    "Line Items:",
    "1. PGT WinGuard SGD 72x80 Impact Sliding Glass Door",
    "   Brand: PGT Series: WinGuard DP Rating: +50/-60",
    "   NOA: NOA 17-0501.09 Qty: 2 Unit Price: $2100 Total: $4200",
    "2. CGI Sentinel 36x48 Impact Single Hung Window",
    "   Brand: CGI Series: Sentinel DP Rating: +45/-55",
    "   NOA: NOA 11-0926.04 Qty: 8 Unit Price: $850 Total: $6800",
    "3. PGT WinGuard 60x36 Impact Picture Window",
    "   Brand: PGT Series: WinGuard DP Rating: +50/-60",
    "   NOA: NOA 17-0501.09 Qty: 3 Unit Price: $1200 Total: $3600",
    "Total: $19000",
    "Installation: full removal disposal trim county inspection",
    "Warranty: 10-year labor Lifetime manufacturer Transferable",
    "Cancellation: 3-day right of rescission per Florida statute",
  ].join("\n");
  const pdfBytes = buildTextPdf(quoteText);
  const { scanSessionId } = await setupTestSession(pdfBytes, "valid-quote.pdf");

  const { status, body } = await invokeScan(scanSessionId);
  const { analysis, session } = await fetchPersistedState(scanSessionId);
  console.log("Test 1:", JSON.stringify(body));

  assertEquals(status, 200);
  assertEquals(body.analysis_status, "complete");
  assertExists(analysis, "Expected an analyses row for a completed scan");
  assertEquals(analysis.scan_session_id, scanSessionId);
  assertEquals(analysis.analysis_status, "complete");
  assertExists(analysis.grade, "Expected grade to be stored");
  assertExists(analysis.proof_of_read, "Expected proof_of_read to be stored");
  assertExists(analysis.preview_json, "Expected preview_json to be stored");
  assertExists(analysis.full_json, "Expected full_json to be stored");
  assertEquals(session.status, "preview_ready");
  assertEquals(
    ["A", "B", "C", "D", "F"].includes(analysis.grade),
    true,
    `Expected A-F, got ${analysis.grade}`,
  );
  assertEquals(body.grade, analysis.grade);
});

Deno.test("invalid document → persisted invalid or low-confidence status", async () => {
  const receiptText = [
    "PUBLIX SUPERMARKET 1234 - Miami FL",
    "Bananas 3lb $1.47",
    "Whole Milk 1 Gal $4.29",
    "Chicken Breast 2lb $8.99",
    "Total: $14.75",
    "THANK YOU FOR SHOPPING AT PUBLIX",
  ].join("\n");
  const pdfBytes = buildTextPdf(receiptText);
  const { scanSessionId } = await setupTestSession(
    pdfBytes,
    "grocery-receipt.pdf",
  );

  const { status, body } = await invokeScan(scanSessionId);
  const { analysis, session } = await fetchPersistedState(scanSessionId);
  console.log("Test 2:", JSON.stringify(body));

  assertEquals(status, 200);
  const expectedStatus = body.analysis_status;
  assert(
    expectedStatus === "invalid_document" ||
      expectedStatus === "needs_better_upload",
  );
  assertStoredFailureState(analysis, session, expectedStatus);
});

Deno.test("garbled content → persisted controlled failure state", async () => {
  const garbage = new Uint8Array(512);
  crypto.getRandomValues(garbage);
  const { scanSessionId } = await setupTestSession(garbage, "garbled.png");

  const { status, body } = await invokeScan(scanSessionId);
  const { analysis, session } = await fetchPersistedState(scanSessionId);
  console.log("Test 3:", JSON.stringify(body));

  assertEquals(status, 200);
  const expectedStatus = body.analysis_status;
  assert(
    expectedStatus === "invalid_document" ||
      expectedStatus === "needs_better_upload",
  );
  assertStoredFailureState(analysis, session, expectedStatus);
});

Deno.test("missing scan_session_id → 400", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({}),
  });
  const respBody = await resp.text();
  assertEquals(resp.status, 400);
  console.log("Test 4:", respBody);
});

Deno.test("non-existent session → 404", async () => {
  const resp = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      scan_session_id: "00000000-0000-0000-0000-000000000000",
    }),
  });
  const respBody = await resp.text();
  assertEquals(resp.status, 404);
  console.log("Test 5:", respBody);
});

// ═══════════════════════════════════════════════════════════════════════════════
// THE BRAIN AUDIT — Pure Rubric Scoring Unit Tests (no network, no Supabase)
// ═══════════════════════════════════════════════════════════════════════════════

/** A fully-specified, best-case quote fixture. */
function perfectQuote(): ExtractionResult {
  return {
    document_type: "window_quote",
    is_window_door_related: true,
    confidence: 0.95,
    page_count: 3,
    total_quoted_price: 18500,
    opening_count: 8,
    contractor_name: "ABC Impact Windows LLC",
    hvhz_zone: true,
    // ── Glass package fields (Area 1) ──────────────────────────────────────
    opening_level_glass_specs_present: true,
    blanket_glass_language_present: false,
    mixed_glass_package_visibility: false,
    // ── Opening scope fields (Area 2) ──────────────────────────────────────
    opening_schedule_present: true,
    opening_schedule_room_labels_present: true,
    opening_schedule_dimensions_complete: true,
    opening_schedule_product_assignments_present: true,
    bulk_scope_blob_present: false,
    // ── Scope-gap fields ───────────────────────────────────────────────────
    wall_repair_scope: "Stucco patch and paint touch-up included",
    stucco_repair_included: true,
    drywall_repair_included: true,
    paint_touchup_included: true,
    debris_removal_included: true,
    engineering_mentioned: true,
    engineering_fees_included: true,
    permit_fees_itemized: true,
    // ── Trust signals ──────────────────────────────────────────────────────
    insurance_proof_mentioned: true,
    licensing_proof_mentioned: true,
    completion_timeline_text: "8-12 weeks from permit approval",
    lead_paint_disclosure_present: true,
    // ── Payment fields ─────────────────────────────────────────────────────
    payment_schedule_text:
      "10% deposit, 40% at material delivery, 50% on completion",
    deposit_percent: 10,
    subject_to_remeasure_present: false,
    final_payment_before_inspection: false,
    // ── Fine-print fields ──────────────────────────────────────────────────
    terms_conditions_present: true,
    generic_product_description_present: false,
    // ── Change-order / substrate fields ──────────────────────────────────
    written_change_order_required: true,
    homeowner_approval_required_for_change_orders: true,
    unilateral_price_adjustment_allowed: false,
    substrate_condition_clause_present: false,
    remeasure_price_adjustment_cap_present: false,
    // ── Installation method / anchoring fields (Area 4) ──────────────────
    anchoring_method_text: "Tapcon concrete anchors",
    anchor_spacing_specified: true,
    fastener_type_specified: true,
    waterproofing_method_text: "DAP Silicone Plus flashing and weep system",
    sealant_specified: true,
    buck_treatment_method_text: "Pressure-treated 2x4 buck with Boral wrap",
    manufacturer_install_compliance_stated: true,
    code_compliance_install_statement_present: true,
    // ── Warranty execution fields (Area 5) ──────────────────────────────────
    warranty_execution_details_present: true,
    warranty_service_provider_type: "contractor",
    warranty_service_provider_name: "WindowMan Pro Services",
    leak_callback_sla_days: 3,
    labor_service_sla_days: 5,
    callback_process_text:
      "Call main office, technician dispatched within 72 hours",
    post_install_stucco_excluded: false,
    post_install_paint_excluded: false,
    water_intrusion_damage_excluded: false,
    line_items: [
      {
        description: "Impact hurricane-rated sliding glass door",
        quantity: 1,
        unit_price: 2800,
        total_price: 2800,
        brand: "PGT",
        series: "WinGuard",
        dp_rating: "DP50",
        noa_number: "NOA-21-1234",
        glass_makeup_type: "insulated_laminated",
        glass_low_e_present: true,
        glass_argon_present: true,
        glass_spec_complete: true,
        opening_location: "Living Room - East Wall",
        opening_tag: "D1",
        product_assignment_text: "PGT WinGuard 770 Sliding Glass Door 72x80",
      },
      {
        description: "Impact hurricane single-hung window",
        quantity: 7,
        unit_price: 1500,
        total_price: 10500,
        brand: "PGT",
        series: "WinGuard",
        dp_rating: "DP40",
        noa_number: "NOA-21-5678",
        glass_makeup_type: "insulated_laminated",
        glass_low_e_present: true,
        glass_argon_present: true,
        glass_spec_complete: true,
        opening_location: "Master Bedroom - South Wall",
        opening_tag: "W1-W7",
        product_assignment_text: "PGT WinGuard 7200 Single Hung 36x60",
      },
    ],
    warranty: {
      labor_years: 5,
      manufacturer_years: 10,
      transferable: true,
      details: "Full manufacturer and labor warranty included",
    },
    permits: {
      included: true,
      responsible_party: "contractor",
      details: "All permits included",
    },
    installation: {
      scope_detail: "Full removal and replacement with stucco patch",
      disposal_included: true,
      accessories_mentioned: true,
    },
    cancellation_policy: "Full refund within 3 business days",
  };
}

// ── Brain Test 1: Perfect A grade ────────────────────────────────────────────

Deno.test("BRAIN: assigns grade A for a flawless impact window quote", () => {
  const result = computeGrade(perfectQuote());
  assertEquals(result.letterGrade, "A");
  assertEquals(result.hardCapApplied, null);
  assertEquals(result.pillarScores.safety >= GRADE_THRESHOLDS.A, true);
  assertEquals(result.weightedAverage >= GRADE_THRESHOLDS.A, true);
});

// ── Brain Test 2: Grade F for empty quote ────────────────────────────────────

Deno.test("BRAIN: assigns grade F with zero_line_items hard cap for empty quote", () => {
  const result = computeGrade({
    document_type: "unknown",
    is_window_door_related: false,
    confidence: 0.3,
    line_items: [],
  });
  assertEquals(result.letterGrade, "F");
  assertEquals(result.hardCapApplied, "zero_line_items");
});

// ── Brain Test 3: No warranty → max C ────────────────────────────────────────

Deno.test("BRAIN: caps grade at C when warranty section is missing", () => {
  const quote = perfectQuote();
  delete quote.warranty;
  const result = computeGrade(quote);

  assertEquals(
    ["A", "B"].includes(result.letterGrade),
    false,
    `Expected C or below, got ${result.letterGrade}`,
  );
  assertEquals(result.hardCapApplied?.includes("no_warranty_section"), true);
});

// ── Brain Test 4: No impact products → max D ────────────────────────────────

Deno.test("BRAIN: caps grade at D when no line item mentions impact/hurricane/storm", () => {
  const quote = perfectQuote();
  quote.line_items = quote.line_items.map((item) => ({
    ...item,
    description: "Standard vinyl single-hung window",
    dp_rating: undefined,
    noa_number: undefined,
  }));
  const result = computeGrade(quote);

  assertEquals(
    ["A", "B", "C"].includes(result.letterGrade),
    false,
    `Expected D or F, got ${result.letterGrade} (hardCap: ${result.hardCapApplied})`,
  );
  assertEquals(
    result.hardCapApplied?.includes("unverified_impact_specs") ||
      result.hardCapApplied?.includes("critical_safety"),
    true,
    `Expected hardcap containing unverified_impact_specs or critical_safety, got: ${result.hardCapApplied}`,
  );
});

// ── Brain Test 5: Dirty OCR data resilience ──────────────────────────────────

Deno.test("BRAIN: handles corrupted/null OCR fields without crashing", () => {
  const corruptedData = {
    document_type: "unknown",
    is_window_door_related: true,
    confidence: "not a number" as unknown as number,
    line_items: null as unknown as ExtractionResult["line_items"],
    warranty: undefined,
    permits: undefined,
    installation: undefined,
    hvhz_zone: undefined,
    total_quoted_price: undefined,
    cancellation_policy: undefined,
  } as ExtractionResult;

  let result: ReturnType<typeof computeGrade> | undefined;
  try {
    result = computeGrade(corruptedData);
  } catch (e) {
    throw new Error(`computeGrade crashed on dirty data: ${e}`);
  }

  assertExists(result);
  assertExists(result.letterGrade);
  assertEquals(result.letterGrade, "F");
  assertEquals(result.hardCapApplied, "zero_line_items");
});

// ── Brain Test 6: Idempotency ────────────────────────────────────────────────

Deno.test("BRAIN: produces identical output across 100 runs", () => {
  const baseline = computeGrade(perfectQuote());
  for (let i = 0; i < 100; i++) {
    const run = computeGrade(perfectQuote());
    assertEquals(
      run.letterGrade,
      baseline.letterGrade,
      `Run ${i}: grade drift`,
    );
    assertEquals(
      run.weightedAverage,
      baseline.weightedAverage,
      `Run ${i}: score drift`,
    );
    assertEquals(
      run.hardCapApplied,
      baseline.hardCapApplied,
      `Run ${i}: hardCap drift`,
    );
  }
});

// ── Brain Test 7: Threshold boundaries ───────────────────────────────────────

Deno.test("BRAIN: letterGrade boundary precision at every threshold", () => {
  assertEquals(letterGrade(88), "A");
  assertEquals(letterGrade(87.99), "B");
  assertEquals(letterGrade(70), "B");
  assertEquals(letterGrade(69.99), "C");
  assertEquals(letterGrade(52), "C");
  assertEquals(letterGrade(51.99), "D");
  assertEquals(letterGrade(37), "D");
  assertEquals(letterGrade(36.99), "F");
  assertEquals(letterGrade(0), "F");
});
