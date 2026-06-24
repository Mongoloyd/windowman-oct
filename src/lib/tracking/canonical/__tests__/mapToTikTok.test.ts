import { describe, expect, it } from "vitest";
import {
  mapToTikTok,
  TIKTOK_LADDER_SOURCE_EVENTS,
  type TikTokMappedEvent,
  type WindowManTikTokSourceEvent,
} from "../mapToTikTok";

const LADDER: Array<
  [WindowManTikTokSourceEvent, string, "standard" | "custom"]
> = [
  ["truth_gate_captured", "SubmitForm", "standard"],
  ["lead_captured", "SubmitForm", "standard"],
  ["quote_uploaded", "UploadQuote", "custom"],
  ["report_revealed", "UnlockReport", "custom"],
  ["report_unlocked", "UnlockReport", "custom"],
  ["contractor_match_requested", "Contact", "standard"],
  ["contractor_intro_requested", "Contact", "standard"],
  ["appointment_booked", "Schedule", "standard"],
  ["appointment_scheduled", "Schedule", "standard"],
  ["sold", "CompletePayment", "standard"],
  ["won", "CompletePayment", "standard"],
];

describe("mapToTikTok", () => {
  it.each(LADDER)(
    "maps %s -> %s (%s)",
    (source, expectedName, expectedKind) => {
      const result = mapToTikTok(source);
      expect(result).not.toBeNull();
      expect(result?.sourceEvent).toBe(source);
      expect(result?.tiktokEventName).toBe(expectedName);
      expect(result?.kind).toBe(expectedKind);
    },
  );

  it("returns null for unknown events and never throws", () => {
    expect(mapToTikTok("unknown_event")).toBeNull();
    expect(mapToTikTok("")).toBeNull();
    expect(mapToTikTok("phone_verified")).toBeNull();
    expect(mapToTikTok("SubmitForm")).toBeNull();
  });

  it("classifies standard vs custom events correctly", () => {
    expect(mapToTikTok("truth_gate_captured")?.kind).toBe("standard");
    expect(mapToTikTok("contractor_match_requested")?.kind).toBe("standard");
    expect(mapToTikTok("appointment_booked")?.kind).toBe("standard");
    expect(mapToTikTok("sold")?.kind).toBe("standard");

    expect(mapToTikTok("quote_uploaded")?.kind).toBe("custom");
    expect(mapToTikTok("report_revealed")?.kind).toBe("custom");
    expect(mapToTikTok("report_unlocked")?.kind).toBe("custom");
  });

  it("assigns the correct optimization tier per funnel stage", () => {
    expect(mapToTikTok("truth_gate_captured")?.recommendedOptimizationTier).toBe("lead");
    expect(mapToTikTok("quote_uploaded")?.recommendedOptimizationTier).toBe("high_intent");
    expect(mapToTikTok("report_revealed")?.recommendedOptimizationTier).toBe("verified_demand");
    expect(mapToTikTok("contractor_match_requested")?.recommendedOptimizationTier).toBe("sales_ready");
    expect(mapToTikTok("appointment_booked")?.recommendedOptimizationTier).toBe("scheduled");
    expect(mapToTikTok("sold")?.recommendedOptimizationTier).toBe("revenue");
  });

  it("marks every mapped event as requiresServerConfirmation = true", () => {
    for (const source of TIKTOK_LADDER_SOURCE_EVENTS) {
      expect(mapToTikTok(source)?.requiresServerConfirmation).toBe(true);
    }
  });

  it("resolves aliases to the same TikTok event name", () => {
    expect(mapToTikTok("lead_captured")?.tiktokEventName).toBe(
      mapToTikTok("truth_gate_captured")?.tiktokEventName,
    );
    expect(mapToTikTok("report_unlocked")?.tiktokEventName).toBe(
      mapToTikTok("report_revealed")?.tiktokEventName,
    );
    expect(mapToTikTok("contractor_intro_requested")?.tiktokEventName).toBe(
      mapToTikTok("contractor_match_requested")?.tiktokEventName,
    );
    expect(mapToTikTok("appointment_scheduled")?.tiktokEventName).toBe(
      mapToTikTok("appointment_booked")?.tiktokEventName,
    );
    expect(mapToTikTok("won")?.tiktokEventName).toBe(
      mapToTikTok("sold")?.tiktokEventName,
    );
  });

  it("never embeds live endpoints or dispatch primitives in its output", () => {
    const forbidden = [
      "business-api.tiktok.com",
      "open-api.tiktok.com",
      "http://",
      "https://",
      "fetch",
      "ttq(",
      "capi-event",
      "dataLayer",
    ];

    for (const source of TIKTOK_LADDER_SOURCE_EVENTS) {
      const serialized = JSON.stringify(mapToTikTok(source));
      for (const token of forbidden) {
        expect(serialized.includes(token)).toBe(false);
      }
    }
  });

  it("returns a fresh object instance each call (pure)", () => {
    const a = mapToTikTok("sold") as TikTokMappedEvent;
    const b = mapToTikTok("sold") as TikTokMappedEvent;
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
