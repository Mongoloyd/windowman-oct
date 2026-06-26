import { describe, expect, it, vi } from "vitest";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Sealed supabase client throws without env — mock before importing the page.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
    from: vi.fn(),
    storage: { from: vi.fn() },
  },
}));

vi.mock("@/components/UploadZone", () => ({
  default: () => null,
}));

vi.mock("@/components/TruthGateFlow", () => ({
  hasTrustedContactIdentity: (
    leadId: string | null | undefined,
    sessionId: string | null | undefined,
  ) =>
    typeof leadId === "string" &&
    UUID_RE.test(leadId) &&
    typeof sessionId === "string" &&
    UUID_RE.test(sessionId),
}));

import { shouldRehydrateNextdoorUpload } from "@/pages/NextdoorHome";

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_SESSION_ID = "22222222-2222-4222-8222-222222222222";
const LEAD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

describe("shouldRehydrateNextdoorUpload", () => {
  it("rehydrates when leadId is valid and sessionId matches nextdoorSessionId", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(true);
  });

  it("does not rehydrate when funnel.sessionId differs from nextdoorSessionId", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: OTHER_SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it("does not rehydrate when leadId is missing", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: null,
        sessionId: SESSION_ID,
        nextdoorSessionId: SESSION_ID,
      }),
    ).toBe(false);
  });

  it("does not rehydrate when nextdoorSessionId is not a valid UUID", () => {
    expect(
      shouldRehydrateNextdoorUpload({
        leadId: LEAD_ID,
        sessionId: "bad",
        nextdoorSessionId: "bad",
      }),
    ).toBe(false);
  });
});
