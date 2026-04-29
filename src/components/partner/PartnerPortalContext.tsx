/**
 * PartnerPortalContext — bridge that lets nested partner pages
 * publish their credit balance + preview state up to the shared
 * PartnerLayout chrome (header, credit pill, Add Credits CTA).
 *
 * Child pages still own data fetching. They simply call
 * `setCreditBalance(meta.credit_balance)` after each fetch so the
 * layout shows a stable, non-stale value during navigation.
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

interface PartnerPortalContextValue {
  creditBalance: number | null;
  isPreview: boolean;
  isDemoMode: boolean;
  setCreditBalance: (v: number | null) => void;
  setIsPreview: (v: boolean) => void;
  setIsDemoMode: (v: boolean) => void;
  toggleDemoMode: () => void;
}

const PartnerPortalContext = createContext<PartnerPortalContextValue | null>(null);

export function PartnerPortalProvider({ children }: { children: ReactNode }) {
  const [creditBalance, setCreditBalanceState] = useState<number | null>(null);
  const [isPreview, setIsPreviewState] = useState(false);
  const [isDemoMode, setIsDemoModeState] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("demo") === "1" || params.get("wm_demo") === "1";
  });

  const setCreditBalance = useCallback((v: number | null) => {
    setCreditBalanceState((prev) => (prev === v ? prev : v));
  }, []);

  const setIsPreview = useCallback((v: boolean) => {
    setIsPreviewState((prev) => (prev === v ? prev : v));
  }, []);

  const setIsDemoMode = useCallback((v: boolean) => {
    setIsDemoModeState((prev) => (prev === v ? prev : v));
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoModeState((prev) => !prev);
  }, []);

  const value = useMemo<PartnerPortalContextValue>(
    () => ({
      creditBalance,
      isPreview,
      isDemoMode,
      setCreditBalance,
      setIsPreview,
      setIsDemoMode,
      toggleDemoMode,
    }),
    [creditBalance, isPreview, isDemoMode, setCreditBalance, setIsPreview, setIsDemoMode, toggleDemoMode],
  );

  return (
    <PartnerPortalContext.Provider value={value}>
      {children}
    </PartnerPortalContext.Provider>
  );
}

export function usePartnerPortal(): PartnerPortalContextValue {
  const ctx = useContext(PartnerPortalContext);
  if (!ctx) {
    // Safe no-op so pages used outside the layout (tests, isolated previews)
    // don't crash. Updates simply have no observable effect.
    return {
      creditBalance: null,
      isPreview: false,
      isDemoMode: false,
      setCreditBalance: () => {},
      setIsPreview: () => {},
      setIsDemoMode: () => {},
      toggleDemoMode: () => {},
    };
  }
  return ctx;
}
