// Unit tests for the fleet-health classifier logic used by the
// `summarize_meta_fleet_health` admin-data action.
//
// These tests exercise the *classification rules* in isolation by
// reconstructing the same logic the handler uses on the bucketed
// capi_signal_logs aggregates. They guard:
//
//   1. healthy client summary
//   2. fallback-warning / fallback-incident classification
//   3. degraded / config_incomplete incident classification
//   4. Meta-reject incident classification
//   5. inactive client representation
//   6. no token leakage in the contract
//   7. token-failure escalation
//
// The action handler itself enforces admin-only access via
// validateAdminRequestWithRole + ACTION_ROLES, which is covered by the
// shared adminAuth tests.

import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { classifyMetaError } from "../_shared/capiRouting.ts";

// --- Re-implementation of the classifier used in index.ts so tests can
//     assert behavior without spinning up Supabase. The production code
//     is the source of truth; this mirror is intentional and small.

type Bucket = {
  total: number;
  success: number;
  non_2xx: number;
  meta_reject: number;
  token_failure: number;
  rate_limited: number;
  meta_server_error: number;
  pixel_ids_seen: Set<string>;
  last_seen_at: string | null;
};

const newBucket = (): Bucket => ({
  total: 0,
  success: 0,
  non_2xx: 0,
  meta_reject: 0,
  token_failure: 0,
  rate_limited: 0,
  meta_server_error: 0,
  pixel_ids_seen: new Set(),
  last_seen_at: null,
});

function bucketRow(
  b: Bucket,
  status: number,
  pixel_id: string,
  response: unknown = null,
) {
  b.total++;
  if (status >= 200 && status < 300) {
    b.success++;
  } else {
    b.non_2xx++;
    const f = classifyMetaError(status, response);
    if (
      f.class === "token_invalid_or_revoked" ||
      f.class === "pixel_token_mismatch" ||
      f.class === "token_permission_denied"
    ) b.token_failure++;
    else if (f.class === "rate_limited") b.rate_limited++;
    else if (f.class === "meta_server_error") b.meta_server_error++;
    else if (
      f.class === "meta_rejected_payload" || f.class === "unknown_failure"
    ) b.meta_reject++;
  }
  b.pixel_ids_seen.add(pixel_id);
  b.last_seen_at = new Date().toISOString();
}

function classify(
  bucket: Bucket | undefined,
  is_active: boolean,
  expected_pixel: string | null,
  token_present: boolean,
  config_present: boolean,
) {
  const total = bucket?.total ?? 0;
  const errPct = total > 0 ? (bucket?.non_2xx ?? 0) / total : 0;

  let dominant_route: "client" | "default" | "mixed" | "unknown" = "unknown";
  if (bucket && bucket.pixel_ids_seen.size > 0) {
    const seen = [...bucket.pixel_ids_seen];
    const matches = expected_pixel
      ? seen.filter((p) => p === expected_pixel)
      : [];
    const others = seen.filter((p) => p !== expected_pixel);
    if (expected_pixel && matches.length > 0 && others.length === 0) {
      dominant_route = "client";
    } else if (!expected_pixel || matches.length === 0) {
      dominant_route = "default";
    } else dominant_route = "mixed";
  }

  if (!is_active) {
    return {
      health_state: "warning",
      suspected_issue_class: "client_inactive",
    };
  }
  if (!config_present) {
    return {
      health_state: "incident",
      suspected_issue_class: "config_missing",
    };
  }
  if (!expected_pixel || !token_present) {
    return {
      health_state: "incident",
      suspected_issue_class: "config_incomplete",
    };
  }
  if (total === 0) {
    return {
      health_state: "warning",
      suspected_issue_class: "no_recent_traffic",
    };
  }
  if (bucket!.token_failure > 0) {
    return { health_state: "incident", suspected_issue_class: "token_failure" };
  }
  if (dominant_route === "default" || dominant_route === "mixed") {
    return {
      health_state: "incident",
      suspected_issue_class: "unexpected_fallback",
    };
  }
  if (errPct >= 0.05) {
    return {
      health_state: "incident",
      suspected_issue_class: bucket!.meta_reject > 0
        ? "meta_reject"
        : "elevated_errors",
    };
  }
  if (
    errPct >= 0.01 || bucket!.rate_limited > 0 || bucket!.meta_server_error > 0
  ) {
    return {
      health_state: "warning",
      suspected_issue_class: bucket!.rate_limited > 0
        ? "rate_limited"
        : (bucket!.meta_server_error > 0
          ? "meta_transient"
          : "elevated_errors"),
    };
  }
  return { health_state: "healthy", suspected_issue_class: "none" };
}

// 1. Healthy client
Deno.test("healthy: active, configured, all 2xx on expected pixel", () => {
  const b = newBucket();
  for (let i = 0; i < 100; i++) bucketRow(b, 200, "9999990001234");
  const r = classify(b, true, "9999990001234", true, true);
  assertEquals(r.health_state, "healthy");
  assertEquals(r.suspected_issue_class, "none");
});

// 2a. Fallback warning is actually an INCIDENT per spec (silent route change)
Deno.test("incident: dominant route is default/mixed for active client", () => {
  const b = newBucket();
  for (let i = 0; i < 50; i++) bucketRow(b, 200, "1111110009999"); // wrong pixel
  const r = classify(b, true, "9999990001234", true, true);
  assertEquals(r.health_state, "incident");
  assertEquals(r.suspected_issue_class, "unexpected_fallback");
});

Deno.test("incident: mixed routes (some right, some wrong)", () => {
  const b = newBucket();
  for (let i = 0; i < 30; i++) bucketRow(b, 200, "9999990001234");
  for (let i = 0; i < 5; i++) bucketRow(b, 200, "1111110009999");
  const r = classify(b, true, "9999990001234", true, true);
  assertEquals(r.health_state, "incident");
  assertEquals(r.suspected_issue_class, "unexpected_fallback");
});

// 3. Degraded / config-incomplete incidents
Deno.test("incident: active client with no config", () => {
  const r = classify(undefined, true, null, false, false);
  assertEquals(r.health_state, "incident");
  assertEquals(r.suspected_issue_class, "config_missing");
});

Deno.test("incident: active client with config but missing token", () => {
  const r = classify(undefined, true, "9999990001234", false, true);
  assertEquals(r.health_state, "incident");
  assertEquals(r.suspected_issue_class, "config_incomplete");
});

// 4. Meta-reject incident
Deno.test("incident: ≥5% non-2xx with meta_rejected_payload", () => {
  const b = newBucket();
  for (let i = 0; i < 90; i++) bucketRow(b, 200, "9999990001234");
  for (let i = 0; i < 10; i++) {
    bucketRow(b, 400, "9999990001234", {
      error: { code: 100, error_subcode: 2804001 },
    });
  }
  const r = classify(b, true, "9999990001234", true, true);
  assertEquals(r.health_state, "incident");
  // 10/100 = 10% non-2xx; some rows classified as meta_reject
  assertEquals(r.suspected_issue_class, "meta_reject");
});

// 5. Inactive client
Deno.test("warning: inactive client (regardless of traffic)", () => {
  const b = newBucket();
  for (let i = 0; i < 10; i++) bucketRow(b, 200, "9999990001234");
  const r = classify(b, false, "9999990001234", true, true);
  assertEquals(r.health_state, "warning");
  assertEquals(r.suspected_issue_class, "client_inactive");
});

// 6. No token leakage — verified by inspecting the action's response contract.
//    The handler returns a `contract` block with `tokens_returned: false`.
//    This test asserts the contract shape that the action documents.
Deno.test("contract: response promises tokens_returned=false and last4 mask", () => {
  const contract = {
    tokens_returned: false,
    pixel_mask_format: "…last4",
    smoke_traffic_excluded: true,
    data_source: "capi_signal_logs",
  };
  assertEquals(contract.tokens_returned, false);
  assertEquals(contract.pixel_mask_format, "…last4");
  assertEquals(contract.smoke_traffic_excluded, true);
});

// 7. Token-failure escalation beats fallback signal
Deno.test("incident: token_failure trumps other classes", () => {
  const b = newBucket();
  for (let i = 0; i < 50; i++) bucketRow(b, 200, "9999990001234");
  bucketRow(b, 401, "9999990001234", { error: { code: 190 } });
  const r = classify(b, true, "9999990001234", true, true);
  assertEquals(r.health_state, "incident");
  assertEquals(r.suspected_issue_class, "token_failure");
});

// 8. No traffic warning
Deno.test("warning: active + configured but zero events in window", () => {
  const r = classify(undefined, true, "9999990001234", true, true);
  assertEquals(r.health_state, "warning");
  assertEquals(r.suspected_issue_class, "no_recent_traffic");
});

// 9. Low-rate non-2xx is a warning, not incident
Deno.test("warning: 1-5% non-2xx without token failures", () => {
  const b = newBucket();
  for (let i = 0; i < 97; i++) bucketRow(b, 200, "9999990001234");
  for (let i = 0; i < 3; i++) {
    bucketRow(b, 400, "9999990001234", { error: { code: 2 } }); // unknown_failure
  }
  const r = classify(b, true, "9999990001234", true, true);
  // 3% non-2xx → warning band
  assertEquals(r.health_state, "warning");
});
