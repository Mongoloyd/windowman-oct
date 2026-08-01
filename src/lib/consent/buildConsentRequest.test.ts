import { describe, expect, it } from "vitest";
import {
  buildContractorSharingConsentRequest,
  buildLeadCaptureConsentRequest,
} from "./buildConsentRequest";

describe("buildLeadCaptureConsentRequest", () => {
  const submissionId = "11111111-1111-4111-8111-111111111111";

  it("records service granted and marketing declined when checkbox unchecked", () => {
    const consent = buildLeadCaptureConsentRequest({
      submissionId,
      source: "truth-gate",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: true,
      marketingCommunicationsGranted: false,
    });
    expect(consent.schemaVersion).toBe("1");
    expect(consent.events).toEqual([
      {
        purpose: "service_communications",
        decision: "granted",
        disclosureVersion: "2026-08-01",
      },
      {
        purpose: "marketing_communications",
        decision: "declined",
        disclosureVersion: "2026-08-01",
      },
    ]);
    expect(consent.events.some((e) => e.purpose === "contractor_sharing")).toBe(
      false,
    );
  });

  it("omits marketing when not presented", () => {
    const consent = buildLeadCaptureConsentRequest({
      submissionId,
      source: "google_quote_check",
      serviceCommunicationsGranted: true,
      marketingConsentPresented: false,
    });
    expect(consent.events).toHaveLength(1);
    expect(consent.events[0]?.purpose).toBe("service_communications");
  });
});

describe("buildContractorSharingConsentRequest", () => {
  it("records contractor sharing only at handoff", () => {
    const consent = buildContractorSharingConsentRequest({
      submissionId: "22222222-2222-4222-8222-222222222222",
      granted: true,
    });
    expect(consent.source).toBe("homeowner-context");
    expect(consent.events).toEqual([
      {
        purpose: "contractor_sharing",
        decision: "granted",
        disclosureVersion: "2026-08-01",
      },
    ]);
  });
});
