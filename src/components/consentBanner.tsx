import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";

const CONSENT_STORAGE_KEY = "wg_consent_mode";
const CONSENT_CHANGED_EVENT = "consentChanged";
const SCROLL_ACCEPT_THRESHOLD_PX = 200;

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
    const persisted = writeStoredConsent(mode);

    if (persisted) {
      updateGtagConsent(mode);
      pushToDataLayer({
        event: "consent_update",
        consent_choice: mode === "granted" ? "accepted" : "rejected",
        consent_type: "all",
      });
      window.dispatchEvent(new Event(CONSENT_CHANGED_EVENT));
    }

    setStoredMode(mode);
    setIsSettingsOpen(false);
  }, []);

  const isBannerVisible = isReady && (storedMode === null || isSettingsOpen);

  useEffect(() => {
    // Scroll acceptance applies only to a first-time, undecided visitor. A
    // visitor who deliberately reopens Privacy settings must click a choice.
    if (!isBannerVisible || storedMode !== null || isSettingsOpen) return;

    const startingScrollY = window.scrollY;

    const handleScroll = () => {
      if (
        Math.abs(window.scrollY - startingScrollY) <
        SCROLL_ACCEPT_THRESHOLD_PX
      ) {
        return;
      }

      window.removeEventListener("scroll", handleScroll);
      saveChoice("granted");
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isBannerVisible, isSettingsOpen, saveChoice, storedMode]);

  if (!isReady) return null;

  if (!isBannerVisible) {
    return (
      <button
        type="button"
        onClick={() => setIsSettingsOpen(true)}
        className="fixed bottom-2 left-2 z-[60] rounded-sm bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 transition-colors hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
      >
        Privacy settings
      </button>
    );
  }

  return (
    <section
      aria-label="Cookie consent"
      aria-live="polite"
      className="fixed inset-x-0 bottom-0 z-[100] border-t border-slate-200 bg-white text-slate-900 shadow-[0_-4px_16px_rgba(15,23,42,0.12)]"
    >
      <div className="mx-auto flex min-h-[52px] max-w-7xl items-center gap-2 px-3 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] sm:gap-4 sm:px-5">
        <p className="min-w-0 flex-1 text-[11px] leading-4 sm:text-xs">
          We use cookies and measurement to improve our experience. By using the
          site you agree.
        </p>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={() => saveChoice("denied")}
            className="px-1.5 py-2 text-[11px] font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 sm:text-xs"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => saveChoice("granted")}
            className="rounded-md bg-slate-900 px-2.5 py-2 text-[11px] font-semibold text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2 sm:px-3 sm:text-xs"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => saveChoice("granted")}
            aria-label="Accept cookies and close"
            title="Accept and close"
            className="flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}
