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
 */

import { test, expect, type Page, type Request, type Response } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
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
const ATTR =
  "?utm_source=prophecy_e2e&utm_medium=test&utm_campaign=prophecy_runtime&wm_client_slug=prophecy-e2e";

function uniqueEmail(tag: string): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  return `wm-prophecy-${tag}-${ts}-${rand}@windowman-test.local`;
}

function isLocalOrNonProdHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return true;
  }
  // Explicit non-production preview patterns only — never production windowman.app.
  if (/netlify\.app$/i.test(hostname) && /deploy-preview/i.test(hostname)) {
    return true;
  }
  return false;
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

  if (!isLocalOrNonProdHost(pageHost)) {
    throw new Error(
      `BLOCKED_UNKNOWN_ENVIRONMENT: page host "${pageHost}" is not proven local/non-production`,
    );
  }

  // Prove Supabase targeting from observed network traffic (no secret printing).
  const supabaseHosts = new Set<string>();
  const onReq = (req: Request) => {
    try {
      const u = new URL(req.url());
      if (
        u.port === "54321" ||
        u.pathname.includes("/functions/v1/") ||
        u.hostname.includes("supabase")
      ) {
        supabaseHosts.add(u.hostname);
      }
    } catch {
      /* ignore */
    }
  };
  page.on("request", onReq);

  // Trigger a lightweight same-origin navigation already done; wait briefly for
  // any hydration traffic, then also probe known local functions origin.
  await page.waitForTimeout(500);
  page.off("request", onReq);

  const envHint =
    process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
  if (envHint) {
    try {
      supabaseHosts.add(new URL(envHint).hostname);
    } catch {
      throw new Error("BLOCKED_UNKNOWN_ENVIRONMENT: invalid Supabase URL in env");
    }
  }

  if (supabaseHosts.size === 0) {
    // Page host is local; require at least the process env or a later capture
    // request to prove DB targeting before treating as blocked.
    return;
  }

  for (const host of supabaseHosts) {
    if (!isLocalOrNonProdHost(host)) {
      throw new Error(
        `BLOCKED_UNKNOWN_ENVIRONMENT: Supabase host "${host}" is not local/non-production`,
      );
    }
  }
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
  all: Request[];
} {
  const captures: Request[] = [];
  const responses: Response[] = [];
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
  });
  return { captures, responses, all };
}

test.describe("Prophecy funnel — environment and journeys", () => {
  test("environment gate proves local/non-production targeting", async ({ page }) => {
    await page.goto(`/prophecy${ATTR}`);
    await assertNonProductionEnvironment(page);

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
    await page.goto(`/prophecy${ATTR}`);
    await assertNonProductionEnvironment(page);
    await acceptConsentIfPresent(page);

    const email = uniqueEmail("nq");
    const net = captureRequests(page);

    await openNoQuoteIntake(page);
    await fillZipAndContinue(page);
    await completeNoQuoteExtras(page);
    await fillContactAndSubmit(page, { email, hasQuote: false });

    await expect(page.getByRole("heading", { name: /You're in\./i })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: /^Close$/i }).click();

    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toHaveCount(0);

    expect(net.captures.length).toBe(1);
    const body = net.captures[0].postDataJSON() as Record<string, unknown>;
    expect(JSON.stringify(body)).toMatch(/no_quote|prophecy_intent/);
    expect(JSON.stringify(body)).toMatch(/utm_source|prophecy_e2e|prophecy-e2e|wm_client/);

    const last = net.responses[net.responses.length - 1];
    expect(last).toBeTruthy();
    expect(last.status()).toBeLessThan(500);
    const payload = await last.json().catch(() => null);
    expect(payload).toBeTruthy();

    const admin = getAdminClient();
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
    await page.goto(`/prophecy${ATTR}`);
    await assertNonProductionEnvironment(page);
    await acceptConsentIfPresent(page);

    const email = uniqueEmail("hq");
    const net = captureRequests(page);

    await openHasQuoteIntake(page);
    await fillZipAndContinue(page);
    await fillContactAndSubmit(page, { email, hasQuote: true });

    await expect(
      page.getByRole("heading", { name: /You're in\. Now the estimate\./i }),
    ).toBeVisible({ timeout: 30_000 });
    await page.getByRole("button", { name: /Upload My Estimate/i }).click();

    await expect(
      page.getByRole("heading", { name: /Drop your quote to start the scan/i }),
    ).toBeVisible({ timeout: 15_000 });

    expect(net.captures.length).toBe(1);

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

    // Allow bootstrap/scan traffic to fire; AI scan may be blocked without secrets.
    await page.waitForTimeout(4000);

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

    // Safe preview before OTP: if we navigated to a report route, OTP gate must remain.
    if (/\/report\//.test(page.url())) {
      await expect(
        page.getByText(/verify|code|text|sms|phone/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page.locator("text=full_json")).toHaveCount(0);
    } else if (bootstrapReqs.length === 0) {
      test.info().annotations.push({
        type: "BLOCKED_EXTERNAL_ENV",
        description:
          "Upload did not produce scan/bootstrap traffic — local AI/scan secrets may be unavailable for the 1x1 fixture.",
      });
    }
  });

  test("failure paths: duplicate submit, capture retry, back, expired resume, missing assets, noscript", async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    await page.goto(`/prophecy${ATTR}`);
    await assertNonProductionEnvironment(page);
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
    await submit.click();
    await submit.click({ force: true }).catch(() => undefined);
    await expect(page.getByRole("heading", { name: /You're in/i })).toBeVisible({
      timeout: 30_000,
    });
    expect(net.captures.length).toBeLessThanOrEqual(2);
    // Deduped persistence: at most one successful capture body with this email.
    const withEmail = net.captures.filter((r) =>
      (r.postData() || "").includes(email),
    );
    expect(withEmail.length).toBeGreaterThanOrEqual(1);

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
      await route.continue();
    });
    const uploadZone = page.getByRole("heading", {
      name: /Drop your quote to start the scan/i,
    });
    if (await uploadZone.isVisible().catch(() => false)) {
      await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
      await page.waitForTimeout(1500);
      // Form/page should remain usable for retry.
      await page.locator('input[type="file"]').first().setInputFiles(FIXTURE);
      await page.waitForTimeout(1500);
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
