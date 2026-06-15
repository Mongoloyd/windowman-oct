import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  captureUtmFromUrl,
  getAttributionPayload,
  getUtmData,
  inferWmIntentFromUtmContent,
  normalizeWmIntent,
} from "./useUtmCapture";

const UTM_STORAGE_KEY = "wm_utm_data";

function installLocalStorageMock() {
  const store = new Map<string, string>();

  const localStorageMock = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    get length() {
      return store.size;
    },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
  };

  vi.stubGlobal("localStorage", localStorageMock);

  return store;
}

function mockLocation(pathname: string, search = "") {
  window.history.replaceState({}, "", `${pathname}${search}`);
}

function clearAttributionStorage() {
  localStorage.removeItem(UTM_STORAGE_KEY);
}

function clearTestCookies() {
  document.cookie = "_fbc=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = "_fbp=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
  document.cookie = "_ttp=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
}

describe("normalizeWmIntent", () => {
  it.each([
    ["has_quote", "has_quote"],
    ["has-quote", "has_quote"],
    ["no_quote", "no_quote"],
    ["no-quote", "no_quote"],
    ["", "unknown"],
    ["garbage", "unknown"],
    [null, "unknown"],
    [undefined, "unknown"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(normalizeWmIntent(input)).toBe(expected);
  });
});

describe("inferWmIntentFromUtmContent", () => {
  it.each([
    ["has_quote", "has_quote"],
    ["has-quote", "has_quote"],
    ["no_quote", "no_quote"],
    ["no-quote", "no_quote"],
    ["brand_story", null],
    [null, null],
  ] as const)("infers %s as %s", (input, expected) => {
    expect(inferWmIntentFromUtmContent(input)).toBe(expected);
  });
});

describe("captureUtmFromUrl", () => {
  beforeEach(() => {
    installLocalStorageMock();
    clearAttributionStorage();
    clearTestCookies();
  });

  afterEach(() => {
    clearAttributionStorage();
    clearTestCookies();
  });

  it("captures homepage Nextdoor URL with explicit wm_intent=has_quote", () => {
    mockLocation(
      "/",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&wm_intent=has_quote",
    );

    const data = captureUtmFromUrl();

    expect(data.utm_source).toBe("nextdoor");
    expect(data.utm_medium).toBe("paid_social");
    expect(data.utm_campaign).toBe("test");
    expect(data.wm_intent).toBe("has_quote");
    expect(data.landing_page_url).toBe(
      "/?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&wm_intent=has_quote",
    );
  });

  it("captures /about Nextdoor URL and infers wm_intent=has_quote from utm_content", () => {
    mockLocation(
      "/about",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&utm_content=has_quote",
    );

    const data = captureUtmFromUrl();

    expect(data.utm_source).toBe("nextdoor");
    expect(data.utm_content).toBe("has_quote");
    expect(data.wm_intent).toBe("has_quote");
    expect(data.landing_page).toBe("/about");
  });

  it("captures /city/pompano-beach Nextdoor URL with ndclid", () => {
    mockLocation(
      "/city/pompano-beach",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&ndclid=test123",
    );

    const data = captureUtmFromUrl();

    expect(data.utm_source).toBe("nextdoor");
    expect(data.ndclid).toBe("test123");
    expect(data.landing_page_url).toBe(
      "/city/pompano-beach?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&ndclid=test123",
    );
  });

  it("preserves first-touch landing_page_url after navigation", () => {
    mockLocation(
      "/city/pompano-beach",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&ndclid=test123",
    );
    captureUtmFromUrl();

    mockLocation("/about");
    captureUtmFromUrl();

    mockLocation("/");
    const data = captureUtmFromUrl();

    expect(data.landing_page_url).toBe(
      "/city/pompano-beach?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=test&ndclid=test123",
    );
    expect(data.landing_page).toBe("/city/pompano-beach");
    expect(data.ndclid).toBe("test123");
  });

  it("explicit wm_intent wins over utm_content inference", () => {
    mockLocation(
      "/",
      "?utm_source=nextdoor&utm_content=no_quote&wm_intent=has_quote",
    );

    const data = captureUtmFromUrl();
    expect(data.wm_intent).toBe("has_quote");
  });

  it("updates latest_touch when a new tagged URL is visited", () => {
    mockLocation("/about", "?utm_source=nextdoor&utm_campaign=first");
    const first = captureUtmFromUrl();

    mockLocation("/blog/example", "?utm_source=nextdoor&utm_campaign=second");
    const second = captureUtmFromUrl();

    expect(second.utm_campaign).toBe("second");
    expect(second.latest_touch_at).toBeGreaterThanOrEqual(first.latest_touch_at);
    expect(second.landing_page_url).toBe("/about?utm_source=nextdoor&utm_campaign=first");
  });

  it("captures the Nextdoor acceptance URL and exposes fields via getAttributionPayload", () => {
    mockLocation(
      "/",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=broward_test&utm_content=has_quote&wm_intent=has_quote&ndclid=abc123&nd_lead_id=lead_789",
    );

    const data = captureUtmFromUrl();

    expect(data.utm_source).toBe("nextdoor");
    expect(data.utm_medium).toBe("paid_social");
    expect(data.utm_campaign).toBe("broward_test");
    expect(data.utm_content).toBe("has_quote");
    expect(data.wm_intent).toBe("has_quote");
    expect(data.ndclid).toBe("abc123");
    expect(data.nd_lead_id).toBe("lead_789");

    const payload = getAttributionPayload();
    expect(payload.utm_source).toBe("nextdoor");
    expect(payload.wm_intent).toBe("has_quote");
    expect(payload.ndclid).toBe("abc123");
    expect(payload.landing_page_url).toBe(
      "/?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=broward_test&utm_content=has_quote&wm_intent=has_quote&ndclid=abc123&nd_lead_id=lead_789",
    );
    expect(payload.current_page_url).toBe(
      "/?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=broward_test&utm_content=has_quote&wm_intent=has_quote&ndclid=abc123&nd_lead_id=lead_789",
    );
    expect(payload.referrer).toBeNull();
    expect(payload.query_params).toEqual(
      expect.objectContaining({
        utm_source: "nextdoor",
        ndclid: "abc123",
        wm_intent: "has_quote",
        nd_lead_id: "lead_789",
      }),
    );
  });

  it("getAttributionPayload reflects current page after navigation", () => {
    mockLocation("/", "?utm_source=nextdoor&utm_campaign=test&wm_intent=has_quote");
    captureUtmFromUrl();

    mockLocation("/truth-gate", "");
    const payload = getAttributionPayload();

    expect(payload.utm_source).toBe("nextdoor");
    expect(payload.wm_intent).toBe("has_quote");
    expect(payload.ndclid).toBeNull();
    expect(payload.landing_page_url).toBe(
      "/?utm_source=nextdoor&utm_campaign=test&wm_intent=has_quote",
    );
    expect(payload.current_page_url).toBe("/truth-gate");
  });

  it("preserves attribution across empty-navigation SPA transitions", () => {
    mockLocation(
      "/",
      "?utm_source=nextdoor&utm_medium=paid_social&utm_campaign=broward_test&utm_content=has_quote&wm_intent=has_quote&ndclid=abc123&nd_lead_id=lead_789",
    );
    captureUtmFromUrl();

    mockLocation("/about");
    captureUtmFromUrl();

    mockLocation("/faq");
    captureUtmFromUrl();

    mockLocation("/");
    const data = captureUtmFromUrl();

    expect(data.ndclid).toBe("abc123");
    expect(data.wm_intent).toBe("has_quote");
    expect(data.nd_lead_id).toBe("lead_789");
    expect(data.utm_source).toBe("nextdoor");
    expect(data.utm_medium).toBe("paid_social");
    expect(data.utm_campaign).toBe("broward_test");
    expect(data.utm_content).toBe("has_quote");
  });

  it("treats Nextdoor-only URLs as attribution-bearing capture triggers", () => {
    mockLocation("/", "?ndclid=only_nextdoor_click&wm_intent=no_quote");

    const data = captureUtmFromUrl();

    expect(data.ndclid).toBe("only_nextdoor_click");
    expect(data.wm_intent).toBe("no_quote");
    expect(data.captured_at).toBeGreaterThan(0);
  });

  it("still captures fbclid and gclid for Meta/Google regression", () => {
    mockLocation("/", "?fbclid=meta_click_123&gclid=google_click_456");

    const data = captureUtmFromUrl();

    expect(data.fbclid).toBe("meta_click_123");
    expect(data.gclid).toBe("google_click_456");
  });

  it("does not throw when localStorage contains corrupted attribution JSON", () => {
    localStorage.setItem(UTM_STORAGE_KEY, "{not-valid-json");

    mockLocation("/");

    expect(() => getUtmData()).not.toThrow();
    expect(() => captureUtmFromUrl()).not.toThrow();
  });
});

describe("CLICK_ID_KEYS contract", () => {
  it("keeps ndclid out of CLICK_ID_KEYS (Nextdoor uses NEXTDOOR_KEYS)", () => {
    const filePath = join(dirname(fileURLToPath(import.meta.url)), "useUtmCapture.ts");
    const source = readFileSync(filePath, "utf8");
    expect(source).toContain('const CLICK_ID_KEYS = [');
    expect(source).not.toMatch(/CLICK_ID_KEYS\s*=\s*\[[^\]]*ndclid/s);
    expect(source).toContain('"ndclid"');
  });
});
