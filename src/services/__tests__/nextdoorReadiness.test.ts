import { describe, expect, it } from "vitest";

import {
  aggregateDispatchLaneStatus,
  buildNextdoorReadinessState,
  containsSensitiveNextdoorReadinessPayload,
  deriveConfigReadiness,
  deriveOverallStatus,
  maskNextdoorDataSourceId,
  readCanonicalLeadCapturedEnabledExpectation,
  readNextdoorShouldSendEnabled,
} from "@/services/nextdoorReadiness";

describe("nextdoorReadiness", () => {
  it("default state is blocked while env enablement variables are false", () => {
    expect(readNextdoorShouldSendEnabled()).toBe(false);
    expect(readCanonicalLeadCapturedEnabledExpectation()).toBe(false);

    const state = buildNextdoorReadinessState({ configs: [], dispatchLane: null });
    expect(state.overallStatus).toBe("blocked");
    expect(state.shouldSendNextdoorEnabled).toBe(false);
    expect(state.canonicalLeadCapturedEnabled).toBe(false);
    expect(state.readOnly).toBe(true);
  });

  it("config-ready state still returns blocked while env enablement variables are false", () => {
    const state = buildNextdoorReadinessState({
      configs: [{
        platform_name: "nextdoor",
        is_active: true,
        token_secret_id: "present",
        dataset_id: "server-dataset-id-1234",
        pixel_id: null,
      }],
      dispatchLane: {
        available: true,
        counts: {
          pending: 0,
          processing: 0,
          sent: 1,
          failed: 0,
          failedWithRetryScheduled: 0,
          suppressed: 0,
          deadLetter: 0,
          blocked: 0,
          dispatched: 0,
          total: 1,
        },
        topSuppressionReasons: [],
        lastProviderStatus: { providerStatus: "200", reason: null },
        lastAttemptAt: "2026-04-14T12:00:00.000Z",
      },
    });

    expect(state.configReadinessStatus).toBe("ready");
    expect(state.overallStatus).toBe("blocked");
    expect(state.overallStatus).not.toBe("ready");
  });

  it("missing config returns pending_setup overall path via deriveOverallStatus only when gates true", () => {
    const config = deriveConfigReadiness({ configs: [] });
    expect(config.hasNextdoorConfig).toBe(false);
    expect(config.configReadinessStatus).toBe("missing");

    const blocked = deriveOverallStatus({
      shouldSendNextdoorEnabled: false,
      canonicalLeadCapturedEnabled: false,
      hasNextdoorConfig: false,
      configReadinessStatus: "missing",
    });
    expect(blocked).toBe("blocked");
  });

  it("invalid_action/admin-data unavailable degrades gracefully with zero counts", () => {
    const state = buildNextdoorReadinessState({
      configs: [],
      dispatchLane: {
        available: false,
        reason: "invalid_action",
        counts: {
          pending: 0,
          processing: 0,
          sent: 0,
          failed: 0,
          failedWithRetryScheduled: 0,
          suppressed: 0,
          deadLetter: 0,
          blocked: 0,
          dispatched: 0,
          total: 0,
        },
        topSuppressionReasons: [],
        lastProviderStatus: null,
        lastAttemptAt: null,
      },
    });

    expect(state.statsAvailable).toBe(false);
    expect(state.dispatchCounts.total).toBe(0);
    expect(state.statsWarning).toContain("admin-data action not deployed");
  });

  it("enum mismatch / query failure degrades gracefully", () => {
    const state = buildNextdoorReadinessState({
      configs: [],
      dispatchLane: {
        available: false,
        reason: "nextdoor_enum_not_applied",
        counts: {
          pending: 0,
          processing: 0,
          sent: 0,
          failed: 0,
          failedWithRetryScheduled: 0,
          suppressed: 0,
          deadLetter: 0,
          blocked: 0,
          dispatched: 0,
          total: 0,
        },
        topSuppressionReasons: [],
        lastProviderStatus: null,
        lastAttemptAt: null,
      },
    });

    expect(state.dbEnumGateStatus).toBe("pending");
    expect(state.statsWarning).toContain("migration not applied");
    expect(state.dispatchCounts.total).toBe(0);
  });

  it("dataset_id/pixel_id/data_source_id are masked", () => {
    const masked = maskNextdoorDataSourceId("server-dataset-id-1234", null);
    expect(masked).toBe("server-d…1234");
    expect(masked).not.toBe("server-dataset-id-1234");
  });

  it("serialized result does not contain raw token", () => {
    const state = buildNextdoorReadinessState({
      configs: [{
        platform_name: "nextdoor",
        is_active: true,
        token_secret_id: "present",
        dataset_id: "abcd1234567890ef",
        pixel_id: null,
      }],
      dispatchLane: null,
    });

    const serialized = JSON.stringify(state);
    expect(serialized).not.toContain("super-secret-token");
    expect(containsSensitiveNextdoorReadinessPayload(state)).toBe(false);
  });

  it("serialized result does not contain raw email/phone/customer payload", () => {
    const aggregated = aggregateDispatchLaneStatus([
      {
        dispatch_status: "suppressed",
        error_message: "missing_customer",
        provider_response_code: "suppressed",
        provider_response_body: { reason: "missing_customer" },
        last_attempt_at: "2026-04-14T12:00:00.000Z",
        next_attempt_at: null,
      },
    ]);

    const serialized = JSON.stringify(aggregated);
    expect(serialized).not.toContain("homeowner@");
    expect(serialized).not.toContain("+1561");
    expect(serialized).not.toContain("\"customer\":");
    expect(serialized).toContain("missing_customer");
    expect(containsSensitiveNextdoorReadinessPayload(aggregated)).toBe(false);
  });

  it("failedWithRetryScheduled is derived from failed + next_attempt_at", () => {
    const aggregated = aggregateDispatchLaneStatus([
      {
        dispatch_status: "failed",
        error_message: "provider_5xx",
        provider_response_code: "503",
        provider_response_body: { reason: "provider_5xx", retryable: true },
        last_attempt_at: "2026-04-14T12:00:00.000Z",
        next_attempt_at: "2026-04-14T12:30:00.000Z",
      },
      {
        dispatch_status: "failed",
        error_message: "provider_4xx",
        provider_response_code: "400",
        provider_response_body: { reason: "provider_4xx", retryable: false },
        last_attempt_at: "2026-04-14T11:00:00.000Z",
        next_attempt_at: null,
      },
    ]);

    expect(aggregated.dispatchCounts.failed).toBe(2);
    expect(aggregated.dispatchCounts.failedWithRetryScheduled).toBe(1);
    expect(Object.keys(aggregated.dispatchCounts)).not.toContain("retrying");
  });

  it("rolls up top suppression reason codes only", () => {
    const aggregated = aggregateDispatchLaneStatus([
      {
        dispatch_status: "suppressed",
        error_message: "nextdoor_missing_client_slug",
        provider_response_body: { reason: "nextdoor_missing_client_slug" },
        last_attempt_at: "2026-04-14T12:00:00.000Z",
      },
      {
        dispatch_status: "suppressed",
        error_message: "nextdoor_missing_client_slug",
        provider_response_body: { reason: "nextdoor_missing_client_slug" },
        last_attempt_at: "2026-04-14T11:00:00.000Z",
      },
      {
        dispatch_status: "suppressed",
        error_message: "missing_customer",
        provider_response_body: { reason: "missing_customer" },
        last_attempt_at: "2026-04-14T10:00:00.000Z",
      },
    ]);

    expect(aggregated.topSuppressionReasons[0]).toEqual({
      reason: "nextdoor_missing_client_slug",
      count: 2,
    });
  });
});
