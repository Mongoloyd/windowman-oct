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

export type StoragePathOptions = {
  /** When > 0, append a Start-Fresh retry suffix to break orphan 409 loops. */
  retryNonce?: number;
};

/**
 * Build a deterministic Storage key for a (sessionId, file) pair.
 * Layout: `${sessionId}/${size}_${normalizedName}` (nonce 0/undefined).
 * Start-Fresh rotation: `${sessionId}/${size}_r{n}_${normalizedName}`.
 */
export function buildDeterministicStoragePath(
  sessionId: string,
  file: File,
  options?: StoragePathOptions,
): string {
  const normalizedName = normalizeFileSegment(file.name);
  const nonce = options?.retryNonce ?? 0;
  const fileSegment =
    nonce > 0 ? `${file.size}_r${nonce}_${normalizedName}` : `${file.size}_${normalizedName}`;
  return `${sessionId}/${fileSegment}`;
}
