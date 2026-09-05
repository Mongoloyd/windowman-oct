import type { APIRequestContext, APIResponse } from "@playwright/test";
import { isUuid } from "../src/lib/routeIdGuards";
import { expect, test } from "./fixtures/localOnlyTest";
import { assertDisposableLocalEnvironment } from "./helpers/localEnvironment";

const E164_RE = /^\+[1-9]\d{7,14}$/;
const FORBIDDEN_PREVIEW_KEYS = new Set([
  "full_json",
  "report_summary_body",
  "v2_source",
  "v2_source_version",
]);

function blocked(reason: string): never {
  throw new Error(`BLOCKED_EXTERNAL_ENV: ${reason}`);
}

function requiredUuid(name: string): string {
  const value = process.env[name]?.trim();
  if (!isUuid(value)) {
    blocked(`${name} must name a valid local synthetic UUID fixture`);
  }
  return value;
}

function requiredE164(name: string): string {
  const value = process.env[name]?.trim();
  if (!value || !E164_RE.test(value)) {
    blocked(`${name} must name a valid local synthetic E.164 fixture`);
  }
  return value;
}

function requireSmokeNamespace(): void {
  const namespace = process.env.WM_E2E_FIXTURE_NAMESPACE?.trim();
  if (!namespace?.startsWith("wm-smoke-")) {
    blocked("WM_E2E_FIXTURE_NAMESPACE must start with wm-smoke-");
  }
}

function credentials(): { endpoint: string; anonKey: string } {
  const { supabaseUrl } = assertDisposableLocalEnvironment();
  const anonKey = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY
  )?.trim();

  if (!anonKey) {
    blocked("a local Supabase publishable/anon key is required");
  }

  return {
    endpoint: new URL("/functions/v1/report-access", supabaseUrl).toString(),
    anonKey,
  };
}

async function callReportAccess(
  request: APIRequestContext,
  body: Record<string, string>,
): Promise<APIResponse> {
  const { endpoint, anonKey } = credentials();
  return request.post(endpoint, {
    maxRedirects: 0,
    headers: {
      apikey: anonKey,
      authorization: `Bearer ${anonKey}`,
      "content-type": "application/json",
    },
    data: body,
  });
}

async function parseJson(response: APIResponse): Promise<{
  body: unknown;
  raw: string;
}> {
  const raw = await response.text();
  try {
    return { body: JSON.parse(raw) as unknown, raw };
  } catch {
    throw new Error(
      `REPORT_ACCESS_CONTRACT_FAILURE: expected JSON response (HTTP ${response.status()})`,
    );
  }
}

function containsForbiddenPreviewKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsForbiddenPreviewKey);
  if (!value || typeof value !== "object") return false;

  return Object.entries(value).some(
    ([key, nested]) =>
      FORBIDDEN_PREVIEW_KEYS.has(key) ||
      containsForbiddenPreviewKey(nested),
  );
}

function assertNoFullReportLeak(body: unknown, raw: string): void {
  expect(containsForbiddenPreviewKey(body)).toBe(false);
  expect(raw).not.toMatch(
    /"(?:full_json|report_summary_body|v2_source|v2_source_version)"\s*:/i,
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireFixtureResponse(
  response: APIResponse,
  body: unknown,
  fixtureName: string,
): void {
  if (response.status() === 404) {
    blocked(`${fixtureName} was not found in local Supabase`);
  }
  expect(response.status(), `${fixtureName} report-access HTTP status`).toBe(200);
  expect(asRecord(body).ok, `${fixtureName} report-access envelope`).toBe(true);
}

test.describe("report-access Verify-to-Reveal boundary", () => {
  test("actual preview response contains no full-report fields at any depth", async ({
    request,
  }) => {
    requireSmokeNamespace();
    const scanSessionId = requiredUuid("WM_E2E_PREVIEW_SCAN_ID");

    const response = await callReportAccess(request, {
      mode: "preview",
      scan_session_id: scanSessionId,
    });
    const { body, raw } = await parseJson(response);

    requireFixtureResponse(response, body, "WM_E2E_PREVIEW_SCAN_ID");
    expect(asRecord(body).mode).toBe("preview");
    assertNoFullReportLeak(body, raw);
  });

  test("a phone authorized for scan A cannot unlock scan B", async ({ request }) => {
    requireSmokeNamespace();
    const verifiedScanId = requiredUuid("WM_E2E_VERIFIED_SCAN_ID");
    const otherScanId = requiredUuid("WM_E2E_UNVERIFIED_OTHER_SCAN_ID");
    const verifiedPhone = requiredE164("WM_E2E_VERIFIED_PHONE_E164");

    expect(verifiedScanId).not.toBe(otherScanId);

    // Prove the fixture's phone really authorizes scan A before using the same
    // phone to exercise the cross-session denial against scan B.
    const authorizedResponse = await callReportAccess(request, {
      mode: "full",
      scan_session_id: verifiedScanId,
      phone_e164: verifiedPhone,
    });
    const authorized = await parseJson(authorizedResponse);
    requireFixtureResponse(
      authorizedResponse,
      authorized.body,
      "WM_E2E_VERIFIED_SCAN_ID",
    );
    if (asRecord(authorized.body).authorized !== true) {
      blocked("the local scan A fixture is not authorized by the supplied phone");
    }

    const deniedResponse = await callReportAccess(request, {
      mode: "full",
      scan_session_id: otherScanId,
      phone_e164: verifiedPhone,
    });
    const denied = await parseJson(deniedResponse);
    requireFixtureResponse(
      deniedResponse,
      denied.body,
      "WM_E2E_UNVERIFIED_OTHER_SCAN_ID",
    );

    expect(asRecord(denied.body)).toMatchObject({
      ok: true,
      mode: "full",
      authorized: false,
    });
    assertNoFullReportLeak(denied.body, denied.raw);
  });
});
