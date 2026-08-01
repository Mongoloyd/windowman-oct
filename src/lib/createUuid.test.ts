import { afterEach, describe, expect, it, vi } from "vitest";
import { createUuid } from "./createUuid";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("createUuid", () => {
  it("delegates to globalThis.crypto.randomUUID when available", () => {
    const expected = "11111111-2222-4333-a444-555555555555";
    const spy = vi
      .spyOn(globalThis.crypto, "randomUUID")
      .mockReturnValue(
        expected as `${string}-${string}-${string}-${string}-${string}`,
      );

    expect(createUuid()).toBe(expected);
    expect(spy).toHaveBeenCalledOnce();
  });

  it("returns RFC 4122 v4 UUIDs via getRandomValues when randomUUID is absent", () => {
    const realGetRandomValues = globalThis.crypto.getRandomValues.bind(
      globalThis.crypto,
    );
    vi.stubGlobal("crypto", { getRandomValues: realGetRandomValues });

    const result = createUuid();
    expect(result).toMatch(UUID_V4_REGEX);
    expect(result[14]).toBe("4");
  });

  it("throws when cryptographic random is unavailable", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => createUuid()).toThrow(
      "Cryptographic random is unavailable in this environment",
    );
  });
});
