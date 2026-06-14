import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  captureUtmFromUrl,
  getAttributionPayload,
  getUtmData,
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
    expect(payload.ndclid).toBe("abc123");
    expect(payload.wm_intent).toBe("has_quote");
    expect(payload.nd_lead_id).toBe("lead_789");
    expect(payload.query_params).toEqual(
      expect.objectContaining({
        utm_source: "nextdoor",
        ndclid: "abc123",
        wm_intent: "has_quote",
        nd_lead_id: "lead_789",
      }),
    );
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
    // _fbc cookie synthesis depends on jsdom cookie semantics; fbclid capture
    // is the stable contract asserted here.
  });

  it("does not throw when localStorage contains corrupted attribution JSON", () => {
    localStorage.setItem(UTM_STORAGE_KEY, "{not-valid-json");

    mockLocation("/");

    expect(() => getUtmData()).not.toThrow();
    expect(() => captureUtmFromUrl()).not.toThrow();
  });
});
