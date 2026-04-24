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
  setCreditBalance: (v: number | null) => void;
  setIsPreview: (v: boolean) => void;
}

const PartnerPortalContext = createContext<PartnerPortalContextValue | null>(null);

export function PartnerPortalProvider({ children }: { children: ReactNode }) {
  const [creditBalance, setCreditBalanceState] = useState<number | null>(null);
  const [isPreview, setIsPreviewState] = useState(false);

  const setCreditBalance = useCallback((v: number | null) => {
    setCreditBalanceState((prev) => (prev === v ? prev : v));
  }, []);

  const setIsPreview = useCallback((v: boolean) => {
    setIsPreviewState((prev) => (prev === v ? prev : v));
  }, []);

  const value = useMemo<PartnerPortalContextValue>(
    () => ({ creditBalance, isPreview, setCreditBalance, setIsPreview }),
    [creditBalance, isPreview, setCreditBalance, setIsPreview],
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
      setCreditBalance: () => {},
      setIsPreview: () => {},
    };
  }
  return ctx;
}
