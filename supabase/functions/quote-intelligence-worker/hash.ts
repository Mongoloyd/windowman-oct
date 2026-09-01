/** SHA-256 of actual file bytes as 64 lowercase hex chars (migration CHECK). */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const digest = await crypto.subtle.digest("SHA-256", copy);
  const hash = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < hash.length; i++) {
    hex += hash[i].toString(16).padStart(2, "0");
  }
  return hex;
}

export function isSha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/.test(value);
}
