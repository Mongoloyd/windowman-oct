/**
 * Storage-path helpers for UploadZone.
 *
 * Determinism rule: the same (sessionId, file) pair MUST always produce the
 * same Storage key. This lets a retry that lost in-memory state still resolve
 * back to the original Storage object + `quote_files` row instead of
 * duplicating either. Behavior locked by `storagePath.test.ts`.
 */

/**
 * Normalize a file name into a Storage-safe segment:
 *   lowercase → collapse non-[a-z0-9._-] to "_" → trim → clamp to ≤80 chars.
 * Empty / whitespace-only names fall back to "file".
 */
export function normalizeFileSegment(name: string): string {
  const cleaned = (name || "file")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "");
  const safe = cleaned.length > 0 ? cleaned : "file";
  return safe.length > 80 ? safe.slice(0, 80) : safe;
}

/**
 * Build a deterministic Storage key for a (sessionId, file) pair.
 * Layout: `${sessionId}/${size}_${normalizedName}`.
 */
export function buildDeterministicStoragePath(sessionId: string, file: File): string {
  return `${sessionId}/${file.size}_${normalizeFileSegment(file.name)}`;
}
