import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PIXEL_ID = "NaEYyiZGt6Hh6zVoNP5RqM";
const V2_KEY = "wg_consent_mode_v2";
const LEGACY_KEY = "wg_consent_mode";
const EVENT_ID = "wm_openai_lead_created_aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

async function loadPixelModule() {
  vi.resetModules();
  return import("./openAiAdsPixel");
}

function installOaiqSpy() {
  const spy = vi.fn() as unknown as OpenAiAdsQueue;
  window.oaiq = spy;
  return vi.mocked(spy);
}

function clearCookie(name: string) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

describe("openAiAdsPixel", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_OPENAI_ADS_PIXEL_ID", PIXEL_ID);
    window.localStorage.clear();
    delete window.oaiq;
    document.head.innerHTML = "<script data-existing-script></script>";
    clearCookie("__oppref");
    clearCookie("__obref");
    window.history.replaceState({}, "", "/");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    delete window.oaiq;
  });

  it("loads the official SDK and applies denied consent before init when consent is unset", async () => {
    const { initOpenAiAdsPixel } = await loadPixelModule();

    initOpenAiAdsPixel();

    const script = document.querySelector<HTMLScriptElement>(
      "script[data-openai-ads-pixel]",
    );
    expect(script?.src).toBe("https://bzrcdn.openai.com/sdk/oaiq.min.js");

    const calls = window.oaiq?.q ?? [];
    expect(calls[0]).toEqual(["consent", false]);
    expect(calls[1]).toEqual(["init", { pixelId: PIXEL_ID }]);
    expect(calls).not.toContainEqual([
      "measure",
      "page_viewed",
      { type: "contents" },
    ]);
  });

  it("initializes once and emits one initial plus one SPA page_viewed", async () => {
    window.localStorage.setItem(V2_KEY, "granted");
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel, trackOpenAiAdsPageViewed } =
      await loadPixelModule();

    initOpenAiAdsPixel();
    initOpenAiAdsPixel();
    window.history.replaceState({}, "", "/next?step=1");
    trackOpenAiAdsPageViewed();
    trackOpenAiAdsPageViewed();

    expect(oaiq.mock.calls.filter(([command]) => command === "init")).toEqual([
      ["init", { pixelId: PIXEL_ID }],
    ]);
    expect(
      oaiq.mock.calls.filter(
        ([command, eventName]) =>
          command === "measure" && eventName === "page_viewed",
      ),
    ).toEqual([
      ["measure", "page_viewed", { type: "contents" }],
      ["measure", "page_viewed", { type: "contents" }],
    ]);
  });

  it("does not count a hash-only navigation as a new page", async () => {
    window.localStorage.setItem(V2_KEY, "granted");
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel, trackOpenAiAdsPageViewed } =
      await loadPixelModule();

    initOpenAiAdsPixel();
    window.history.replaceState({}, "", "/#details");
    trackOpenAiAdsPageViewed();

    expect(
      oaiq.mock.calls.filter(
        ([command, eventName]) =>
          command === "measure" && eventName === "page_viewed",
      ),
    ).toHaveLength(1);
  });

  it("re-syncs a later grant before emitting page_viewed", async () => {
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel, trackOpenAiAdsPageViewed } =
      await loadPixelModule();

    initOpenAiAdsPixel();
    window.localStorage.setItem(V2_KEY, "granted");
    trackOpenAiAdsPageViewed();

    expect(oaiq).toHaveBeenNthCalledWith(1, "consent", false);
    expect(oaiq).toHaveBeenCalledWith("consent", true);
    expect(oaiq).toHaveBeenCalledWith("measure", "page_viewed", {
      type: "contents",
    });
  });

  it("uses the server event ID unchanged for consented lead_created", async () => {
    window.localStorage.setItem(V2_KEY, "granted");
    const oaiq = installOaiqSpy();
    const { trackOpenAiAdsLeadCreated } = await loadPixelModule();

    trackOpenAiAdsLeadCreated(EVENT_ID);

    expect(oaiq).toHaveBeenCalledWith(
      "measure",
      "lead_created",
      { type: "customer_action" },
      { event_id: EVENT_ID },
    );

    const leadCall = oaiq.mock.calls.find(([, name]) => name === "lead_created");
    expect(JSON.stringify(leadCall)).not.toMatch(/email|phone|first_name/i);
  });

  it("suppresses lead_created when consent is denied", async () => {
    window.localStorage.setItem(V2_KEY, "denied");
    const oaiq = installOaiqSpy();
    const { trackOpenAiAdsLeadCreated } = await loadPixelModule();

    trackOpenAiAdsLeadCreated(EVENT_ID);

    expect(oaiq.mock.calls.some(([, name]) => name === "lead_created")).toBe(false);
  });

  it("does nothing when the public Pixel ID is missing", async () => {
    vi.stubEnv("VITE_OPENAI_ADS_PIXEL_ID", "");
    const { initOpenAiAdsPixel } = await loadPixelModule();

    initOpenAiAdsPixel();

    expect(window.oaiq).toBeUndefined();
    expect(document.querySelector("script[data-openai-ads-pixel]")).toBeNull();
  });

  it("passes raw oppref and obref without decoding", async () => {
    window.localStorage.setItem(V2_KEY, "granted");
    document.cookie = "__oppref=opaque%2Fref%3Dvalue; path=/";
    document.cookie = "__obref=browser-ref-123; path=/";
    window.history.replaceState({}, "", "/quote-check?oppref=url%2Ffallback#top");
    const { getOpenAiAdsCaptureContext } = await loadPixelModule();

    expect(getOpenAiAdsCaptureContext()).toEqual({
      measurementConsent: true,
      sourceUrl: window.location.href,
      oppref: "opaque%2Fref%3Dvalue",
      obref: "browser-ref-123",
    });
  });

  it("does not authorize measurement from legacy granted consent alone", async () => {
    window.localStorage.setItem(LEGACY_KEY, "granted");
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel, trackOpenAiAdsPageViewed } =
      await loadPixelModule();

    initOpenAiAdsPixel();
    trackOpenAiAdsPageViewed();

    expect(oaiq).toHaveBeenCalledWith("consent", false);
    expect(
      oaiq.mock.calls.some(
        ([command, eventName]) =>
          command === "measure" && eventName === "page_viewed",
      ),
    ).toBe(false);
  });

  it("does not authorize measurement from legacy denied consent alone", async () => {
    window.localStorage.setItem(LEGACY_KEY, "denied");
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel } = await loadPixelModule();

    initOpenAiAdsPixel();

    expect(oaiq).toHaveBeenCalledWith("consent", false);
    expect(
      oaiq.mock.calls.some(
        ([command, eventName]) =>
          command === "measure" && eventName === "page_viewed",
      ),
    ).toBe(false);
  });

  it("remains denied when legacy granted and v2 denied", async () => {
    window.localStorage.setItem(LEGACY_KEY, "granted");
    window.localStorage.setItem(V2_KEY, "denied");
    const oaiq = installOaiqSpy();
    const { trackOpenAiAdsLeadCreated } = await loadPixelModule();

    trackOpenAiAdsLeadCreated(EVENT_ID);

    expect(oaiq.mock.calls.some(([, name]) => name === "lead_created")).toBe(
      false,
    );
  });

  it("follows v2 granted when legacy denied", async () => {
    window.localStorage.setItem(LEGACY_KEY, "denied");
    window.localStorage.setItem(V2_KEY, "granted");
    const oaiq = installOaiqSpy();
    const { trackOpenAiAdsLeadCreated } = await loadPixelModule();

    trackOpenAiAdsLeadCreated(EVENT_ID);

    expect(oaiq).toHaveBeenCalledWith(
      "measure",
      "lead_created",
      { type: "customer_action" },
      { event_id: EVENT_ID },
    );
  });

  it("treats invalid v2 consent as denied", async () => {
    window.localStorage.setItem(V2_KEY, "maybe");
    const oaiq = installOaiqSpy();
    const { initOpenAiAdsPixel } = await loadPixelModule();

    initOpenAiAdsPixel();

    expect(oaiq).toHaveBeenCalledWith("consent", false);
  });

  it("treats storage access failure as denied", async () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: () => {
          throw new Error("storage blocked");
        },
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0,
      },
    });
    const { hasOpenAiAdsMeasurementConsent } = await loadPixelModule();

    expect(hasOpenAiAdsMeasurementConsent()).toBe(false);
  });

  it("returns no CAPI context without explicit granted consent", async () => {
    const { getOpenAiAdsCaptureContext } = await loadPixelModule();
    expect(getOpenAiAdsCaptureContext()).toBeNull();
  });

  it("swallows SDK setup failures", async () => {
    Object.defineProperty(window, "oaiq", {
      configurable: true,
      get() {
        throw new Error("blocked by browser");
      },
    });
    const { initOpenAiAdsPixel } = await loadPixelModule();

    expect(() => initOpenAiAdsPixel()).not.toThrow();

    delete window.oaiq;
  });
});
