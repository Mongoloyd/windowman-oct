import { useCallback, useEffect, useState } from "react";
import {
  MEASUREMENT_CONSENT_CHANGED_EVENT,
  readStoredMeasurementConsent,
  writeStoredMeasurementConsent,
  type StoredMeasurementConsent,
} from "@/lib/consent/measurementConsent";
const PERSISTENCE_ERROR =
  "Unable to save your choice. Please try again.";

function pushToDataLayer(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

function updateGtagConsent(mode: StoredMeasurementConsent) {
  if (typeof window === "undefined") return;

  window.gtag =
    window.gtag ||
    function (...args: unknown[]) {
      (window.dataLayer = window.dataLayer || []).push(
        args as unknown as Record<string, unknown>,
      );
    };

  window.gtag("consent", "update", {
    ad_storage: mode,
    ad_user_data: mode,
    ad_personalization: mode,
    analytics_storage: mode,
    functionality_storage: mode,
    personalization_storage: mode,
  });
}

export default function ConsentBanner() {
  const [storedMode, setStoredMode] =
    useState<StoredMeasurementConsent | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    const savedMode = readStoredMeasurementConsent();
    setStoredMode(savedMode);
    setIsReady(true);

    if (!savedMode) return;

    // Restore the saved choice for tags that initialize after this component.
    updateGtagConsent(savedMode);
    pushToDataLayer({
      event: "consent_update",
      consent_choice: savedMode === "granted" ? "accepted" : "rejected",
      consent_type: "all",
    });
  }, []);

  const saveChoice = useCallback((mode: StoredMeasurementConsent) => {
    setPersistenceError(null);

    const persisted = writeStoredMeasurementConsent(mode);
    if (!persisted) {
      setPersistenceError(PERSISTENCE_ERROR);
      return;
    }

    updateGtagConsent(mode);
    pushToDataLayer({
      event: "consent_update",
      consent_choice: mode === "granted" ? "accepted" : "rejected",
      consent_type: "all",
    });
    window.dispatchEvent(new Event(MEASUREMENT_CONSENT_CHANGED_EVENT));
    setStoredMode(mode);
  }, []);

  const isBannerVisible = isReady && storedMode === null;

  if (!isReady) return null;
  if (!isBannerVisible) return null;

  return (
    <section
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white text-slate-900 shadow-[0_-4px_16px_rgba(15,23,42,0.12)]"
    >
      <div className="mx-auto flex min-h-[52px] max-w-7xl items-center gap-2 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:gap-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] leading-4 sm:text-xs">
            We use cookies and measurement to improve your experience. You can
            accept or decline measurement.
          </p>
          {persistenceError ? (
            <p role="alert" className="mt-1 text-[11px] font-medium text-red-700 sm:text-xs">
              {persistenceError}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => saveChoice("granted")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md bg-slate-900 px-3 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:text-xs"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => saveChoice("denied")}
            className="inline-flex min-h-11 min-w-11 items-center justify-center border-0 bg-transparent px-3 text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 sm:text-xs"
          >
            Decline
          </button>
        </div>
      </div>
    </section>
  );
}
