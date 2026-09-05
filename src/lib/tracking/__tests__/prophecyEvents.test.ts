import { beforeEach, describe, expect, it, vi } from "vitest";

const pushDataLayerEventMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/tracking/dataLayer", () => ({
  pushDataLayerEvent: pushDataLayerEventMock,
}));

import {
  pushProphecyLowIntentEvent,
  type ProphecyLowIntentEventName,
  type ProphecyLowIntentParameters,
} from "@/lib/tracking/prophecyEvents";

describe("Prophecy low-intent measurement", () => {
  beforeEach(() => {
    pushDataLayerEventMock.mockReset();
  });

  it("supports only the approved low-intent event names", () => {
    const eventNames: ProphecyLowIntentEventName[] = [
      "path_selected",
      "form_start",
      "form_error",
      "upload_start",
      "upload_error",
      "video_play",
    ];

    for (const eventName of eventNames) {
      pushProphecyLowIntentEvent(eventName);
    }

    expect(pushDataLayerEventMock.mock.calls.map(([name]) => name)).toEqual(
      eventNames,
    );
    expect(pushDataLayerEventMock).toHaveBeenNthCalledWith(
      1,
      "path_selected",
      { source_tool: "prophecy" },
    );
  });

  it("projects a new payload from the strict scalar allowlist", () => {
    pushProphecyLowIntentEvent("upload_start", {
      flow_variant: "four_checks",
      wm_intent: "has_quote",
      cta_location: "hero_primary",
      step_name: "upload",
      file_type: "application/pdf",
      email: "private@example.com",
      phone: "+15551234567",
      zip: "33301",
      filename: "private-quote.pdf",
      storage_path: "quotes/private-quote.pdf",
      visitor_id: "visitor-id",
      lead_id: "lead-id",
      session_id: "session-id",
      metadata: { secret: true },
    } as ProphecyLowIntentParameters & Record<string, unknown>);

    expect(pushDataLayerEventMock).toHaveBeenCalledWith("upload_start", {
      source_tool: "prophecy",
      flow_variant: "four_checks",
      wm_intent: "has_quote",
      cta_location: "hero_primary",
      step_name: "upload",
      file_type: "application/pdf",
    });
  });

  it("drops invalid enum values, unsafe variants, and unknown event names", () => {
    pushProphecyLowIntentEvent("form_start", {
      flow_variant: "someone@example.com",
      wm_intent: "maybe" as "has_quote",
      cta_location: "sidebar" as "hero_primary",
      step_name: "contact-name" as "intent",
      file_type: "text/plain" as "application/pdf",
    });
    pushProphecyLowIntentEvent(
      "lead_captured" as ProphecyLowIntentEventName,
      {},
    );

    expect(pushDataLayerEventMock).toHaveBeenCalledTimes(1);
    expect(pushDataLayerEventMock).toHaveBeenCalledWith("form_start", {
      source_tool: "prophecy",
    });
  });

  it("never lets a downstream measurement exception break the caller", () => {
    pushDataLayerEventMock.mockImplementationOnce(() => {
      throw new Error("measurement unavailable");
    });

    expect(() =>
      pushProphecyLowIntentEvent("video_play", {
        flow_variant: "prophecy",
        step_name: "explainer",
      }),
    ).not.toThrow();
  });
});
