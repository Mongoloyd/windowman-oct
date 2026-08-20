import { describe, expect, it } from "vitest";
import {
  classifyRouteOwnership,
  normalizeClientSlug,
  type RouteOwnershipInput,
} from "../routeOwnership";

function makeInput(overrides: Partial<RouteOwnershipInput> = {}): RouteOwnershipInput {
  return {
    eventName: "lead_identified",
    attemptCount: 1,
    ...overrides,
  };
}

describe("normalizeClientSlug", () => {
  it("trims and lowercases slugs", () => {
    expect(normalizeClientSlug("  Tenant-Alpha  ")).toBe("tenant-alpha");
  });

  it("returns null for empty or non-string values", () => {
    expect(normalizeClientSlug("")).toBeNull();
    expect(normalizeClientSlug("   ")).toBeNull();
    expect(normalizeClientSlug(null)).toBeNull();
    expect(normalizeClientSlug(undefined)).toBeNull();
    expect(normalizeClientSlug(42)).toBeNull();
  });
});

describe("classifyRouteOwnership", () => {
  it("returns tenant_required when normalized slug is present", () => {
    const result = classifyRouteOwnership(
      makeInput({ eventClientSlug: "Tenant-Alpha" }),
    );

    expect(result).toEqual({
      routeClass: "tenant_required",
      verifiedClientSlug: "tenant-alpha",
      reason: "tenant_slug_verified",
      allowDefaultPixel: false,
      allowEnvFallback: false,
    });
  });

  it("allows only the exact server-minted WMChat lead scope", () => {
    const result = classifyRouteOwnership(
      makeInput({
        eventName: "lead_captured",
        eventLeadId: crypto.randomUUID(),
        eventMeasurementScope: "wmchat_day1_lead",
      }),
    );

    expect(result).toEqual({
      routeClass: "platform_owned",
      verifiedClientSlug: null,
      reason: "platform_owned_wmchat_lead",
      allowDefaultPixel: true,
      allowEnvFallback: true,
    });
  });

  it("keeps tenant ownership ahead of the platform WMChat scope", () => {
    const result = classifyRouteOwnership(
      makeInput({
        eventName: "lead_captured",
        eventClientSlug: "Tenant-Alpha",
        eventMeasurementScope: "wmchat_day1_lead",
      }),
    );

    expect(result.routeClass).toBe("tenant_required");
    expect(result.verifiedClientSlug).toBe("tenant-alpha");
  });

  it("rejects unrelated events even if they copy the scope literal", () => {
    const result = classifyRouteOwnership(
      makeInput({
        eventName: "lead_qualified",
        eventLeadId: crypto.randomUUID(),
        eventMeasurementScope: "wmchat_day1_lead",
      }),
    );

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("missing_client_slug");
  });

  it("returns unresolved missing_client_slug when lead_id exists without slug", () => {
    const result = classifyRouteOwnership(
      makeInput({ eventLeadId: crypto.randomUUID() }),
    );

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("missing_client_slug");
    expect(result.verifiedClientSlug).toBeNull();
    expect(result.allowDefaultPixel).toBe(false);
  });

  it("returns unresolved missing_client_slug when scan_session_id exists without slug", () => {
    const result = classifyRouteOwnership(
      makeInput({ eventScanSessionId: crypto.randomUUID() }),
    );

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("missing_client_slug");
  });

  it("returns unresolved missing_client_slug when analysis_id exists without slug", () => {
    const result = classifyRouteOwnership(
      makeInput({ eventAnalysisId: crypto.randomUUID() }),
    );

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("missing_client_slug");
  });

  it("returns unresolved missing_client_slug when quote_file_id exists without slug", () => {
    const result = classifyRouteOwnership(
      makeInput({ eventQuoteFileId: crypto.randomUUID() }),
    );

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("missing_client_slug");
  });

  it("returns unresolved platform_default_not_allowed when no entity IDs and no slug", () => {
    const result = classifyRouteOwnership(makeInput());

    expect(result.routeClass).toBe("unresolved");
    expect(result.reason).toBe("platform_default_not_allowed");
    expect(result.allowDefaultPixel).toBe(false);
    expect(result.allowEnvFallback).toBe(false);
  });
});
