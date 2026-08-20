export const MEASUREMENT_CONSENT_STORAGE_KEY = "wg_consent_mode_v2";
export const MEASUREMENT_CONSENT_CHANGED_EVENT = "consentChanged";

export type StoredMeasurementConsent = "granted" | "denied";
export type AdvertisingMeasurementDecision = "granted" | "declined";

export function readStoredMeasurementConsent(): StoredMeasurementConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(MEASUREMENT_CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

export function writeStoredMeasurementConsent(
  mode: StoredMeasurementConsent,
): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.localStorage.setItem(MEASUREMENT_CONSENT_STORAGE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}

export function readAdvertisingMeasurementDecision():
  | AdvertisingMeasurementDecision
  | null {
  const mode = readStoredMeasurementConsent();
  if (mode === "granted") return "granted";
  if (mode === "denied") return "declined";
  return null;
}

export function isMeasurementConsentGranted(): boolean {
  return readStoredMeasurementConsent() === "granted";
}
