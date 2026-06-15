import { describe, expect, it } from "vitest";
import {
  hasNextdoorAttribution,
  isNextdoorDispatchEventAllowed,
  isViteNextdoorCapiEnabled,
  resolveShouldSendNextdoor,
} from "../nextdoorDispatchEligibility";
import type { WMCanonicalEventPayload } from "../types";

function payloadWith(
  overrides: Partial<WMCanonicalEventPayload> = {},
): WMCanonicalEventPayload {
  return {
    identity: { email: "user@example.com", phone: "5614685571" },
    journey: { route: "/city/foo", flow: "public" },
    ...overrides,
  };
}

describe("nextdoorDispatchEligibility", () => {
  it("detects metadata.utm_source nextdoor", () => {
    expect(hasNextdoorAttribution(payloadWith({
      metadata: { utm_source: "nextdoor" },
    }))).toBe(true);
  });

  it("detects source.utmSource nextdoor", () => {
    expect(hasNextdoorAttribution(payloadWith({
      source: { utmSource: "nextdoor" },
    }))).toBe(true);
  });

  it("detects metadata.ndclid without utm_source", () => {
    expect(hasNextdoorAttribution(payloadWith({
      metadata: { ndclid: "click-123" },
    }))).toBe(true);
  });

  it("detects metadata.nd_lead_id without utm_source", () => {
    expect(hasNextdoorAttribution(payloadWith({
      metadata: { nd_lead_id: "lead-456" },
    }))).toBe(true);
  });

  it("detects nested metadata.attribution ndclid", () => {
    expect(hasNextdoorAttribution(payloadWith({
      metadata: { attribution: { ndclid: "nested-1" } },
    }))).toBe(true);
  });

  it("detects metadata.query_params utm_source nextdoor", () => {
    expect(hasNextdoorAttribution(payloadWith({
      metadata: { query_params: { utm_source: "nextdoor" } },
    }))).toBe(true);
  });

  it("does not treat /nextdoor journey route alone as attribution", () => {
    expect(hasNextdoorAttribution(payloadWith({
      journey: { route: "/nextdoor", flow: "public" },
    }))).toBe(false);
  });

  it("excludes virtual_page_view from allowlist", () => {
    expect(isNextdoorDispatchEventAllowed("virtual_page_view")).toBe(false);
    expect(isNextdoorDispatchEventAllowed("lead_identified")).toBe(true);
  });

  it("defaults env gate to false when unset", () => {
    expect(isViteNextdoorCapiEnabled(undefined)).toBe(false);
    expect(isViteNextdoorCapiEnabled("false")).toBe(false);
    expect(isViteNextdoorCapiEnabled("true")).toBe(true);
  });

  it("resolveShouldSendNextdoor requires all gates", () => {
    const payload = payloadWith({ metadata: { utm_source: "nextdoor", ndclid: "x" } });

    expect(resolveShouldSendNextdoor({
      envEnabled: false,
      eventName: "lead_identified",
      identityQuality: "high",
      quoteSafe: true,
      payload,
    })).toBe(false);

    expect(resolveShouldSendNextdoor({
      envEnabled: true,
      eventName: "lead_identified",
      identityQuality: "high",
      quoteSafe: true,
      payload,
    })).toBe(true);

    expect(resolveShouldSendNextdoor({
      envEnabled: true,
      eventName: "virtual_page_view",
      identityQuality: "high",
      quoteSafe: true,
      payload,
    })).toBe(false);
  });
});
