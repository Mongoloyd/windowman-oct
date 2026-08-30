import { describe, expect, it } from "vitest";
import { formatContractorName } from "./formatContractorName";

describe("formatContractorName", () => {
  it("title-cases uniformly lower or upper OCR output", () => {
    expect(formatContractorName("brightview window")).toBe("Brightview Window");
    expect(formatContractorName("COASTAL FORTRESS WINDOWS LLC")).toBe(
      "Coastal Fortress Windows LLC",
    );
  });

  it("preserves deliberate mixed-case brand styling", () => {
    expect(formatContractorName("  BrightView   Window  ")).toBe("BrightView Window");
    expect(formatContractorName("iQ Windows PGT")).toBe("iQ Windows PGT");
  });

  it("handles punctuation, blanks, nulls, and length bounds safely", () => {
    expect(formatContractorName("o'brien coastal-windows")).toBe(
      "O'Brien Coastal-Windows",
    );
    expect(formatContractorName("   ")).toBeNull();
    expect(formatContractorName(null)).toBeNull();
    expect(formatContractorName(undefined)).toBeNull();
    expect(formatContractorName("long contractor name", 8)).toBe("Long Con");
  });
});
