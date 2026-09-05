import { describe, expect, it, vi } from "vitest";
import type { Page, Route } from "@playwright/test";
import {
  assertDisposableLocalEnvironment,
  installLocalSupabaseFirewall,
} from "./localEnvironment";

const LOCAL_ENV = {
  PLAYWRIGHT_BASE_URL: "http://127.0.0.1:8080",
  VITE_SUPABASE_URL: "http://127.0.0.1:54321",
};

describe("assertDisposableLocalEnvironment", () => {
  it("accepts only a loopback app and local Supabase CLI target", () => {
    const proof = assertDisposableLocalEnvironment(LOCAL_ENV);

    expect(proof.appBaseUrl.origin).toBe("http://127.0.0.1:8080");
    expect(proof.supabaseUrl.origin).toBe("http://127.0.0.1:54321");
  });

  it("fails closed when the Supabase target is missing", () => {
    expect(() =>
      assertDisposableLocalEnvironment({
        PLAYWRIGHT_BASE_URL: "http://localhost:8080",
      }),
    ).toThrow(/BLOCKED_UNKNOWN_ENVIRONMENT/);
  });

  it("rejects a remote Supabase project even when the app is local", () => {
    expect(() =>
      assertDisposableLocalEnvironment({
        PLAYWRIGHT_BASE_URL: "http://localhost:8080",
        VITE_SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow(/BLOCKED_UNKNOWN_ENVIRONMENT/);
  });

  it("requires the dedicated local service role for state-changing tests", () => {
    expect(() =>
      assertDisposableLocalEnvironment(LOCAL_ENV, {
        requireServiceRole: true,
      }),
    ).toThrow(/PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY/);

    expect(() =>
      assertDisposableLocalEnvironment(
        {
          ...LOCAL_ENV,
          PROPHECY_E2E_LOCAL_SERVICE_ROLE_KEY: "local-test-only",
        },
        { requireServiceRole: true },
      ),
    ).not.toThrow();
  });

  it("rejects any service-role credential exposed through Vite", () => {
    expect(() =>
      assertDisposableLocalEnvironment({
        ...LOCAL_ENV,
        VITE_SUPABASE_SERVICE_ROLE_KEY: "must-never-reach-browser",
      }),
    ).toThrow(/BLOCKED_UNKNOWN_ENVIRONMENT/);
  });
});

describe("installLocalSupabaseFirewall", () => {
  it("aborts and records a non-local Supabase API request", async () => {
    let routeHandler: ((route: Route) => Promise<void>) | undefined;
    const page = {
      route: vi.fn(async (_pattern, handler) => {
        routeHandler = handler;
      }),
      unroute: vi.fn(async () => undefined),
    } as unknown as Page;
    const firewall = await installLocalSupabaseFirewall(page);
    const route = {
      request: () => ({
        url: () => "https://example.supabase.co/functions/v1/report-access",
      }),
      abort: vi.fn(async () => undefined),
      continue: vi.fn(async () => undefined),
    } as unknown as Route;

    await routeHandler?.(route);

    expect(route.abort).toHaveBeenCalledWith("blockedbyclient");
    expect(route.continue).not.toHaveBeenCalled();
    expect(() => firewall.assertClean()).toThrow(
      /BLOCKED_UNKNOWN_ENVIRONMENT/,
    );
    await firewall.dispose();
  });
});
