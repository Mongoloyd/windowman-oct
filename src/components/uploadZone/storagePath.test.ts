import { describe, it, expect } from "vitest";
import { normalizeFileSegment, buildDeterministicStoragePath } from "./storagePath";

// jsdom provides File; size derives from blob parts.
function makeFile(name: string, size: number, type = "application/pdf"): File {
  // Build a blob of exactly `size` bytes so file.size is deterministic.
  const buf = new Uint8Array(size);
  return new File([buf], name, { type });
}

describe("normalizeFileSegment", () => {
  it("lowercases and replaces unsafe chars with underscores", () => {
    expect(normalizeFileSegment("My Quote #1/Final.PDF")).toBe("my_quote_1_final.pdf");
  });

  it("collapses repeated underscores", () => {
    expect(normalizeFileSegment("a   b___c")).toBe("a_b_c");
  });

  it("strips unicode characters", () => {
    expect(normalizeFileSegment("résumé.pdf")).toBe("r_sum_.pdf");
  });

  it("falls back to 'file' for empty or whitespace-only names", () => {
    expect(normalizeFileSegment("")).toBe("file");
    expect(normalizeFileSegment("   ")).toBe("file");
    expect(normalizeFileSegment("___")).toBe("file");
  });

  it("clamps to ≤80 chars", () => {
    const long = "a".repeat(200) + ".pdf";
    const out = normalizeFileSegment(long);
    expect(out.length).toBeLessThanOrEqual(80);
  });

  it("contains only [a-z0-9._-]", () => {
    const out = normalizeFileSegment("Spaces and / slashes # hashes & more!.pdf");
    expect(out).toMatch(/^[a-z0-9._-]+$/);
  });
});

describe("buildDeterministicStoragePath", () => {
  it("returns identical keys for identical (sessionId, file) inputs", () => {
    const f1 = makeFile("quote.pdf", 1024);
    const f2 = makeFile("quote.pdf", 1024);
    expect(buildDeterministicStoragePath("session_abc", f1)).toBe(
      buildDeterministicStoragePath("session_abc", f2),
    );
  });

  it("changes when file size changes", () => {
    const a = buildDeterministicStoragePath("session_abc", makeFile("quote.pdf", 1024));
    const b = buildDeterministicStoragePath("session_abc", makeFile("quote.pdf", 2048));
    expect(a).not.toBe(b);
  });

  it("changes when sessionId changes", () => {
    const f = makeFile("quote.pdf", 1024);
    expect(buildDeterministicStoragePath("s1", f)).not.toBe(
      buildDeterministicStoragePath("s2", f),
    );
  });

  it("uses the normalized filename in the key", () => {
    const f = makeFile("My Quote.pdf", 512);
    expect(buildDeterministicStoragePath("sess", f)).toBe("sess/512_my_quote.pdf");
  });
});
