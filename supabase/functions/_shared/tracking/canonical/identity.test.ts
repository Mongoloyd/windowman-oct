import {
  assertEquals,
  assertMatch,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { normalizeAndHashIdentity } from "./identity.ts";

Deno.test("server identity trims/lowercases email, normalizes E.164 phone, and SHA-256 hashes once", async () => {
  const existingHash = "A".repeat(64);
  const normalized = await normalizeAndHashIdentity({
    email: "  USER@Example.COM ",
    phone: "(561) 468-5571",
    emailHash: existingHash,
  });

  assertEquals(normalized.email, "user@example.com");
  assertEquals(normalized.phone, "+15614685571");
  assertEquals(normalized.emailHash, existingHash.toLowerCase());
  assertMatch(normalized.phoneHash ?? "", /^[a-f0-9]{64}$/);
});
