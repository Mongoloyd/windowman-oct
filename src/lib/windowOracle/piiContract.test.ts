import { describe, expect, it } from "vitest";
import {
  SYNTHETIC_ORACLE_NOW_MS,
  SYNTHETIC_ORACLE_OBSERVATIONS,
} from "./fixtures";
import { FIXTURE_ORACLE_CONFIDENCE_POLICY } from "./fixtures.testPolicy";
import { runOracleQuery } from "./queryEngine";
import type { OracleObservation, OracleQueryResponse } from "./types";

const FORBIDDEN_OBS_KEYS = [
  "name",
  "firstName",
  "lastName",
  "email",
  "phone",
  "phone_e164",
  "street",
  "address",
  "storageUrl",
  "signed_url",
  "otp",
] as const;

const FORBIDDEN_RESPONSE_KEYS = [
  "email",
  "phone",
  "phone_e164",
  "homeownerName",
  "streetAddress",
  "storageUrl",
  "signed_url",
  "otp",
] as const;

function collectKeys(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => collectKeys(v, `${prefix}[${i}]`));
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(
      ([k, v]) => [prefix ? `${prefix}.${k}` : k, ...collectKeys(v, prefix ? `${prefix}.${k}` : k)],
    );
  }
  return [];
}

describe("windowOracle PII contract", () => {
  it("OracleObservation fixtures never include forbidden PII keys", () => {
    for (const obs of SYNTHETIC_ORACLE_OBSERVATIONS) {
      const keys = Object.keys(obs);
      for (const forbidden of FORBIDDEN_OBS_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it("OracleQueryResponse never includes forbidden PII keys", () => {
    const response: OracleQueryResponse = runOracleQuery({
      observations: SYNTHETIC_ORACLE_OBSERVATIONS,
      request: {
        geography: { zip: "00001", county: "Synthetic Region A" },
        provenance: "COMPARE",
        dateRangeMonths: 24,
        homeownerPpo: 2500,
      },
      policy: FIXTURE_ORACLE_CONFIDENCE_POLICY,
      nowMs: SYNTHETIC_ORACLE_NOW_MS,
    });

    const keys = collectKeys(response).map((k) => k.toLowerCase());
    for (const forbidden of FORBIDDEN_RESPONSE_KEYS) {
      expect(keys.some((k) => k === forbidden.toLowerCase() || k.endsWith(`.${forbidden.toLowerCase()}`))).toBe(
        false,
      );
    }

    // Recent ids are anonymized OBS-* only
    for (const id of response.recentObservationIds) {
      expect(id.startsWith("OBS-")).toBe(true);
    }
  });

  it("type shape documents allowed observation fields only", () => {
    const sample: OracleObservation = SYNTHETIC_ORACLE_OBSERVATIONS[0];
    expect(sample).toHaveProperty("id");
    expect(sample).toHaveProperty("ppo");
    expect(sample).not.toHaveProperty("email");
    expect(sample).not.toHaveProperty("phone");
  });
});
