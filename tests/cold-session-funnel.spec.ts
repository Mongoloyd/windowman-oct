/**
 * Cold-Session Homepage Funnel — Narrow Smoke Coverage
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Locks in the three flows that have repeatedly passed in clean/incognito
 * sessions, so the next silent regression surfaces in CI, not in front of a
 * homeowner. INTENTIONALLY NARROW. Does NOT touch:
 *   - scanner / extraction / scoring logic
 *   - storage internals
 *   - OTP send/verify (no real Twilio delivery in CI)
 *   - admin / GTM / contractor portal
 *   - production RLS posture
 *
 * Each test:
 *   - runs in a fresh `browser.newContext()` (no cookies, no localStorage)
 *   - uses a unique `wm-smoke-<ts>-<rand>@windowman-test.local` marker so no
 *     prior database row can satisfy assertions
 *   - captures trace + screenshot on failure
 *   - cleans up its row after asserting (best-effort)
 *
 * DB assertions go through `tests/helpers/supabaseAdmin.ts`, which uses the
 * service-role secret read from the Playwright Node process env. That secret
 * MUST never be `VITE_*`, never imported from `src/`, never bundled. If the
 * secret is absent (local dev), each test skips with one explanatory log line.
 */

import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import {
  getAdminClient,
  getLeadByEmail,
  getQuoteFilesForLead,
  getScanSessionsForLead,
  cleanupTestLead,
  SKIP_REASON,
} from "./helpers/supabaseAdmin";

// ── Capture trace + screenshot on failure for the entire file ─────────────
test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

// ── Unique marker per test ────────────────────────────────────────────────
function uniqueEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `wm-smoke-${ts}-${rand}@windowman-test.local`;
}

// Twilio "magic" test number — Lookup accepts as valid mobile, never delivers
// a real SMS. We don't invoke send-otp in these smokes anyway; this number is
// only used to populate the optional phone field in TruthGate.
const QA_PHONE_INPUT = "(500) 555-0006";
const QA_PHONE_E164 = "+15005550006";

// ── Walk TruthGate's 4 quiz steps + the lead form ─────────────────────────
async function completeTruthGate(page: Page, opts: { email: string; phone?: string }) {
  await page.goto("/");
  // TruthGate is rendered below the hero; ensure it's mounted.
  await page.waitForSelector("#truth-gate", { state: "attached", timeout: 15_000 });

  // Step 1: window count tile — click first option
  await page.locator("#truth-gate button").first().click();

  // Steps 2-4 each render a fresh set of option buttons. The active step is
  // re-rendered as a single motion.div, so we wait for the next visible
  // option set and click the first one. Three transitions total.
  for (let i = 0; i < 3; i++) {
    // Wait for a non-disabled option button under #truth-gate (excluding the
    // form submit which only appears at step 5).
    await page.waitForTimeout(450); // motion + autoadvance ~300ms
    const buttons = page.locator("#truth-gate button:not([type='submit'])");
    await buttons.first().waitFor({ state: "visible", timeout: 5_000 });
    await buttons.first().click();
  }

  // Step 5: lead form. There's a "loading → estimate → done" transition
  // (~2s) before the form mounts.
  const firstNameInput = page.locator("input[autocomplete='given-name']");
  await firstNameInput.waitFor({ state: "visible", timeout: 8_000 });

  await firstNameInput.fill("SmokeTest");
  await page.locator("input[type='email']").fill(opts.email);
  if (opts.phone) {
    await page.locator("input[type='tel']").fill(opts.phone);
  }

  await page.getByRole("button", { name: /Upload My Quote/i }).click();

  // Submit success → UploadZone becomes visible. UploadZone renders a
  // dropzone with the heading "Drop your quote to start the scan."
  await expect(
    page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
  ).toBeVisible({ timeout: 10_000 });
}

// ═════════════════════════════════════════════════════════════════════════
// TEST 1 — Email-only partial review
// ═════════════════════════════════════════════════════════════════════════
// Proves: the email-only path creates a real `leads` row with NO phone, and
// the UI advances to UploadZone. This is the exact path a homeowner takes
// when they're not ready to share a number.
test("cold session: email-only TruthGate creates lead with null phone and reveals UploadZone", async ({
  browser,
}) => {
  test.skip(getAdminClient() === null, SKIP_REASON);

  const email = uniqueEmail();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await completeTruthGate(page, { email });

    // Settle the async lead insert (TruthGate awaits it before flipping
    // submitState to "success", but the UI advance and the DB write are
    // independent — give the row a beat to be queryable).
    await page.waitForTimeout(1_500);

    const lead = await getLeadByEmail(email);
    expect(lead, `expected a leads row for unique email ${email}`).not.toBeNull();
    expect(lead!.email).toBe(email);
    expect(lead!.phone_e164).toBeNull();
    expect(lead!.source).toBe("truth-gate");
  } finally {
    await ctx.close();
    await cleanupTestLead(email);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// TEST 2 — Email + phone partial review
// ═════════════════════════════════════════════════════════════════════════
// Proves: the email+phone path normalizes the phone to E.164 and persists
// it on the leads row. Does NOT invoke send-otp or verify-otp — so no real
// Twilio delivery happens in CI.
test("cold session: email+phone TruthGate persists phone in E.164 form and reveals UploadZone", async ({
  browser,
}) => {
  test.skip(getAdminClient() === null, SKIP_REASON);

  const email = uniqueEmail();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await completeTruthGate(page, { email, phone: QA_PHONE_INPUT });
    await page.waitForTimeout(1_500);

    const lead = await getLeadByEmail(email);
    expect(lead, `expected a leads row for unique email ${email}`).not.toBeNull();
    expect(lead!.email).toBe(email);
    expect(lead!.phone_e164).toBe(QA_PHONE_E164);
  } finally {
    await ctx.close();
    await cleanupTestLead(email);
  }
});

// ═════════════════════════════════════════════════════════════════════════
// TEST 3 — Upload smoke
// ═════════════════════════════════════════════════════════════════════════
// Proves: from a cold session, the canonical scan path initiates correctly:
//   UploadZone visible → file selection succeeds → quote_files row exists →
//   scan_sessions row exists, both bound to the lead created by TruthGate.
// Does NOT assert on final analysis completion or grade generation — that
// depends on Gemini latency and is out of scope for a smoke.
test("cold session: upload smoke creates quote_files and scan_sessions for the lead", async ({
  browser,
}) => {
  test.skip(getAdminClient() === null, SKIP_REASON);

  const email = uniqueEmail();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const fixturePath = path.resolve(__dirname, "fixtures/sample-quote.png");

  try {
    await completeTruthGate(page, { email });

    // The hidden file input is `display:none`; setInputFiles bypasses the
    // dropzone click and feeds the file straight to UploadZone's handler.
    const fileInput = page.locator("input[type='file'][accept*='pdf']");
    await fileInput.waitFor({ state: "attached", timeout: 5_000 });
    await fileInput.setInputFiles(fixturePath);

    // Confirm file selection succeeded (UploadZone renders the file name).
    await expect(page.getByText("sample-quote.png")).toBeVisible({ timeout: 5_000 });

    // Click "Start My AI Scan" to trigger storage.upload + quote_files +
    // scan_sessions inserts.
    await page.getByRole("button", { name: /Start My AI Scan/i }).click();

    // The button label flips to "Uploading..." then "Scanning..." once the
    // scan_session is created. Wait for either label as proof the UI has
    // advanced out of the raw upload-pending state.
    await expect(
      page.getByRole("button", { name: /Uploading|Scanning/i }),
    ).toBeVisible({ timeout: 15_000 });

    // Resolve the lead created by TruthGate, then assert the canonical
    // scan rows exist for it. Poll for up to ~12s — quote_files +
    // scan_sessions inserts happen sequentially after storage upload.
    const lead = await getLeadByEmail(email);
    expect(lead, `expected a leads row for unique email ${email}`).not.toBeNull();

    let qf = { count: 0, firstId: null as string | null };
    let ss = { count: 0, firstId: null as string | null };
    for (let i = 0; i < 12; i++) {
      qf = await getQuoteFilesForLead(lead!.id);
      ss = await getScanSessionsForLead(lead!.id);
      if (qf.count > 0 && ss.count > 0) break;
      await page.waitForTimeout(1_000);
    }

    expect(qf.count, "expected at least one quote_files row for the lead").toBeGreaterThan(0);
    expect(ss.count, "expected at least one scan_sessions row for the lead").toBeGreaterThan(0);
  } finally {
    await ctx.close();
    await cleanupTestLead(email);
  }
});
