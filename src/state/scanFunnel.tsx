/**
 * ScanFunnelContext — Funnel-scoped state for the quote-upload flow.
 *
 * Tracks phone, OTP, lead, session, and scan state so that
 * downstream components (ScanTheatrics, VerifyGate, TruthReportClassic)
 * can branch correctly without prop-threading.
 *
 * Persists phoneE164, phoneStatus, and sessionId to localStorage
 * so they survive page refresh. Expires after 24 hours.
 *
 * Wrap the quote-upload funnel subtree with <ScanFunnelProvider>.
 */

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";

/* ── Types ─────────────────────────────────────────────── */

export type PhoneFunnelStatus =
  | "none"
  | "screened_valid"
  | "sending_otp"
  | "otp_sent"
  | "send_failed"
  | "verified";

export interface ScanFunnelState {
  phoneE164: string | null;
  phoneStatus: PhoneFunnelStatus;
  leadId: string | null;
  sessionId: string | null;
  scanSessionId: string | null;
  quoteFileId: string | null;
  clientSlug: string | null;
}

export interface ScanFunnelActions {
  setPhone: (e164: string, status: PhoneFunnelStatus) => void;
  setPhoneStatus: (status: PhoneFunnelStatus) => void;
  setLeadId: (id: string) => void;
  setSessionId: (id: string) => void;
  setScanSessionId: (id: string) => void;
  setQuoteFileId: (id: string) => void;
  resetFunnel: () => void;
  /** Clear persisted state (on report unlock or stale cleanup) */
  clearFunnel: () => void;
}

type ScanFunnelContextValue = ScanFunnelState & ScanFunnelActions;

/* ── localStorage keys & helpers ───────────────────────── */

const LS_PREFIX = "wm_funnel_";
const LS_KEYS = {
  phoneE164: `${LS_PREFIX}phoneE164`,
  phoneStatus: `${LS_PREFIX}phoneStatus`,
  sessionId: `${LS_PREFIX}sessionId`,
  scanSessionId: `${LS_PREFIX}scanSessionId`,
  timestamp: `${LS_PREFIX}ts`,
} as const;

const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

function readPersistedState(): Partial<ScanFunnelState> {
  try {
    const ts = localStorage.getItem(LS_KEYS.timestamp);
    if (ts && Date.now() - Number(ts) > EXPIRY_MS) {
      Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
      return {};
    }
    const phoneE164 = localStorage.getItem(LS_KEYS.phoneE164) || null;
    const phoneStatus = (localStorage.getItem(LS_KEYS.phoneStatus) as PhoneFunnelStatus) || "none";
    const sessionId = localStorage.getItem(LS_KEYS.sessionId) || null;
    const scanSessionId = localStorage.getItem(LS_KEYS.scanSessionId) ?? null;
    if (!phoneE164 && phoneStatus === "none" && !sessionId && !scanSessionId) return {};
    return { phoneE164, phoneStatus, sessionId, scanSessionId };
  } catch {
    return {};
  }
}

function persistFields(fields: { phoneE164?: string | null; phoneStatus?: PhoneFunnelStatus; sessionId?: string | null; scanSessionId?: string | null }) {
  try {
    if (fields.phoneE164 !== undefined) {
      if (fields.phoneE164) localStorage.setItem(LS_KEYS.phoneE164, fields.phoneE164);
      else localStorage.removeItem(LS_KEYS.phoneE164);
    }
    if (fields.phoneStatus !== undefined) {
      localStorage.setItem(LS_KEYS.phoneStatus, fields.phoneStatus);
    }
    if (fields.sessionId !== undefined) {
      if (fields.sessionId) localStorage.setItem(LS_KEYS.sessionId, fields.sessionId);
      else localStorage.removeItem(LS_KEYS.sessionId);
    }
    if (fields.scanSessionId !== undefined) {
      if (typeof fields.scanSessionId === "string" && fields.scanSessionId.length > 0) {
        localStorage.setItem(LS_KEYS.scanSessionId, fields.scanSessionId);
      } else if (fields.scanSessionId === null) {
        localStorage.removeItem(LS_KEYS.scanSessionId);
      }
    }
    localStorage.setItem(LS_KEYS.timestamp, String(Date.now()));
  } catch { /* localStorage unavailable */ }
}

function clearPersistedFunnel() {
  try {
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/**
 * Additive read-back helper for restoring an in-flight scan funnel
 * after a bare page refresh. Returns null if no valid (non-expired)
 * persisted state exists.
 *
 * Used by the homepage to safely re-enter the canonical scan flow
 * (preview / OTP) without requiring a `?resume=1` URL parameter.
 *
 * Fail-closed: any expiry, parse error, or missing scanSessionId
 * yields null and the caller should fall through to the marketing hero.
 */
export function readPersistedFunnelSnapshot(): {
  scanSessionId: string | null;
  sessionId: string | null;
  phoneE164: string | null;
  phoneStatus: PhoneFunnelStatus;
} | null {
  const persisted = readPersistedState();
  if (!persisted || !persisted.scanSessionId) return null;
  return {
    scanSessionId: persisted.scanSessionId,
    sessionId: persisted.sessionId ?? null,
    phoneE164: persisted.phoneE164 ?? null,
    phoneStatus: persisted.phoneStatus ?? "none",
  };
}

/* ── Defaults ──────────────────────────────────────────── */

const DEFAULT_STATE: ScanFunnelState = {
  phoneE164: null,
  phoneStatus: "none",
  leadId: null,
  sessionId: null,
  scanSessionId: null,
  quoteFileId: null,
  clientSlug: null,
};

/* ── Context ───────────────────────────────────────────── */

export const ScanFunnelContext = createContext<ScanFunnelContextValue | null>(null);

function devLogFunnel(label: string, state: ScanFunnelState) {
  if (!import.meta.env.DEV) return;
  console.info(`[ScanFunnelProvider] ${label}`, {
    sessionId: state.sessionId,
    leadId: state.leadId,
    quoteFileId: state.quoteFileId,
    scanSessionId: state.scanSessionId,
    phoneStatus: state.phoneStatus,
    clientSlug: state.clientSlug,
  });
}

/* ── Provider ──────────────────────────────────────────── */

export function ScanFunnelProvider({ children, initialClientSlug }: { children: React.ReactNode; initialClientSlug?: string }) {
  const [state, setState] = useState<ScanFunnelState>(() => {
    const persisted = readPersistedState();
    return { ...DEFAULT_STATE, ...persisted, clientSlug: initialClientSlug ?? null };
  });

  const setPhone = useCallback((e164: string, status: PhoneFunnelStatus) => {
    setState((s) => ({ ...s, phoneE164: e164, phoneStatus: status }));
    persistFields({ phoneE164: e164, phoneStatus: status });
  }, []);

  const setPhoneStatus = useCallback((status: PhoneFunnelStatus) => {
    setState((s) => ({ ...s, phoneStatus: status }));
    persistFields({ phoneStatus: status });
  }, []);

  const setLeadId = useCallback((id: string) => {
    setState((s) => ({ ...s, leadId: id }));
  }, []);

  const setSessionId = useCallback((id: string) => {
    setState((s) => ({ ...s, sessionId: id }));
    persistFields({ sessionId: id });
  }, []);

  const setScanSessionId = useCallback((id: string) => {
    setState((s) => ({ ...s, scanSessionId: id }));
    persistFields({ scanSessionId: id });
  }, []);

  const setQuoteFileId = useCallback((id: string) => {
    setState((s) => ({ ...s, quoteFileId: id }));
  }, []);

  const resetFunnel = useCallback(() => {
    setState(DEFAULT_STATE);
    clearPersistedFunnel();
  }, []);

  const clearFunnel = useCallback(() => {
    setState(DEFAULT_STATE);
    clearPersistedFunnel();
  }, []);

  useEffect(() => {
    devLogFunnel("mount", state);
    return () => devLogFunnel("unmount", state);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount/unmount diagnostic only
  }, []);

  useEffect(() => {
    devLogFunnel("state_change", state);
  }, [state]);

  const value = useMemo<ScanFunnelContextValue>(
    () => ({
      ...state,
      setPhone,
      setPhoneStatus,
      setLeadId,
      setSessionId,
      setScanSessionId,
      setQuoteFileId,
      resetFunnel,
      clearFunnel,
    }),
    [state, setPhone, setPhoneStatus, setLeadId, setSessionId, setScanSessionId, setQuoteFileId, resetFunnel, clearFunnel]
  );

  return (
    <ScanFunnelContext.Provider value={value}>
      {children}
    </ScanFunnelContext.Provider>
  );
}

/* ── Hooks ─────────────────────────────────────────────── */

export function useScanFunnel(): ScanFunnelContextValue {
  const ctx = useContext(ScanFunnelContext);
  if (!ctx) {
    throw new Error("useScanFunnel must be used within a <ScanFunnelProvider>");
  }
  return ctx;
}

/** Safe version — returns null when outside provider (for shared hooks like useReportAccess) */
export function useScanFunnelSafe(): ScanFunnelContextValue | null {
  return useContext(ScanFunnelContext);
}
