import { test, expect, type Page } from "@playwright/test";
import {
  cleanupTestPartnerAccount,
  getAdminClient,
  getContractorAccountByEmail,
  getPartnerProfileByEmail,
  SKIP_REASON,
} from "../helpers/supabaseAdmin";

test.use({ trace: "retain-on-failure", screenshot: "only-on-failure" });

const PARTNER_PREFIX = "wm-partner-e2e-";

test.skip(getAdminClient() === null, SKIP_REASON);

function uniquePartnerEmail(): string {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  return `${PARTNER_PREFIX}${ts}-${rand}@windowman-test.local`;
}

async function fillPartnerJoinForm(page: Page, data: {
  companyName: string;
  contactName: string;
  email: string;
  password: string;
}) {
  await page.getByPlaceholder("Acme Windows & Doors").fill(data.companyName);
  await page.getByPlaceholder("Owner or sales lead").fill(data.contactName);
  await page.getByPlaceholder("partner@company.com").fill(data.email);
  await page.getByPlaceholder("Best callback number").fill("(500) 555-0006");
  await page.getByPlaceholder("Counties, cities, or zip codes served").fill("Miami-Dade, Broward, Palm Beach");
  await page.getByPlaceholder("company.com").fill("https://e2e-window-partner.example");
  await page.getByPlaceholder("Optional").fill("E2E-CGC-12345");
  await page.getByPlaceholder("How many verified leads can you handle?").fill("10-15 per month");
  await page.getByPlaceholder("At least 8 characters").fill(data.password);
  await page.getByPlaceholder("Re-enter password").fill(data.password);
  await page.getByPlaceholder("Tell us what markets or lead types fit your crew.").fill(
    "Playwright smoke registration for the real request-partner-access flow.",
  );
}

test("partner join: registers through request-partner-access and lands in pending review", async ({ browser }) => {
  const email = uniquePartnerEmail();
  const password = `PartnerE2E-${Date.now()}!`;
  const companyName = `WM Partner E2E ${Date.now()}`;
  const contactName = "Playwright Partner";
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  try {
    await page.goto("/partner/join");
    await expect(page.getByRole("heading", { name: /request partner access/i })).toBeVisible({ timeout: 15_000 });

    await fillPartnerJoinForm(page, { companyName, contactName, email, password });

    const functionResponsePromise = page.waitForResponse((response) => {
      const request = response.request();
      return response.url().includes("/functions/v1/request-partner-access") && request.method() === "POST";
    });

    await page.getByRole("button", { name: /submit request/i }).click();

    const functionResponse = await functionResponsePromise;
    expect(functionResponse.ok(), `request-partner-access returned ${functionResponse.status()}`).toBe(true);
    const functionBody = await functionResponse.json() as { ok?: boolean; status?: string; user_id?: string };
    expect(functionBody.ok).toBe(true);
    expect(functionBody.status).toBe("pending_review");
    expect(functionBody.user_id).toBeTruthy();

    await expect(page.getByText(/request received/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /you're on the list/i })).toBeVisible();
    await expect(page.getByText(/partner account is pending review/i)).toBeVisible();
    await expect(page.getByText(/pending-review screen/i)).toBeVisible();

    const profile = await getPartnerProfileByEmail(email);
    expect(profile, `expected contractor_profiles row for ${email}`).not.toBeNull();
    expect(profile!.company_name).toBe(companyName);
    expect(profile!.contact_email).toBe(email);
    expect(profile!.status).toBe("pending_review");

    const account = await getContractorAccountByEmail(email);
    expect(account, `expected contractor_accounts row for ${email}`).not.toBeNull();
    expect(account!.auth_user_id).toBe(profile!.id);
    expect(account!.client_slug).toBe("direct");
    expect(account!.display_name).toBe(companyName);
    expect(account!.contact_email).toBe(email);
    expect(account!.contact_phone).toBe("(500) 555-0006");
    expect(account!.access_status).toBe("pending");
    expect(account!.is_active).toBe(false);
    expect(account!.portal_role).toBe("contractor_owner");
    expect(account!.territory).toMatchObject({
      service_area: "Miami-Dade, Broward, Palm Beach",
      website: "https://e2e-window-partner.example",
      license_number: "E2E-CGC-12345",
      monthly_capacity: "10-15 per month",
    });
    expect(account!.metadata).toMatchObject({
      source: "partner_self_serve",
      contact_name: contactName,
    });

    await page.getByRole("button", { name: /return to sign in/i }).click();
    await page.getByPlaceholder("partner@company.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL(/\/partner\/opportunities/, { timeout: 15_000 });
    await page.goto("/partner/onboarding");
    await expect(page.getByRole("heading", { name: /account pending review/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/partner account request is under review/i)).toBeVisible();
  } finally {
    await ctx.close();
    await cleanupTestPartnerAccount(email);
  }
});
