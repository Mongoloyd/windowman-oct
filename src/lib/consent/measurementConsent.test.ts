import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isMeasurementConsentGranted,
  MEASUREMENT_CONSENT_STORAGE_KEY,
  readAdvertisingMeasurementDecision,
  readStoredMeasurementConsent,
  writeStoredMeasurementConsent,
} from "./measurementConsent";

describe("measurementConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("maps the stored banner decision to the consent contract", () => {
    expect(readStoredMeasurementConsent()).toBeNull();
    expect(readAdvertisingMeasurementDecision()).toBeNull();
    expect(isMeasurementConsentGranted()).toBe(false);

    expect(writeStoredMeasurementConsent("granted")).toBe(true);
    expect(readAdvertisingMeasurementDecision()).toBe("granted");
    expect(isMeasurementConsentGranted()).toBe(true);

    expect(writeStoredMeasurementConsent("denied")).toBe(true);
    expect(readAdvertisingMeasurementDecision()).toBe("declined");
    expect(isMeasurementConsentGranted()).toBe(false);
  });

  it("fails closed for unknown or inaccessible storage", () => {
    localStorage.setItem(MEASUREMENT_CONSENT_STORAGE_KEY, "unexpected");
    expect(readStoredMeasurementConsent()).toBeNull();

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked");
    });
    expect(readAdvertisingMeasurementDecision()).toBeNull();
    expect(isMeasurementConsentGranted()).toBe(false);
  });
});
