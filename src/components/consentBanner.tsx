import { useCallback, useEffect, useState } from "react";

const CONSENT_STORAGE_KEY = "wg_consent_mode_v2";
const CONSENT_CHANGED_EVENT = "consentChanged";
const PERSISTENCE_ERROR =
  "Unable to save your choice. Please try again.";

type ConsentMode = "granted" | "denied";

function readStoredConsent(): ConsentMode | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value === "granted" || value === "denied" ? value : null;
  } catch {
    return null;
  }
}

function writeStoredConsent(mode: ConsentMode): boolean {
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, mode);
    return true;
  } catch {
    // Storage-restricted browsers remain fail-closed for measurement.
    return false;
  }
}

function pushToDataLayer(payload: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push(payload);
}

function updateGtagConsent(mode: ConsentMode) {
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
  const [storedMode, setStoredMode] = useState<ConsentMode | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  useEffect(() => {
    const savedMode = readStoredConsent();
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

  const saveChoice = useCallback((mode: ConsentMode) => {
    setPersistenceError(null);

    const persisted = writeStoredConsent(mode);
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
    window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
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
            className="rounded-md bg-slate-900 px-2.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:px-3 sm:text-xs"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => saveChoice("denied")}
            className="border-0 bg-transparent px-1.5 py-2 text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 sm:text-xs"
          >
            Decline
          </button>
        </div>
      </div>
    </section>
  );
}
