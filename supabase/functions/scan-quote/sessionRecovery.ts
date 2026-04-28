/**
 * scan-quote/sessionRecovery.ts
 *
 * Stuck-session recovery utility.
 *
 * Background: prior to this pass the handler refused to re-process any
 * session whose status was already `processing`. That behavior is correct as
 * a *fresh* idempotency guard — we never want two concurrent invocations
 * racing on the same session — but it also meant a crashed invocation would
 * leave the session permanently wedged.
 *
 * This module provides a single decision function: given a current session
 * row and a stale-age threshold, decide whether the caller is allowed to
 * take the session over for recovery, or must back off and let the in-flight
 * invocation complete.
 */

export type SessionStatus =
  | "idle"
  | "uploading"
  | "processing"
  | "preview_ready"
  | "complete"
  | "invalid_document"
  | "needs_better_upload"
  | "error";

export interface SessionRowForRecovery {
  status: string | null;
  updated_at?: string | null;
  created_at?: string | null;
}

export type RecoveryDecision =
  | { kind: "process_fresh" }
  | { kind: "skip_terminal"; status: SessionStatus }
  | { kind: "skip_in_flight"; ageMs: number }
  | { kind: "takeover_stale"; ageMs: number };

const TRULY_TERMINAL: ReadonlySet<SessionStatus> = new Set([
  "preview_ready",
  "complete",
  "invalid_document",
  "needs_better_upload",
  "error",
]);

const RECOVERABLE_IN_FLIGHT: ReadonlySet<SessionStatus> = new Set([
  "processing",
]);

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Decide what the handler should do given the session's current state.
 *
 * Rules:
 *  - terminal statuses (preview_ready/complete/invalid_document/needs_better_upload/error)
 *    are returned to the caller as-is (idempotent no-op).
 *  - `processing` younger than `staleProcessingMinutes` is treated as a still-running
 *    invocation; reject with `skip_in_flight` so we don't double-write `analyses`.
 *  - `processing` older than threshold is a crashed/abandoned invocation; the caller
 *    is allowed to take it over.
 *  - everything else (`idle`, `uploading`, missing) → fresh processing path.
 */
export function decideSessionRecovery(
  session: SessionRowForRecovery,
  staleProcessingMinutes: number,
  now: number = Date.now(),
): RecoveryDecision {
  const status = (session.status ?? "idle") as SessionStatus;

  if (TRULY_TERMINAL.has(status)) {
    return { kind: "skip_terminal", status };
  }

  if (RECOVERABLE_IN_FLIGHT.has(status)) {
    const reference = parseTimestamp(session.updated_at) ??
      parseTimestamp(session.created_at);
    // If we have no timestamp at all, prefer caution: treat as in-flight.
    if (reference === null) {
      return { kind: "skip_in_flight", ageMs: 0 };
    }
    const ageMs = Math.max(0, now - reference);
    const thresholdMs = Math.max(0, staleProcessingMinutes) * 60 * 1000;
    if (ageMs >= thresholdMs) {
      return { kind: "takeover_stale", ageMs };
    }
    return { kind: "skip_in_flight", ageMs };
  }

  return { kind: "process_fresh" };
}
