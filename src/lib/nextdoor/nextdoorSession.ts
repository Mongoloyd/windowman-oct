const NEXTDOOR_SESSION_KEY = "wm_nextdoor_session_id";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Stable per-browser-tab session ID for /nextdoor lead capture and future upload handoff.
 * Persists in sessionStorage for the tab lifetime.
 */
export function getOrCreateNextdoorSessionId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const existing = sessionStorage.getItem(NEXTDOOR_SESSION_KEY);
    if (existing && UUID_RE.test(existing)) {
      return existing;
    }

    const id = crypto.randomUUID();
    sessionStorage.setItem(NEXTDOOR_SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function isValidNextdoorSessionId(sessionId: string): boolean {
  return UUID_RE.test(sessionId);
}

export { NEXTDOOR_SESSION_KEY };
