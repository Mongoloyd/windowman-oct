/**
 * Tests for AppTrackingProvider — useAppTracking() out-of-provider fallback.
 *
 * Regression coverage for the missing `getLeadId` import: the fallback
 * branch (components rendered outside <AppTrackingProvider>, e.g. tests)
 * calls getLeadId()/getUtmData()/getUtmPayload directly. It must not throw
 * and must return a stable, non-empty lead ID plus unchanged UTM behavior.
 */

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useAppTracking } from "./AppTrackingProvider";
import { getLeadId } from "@/lib/useLeadId";
import { getUtmData, getUtmPayload } from "@/lib/useUtmCapture";

describe("useAppTracking outside AppTrackingProvider (fallback)", () => {
  it("does not throw when no provider is mounted", () => {
    expect(() => renderHook(() => useAppTracking())).not.toThrow();
  });

  it("returns a non-empty leadId matching getLeadId()", () => {
    const { result } = renderHook(() => useAppTracking());
    expect(result.current.leadId).toBeTruthy();
    expect(typeof result.current.leadId).toBe("string");
    expect(result.current.leadId.length).toBeGreaterThan(0);
    // getLeadId() caches the ID, so the fallback must return the same value.
    expect(result.current.leadId).toBe(getLeadId());
  });

  it("returns getUtmData() output and the canonical getUtmPayload", () => {
    const { result } = renderHook(() => useAppTracking());
    expect(result.current.utmData).toEqual(getUtmData());
    expect(result.current.getUtmPayload).toBe(getUtmPayload);
  });
});
