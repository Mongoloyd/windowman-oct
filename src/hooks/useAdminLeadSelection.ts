import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

export const ADMIN_XL_MEDIA_QUERY = "(min-width: 1280px)";
export type AdminLeadPresentation = "sheet" | "full-viewport";

const SCROLL_TTL_MS = 30 * 60 * 1000;
const PII_QUERY_KEYS = ["q", "search", "name", "email", "phone", "phone_e164"] as const;

export function writeLeadIdParam(
  current: URLSearchParams,
  leadId: string | null,
): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const key of PII_QUERY_KEYS) {
    next.delete(key);
  }
  if (leadId) next.set("lead_id", leadId);
  else next.delete("lead_id");
  return next;
}

export function buildLeadSelectionHref(
  current: URLSearchParams,
  leadId: string,
): string {
  const next = writeLeadIdParam(current, leadId);
  const query = next.toString();
  return query ? `?${query}` : "?";
}

function collectionScrollKey(pathname: string, params: URLSearchParams): string {
  const canonical = new URLSearchParams(params);
  canonical.delete("lead_id");
  for (const key of PII_QUERY_KEYS) {
    canonical.delete(key);
  }
  return `wm-admin-collection-scroll:${pathname}?${canonical.toString()}`;
}

function safeScrollTo(top: number): void {
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return;
  }
  window.scrollTo({ top, left: 0, behavior: "auto" });
}

export function captureCollectionScroll(pathname: string, params: URLSearchParams): void {
  const offset = window.scrollY;
  if (!Number.isFinite(offset) || offset < 0) return;
  sessionStorage.setItem(
    collectionScrollKey(pathname, params),
    JSON.stringify({ offset, savedAt: Date.now() }),
  );
}

export function restoreCollectionScroll(pathname: string, params: URLSearchParams): boolean {
  try {
    const raw = sessionStorage.getItem(collectionScrollKey(pathname, params));
    if (!raw) return false;
    const parsed = JSON.parse(raw) as { offset?: number; savedAt?: number };
    if (
      typeof parsed.offset !== "number" ||
      parsed.offset < 0 ||
      typeof parsed.savedAt !== "number" ||
      Date.now() - parsed.savedAt > SCROLL_TTL_MS
    ) {
      sessionStorage.removeItem(collectionScrollKey(pathname, params));
      return false;
    }
    const maxOffset = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (parsed.offset > maxOffset + 8) {
      sessionStorage.removeItem(collectionScrollKey(pathname, params));
      return false;
    }
    safeScrollTo(parsed.offset);
    return true;
  } catch {
    return false;
  }
}

export function useAdminXlPresentation(): AdminLeadPresentation {
  const [isXl, setIsXl] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(ADMIN_XL_MEDIA_QUERY);
    const sync = () => setIsXl(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return isXl ? "sheet" : "full-viewport";
}

export function useAdminLeadSelection<T extends { id: string }>(
  leads: readonly T[],
  options: { isReady?: boolean; onBeforeOpen?: () => void } = {},
) {
  const { isReady = true, onBeforeOpen } = options;
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const selectedLeadId = searchParams.get("lead_id");
  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? null;
  const inaccessible = Boolean(selectedLeadId) && isReady && !selectedLead;
  const openedFromListRef = useRef(false);
  const launcherRef = useRef<HTMLElement | null>(null);
  const presentation = useAdminXlPresentation();

  const openHref = useCallback(
    (leadId: string) => buildLeadSelectionHref(searchParams, leadId),
    [searchParams],
  );

  const openLead = useCallback(
    (leadId: string, launcher?: HTMLElement | null) => {
      onBeforeOpen?.();
      captureCollectionScroll(location.pathname, searchParams);
      launcherRef.current = launcher ?? (document.activeElement as HTMLElement | null);
      openedFromListRef.current = true;
      setSearchParams(writeLeadIdParam(searchParams, leadId), { replace: false });
    },
    [location.pathname, onBeforeOpen, searchParams, setSearchParams],
  );

  const closeLead = useCallback(() => {
    if (openedFromListRef.current) {
      navigate(-1);
      return;
    }
    setSearchParams(writeLeadIdParam(searchParams, null), { replace: true });
  }, [navigate, searchParams, setSearchParams]);

  useEffect(() => {
    if (selectedLeadId) return;
    const launcher = launcherRef.current;
    launcherRef.current = null;
    openedFromListRef.current = false;
    restoreCollectionScroll(location.pathname, searchParams);
    if (launcher && typeof launcher.focus === "function") {
      window.requestAnimationFrame(() => launcher.focus());
    }
  }, [location.pathname, searchParams, selectedLeadId]);

  return {
    selectedLeadId,
    selectedLead,
    inaccessible,
    isOpen: Boolean(selectedLeadId) && isReady,
    presentation,
    openHref,
    openLead,
    closeLead,
    expandHref: (leadId: string) => `/admin/leads/${leadId}`,
  };
}
