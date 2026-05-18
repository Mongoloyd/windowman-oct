import { describe, it, expect, vi } from "vitest";
import { applyLeadPhoneHydration, resolveGatedFunnelPhone } from "./gatedFunnelPhone";

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
  it("hydrates phone from lead when funnel has no phone", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      leadPhoneE164: "+13055551234",
      funnelPhoneE164: null,
      funnelPhoneStatus: "none",
      setPhone,
    });
    expect(setPhone).toHaveBeenCalledWith("+13055551234", "screened_valid");
  });

  it("does not clear funnel phone when lead read is null and status is otp_sent", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      leadPhoneE164: null,
      funnelPhoneE164: "+13055551234",
      funnelPhoneStatus: "otp_sent",
      setPhone,
    });
    expect(setPhone).not.toHaveBeenCalled();
  });

  it("clears stale funnel phone only when status is none and lead has no phone", () => {
    const setPhone = vi.fn();
    applyLeadPhoneHydration({
      leadPhoneE164: null,
      funnelPhoneE164: "+13055551234",
      funnelPhoneStatus: "none",
      setPhone,
    });
    expect(setPhone).toHaveBeenCalledWith("", "none");
  });
});
