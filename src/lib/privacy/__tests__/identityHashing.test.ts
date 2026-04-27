import { describe, expect, it } from "vitest";

import {
  buildHashedIdentity,
  buildProviderIdentityContracts,
  hashNormalizedValue,
  isSha256Hex,
  normalizeBasicText,
  normalizeEmail,
  normalizePhone,
  sha256Hex,
} from "../identityHashing";

const KNOWN_SHA = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";

describe("identityHashing", () => {
  it("normalizes email deterministically without alias rewriting", () => {
    expect(normalizeEmail(" Test@Example.COM ")).toBe("test@example.com");
    expect(normalizeEmail(" First.Last+Alias@Example.COM ")).toBe("first.last+alias@example.com");
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail("malformed string")).toBe("malformed string");
  });

  it("normalizes phone values into plausible E.164 values", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("1-555-123-4567")).toBe("+15551234567");
    expect(normalizePhone("+1 (555) 123-4567")).toBe("+15551234567");
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });

  it("normalizes basic text", () => {
    expect(normalizeBasicText("  Miami   Beach  ")).toBe("miami beach");
    expect(normalizeBasicText("   ")).toBeNull();
  });

  it("detects SHA-256 hex strings case-insensitively", () => {
    expect(isSha256Hex(KNOWN_SHA)).toBe(true);
    expect(isSha256Hex(KNOWN_SHA.toUpperCase())).toBe(true);
    expect(isSha256Hex("not-a-hash")).toBe(false);
  });

  it("hashes deterministically as lowercase SHA-256 hex", async () => {
    expect(await sha256Hex("test")).toBe(KNOWN_SHA);
    expect(await sha256Hex("test")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("gives the same email hash for different input casing", async () => {
    const first = await hashNormalizedValue(" Test@Example.COM ", { normalizer: normalizeEmail });
    const second = await hashNormalizedValue("test@example.com", { normalizer: normalizeEmail });
    expect(first.hash).toBe(second.hash);
    expect(first.hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("does not double-hash already hashed input", async () => {
    const result = await hashNormalizedValue(KNOWN_SHA.toUpperCase(), { normalizer: normalizeEmail });
    expect(result.hash).toBe(KNOWN_SHA);
    expect(result.alreadyHashed).toBe(true);
    expect(result.normalizationApplied).toBe(false);
  });

  it("returns no raw email or phone fields from the hashed identity builder", async () => {
    const identity = await buildHashedIdentity({
      email: " Test@Example.COM ",
      phone: "(555) 123-4567",
      externalId: "lead_123",
    });
    expect(identity.email_hash_present).toBe(true);
    expect(identity.phone_hash_present).toBe(true);
    expect(identity.external_id_hash_present).toBe(true);
    expect(JSON.stringify(identity)).not.toContain("Test@Example.COM");
    expect(JSON.stringify(identity)).not.toContain("555");
  });

  it("builds provider identity contracts from hashed values only", async () => {
    const identity = await buildHashedIdentity({ email: "test@example.com", phone: "+15551234567", externalId: "lead_123" });
    const contracts = buildProviderIdentityContracts(identity);
    expect(contracts.meta.em?.[0]).toBe(identity.email_hash);
    expect(contracts.meta.ph?.[0]).toBe(identity.phone_hash);
    expect(contracts.tiktok.external_id).toBe(identity.external_id_hash);
    expect(JSON.stringify(contracts)).not.toContain("test@example.com");
    expect(JSON.stringify(contracts)).not.toContain("+15551234567");
  });
});
