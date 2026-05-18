import { describe, it, expect, vi } from "vitest";
import { applyLeadPhoneHydration, resolveGatedFunnelPhone } from "./gatedFunnelPhone";
import type { PhoneFunnelStatus } from "@/state/scanFunnel";

describe("resolveGatedFunnelPhone", () => {
  it("passes through phone when funnel scanSessionId is unset", () => {
    const result = resolveGatedFunnelPhone(
      {
        phoneE164: "+13055551234",
        phoneStatus: "otp_sent",
        scanSessionId: null,
      },
      "11111111-1111-4111-8111-111111111111",
    );
    expect(result.phoneE164).toBe("+13055551234");
    expect(result.phoneStatus).toBe("otp_sent");
    expect(result.isSessionMatch).toBe(true);
  });

  it("hides phone when funnel scanSessionId mismatches active session", () => {
    const result = resolveGatedFunnelPhone(
      {
        phoneE164: "+13055551234",
        phoneStatus: "otp_sent",
        scanSessionId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      },
      "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    );
    expect(result.phoneE164).toBeNull();
    expect(result.phoneStatus).toBeUndefined();
    expect(result.isSessionMatch).toBe(false);
  });
});

describe("applyLeadPhoneHydration", () => {
  it("hydrates phone from a loaded lead when funnel has no phone", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      lead: { kind: "loaded", phoneE164: "+13055551234" },
      funnelPhoneE164: null,
      funnelPhoneStatus: "none",
      setPhone,
    });
    expect(setPhone).toHaveBeenCalledWith("+13055551234", "screened_valid");
  });

  it("preserves funnel phone when lead read is unknown (status none)", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      lead: { kind: "unknown" },
      funnelPhoneE164: "+13055551234",
      funnelPhoneStatus: "none",
      setPhone,
    });
    expect(setPhone).not.toHaveBeenCalled();
  });

  it("preserves funnel phone when lead read is unknown (status otp_sent)", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      lead: { kind: "unknown" },
      funnelPhoneE164: "+13055551234",
      funnelPhoneStatus: "otp_sent",
      setPhone,
    });
    expect(setPhone).not.toHaveBeenCalled();
  });

  it("clears stale funnel phone only when loaded lead has no phone and status is none", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      lead: { kind: "loaded", phoneE164: null },
      funnelPhoneE164: "+13055551234",
      funnelPhoneStatus: "none",
      setPhone,
    });
    expect(setPhone).toHaveBeenCalledWith("", "none");
  });

  const protectedStatuses: PhoneFunnelStatus[] = [
    "screened_valid",
    "sending_otp",
    "otp_sent",
    "verified",
    "send_failed",
  ];

  it.each(protectedStatuses)(
    "does not clear funnel phone when loaded lead has no phone and status is %s",
    (funnelPhoneStatus) => {
      const setPhone = vi.fn();
      applyLeadPhoneHydration({
        lead: { kind: "loaded", phoneE164: null },
        funnelPhoneE164: "+13055551234",
        funnelPhoneStatus,
        setPhone,
      });
      expect(setPhone).not.toHaveBeenCalled();
    },
  );
});
