/**
 * Prophecy funnel — synthetic local/non-production Playwright journeys.
 *
 * Environment gate: refuses state-changing journeys unless the page under test
 * and Supabase endpoints resolve to localhost/127.0.0.1 (or a clearly labeled
 * non-production host). No production PII, phones, or service-role browser use.
 *
 * DB lead-row reads use the existing Node-only supabaseAdmin helper when the
 * service-role key is present; otherwise the suite records
 * NEEDS_RUNTIME_VERIFICATION without inventing a privileged browser query.
 *
 * Run locally with:
 * npx playwright test -c playwright.prophecy.config.ts tests/prophecy-funnel.spec.ts
 */

import { test, expect, type Page, type Request, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cleanupTestLead,
  getAdminClient,
  getLeadByEmail,
  SKIP_REASON,
} from "./helpers/supabaseAdmin";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(SPEC_DIR, "fixtures", "sample-quote.png");
const PROPHECY_STATIC_HTML = path.resolve(
  SPEC_DIR,
  "../dist/prophecy/index.html",
);
const RESUME_KEY = "wm_prophecy_upload_resume_v1";
const QA_PHONE = "(500) 555-0006";
const hasExplicitLocalAdminProof = Boolean(
  process.env.PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY,
);
const ATTR =
  "?utm_source=prophecy_e2e&utm_medium=test&utm_campaign=prophecy_runtime&wm_client_slug=prophecy-e2e";

function uniqueEmail(tag: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const email = `wm-smoke-prophecy-${tag}-${ts}-${rand}@windowman-test.local`;
  testEmails.add(email);
  return email;
}

const testEmails = new Set<string>();

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function assertNonProductionEnvironment(page: Page): Promise<void> {
  const base =
    test.info().project.use.baseURL ??
    process.env.PLAYWRIGHT_BASE_URL ??
    page.url() ??
    "";
  let pageHost = "";
  try {
    pageHost = new URL(base || "http://127.0.0.1:8080").hostname;
  } catch {
    throw new Error("BLOCKED_UNKNOWN_ENVIRONMENT: could not parse page base URL");
  }

  if (!isLocalHost(pageHost)) {
    throw new Error(
      `BLOCKED_UNKNOWN_ENVIRONMENT: page host "${pageHost}" is not permitted — this suite runs only against local hosts (localhost / 127.0.0.1)`,
    );
  }

  const envHints = [
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ].filter((value): value is string => Boolean(value));
  if (envHints.length === 0) {
    throw new Error(
      "BLOCKED_UNKNOWN_ENVIRONMENT: could not prove Supabase host (set SUPABASE_URL/VITE_SUPABASE_URL or use playwright.prophecy.config.ts for the local stack)",
    );
  }

  // This sprint authorizes the disposable local stack only. A remote preview
  // needs a separately identified and approved Supabase project.
  for (const envHint of envHints) {
    let configuredSupabaseHost = "";
    try {
      configuredSupabaseHost = new URL(envHint).hostname;
    } catch {
      throw new Error("BLOCKED_UNKNOWN_ENVIRONMENT: invalid Supabase URL in env");
    }

    if (!isLocalHost(configuredSupabaseHost)) {
      throw new Error(
        `BLOCKED_UNKNOWN_ENVIRONMENT: Supabase host "${configuredSupabaseHost}" is not the disposable local stack`,
      );
    }
  }

  // Defense in depth: even if an already-running Vite server was built with a
  // different env, abort any Supabase request that does not stay local before
  // it can mutate data.
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isSupabaseTraffic =
      requestUrl.port === "54321" ||
      requestUrl.hostname.includes("supabase") ||
      /\/(?:functions|storage|rest|auth|realtime)\/v1\//.test(requestUrl.pathname);

    if (isSupabaseTraffic && !isLocalHost(requestUrl.hostname)) {
      await route.abort("blockedbyclient");
      throw new Error(
        `BLOCKED_UNKNOWN_ENVIRONMENT: browser attempted Supabase request to non-local host "${requestUrl.hostname}"`,
      );
    }

    await route.fallback();
  });
}

/**
 * Deterministic scan-backend mocks for local runs where the scanner Edge
 * Function or its downstream AI/OCR provider lacks the API keys required to
 * produce a "valid estimate" outcome from a synthetic fixture.
 *
 * The mocks preserve the canonical Verify-to-Reveal boundary:
 *   • scan-quote returns a "valid" preview_ready envelope (no analysis body).
 *   • get_scan_status returns a non-terminal preview-ready status so
 *     useAnalysisData proceeds to the preview fetch instead of a terminal
 *     fallback.
 *   • report-access returns a safe preview envelope for mode:"preview" and
 *     the unauthorized envelope for any mode:"full" attempt. The preview
 *     payload NEVER contains "full_json".
 *
 * Registered after assertNonProductionEnvironment's catch-all `**\/*` route,
 * so these specific handlers match first (Playwright dispatches routes in
 * reverse registration order).
 */
async function installDeterministicScanBackend(page: Page): Promise<void> {
  await page.route("**/functions/v1/scan-quote", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        analysis_status: "complete",
        scan_session_status: "preview_ready",
        grade: "C",
      }),
    });
  });

  await page.route("**/rest/v1/rpc/get_scan_status", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ status: "preview_ready" }]),
    });
  });

  await page.route("**/functions/v1/report-access", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    let mode = "preview";
    try {
      const parsed = route.request().postDataJSON() as { mode?: unknown } | null;
      if (parsed && typeof parsed.mode === "string") {
        mode = parsed.mode;
      }
    } catch {
      // treat unparseable bodies as preview requests
    }
    if (mode === "full") {
      // Verify-to-Reveal invariant: pre-OTP full requests must never receive
      // full_json. Return the canonical unauthorized envelope instead.
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, authorized: false, mode: "full" }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        mode: "preview",
        data: {
          analysis_id: "00000000-0000-4000-8000-00000000ab01",
          grade: "C",
          flag_count: 2,
          flag_red_count: 0,
          flag_amber_count: 2,
          proof_of_read: {
            classification: "estimate",
            vendor: "ABC Impact Windows & Roofing LLC",
          },
          preview_json: {
            headline: "Preview only — verify to reveal",
          },
          confidence_score: 0.72,
          document_type: "estimate",
          rubric_version: "prophecy-e2e-fixture-v1",
        },
      }),
    });
  });
}

async function acceptConsentIfPresent(page: Page): Promise<void> {
  const accept = page.getByRole("button", { name: "Accept" });
  if (await accept.isVisible().catch(() => false)) {
    await accept.click();
  }
}

async function openNoQuoteIntake(page: Page): Promise<void> {
  await page.getByRole("button", { name: /I don't have an estimate yet/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function openHasQuoteIntake(page: Page): Promise<void> {
  await page.getByRole("button", { name: /I've got an estimate in hand/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

async function fillZipAndContinue(page: Page, zip = "33301"): Promise<void> {
  await page.locator("#prophecy-zip").fill(zip);
  await page.getByRole("button", { name: /^Continue$/i }).click();
}

async function completeNoQuoteExtras(page: Page): Promise<void> {
  // Openings/priority use radio semantics inside the intake skin.
  await page.getByRole("radio", { name: "1–5" }).click();
  await page.getByRole("radio", { name: "Not overpaying" }).click();
}

async function fillContactAndSubmit(
  page: Page,
  opts: { email: string; hasQuote: boolean },
): Promise<void> {
  await page.locator("#prophecy-first-name").fill("ProphecyTest");
  await page.locator("#prophecy-phone").fill(QA_PHONE);
  await page.locator("#prophecy-email").fill(opts.email);
  const submit = page.getByTestId("prophecy-intake-submit");
  await expect(submit).toContainText(
    opts.hasQuote ? /Continue To Upload/i : /Start My Free Check/i,
  );
  await submit.click();
}

function captureRequests(page: Page): {
  captures: Request[];
  responses: Response[];
  reportAccessResponses: Response[];
  all: Request[];
} {
  const captures: Request[] = [];
  const responses: Response[] = [];
  const reportAccessResponses: Response[] = [];
  const all: Request[] = [];
  page.on("request", (req) => {
    all.push(req);
    if (req.url().includes("capture-truth-gate-lead")) {
      captures.push(req);
    }
  });
  page.on("response", (res) => {
    if (res.url().includes("capture-truth-gate-lead")) {
      responses.push(res);
    }
    if (res.url().includes("/functions/v1/report-access")) {
      reportAccessResponses.push(res);
    }
  });
  return { captures, responses, reportAccessResponses, all };
}

test.describe("Prophecy funnel — environment and journeys", () => {
  test.afterEach(async ({}, testInfo) => {
    if (
      hasExplicitLocalAdminProof &&
      testInfo.status === testInfo.expectedStatus
    ) {
      for (const email of testEmails) {
        await cleanupTestLead(email);
      }
    }
    testEmails.clear();
  });

  test("environment gate fails closed without local Supabase proof", async ({ page }) => {
    const previousViteUrl = process.env.VITE_SUPABASE_URL;
    const previousServerUrl = process.env.SUPABASE_URL;

    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    try {
      await expect(assertNonProductionEnvironment(page)).rejects.toThrow(
        /BLOCKED_UNKNOWN_ENVIRONMENT: could not prove Supabase host/,
      );
    } finally {
      if (previousViteUrl === undefined) delete process.env.VITE_SUPABASE_URL;
      else process.env.VITE_SUPABASE_URL = previousViteUrl;
      if (previousServerUrl === undefined) delete process.env.SUPABASE_URL;
      else process.env.SUPABASE_URL = previousServerUrl;
    }
  });

  test("environment gate proves local/non-production targeting", async ({ page }) => {
    await assertNonProductionEnvironment(page);
    await page.goto(`/prophecy${ATTR}`);

    // Browser must not see a service-role key in Vite-exposed globals.
    const leaked = await page.evaluate(() => {
      try {
        const keys = Object.keys(window as unknown as Record<string, unknown>);
        return keys.some((k) => /SERVICE_ROLE/i.test(k));
      } catch {
        return false;
      }
    });
    expect(leaked).toBe(false);
  });

  test("no_quote: synthetic intake persists exactly one capture", async ({ page }) => {
    await assertNonProductionEnvironment(page);
    await page.goto(`/prophecy${ATTR}`);
    await acceptConsentIfPresent(page);

    const email = uniqueEmail("nq");
    const net = captureRequests(page);
    const captureResponsePromise = page.waitForResponse((response) =>
      response.url().includes("capture-truth-gate-lead"),
    );

    await openNoQuoteIntake(page);
    await fillZipAndContinue(page);
    await completeNoQuoteExtras(page);
    await fillContactAndSubmit(page, { email, hasQuote: false });
    const captureResponse = await captureResponsePromise;

    await expect(page.getByRole("heading", { name: /You're in\./i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Close$/i }).click();

    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toHaveCount(0);

    await expect.poll(() => net.captures.length).toBe(1);
    const body = net.captures[0].postDataJSON() as Record<string, unknown>;
    expect(JSON.stringify(body)).toMatch(/no_quote|prophecy_intent/);
    expect(JSON.stringify(body)).toMatch(/utm_source|prophecy_e2e|prophecy-e2e|wm_client/);

    await expect.poll(() => net.responses.length).toBe(1);
    expect(captureResponse.status()).toBeLessThan(500);
    const payload = await captureResponse.json().catch(() => null);
    expect(payload).toBeTruthy();

    const admin = hasExplicitLocalAdminProof ? getAdminClient() : null;
    if (!admin) {
      test.info().annotations.push({
        type: "NEEDS_RUNTIME_VERIFICATION",
        description: SKIP_REASON,
      });
    } else {
      const lead = await getLeadByEmail(email);
      expect(lead).toBeTruthy();
      expect(lead?.email).toBe(email);
    }
  });

  test("has_quote: upload zone, resume hint, and Verify-to-Reveal boundary", async ({
    page,
  }) => {
    await assertNonProductionEnvironment(page);
    await installDeterministicScanBackend(page);
    await page.goto(`/prophecy${ATTR}`);
    await acceptConsentIfPresent(page);

    const email = uniqueEmail("hq");
    const net = captureRequests(page);
    const captureResponsePromise = page.waitForResponse((response) =>
      response.url().includes("capture-truth-gate-lead"),
    );

    await openHasQuoteIntake(page);
    await fillZipAndContinue(page);
    await fillContactAndSubmit(page, { email, hasQuote: true });
    await captureResponsePromise;

    await expect(
      page.getByRole("heading", { name: /You're in\. Now the estimate\./i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Upload My Estimate/i }).click();

    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toBeVisible({ timeout: 15_000 });

    await expect.poll(() => net.captures.length).toBe(1);

    const resumeBefore = await page.evaluate((key) => sessionStorage.getItem(key), RESUME_KEY);
    expect(resumeBefore).toBeTruthy();
    const parsed = JSON.parse(resumeBefore!) as {
      leadId: string;
      sessionId: string;
      expiresAt: number;
    };
    expect(parsed.leadId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(parsed.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );

    await page.reload({ waitUntil: "networkidle" });
    await acceptConsentIfPresent(page);
    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toBeVisible({ timeout: 15_000 });
    const resumeAfter = await page.evaluate((key) => sessionStorage.getItem(key), RESUME_KEY);
    expect(resumeAfter).toBeTruthy();
    const parsedAfter = JSON.parse(resumeAfter!) as {
      leadId: string;
      sessionId: string;
    };
    expect(parsedAfter.leadId).toBe(parsed.leadId);
    expect(parsedAfter.sessionId).toBe(parsed.sessionId);

    const bootstrapReqs: string[] = [];
    page.on("request", (req) => {
      const u = req.url();
      if (
        /scan-quote|storage\/v1|create-scan|bootstrap|quote.?file|upload/i.test(u)
      ) {
        bootstrapReqs.push(u);
      }
    });

    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(FIXTURE);

    const scanResponsePromise = page
      .waitForResponse((response) =>
        response.url().includes("/functions/v1/scan-quote"),
      { timeout: 60_000 })
      .catch(() => null);
    await page.getByRole("button", { name: /Scan my quote/i }).click();
    const scanResponse = await scanResponsePromise;

    if (!scanResponse || !scanResponse.ok()) {
      throw new Error(
        "BLOCKED_EXTERNAL_ENV: local scan-quote did not return a successful response; preview/reveal was not exercised",
      );
    }

    const retryScan = page.getByRole("button", { name: /Retry Scan/i });
    const scanOutcomeDeadline = Date.now() + 30_000;
    let scanOutcome: "report" | "terminal" | "unknown" = "unknown";
    while (Date.now() < scanOutcomeDeadline) {
      if (/\/report\//.test(page.url())) {
        scanOutcome = "report";
        break;
      }
      if (await retryScan.isVisible().catch(() => false)) {
        scanOutcome = "terminal";
        break;
      }
      await page.waitForTimeout(250);
    }

    if (scanOutcome !== "report") {
      // The terminal scanner state can leave long-lived browser work pending.
      // Close the page before surfacing the hard environment blocker so the
      // failure is reported promptly instead of being obscured by teardown.
      await page.unrouteAll({ behavior: "ignoreErrors" });
      await page.close({ runBeforeUnload: false });
      throw new Error(
        scanOutcome === "terminal"
          ? "BLOCKED_EXTERNAL_ENV: repository fixture reached scan-quote but was classified as a terminal non-quote; preview/reveal was not exercised"
          : "BLOCKED_EXTERNAL_ENV: local scan returned without producing a report preview; preview/reveal was not exercised",
      );
    }

    await expect
      .poll(() => net.reportAccessResponses.length, { timeout: 30_000 })
      .toBeGreaterThan(0);

    for (const response of net.reportAccessResponses) {
      const responseBody = await response.text();
      expect(responseBody).not.toMatch(/"full_json"\s*:/i);
    }

    const fullJsonHits = net.all.filter((r) => {
      const u = r.url().toLowerCase();
      return u.includes("full_json") || u.includes("get_analysis_full");
    });
    expect(fullJsonHits.length).toBe(0);

    const persistenceLeak = await page.evaluate(() => {
      const bags = [localStorage, sessionStorage];
      for (const bag of bags) {
        for (let i = 0; i < bag.length; i++) {
          const key = bag.key(i);
          if (!key) continue;
          const val = bag.getItem(key) || "";
          if (/full_json/i.test(key) || /full_json/i.test(val)) return true;
        }
      }
      return document.documentElement.innerHTML.includes("full_json");
    });
    expect(persistenceLeak).toBe(false);

    expect(bootstrapReqs.length).toBeGreaterThan(0);
    await expect(
      page.getByText(/verify|code|text|sms|phone/i).first(),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("text=full_json")).toHaveCount(0);
  });

  test("failure paths: duplicate submit, capture retry, back, expired resume, missing assets, noscript", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await assertNonProductionEnvironment(page);
    await page.goto(`/prophecy${ATTR}`);
    await acceptConsentIfPresent(page);

    // Rapid duplicate submit — only one capture should stick.
    const email = uniqueEmail("dup");
    const net = captureRequests(page);
    await openHasQuoteIntake(page);
    await fillZipAndContinue(page);
    await page.locator("#prophecy-first-name").fill("ProphecyTest");
    await page.locator("#prophecy-phone").fill(QA_PHONE);
    await page.locator("#prophecy-email").fill(email);
    const submit = page.getByTestId("prophecy-intake-submit");
    const duplicateCaptureResponse = page.waitForResponse((response) =>
      response.url().includes("capture-truth-gate-lead"),
    );
    await submit.click();
    await submit.click({ force: true }).catch(() => undefined);
    await duplicateCaptureResponse;
    await expect(page.getByRole("heading", { name: /You're in/i })).toBeVisible({
      timeout: 30_000,
    });
    await expect.poll(() => net.captures.length).toBe(1);
    // Deduped persistence: one browser capture and, when the local Node admin
    // client is available, exactly one stored row for the synthetic address.
    const withEmail = net.captures.filter((r) =>
      (r.postData() || "").includes(email),
    );
    expect(withEmail).toHaveLength(1);
    const admin = hasExplicitLocalAdminProof ? getAdminClient() : null;
    if (admin) {
      const { count, error } = await admin
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("email", email);
      expect(error).toBeNull();
      expect(count).toBe(1);
    } else {
      test.info().annotations.push({
        type: "NEEDS_RUNTIME_VERIFICATION",
        description: `${SKIP_REASON} Persisted duplicate-row count was not checked.`,
      });
    }

    // Back navigation preserves recoverable form state on a fresh open.
    await page.getByRole("button", { name: /Upload My Estimate|Close/i }).click();
    await openHasQuoteIntake(page);
    await fillZipAndContinue(page);
    await page.getByRole("button", { name: /← Back/i }).click();
    await expect(page.locator("#prophecy-zip")).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();

    // Capture network failure + retry with recoverable form state.
    await page.route("**/functions/v1/capture-truth-gate-lead", async (route) => {
      await route.abort("failed");
    });
    await openHasQuoteIntake(page);
    await fillZipAndContinue(page);
    const retryEmail = uniqueEmail("retry");
    await fillContactAndSubmit(page, { email: retryEmail, hasQuote: true });
    await expect(page.getByTestId("prophecy-intake-submit-error")).toContainText(
      /.+/i,
      { timeout: 15_000 },
    );
    await expect(page.locator("#prophecy-email")).toHaveValue(retryEmail);
    await page.unroute("**/functions/v1/capture-truth-gate-lead");
    await page.getByTestId("prophecy-intake-submit").click();
    await expect(page.getByRole("heading", { name: /You're in/i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /Upload My Estimate|Close/i }).click();

    // Upload failure + retry (abort storage/upload once, then allow).
    let blockedOnce = false;
    await page.route("**/storage/v1/**", async (route) => {
      if (!blockedOnce) {
        blockedOnce = true;
        await route.abort("failed");
        return;
      }
      await route.fallback();
    });
    const uploadZone = page.getByRole("heading", {
      name: /Drop your quote to start the scan/i,
    });
    if (await uploadZone.isVisible().catch(() => false)) {
      await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
      await page.getByRole("button", { name: /Scan my quote/i }).click();
      await expect.poll(() => blockedOnce).toBe(true);
      const retry = page.getByRole("button", { name: /Retry Scan/i });
      await expect(retry).toBeVisible({ timeout: 15_000 });
      await retry.click();
    }
    await page.unroute("**/storage/v1/**");

    // Expired resume hint.
    await page.evaluate((key) => {
      sessionStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          leadId: "11111111-1111-4111-8111-111111111111",
          sessionId: "22222222-2222-4222-8222-222222222222",
          expiresAt: Date.now() - 60_000,
        }),
      );
    }, RESUME_KEY);
    await page.reload({ waitUntil: "networkidle" });
    await acceptConsentIfPresent(page);
    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toHaveCount(0);

    // Missing intent image via request interception (do not rename public assets).
    await page.route("**/images/prophecy/intent-has-quote.avif", (route) =>
      route.abort("failed"),
    );
    await page.route("**/images/prophecy/intent-has-quote.webp", (route) =>
      route.abort("failed"),
    );
    await page.route("**/images/prophecy/intent-has-quote.jpg", (route) =>
      route.abort("failed"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await acceptConsentIfPresent(page);
    await expect(
      page.getByRole("button", { name: /I've got an estimate in hand/i }).first(),
    ).toBeVisible();
    await page.unroute("**/images/prophecy/intent-has-quote.avif");
    await page.unroute("**/images/prophecy/intent-has-quote.webp");
    await page.unroute("**/images/prophecy/intent-has-quote.jpg");

    // Missing video poster via interception.
    await page.route("**/images/windowman-explainer-poster**", (route) =>
      route.abort("failed"),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await acceptConsentIfPresent(page);
    await expect(page.getByRole("button", { name: /play/i }).first()).toBeVisible({
      timeout: 10_000,
    });
    await page.unroute("**/images/windowman-explainer-poster**");

    // JavaScript-disabled noscript document (static prophecy shell from build).
    if (!fs.existsSync(PROPHECY_STATIC_HTML)) {
      test.info().annotations.push({
        type: "NEEDS_RUNTIME_VERIFICATION",
        description:
          "dist/prophecy/index.html missing — run npm run build before noscript proof",
      });
    } else {
      const noscriptContext = await browser.newContext({
        javaScriptEnabled: false,
      });
      const noscriptPage = await noscriptContext.newPage();
      const html = fs.readFileSync(PROPHECY_STATIC_HTML, "utf8");
      await noscriptPage.setContent(html, { waitUntil: "domcontentloaded" });
      await expect(
        noscriptPage.getByText(/JavaScript is required/i),
      ).toBeVisible({ timeout: 5_000 });
      await noscriptContext.close();
    }
  });
});
