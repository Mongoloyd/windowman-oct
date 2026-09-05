import { useCallback, useEffect, useMemo, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { FUNNEL_STAGES } from "@/components/admin/leadWorkflow";

export const INBOX_RANGE_VALUES = ["all", "24h", "7d", "30d"] as const;
export const INBOX_VERIFIED_VALUES = ["all", "verified", "unverified"] as const;
export const INBOX_SOURCE_VALUES = ["all", "power-tool-demo"] as const;
export const INBOX_SHORTCUT_VALUES = ["all", "yes", "no"] as const;
export const INBOX_PRIORITY_VALUES = [
  "all",
  "Quote Holder",
  "Hot",
  "Warm",
  "Researching",
  "Incomplete",
] as const;

const DEMO_STAGE_VALUES = ["demo_intake_complete", "demo_quote_holder_shortcut"] as const;

export const INBOX_STAGE_VALUES = [
  "all",
  ...FUNNEL_STAGES.map((stage) => stage.value),
  ...DEMO_STAGE_VALUES,
] as const;

export type InboxDateRange = (typeof INBOX_RANGE_VALUES)[number];
export type InboxVerifiedFilter = (typeof INBOX_VERIFIED_VALUES)[number];
export type InboxSourceFilter = (typeof INBOX_SOURCE_VALUES)[number];
export type InboxShortcutFilter = (typeof INBOX_SHORTCUT_VALUES)[number];
export type InboxPriorityFilter = (typeof INBOX_PRIORITY_VALUES)[number];
export type InboxStageFilter = (typeof INBOX_STAGE_VALUES)[number];

export interface AdminLeadInboxFilters {
  range: InboxDateRange;
  county: string;
  verified: InboxVerifiedFilter;
  stage: InboxStageFilter;
  source: InboxSourceFilter;
  shortcut: InboxShortcutFilter;
  priority: InboxPriorityFilter;
}

export const DEFAULT_INBOX_FILTERS: AdminLeadInboxFilters = {
  range: "all",
  county: "all",
  verified: "all",
  stage: "all",
  source: "all",
  shortcut: "all",
  priority: "all",
};

const RECOGNIZED_KEYS = [
  "range",
  "county",
  "verified",
  "stage",
  "source",
  "shortcut",
  "priority",
] as const;

const CONTACT_PII_KEYS = ["q", "search", "name", "email", "phone", "phone_e164"] as const;
const SCROLL_TTL_MS = 30 * 60 * 1000;
const SCROLL_STORAGE_PREFIX = "wm-admin-inbox-scroll:";

function isAllowlisted<T extends string>(value: string, allowed: readonly T[]): value is T {
  return allowed.includes(value as T);
}

export function inboxFilterSignature(filters: AdminLeadInboxFilters): string {
  return RECOGNIZED_KEYS.map((key) => `${key}=${filters[key]}`).join("&");
}

export function parseInboxFilters(
  params: URLSearchParams,
  counties: readonly string[] = [],
): { filters: AdminLeadInboxFilters; shouldReplace: boolean } {
  let shouldReplace = false;

  const parseKnown = <T extends string>(
    key: string,
    allowed: readonly T[],
    fallback: T,
  ): T => {
    const raw = params.get(key);
    if (raw == null) return fallback;
    if (isAllowlisted(raw, allowed)) return raw;
    shouldReplace = true;
    return fallback;
  };

  const range = parseKnown("range", INBOX_RANGE_VALUES, "all");
  const verified = parseKnown("verified", INBOX_VERIFIED_VALUES, "all");
  const stage = parseKnown("stage", INBOX_STAGE_VALUES, "all");
  const source = parseKnown("source", INBOX_SOURCE_VALUES, "all");
  const shortcut = parseKnown("shortcut", INBOX_SHORTCUT_VALUES, "all");
  const priority = parseKnown("priority", INBOX_PRIORITY_VALUES, "all");

  const rawCounty = params.get("county");
  let county = "all";
  if (rawCounty != null) {
    if (rawCounty === "all") {
      county = "all";
    } else if (counties.length === 0 || counties.includes(rawCounty)) {
      county = rawCounty;
    } else {
      county = "all";
      shouldReplace = true;
    }
  }

  return {
    filters: { range, county, verified, stage, source, shortcut, priority },
    shouldReplace,
  };
}

export function serializeInboxFilters(
  current: URLSearchParams,
  filters: AdminLeadInboxFilters,
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const key of CONTACT_PII_KEYS) {
    next.delete(key);
  }

  for (const key of RECOGNIZED_KEYS) {
    const value = filters[key];
    if (value === DEFAULT_INBOX_FILTERS[key]) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  }

  return next;
}

function scrollStorageKey(filters: AdminLeadInboxFilters): string {
  return `${SCROLL_STORAGE_PREFIX}/admin/leads?${inboxFilterSignature(filters)}`;
}

interface ScrollHint {
  offset: number;
  signature: string;
  savedAt: number;
}

export function readInboxScrollHint(filters: AdminLeadInboxFilters): ScrollHint | null {
  try {
    const raw = sessionStorage.getItem(scrollStorageKey(filters));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ScrollHint;
    if (
      typeof parsed.offset !== "number" ||
      parsed.offset < 0 ||
      parsed.signature !== inboxFilterSignature(filters) ||
      Date.now() - parsed.savedAt > SCROLL_TTL_MS
    ) {
      sessionStorage.removeItem(scrollStorageKey(filters));
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeInboxScrollHint(filters: AdminLeadInboxFilters, offset: number): void {
  if (!Number.isFinite(offset) || offset < 0) return;
  const hint: ScrollHint = {
    offset,
    signature: inboxFilterSignature(filters),
    savedAt: Date.now(),
  };
  sessionStorage.setItem(scrollStorageKey(filters), JSON.stringify(hint));
}

export function clearInboxScrollHint(filters: AdminLeadInboxFilters): void {
  sessionStorage.removeItem(scrollStorageKey(filters));
}

function safeScrollTo(top: number): void {
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    return;
  }
  window.scrollTo({ top, left: 0, behavior: "auto" });
}

export function useAdminLeadInboxState(counties: readonly string[]) {
  const [searchParams, setSearchParams] = useSearchParams();
  const parsed = useMemo(
    () => parseInboxFilters(searchParams, counties),
    [searchParams, counties],
  );
  const filters = parsed.filters;

  useEffect(() => {
    if (!parsed.shouldReplace) return;
    const next = serializeInboxFilters(searchParams, filters);
    if (next.toString() === searchParams.toString()) return;
    setSearchParams(next, { replace: true });
  }, [filters, parsed.shouldReplace, searchParams, setSearchParams]);

  const updateFilters = useCallback(
    (patch: Partial<AdminLeadInboxFilters>) => {
      const nextFilters = { ...filters, ...patch };
      const next = serializeInboxFilters(searchParams, nextFilters);
      setSearchParams(next, { replace: false });
    },
    [filters, searchParams, setSearchParams],
  );

  const captureScroll = useCallback(() => {
    writeInboxScrollHint(filters, window.scrollY);
  }, [filters]);

  const restoreScroll = useCallback(() => {
    const hint = readInboxScrollHint(filters);
    if (!hint) return false;
    const maxOffset = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (hint.offset > maxOffset + 8) {
      clearInboxScrollHint(filters);
      return false;
    }
    safeScrollTo(hint.offset);
    return true;
  }, [filters]);

  const resetScroll = useCallback(() => {
    safeScrollTo(0);
  }, []);

  return {
    filters,
    leadId: searchParams.get("lead_id"),
    searchParams,
    updateFilters,
    setRange: (range: InboxDateRange) => updateFilters({ range }),
    setCounty: (county: string) => updateFilters({ county }),
    setVerified: (verified: InboxVerifiedFilter) => updateFilters({ verified }),
    setStage: (stage: InboxStageFilter) => updateFilters({ stage }),
    setSource: (source: InboxSourceFilter) => updateFilters({ source }),
    setShortcut: (shortcut: InboxShortcutFilter) => updateFilters({ shortcut }),
    setPriority: (priority: InboxPriorityFilter) => updateFilters({ priority }),
    captureScroll,
    restoreScroll,
    resetScroll,
  };
}

export function useInboxDirectoryScroll(options: {
  filters: AdminLeadInboxFilters;
  search: string;
  isReady: boolean;
  captureScroll: () => void;
  restoreScroll: () => boolean;
  resetScroll: () => void;
}) {
  const { filters, search, isReady, captureScroll, restoreScroll, resetScroll } = options;
  const lastSearch = useRef(search);
  const restoreAttempts = useRef(0);

  useEffect(() => {
    if (lastSearch.current === search) return;
    lastSearch.current = search;
    resetScroll();
  }, [resetScroll, search]);

  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        captureScroll();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [captureScroll]);

  useEffect(() => {
    if (!isReady) {
      restoreAttempts.current = 0;
      return;
    }
    let attempts = 0;
    const maxAttempts = 6;
    const tick = () => {
      if (restoreScroll() || attempts >= maxAttempts) return;
      attempts += 1;
      window.setTimeout(tick, 50);
    };
    tick();
  }, [filters, isReady, restoreScroll]);
}
