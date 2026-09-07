import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page, type Route } from "@playwright/test";

const RESUME_KEY = "wm_nq3_upload_resume_v1";
const LEAD_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const SCAN_SESSION_ID = "33333333-3333-4333-8333-333333333333";
const QUOTE_FILE_ID = "44444444-4444-4444-8444-444444444444";
const RATE_LIMITED_PHONE = "+13054440144";
const SPEC_DIR = path.dirname(fileURLToPath(import.meta.url));
const QUOTE_FIXTURE = path.join(SPEC_DIR, "fixtures", "sample-quote.png");

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    body: JSON.stringify(body),
    contentType: "application/json",
    headers: CORS_HEADERS,
    status,
  });
}

async function fulfillPreflight(route: Route): Promise<boolean> {
  if (route.request().method() !== "OPTIONS") return false;
  await route.fulfill({ headers: CORS_HEADERS, status: 204 });
  return true;
}

async function installFreshScanBackend(page: Page) {
  const sendOtpBodies: Array<Record<string, unknown>> = [];

  // Fail closed against an accidentally remote Vite environment. Specific
  // deterministic handlers below are registered later and therefore win.
  await page.route("**/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const isSupabaseTraffic =
      requestUrl.port === "54321" ||
      requestUrl.hostname.includes("supabase") ||
      /\/(?:functions|storage|rest|auth|realtime)\/v1\//.test(requestUrl.pathname);

    if (!isSupabaseTraffic) {
      await route.fallback();
      return;
    }

    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, {});
  });

  await page.route("**/rest/v1/rpc/get_upload_retry_context", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, []);
  });

  await page.route("**/storage/v1/object/quotes/**", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, { Key: "quotes/nq3-e2e/sample-quote.png" });
  });

  await page.route("**/functions/v1/start-upload-scan-session", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, {
      lead_id: LEAD_ID,
      quote_file_id: QUOTE_FILE_ID,
      scan_session_id: SCAN_SESSION_ID,
      success: true,
    });
  });

  await page.route("**/functions/v1/scan-quote", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, {
      analysis_status: "complete",
      grade: "C",
      scan_session_status: "preview_ready",
    });
  });

  await page.route("**/rest/v1/rpc/get_scan_status", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, [{ status: "preview_ready" }]);
  });

  await page.route("**/functions/v1/report-access", async (route) => {
    if (await fulfillPreflight(route)) return;
    const body = route.request().postDataJSON() as { mode?: unknown };
    if (body.mode === "full") {
      await fulfillJson(route, {
        authorized: false,
        mode: "full",
        ok: true,
      });
      return;
    }

    await fulfillJson(route, {
      data: {
        analysis_id: "55555555-5555-4555-8555-555555555555",
        confidence_score: 82,
        document_type: "estimate",
        flag_amber_count: 2,
        flag_count: 2,
        flag_red_count: 0,
        grade: "C",
        preview_json: {
          headline: "Preview only — verify to reveal",
        },
        proof_of_read: {
          contractor_name: "NQ3 E2E Windows",
          line_item_count: 8,
          opening_count: 6,
          page_count: 2,
        },
        rubric_version: "nq3-e2e-fixture-v1",
      },
      mode: "preview",
      ok: true,
    });
  });

  await page.route("**/rest/v1/rpc/get_county_by_scan_session", async (route) => {
    if (await fulfillPreflight(route)) return;
    await fulfillJson(route, [{ county: "Martin" }]);
  });

  await page.route("**/functions/v1/send-otp", async (route) => {
    if (await fulfillPreflight(route)) return;
    const body = route.request().postDataJSON() as Record<string, unknown>;
    sendOtpBodies.push(body);
    if (body.phone_e164 === RATE_LIMITED_PHONE) {
      await fulfillJson(
        route,
        {
          error: "Too many code requests. Please wait 30 seconds before trying again.",
          retry_after: 30,
          success: false,
        },
        429,
      );
      return;
    }
    await fulfillJson(route, { success: true });
  });

  return { sendOtpBodies };
}

async function dismissConsent(page: Page) {
  const banner = page.getByRole("region", { name: "Cookie consent" });
  if (await banner.isVisible().catch(() => false)) {
    await banner.getByRole("button", { name: "Decline" }).click();
  }
}

async function seedUploadResume(page: Page) {
  await page.addInitScript(
    ({ key, leadId, sessionId }) => {
      window.sessionStorage.setItem(
        key,
        JSON.stringify({
          version: 1,
          leadId,
          sessionId,
          expiresAt: Date.now() + 5 * 60 * 1000,
        }),
      );
    },
    { key: RESUME_KEY, leadId: LEAD_ID, sessionId: SESSION_ID },
  );
}

async function expectNativeUploadLayout(page: Page, cardPadding: number) {
  const uploadZone = page.getByTestId("upload-zone");
  const uploadCard = uploadZone.locator(".card-raised-hero");
  const dropTarget = page.getByRole("button", { name: "Upload your quote file" });

  await expect(uploadZone).toBeVisible();
  await expect(uploadCard).toHaveCSS("padding-top", `${cardPadding}px`);
  await expect(uploadCard).toHaveCSS("padding-right", `${cardPadding}px`);
  await expect(uploadCard).toHaveCSS("padding-bottom", `${cardPadding}px`);
  await expect(uploadCard).toHaveCSS("padding-left", `${cardPadding}px`);
  await expect(dropTarget).toHaveCSS("padding-top", "40px");
  await expect(dropTarget).toHaveCSS("padding-right", "24px");
  await expect(dropTarget).toHaveCSS("padding-bottom", "40px");
  await expect(dropTarget).toHaveCSS("padding-left", "24px");

  const alignment = await uploadZone.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      centerDelta: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2),
      overflows: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  expect(alignment.centerDelta).toBeLessThanOrEqual(1.5);
  expect(alignment.overflows).toBe(false);
}

for (const reducedMotion of [false, true]) {
  test(`keeps real UploadZone spacing and centering at 390px${
    reducedMotion ? " with reduced motion" : ""
  }`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    await seedUploadResume(page);
    await page.goto("/nq3");
    await dismissConsent(page);

    await expectNativeUploadLayout(page, 28);
  });

  test(`keeps real UploadZone spacing and centering at 1280px${
    reducedMotion ? " with reduced motion" : ""
  }`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    if (reducedMotion) await page.emulateMedia({ reducedMotion: "reduce" });
    await seedUploadResume(page);
    await page.goto("/nq3");
    await dismissConsent(page);

    await expectNativeUploadLayout(page, 32);
  });
}

test("hands a persisted has-quote lead to the uploader after focus restoration", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    Object.defineProperty(window, "dataLayer", {
      configurable: true,
      value: [],
      writable: true,
    });
  });
  const { sendOtpBodies } = await installFreshScanBackend(page);

  let capturedSessionId = "";
  await page.route("**/functions/v1/capture-truth-gate-lead", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({
        headers: {
          "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Origin": "*",
        },
        status: 204,
      });
      return;
    }

    const payload = route.request().postDataJSON() as { session_id?: unknown };
    capturedSessionId =
      typeof payload.session_id === "string" ? payload.session_id : "";
    await route.fulfill({
      body: JSON.stringify({
        success: true,
        lead_id: LEAD_ID,
        session_id: capturedSessionId,
        reused: false,
      }),
      contentType: "application/json",
      headers: { "Access-Control-Allow-Origin": "*" },
      status: 200,
    });
  });

  const originalUrl = "/nq3?utm_source=nq3-regression&gclid=handoff-test";
  await page.goto(originalUrl);
  await dismissConsent(page);

  const opener = page.getByTestId("nq3-escape-hatch");
  await expect(opener).toBeVisible();
  await opener.click();
  await expect
    .poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(originalUrl);

  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Florida project ZIP code").fill("34997");
  await dialog.getByRole("button", { name: "Continue" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Your estimate is next." }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "What are you replacing?" }),
  ).toHaveCount(0);

  await dialog.getByLabel("First name").fill("NqThreeSentinel");
  await dialog.getByLabel("Email address").fill("nq3-sentinel@example.test");
  await dialog.getByLabel("Mobile number").fill("3055550142");
  await dialog.getByRole("button", { name: "Continue to Upload" }).click();

  await expect(
    dialog.getByRole("heading", { name: "Ready to upload." }),
  ).toBeVisible();
  const uploadSection = page.locator("section[data-campaign-shared-ui]");
  await expect(uploadSection).toBeHidden();

  const storedResume = await page.evaluate((key) => {
    const value = window.sessionStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  }, RESUME_KEY);
  expect(capturedSessionId).not.toBe("");
  expect(storedResume).toMatchObject({
    version: 1,
    leadId: LEAD_ID,
    sessionId: capturedSessionId,
  });

  await page.evaluate(() => {
    const state = window as typeof window & {
      __nq3HandoffSequence?: Array<{
        preventScroll?: boolean;
        type: "focus" | "scroll";
      }>;
    };
    state.__nq3HandoffSequence = [];

    const openerElement = document.querySelector<HTMLElement>(
      '[data-testid="nq3-escape-hatch"]',
    );
    if (!openerElement) throw new Error("NQ3 handoff opener missing");
    const nativeFocus = openerElement.focus.bind(openerElement);
    openerElement.focus = (options?: FocusOptions) => {
      state.__nq3HandoffSequence?.push({
        preventScroll: options?.preventScroll === true,
        type: "focus",
      });
      nativeFocus(options);
    };

    const nativeScrollIntoView = Element.prototype.scrollIntoView;
    Element.prototype.scrollIntoView = function scrollIntoView(options) {
      if ((this as HTMLElement).dataset.testid === "upload-zone") {
        state.__nq3HandoffSequence?.push({ type: "scroll" });
      }
      nativeScrollIntoView.call(this, options);
    };
  });

  const scrollBeforeReveal = await page.evaluate(() => window.scrollY);
  await dialog.getByRole("button", { name: "Upload My Estimate" }).click();

  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(uploadSection).toBeVisible();
  await expect(page.getByTestId("upload-zone")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrollBeforeReveal + 100);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = window as typeof window & {
          __nq3HandoffSequence?: Array<{
            preventScroll?: boolean;
            type: "focus" | "scroll";
          }>;
        };
        return state.__nq3HandoffSequence ?? [];
      }),
    )
    .toEqual([
      { preventScroll: true, type: "focus" },
      { type: "scroll" },
    ]);
  await expect
    .poll(() => page.evaluate(() => location.pathname + location.search))
    .toBe(originalUrl);

  const serializedDataLayer = await page.evaluate(() => {
    const seen = new WeakSet<object>();
    return JSON.stringify(
      (window as typeof window & { dataLayer?: unknown[] }).dataLayer ?? [],
      (_key, value: unknown) => {
        if (value instanceof Element) return `[${value.tagName}]`;
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return "[Circular]";
          seen.add(value);
        }
        return value;
      },
    );
  });
  expect(serializedDataLayer).not.toMatch(
    /NqThreeSentinel|nq3-sentinel@example\.test|3055550142|\+13055550142/,
  );

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(QUOTE_FIXTURE);
  await expect(page.getByText("sample-quote.png")).toBeVisible();

  await page.getByRole("button", { name: /Scan my quote/i }).click();
  await expect(page).toHaveURL(`/report/classic/${SCAN_SESSION_ID}`);

  const firstTheatrics = page.getByText("Forensic Document Analysis");
  const secondTheatrics = page.getByText("DECONSTRUCTING DOCUMENT · 5 PILLARS");
  const partialReportGate = page.locator("#otp-gate");

  await expect(firstTheatrics).toBeVisible({ timeout: 10_000 });
  await expect(partialReportGate).toHaveCount(0);
  await expect(secondTheatrics).toBeVisible({ timeout: 15_000 });
  await expect(partialReportGate).toHaveCount(0);

  await expect(partialReportGate).toBeVisible({ timeout: 15_000 });
  await expect(
    page.getByText("We sent a 6-digit code to (•••) •••-0142"),
  ).toBeVisible();
  await expect(firstTheatrics).toHaveCount(0);
  await expect
    .poll(() => sendOtpBodies.length, { timeout: 5_000 })
    .toBe(1);
  expect(sendOtpBodies[0]).toEqual({
    phone_e164: "+13055550142",
    scan_session_id: SCAN_SESSION_ID,
  });
  expect(
    await page.evaluate(() =>
      Boolean(
        (window.history.state as { usr?: { freshScan?: unknown } } | null)
          ?.usr?.freshScan,
      ),
    ),
  ).toBe(false);

  const reportUrl = `/report/classic/${SCAN_SESSION_ID}`;
  const otpInput = page.getByLabel("One-time verification code");
  await otpInput.fill("12");

  const persistedFunnelBeforeChange = await page.evaluate(() => ({
    leadId: window.localStorage.getItem("wm_funnel_leadId"),
    phoneE164: window.localStorage.getItem("wm_funnel_phoneE164"),
    scanSessionId: window.localStorage.getItem("wm_funnel_scanSessionId"),
    sessionId: window.localStorage.getItem("wm_funnel_sessionId"),
  }));
  expect(persistedFunnelBeforeChange).toMatchObject({
    leadId: LEAD_ID,
    phoneE164: "+13055550142",
    scanSessionId: SCAN_SESSION_ID,
  });

  const changeNumber = page.getByRole("button", { name: "Change number" });
  await expect(changeNumber).toBeVisible();
  await changeNumber.click();

  await expect(page).toHaveURL(reportUrl);
  await expect(partialReportGate).toBeVisible();
  const replacementPhone = page.getByLabel("Mobile number");
  await expect(replacementPhone).toBeVisible();
  await expect(replacementPhone).toHaveValue("");

  const persistedFunnelAfterChange = await page.evaluate(() => ({
    leadId: window.localStorage.getItem("wm_funnel_leadId"),
    phoneE164: window.localStorage.getItem("wm_funnel_phoneE164"),
    phoneStatus: window.localStorage.getItem("wm_funnel_phoneStatus"),
    scanSessionId: window.localStorage.getItem("wm_funnel_scanSessionId"),
    sessionId: window.localStorage.getItem("wm_funnel_sessionId"),
  }));
  expect(persistedFunnelAfterChange).toEqual({
    leadId: persistedFunnelBeforeChange.leadId,
    phoneE164: null,
    phoneStatus: "none",
    scanSessionId: persistedFunnelBeforeChange.scanSessionId,
    sessionId: persistedFunnelBeforeChange.sessionId,
  });

  const sendSecureCode = page.getByRole("button", { name: "Send secure code" });
  await replacementPhone.fill("30555");
  await expect(sendSecureCode).toBeDisabled();
  expect(sendOtpBodies).toHaveLength(1);

  await replacementPhone.fill("3054440144");
  await page.getByRole("checkbox").check();
  await sendSecureCode.click();
  await expect(
    page.getByText("Too many code requests. Please wait 30 seconds before trying again."),
  ).toBeVisible();
  await expect(page.getByText("This protects your phone from abuse. The limit resets shortly.")).toBeVisible();
  await expect(replacementPhone).toBeVisible();
  await expect(page).toHaveURL(reportUrl);
  expect(sendOtpBodies[1]).toEqual({
    phone_e164: RATE_LIMITED_PHONE,
    scan_session_id: SCAN_SESSION_ID,
  });

  await replacementPhone.fill("3054440143");
  await expect(
    page.getByText("Too many code requests. Please wait 30 seconds before trying again."),
  ).toHaveCount(0);
  await sendSecureCode.click();

  await expect(page.getByText("We sent a 6-digit code to (•••) •••-0143")).toBeVisible();
  await expect(page.getByLabel("One-time verification code")).toHaveValue("");
  await expect(partialReportGate).toBeVisible();
  await expect(page).toHaveURL(reportUrl);
  expect(sendOtpBodies[2]).toEqual({
    phone_e164: "+13054440143",
    scan_session_id: SCAN_SESSION_ID,
  });

  await page.reload();
  await expect(partialReportGate).toBeVisible({ timeout: 10_000 });
  await expect(firstTheatrics).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(sendOtpBodies).toHaveLength(3);
});
