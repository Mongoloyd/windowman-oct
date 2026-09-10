import { describe, expect, it } from "vitest";
import { formatLatestActivityLabel } from "./formatLatestActivityLabel";

describe("formatLatestActivityLabel", () => {
  it("maps known activity types", () => {
    expect(formatLatestActivityLabel("quote_uploaded")).toBe("Quote uploaded");
    expect(formatLatestActivityLabel("truth_gate_captured")).toBe(
      "TruthGate submitted",
    );
    expect(formatLatestActivityLabel("quote_education_demo_submitted")).toBe(
      "Quote education demo submitted",
    );
  });

  it("falls back for unknown or empty values", () => {
    expect(formatLatestActivityLabel(null)).toBe("No activity yet");
    expect(formatLatestActivityLabel("custom_event_name")).toBe(
      "Custom Event Name",
    );
  });
});
