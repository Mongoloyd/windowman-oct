import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEASUREMENT_CONSENT_STORAGE_KEY } from "./consent/measurementConsent";

describe("metaBrowserPixel", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("VITE_META_PIXEL_ID", "1234567890");
    localStorage.clear();
    delete window.fbq;
    delete window._fbq;
  });

  it("fails closed without advertising measurement consent", async () => {
    const { initMetaBrowserPixel, trackMetaPageView } = await import(
      "./metaBrowserPixel"
    );

    expect(initMetaBrowserPixel()).toBe(false);
    expect(trackMetaPageView()).toBe(false);
    expect(window.fbq).toBeUndefined();
  });

  it("advertising measurement declined emits zero browser Meta events", async () => {
    localStorage.setItem(MEASUREMENT_CONSENT_STORAGE_KEY, "declined");
    const { initMetaBrowserPixel, trackMetaPageView } = await import(
      "./metaBrowserPixel"
    );

    expect(initMetaBrowserPixel()).toBe(false);
    expect(trackMetaPageView()).toBe(false);
    expect(window.fbq).toBeUndefined();
  });

  it("emits PageView only after consent and never emits a conversion", async () => {
    localStorage.setItem(MEASUREMENT_CONSENT_STORAGE_KEY, "granted");
    const { initMetaBrowserPixel, trackMetaPageView } = await import(
      "./metaBrowserPixel"
    );

    expect(initMetaBrowserPixel()).toBe(true);
    expect(trackMetaPageView()).toBe(true);

    const calls = (window.fbq?.queue ?? []) as unknown[][];
    expect(calls).toContainEqual(["init", "1234567890"]);
    expect(calls.filter((call) => call[0] === "track")).toEqual([
      ["track", "PageView"],
      ["track", "PageView"],
    ]);
    expect(JSON.stringify(calls)).not.toMatch(
      /Lead|QualifiedChatLead|SubmitApplication/,
    );
  });
});
