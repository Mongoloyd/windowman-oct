import { describe, expect, it } from "vitest";
import {
  evaluateTikTokDispatchEligibility,
  isTikTokCapiEnabled,
  isViteTikTokCapiEnabled,
} from "../tiktokDispatchEligibility";

describe("tiktokDispatchEligibility", () => {
  it("disables enqueue when TIKTOK_CAPI_ENABLED is missing", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
    })).toEqual({
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    });
  });

  it("disables enqueue when TIKTOK_CAPI_ENABLED is false", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "false" },
    })).toEqual({
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    });
  });

  it("disables enqueue when TIKTOK_CAPI_ENABLED is 0", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "0" },
    })).toEqual({
      shouldEnqueue: false,
      reason: "tiktok_disabled",
      mappedEventName: null,
    });
  });

  it("enqueues truth_gate_captured when gate is true", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "truth_gate_captured",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    })).toEqual({
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "SubmitForm",
    });
  });

  it("enqueues quote_uploaded when gate is true", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    })).toEqual({
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "UploadQuote",
    });
  });

  it("enqueues sold when gate is true", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "sold",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    })).toEqual({
      shouldEnqueue: true,
      platformName: "tiktok",
      mappedEventName: "CompletePayment",
    });
  });

  it("returns no_tiktok_mapping for unknown events when gate is true", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "unknown_event",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    })).toEqual({
      shouldEnqueue: false,
      reason: "no_tiktok_mapping",
      mappedEventName: null,
    });
  });

  it("returns missing_event_name for empty event_name", () => {
    expect(evaluateTikTokDispatchEligibility({
      eventName: "   ",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    })).toEqual({
      shouldEnqueue: false,
      reason: "missing_event_name",
      mappedEventName: null,
    });
  });

  it("does not produce a payload object", () => {
    const result = evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    });

    expect(result).not.toHaveProperty("payload");
    if (result.shouldEnqueue) {
      expect(result.mappedEventName).toBe("UploadQuote");
    }
  });

  it("does not call fetch", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    evaluateTikTokDispatchEligibility({
      eventName: "quote_uploaded",
      env: { TIKTOK_CAPI_ENABLED: "true" },
    });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
