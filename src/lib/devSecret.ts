/**
 * DEV-only client bypass secret.
 *
 * Stored in localStorage at runtime via window.prompt — never committed,
 * never bundled, never read from import.meta.env.
 *
 * Server-side `DEV_BYPASS_SECRET` (Supabase edge function secret) remains
 * the only real enforcement boundary. This client value is just what gets
 * sent in the `x-dev-secret` header / `dev_secret` body — the server
 * decides whether to accept it.
 *
 * In production builds (`import.meta.env.DEV === false`) every accessor
 * returns `null` and is dead code.
 */

const STORAGE_KEY = "wm_dev_secret";

/**
 * Returns the stored dev secret, prompting the user once if missing.
 * Use only from explicit user-initiated DEV actions (e.g. clicking a
 * scenario button). User cancel → returns null → caller falls back to
 * the normal flow.
 */
export function getDevSecret(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    const existing = localStorage.getItem(STORAGE_KEY);
    if (existing && existing.trim()) return existing.trim();
    const entered = window.prompt(
      "Enter DEV_BYPASS_SECRET (cancel to use normal OTP flow):"
    );
    if (entered && entered.trim()) {
      const v = entered.trim();
      localStorage.setItem(STORAGE_KEY, v);
      return v;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Returns the stored dev secret WITHOUT prompting. Use from passive
 * code paths (auto-skip gates, mount effects, admin fetches) so users
 * are never surprised by a prompt on page load.
 */
export function peekDevSecret(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

/** Clear the stored dev secret (e.g. to test the real OTP flow in DEV). */
export function clearDevSecret(): void {
  if (!import.meta.env.DEV) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
