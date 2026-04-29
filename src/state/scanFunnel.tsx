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
  setClientSlug: (slug: string | null) => void;
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
  leadId: `${LS_PREFIX}leadId`,
  sessionId: `${LS_PREFIX}sessionId`,
  scanSessionId: `${LS_PREFIX}scanSessionId`,
  quoteFileId: `${LS_PREFIX}quoteFileId`,
  clientSlug: `${LS_PREFIX}clientSlug`,
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
    const leadId = localStorage.getItem(LS_KEYS.leadId) || null;
    const sessionId = localStorage.getItem(LS_KEYS.sessionId) || null;
    const scanSessionId = localStorage.getItem(LS_KEYS.scanSessionId) ?? null;
    const quoteFileId = localStorage.getItem(LS_KEYS.quoteFileId) || null;
    const clientSlug = localStorage.getItem(LS_KEYS.clientSlug) || null;
    if (!phoneE164 && phoneStatus === "none" && !leadId && !sessionId && !scanSessionId && !quoteFileId && !clientSlug) return {};
    return { phoneE164, phoneStatus, leadId, sessionId, scanSessionId, quoteFileId, clientSlug };
  } catch {
    return {};
  }
}

function persistFields(fields: { phoneE164?: string | null; phoneStatus?: PhoneFunnelStatus; leadId?: string | null; sessionId?: string | null; scanSessionId?: string | null; quoteFileId?: string | null; clientSlug?: string | null }) {
  try {
    if (fields.phoneE164 !== undefined) {
      if (fields.phoneE164) localStorage.setItem(LS_KEYS.phoneE164, fields.phoneE164);
      else localStorage.removeItem(LS_KEYS.phoneE164);
    }
    if (fields.phoneStatus !== undefined) {
      localStorage.setItem(LS_KEYS.phoneStatus, fields.phoneStatus);
    }
    if (fields.leadId !== undefined) {
      if (fields.leadId) localStorage.setItem(LS_KEYS.leadId, fields.leadId);
      else localStorage.removeItem(LS_KEYS.leadId);
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
    if (fields.quoteFileId !== undefined) {
      if (fields.quoteFileId) localStorage.setItem(LS_KEYS.quoteFileId, fields.quoteFileId);
      else localStorage.removeItem(LS_KEYS.quoteFileId);
    }
    if (fields.clientSlug !== undefined) {
      if (fields.clientSlug) localStorage.setItem(LS_KEYS.clientSlug, fields.clientSlug);
      else localStorage.removeItem(LS_KEYS.clientSlug);
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
  leadId: string | null;
  quoteFileId: string | null;
  phoneE164: string | null;
  phoneStatus: PhoneFunnelStatus;
} | null {
  const persisted = readPersistedState();
  if (!persisted || !persisted.scanSessionId) return null;
  return {
    scanSessionId: persisted.scanSessionId,
    sessionId: persisted.sessionId ?? null,
    leadId: persisted.leadId ?? null,
    quoteFileId: persisted.quoteFileId ?? null,
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
    persistFields({ leadId: id });
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
    persistFields({ quoteFileId: id });
  }, []);

  const setClientSlug = useCallback((slug: string | null) => {
    setState((s) => ({ ...s, clientSlug: slug }));
    persistFields({ clientSlug: slug });
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
      setClientSlug,
      resetFunnel,
      clearFunnel,
    }),
    [state, setPhone, setPhoneStatus, setLeadId, setSessionId, setScanSessionId, setQuoteFileId, setClientSlug, resetFunnel, clearFunnel]
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
