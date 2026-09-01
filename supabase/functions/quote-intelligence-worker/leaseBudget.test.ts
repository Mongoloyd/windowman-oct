import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hasSufficientLeaseBudget } from "./leaseBudget.ts";
import { sha256Hex } from "./hash.ts";

Deno.test("lease budget requires both leases to outlive timeout plus margin", () => {
  const now = new Date("2026-09-01T15:00:00.000Z");
  const ok = hasSufficientLeaseBudget({
    jobLeaseExpiresAt: new Date("2026-09-01T15:01:00.000Z"),
    contentLeaseExpiresAt: new Date("2026-09-01T15:01:00.000Z"),
    providerTimeoutMs: 20_000,
    safetyMarginMs: 5_000,
    now,
  });
  assert(ok);

  const short = hasSufficientLeaseBudget({
    jobLeaseExpiresAt: new Date("2026-09-01T15:00:10.000Z"),
    contentLeaseExpiresAt: new Date("2026-09-01T15:01:00.000Z"),
    providerTimeoutMs: 20_000,
    safetyMarginMs: 5_000,
    now,
  });
  assertEquals(short, false);
});

Deno.test("SHA-256 hex is 64 lowercase characters of actual bytes", async () => {
  const hex = await sha256Hex(new TextEncoder().encode("abc"));
  assertEquals(
    hex,
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});
