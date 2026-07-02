import { beforeEach, describe, expect, it, vi } from "vitest";

const pushLowIntentEventMock = vi.fn();
const handoffMock = vi.fn();
const openIntakeMock = vi.fn();

vi.mock("@/lib/tracking/dataLayer", () => ({
  HANDOFF_SOURCE_ROUTE_KEY: "wm_last_handoff_source_route",
  pushLowIntentEvent: (...args: unknown[]) => pushLowIntentEventMock(...args),
}));

vi.mock("./landingHandoff", () => ({
  handoffToCanonicalUpload: () => handoffMock(),
  openFirstQuoteIntake: () => openIntakeMock(),
}));

import {
  trackAndHandoffToCanonicalUpload,
  trackAndOpenFirstQuoteIntake,
} from "./landingTracking";

describe("landingTracking", () => {
  beforeEach(() => {
    pushLowIntentEventMock.mockReset();
    handoffMock.mockReset();
    openIntakeMock.mockReset();
    sessionStorage.clear();
  });

  it("fires windowman_handoff_has_quote then navigates", () => {
    trackAndHandoffToCanonicalUpload("hero_analyze_quote");

    expect(pushLowIntentEventMock).toHaveBeenCalledWith(
      "windowman_handoff_has_quote",
      expect.objectContaining({
        wm_intent: "has_quote",
        cta_source: "hero_analyze_quote",
        destination_hash: "#truth-gate",
      }),
    );
    expect(sessionStorage.getItem("wm_last_handoff_source_route")).toBe("/windowman");
    expect(handoffMock).toHaveBeenCalledTimes(1);
  });

  it("fires first_quote_modal_opened then opens modal", () => {
    trackAndOpenFirstQuoteIntake("hero_first_quote");

    expect(pushLowIntentEventMock).toHaveBeenCalledWith(
      "first_quote_modal_opened",
      expect.objectContaining({
        wm_intent: "no_quote",
        cta_source: "hero_first_quote",
        page_path: "/windowman",
      }),
    );
    expect(openIntakeMock).toHaveBeenCalledTimes(1);
  });
});
