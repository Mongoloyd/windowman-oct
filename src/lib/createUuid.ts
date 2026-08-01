/**
 * RFC 4122 version-4 UUID for client-side stable submission identifiers.
 */
export function createUuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }

  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      hex.push(bytes[i].toString(16).padStart(2, "0"));
    }

    return (
      hex[0] +
      hex[1] +
      hex[2] +
      hex[3] +
      "-" +
      hex[4] +
      hex[5] +
      "-" +
      hex[6] +
      hex[7] +
      "-" +
      hex[8] +
      hex[9] +
      "-" +
      hex[10] +
      hex[11] +
      hex[12] +
      hex[13] +
      hex[14] +
      hex[15]
    );
  }

  throw new Error("Cryptographic random is unavailable in this environment");
}
