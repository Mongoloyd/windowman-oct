/**
 * pageview-dedupe-test.ts
 *
 * Runtime proof that the WindowMan top-of-funnel browser Meta pixel fires:
 *   - exactly 1 PageView on initial app mount
 *   - exactly +1 PageView per SPA route change
 *   - zero browser-side conversion events (Lead, Purchase, etc.)
 *   - zero browser-side calls to /functions/v1/capi-event
 *
 * Runs under the project's existing Vitest + jsdom stack — no new deps.
 *
 * Run with:
 *   npx vitest run scripts/pageview-dedupe-test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { useEffect } from "react";

import { AppTrackingProvider } from "@/components/AppTrackingProvider";

// ── Forbidden browser-side Meta event names (must NEVER appear) ────────────
const FORBIDDEN_EVENTS = new Set([
  "Lead",
  "CompleteRegistration",
  "Purchase",
  "SubmitApplication",
  "Schedule",
]);

// ── Module-state reset ─────────────────────────────────────────────────────
// `metaBrowserPixel.ts` holds module-level `initialized` + `scriptInjected`
// flags. We must reset the module between tests so each test starts clean.
async function freshSetup() {
  vi.resetModules();
  // Stub the env var BEFORE importing anything that reads it.
  vi.stubEnv("VITE_META_PIXEL_ID", "1234567890");

  // Install the fbq spy BEFORE the module's init runs. Because `window.fbq`
  // already exists, `injectBaseScript` bails out early and does NOT load
  // the real Facebook script — perfect for jsdom.
  const fbqSpy = vi.fn();
  // @ts-expect-error — minimal shape for the spy
  window.fbq = fbqSpy;
  // @ts-expect-error
  window._fbq = fbqSpy;

  // Mock fetch to assert no browser POSTs to capi-event ever happen.
  const fetchSpy = vi.fn().mockResolvedValue(
    new Response("{}", { status: 200, headers: { "content-type": "application/json" } })
  );
  // @ts-expect-error
  globalThis.fetch = fetchSpy;

  // Re-import provider AFTER env + fbq are in place so module-level state
  // (initialized flag) starts fresh for this test.
  const mod = await import("@/components/AppTrackingProvider");
  return { fbqSpy, fetchSpy, AppTrackingProvider: mod.AppTrackingProvider };
}

function countPageViews(spy: ReturnType<typeof vi.fn>): number {
  return spy.mock.calls.filter(
    (call) => call[0] === "track" && call[1] === "PageView"
  ).length;
}

function countInits(spy: ReturnType<typeof vi.fn>): number {
  return spy.mock.calls.filter((call) => call[0] === "init").length;
}

function forbiddenEventsSeen(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls
    .filter((call) => call[0] === "track" && FORBIDDEN_EVENTS.has(String(call[1])))
    .map((call) => String(call[1]));
}

function capiEventCallSeen(spy: ReturnType<typeof vi.fn>): boolean {
  return spy.mock.calls.some((call) => {
    const url = String(call[0] ?? "");
    return url.includes("capi-event");
  });
}

// ── Tiny harness component that exposes navigate() to the test ─────────────
let navigateRef: ((to: string) => void) | null = null;
function NavExposer() {
  const navigate = useNavigate();
  useEffect(() => {
    navigateRef = (to: string) => navigate(to);
    return () => {
      navigateRef = null;
    };
  }, [navigate]);
  return null;
}

describe("Browser Meta PageView dedupe — runtime proof", () => {
  beforeEach(() => {
    navigateRef = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    // @ts-expect-error
    delete window.fbq;
    // @ts-expect-error
    delete window._fbq;
  });

  it("fires exactly 1 PageView on initial mount", async () => {
    const { fbqSpy, fetchSpy, AppTrackingProvider } = await freshSetup();

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <AppTrackingProvider>
            <NavExposer />
            <Routes>
              <Route path="/" element={<div>home</div>} />
              <Route path="/about" element={<div>about</div>} />
              <Route path="/contact" element={<div>contact</div>} />
            </Routes>
          </AppTrackingProvider>
        </MemoryRouter>
      );
    });

    expect(countInits(fbqSpy)).toBe(1);
    expect(countPageViews(fbqSpy)).toBe(1);
    expect(forbiddenEventsSeen(fbqSpy)).toEqual([]);
    expect(capiEventCallSeen(fetchSpy)).toBe(false);
  });

  it("adds exactly +1 PageView per SPA route change", async () => {
    const { fbqSpy, fetchSpy, AppTrackingProvider } = await freshSetup();

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <AppTrackingProvider>
            <NavExposer />
            <Routes>
              <Route path="/" element={<div>home</div>} />
              <Route path="/about" element={<div>about</div>} />
              <Route path="/contact" element={<div>contact</div>} />
              <Route path="/faq" element={<div>faq</div>} />
            </Routes>
          </AppTrackingProvider>
        </MemoryRouter>
      );
    });

    // Initial mount baseline
    expect(countPageViews(fbqSpy)).toBe(1);

    // One route change → +1
    await act(async () => {
      navigateRef!("/about");
    });
    expect(countPageViews(fbqSpy)).toBe(2);

    // Second route change → +1
    await act(async () => {
      navigateRef!("/contact");
    });
    expect(countPageViews(fbqSpy)).toBe(3);

    // Third route change → +1
    await act(async () => {
      navigateRef!("/faq");
    });
    expect(countPageViews(fbqSpy)).toBe(4);

    // Init must still be exactly once across all navigations
    expect(countInits(fbqSpy)).toBe(1);

    // No forbidden conversion events
    expect(forbiddenEventsSeen(fbqSpy)).toEqual([]);

    // No browser POSTs to capi-event
    expect(capiEventCallSeen(fetchSpy)).toBe(false);
  });

  it("does not double-fire when re-navigating to the same path with new search", async () => {
    const { fbqSpy, AppTrackingProvider } = await freshSetup();

    await act(async () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <AppTrackingProvider>
            <NavExposer />
            <Routes>
              <Route path="/" element={<div>home</div>} />
              <Route path="/about" element={<div>about</div>} />
            </Routes>
          </AppTrackingProvider>
        </MemoryRouter>
      );
    });

    expect(countPageViews(fbqSpy)).toBe(1);

    await act(async () => {
      navigateRef!("/about?utm_source=test");
    });
    expect(countPageViews(fbqSpy)).toBe(2);

    await act(async () => {
      navigateRef!("/about?utm_source=test2");
    });
    expect(countPageViews(fbqSpy)).toBe(3);

    expect(forbiddenEventsSeen(fbqSpy)).toEqual([]);
  });
});
