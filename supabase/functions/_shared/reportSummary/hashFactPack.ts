/** Stable SHA-256 hex digest for canonical JSON payloads. */
export async function sha256HexFromText(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashFactPack(
  pack: unknown,
): Promise<string> {
  const canonical = JSON.stringify(pack);
  return sha256HexFromText(canonical);
}
