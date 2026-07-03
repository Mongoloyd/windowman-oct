import { describe, it, expect } from "vitest";
import {
  deriveEvidenceRowTier,
  deriveExecutiveSummaryVisual,
  mapCodeComplianceStatusToVisual,
  mapFinancialIntegrityStatusToVisual,
  mapFlagSeverityToVisual,
  mapSigningRiskSeverityToVisual,
  splitMoneyPhrases,
} from "./visualState";

describe("mapFlagSeverityToVisual", () => {
  it("maps red to critical strong card", () => {
    const v = mapFlagSeverityToVisual("red");
    expect(v.tone).toBe("critical");
    expect(v.intensity).toBe("strong");
    expect(v.cardClass).toContain("fr-card--critical");
    expect(v.cardClass).toContain("fr-glow--critical");
    expect(v.pillClass).toBe("fr-pill--critical");
    expect(v.shouldGlow).toBe(true);
  });

  it("maps amber to warning medium card", () => {
    const v = mapFlagSeverityToVisual("amber");
    expect(v.tone).toBe("warning");
    expect(v.intensity).toBe("medium");
    expect(v.cardClass).toContain("fr-card--warning");
    expect(v.pillClass).toBe("fr-pill--warning");
  });

  it("maps green to verified soft card", () => {
    const v = mapFlagSeverityToVisual("green");
    expect(v.tone).toBe("verified");
    expect(v.cardClass).toContain("fr-card--verified");
    expect(v.shouldGlow).toBe(false);
  });
});

describe("mapSigningRiskSeverityToVisual", () => {
  it("maps critical to red visual", () => {
    expect(mapSigningRiskSeverityToVisual("critical").tone).toBe("critical");
  });

  it("maps warning to amber visual", () => {
    expect(mapSigningRiskSeverityToVisual("warning").tone).toBe("warning");
  });
});

describe("deriveExecutiveSummaryVisual", () => {
  it("returns critical strong when overpayment is positive", () => {
    const v = deriveExecutiveSummaryVisual({
      grade: "A",
      flagRedCount: 0,
      overpaymentLow: 1000,
      overpaymentHigh: 2000,
    });
    expect(v.tone).toBe("critical");
    expect(v.cardClass).toContain("fr-glow--critical-strong");
  });

  it("returns warning when grade is weak", () => {
    const v = deriveExecutiveSummaryVisual({
      grade: "D",
      flagRedCount: 0,
    });
    expect(v.tone).toBe("warning");
    expect(v.cardClass).toContain("fr-card--warning");
  });

  it("returns warning when red flags present", () => {
    const v = deriveExecutiveSummaryVisual({
      grade: "B",
      flagRedCount: 2,
    });
    expect(v.tone).toBe("warning");
  });

  it("returns calm info when no risk signals", () => {
    const v = deriveExecutiveSummaryVisual({
      grade: "A",
      flagRedCount: 0,
    });
    expect(v.tone).toBe("info");
    expect(v.cardClass).toBe("fr-card");
    expect(v.shouldGlow).toBe(false);
  });
});

describe("deriveEvidenceRowTier", () => {
  it("financial: maps high_friction to critical-alert", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "financial",
        status: "high_friction",
        severity: "info",
      }),
    ).toBe("critical-alert");
  });

  it("financial: maps danger severity to critical-alert", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "financial",
        status: "transparent",
        severity: "danger",
      }),
    ).toBe("critical-alert");
  });

  it("financial: maps needs_verification to warning-alert", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "financial",
        status: "needs_verification",
        severity: "info",
      }),
    ).toBe("warning-alert");
  });

  it("financial: maps transparent to summary", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "financial",
        status: "transparent",
        severity: "info",
      }),
    ).toBe("summary");
  });

  it("compliance: maps missing+danger to critical-alert", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "compliance",
        status: "missing",
        severity: "danger",
      }),
    ).toBe("critical-alert");
  });

  it("compliance: maps missing+warning to warning-alert", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "compliance",
        status: "missing",
        severity: "warning",
      }),
    ).toBe("warning-alert");
  });

  it("compliance: maps documented to summary", () => {
    expect(
      deriveEvidenceRowTier({
        domain: "compliance",
        status: "documented",
        severity: "info",
      }),
    ).toBe("summary");
  });
});

describe("splitMoneyPhrases", () => {
  it("splits single dollar amount", () => {
    const parts = splitMoneyPhrases("Potential hidden total: $2,300–$4,400.");
    expect(parts.some((p) => p.isMoney && p.text.includes("$2,300"))).toBe(true);
  });

  it("returns plain text when no money", () => {
    const parts = splitMoneyPhrases("No dollar values here.");
    expect(parts).toEqual([{ text: "No dollar values here.", isMoney: false }]);
  });

  it("handles empty string", () => {
    expect(splitMoneyPhrases("")).toEqual([{ text: "", isMoney: false }]);
  });
});

describe("mapFinancialIntegrityStatusToVisual", () => {
  it("maps transparent to verified pill", () => {
    const v = mapFinancialIntegrityStatusToVisual("transparent");
    expect(v.tone).toBe("verified");
    expect(v.pillClass).toBe("fr-pill--verified");
  });

  it("maps high_friction to critical pill", () => {
    const v = mapFinancialIntegrityStatusToVisual("high_friction");
    expect(v.tone).toBe("critical");
    expect(v.pillClass).toBe("fr-pill--critical");
  });
});

describe("mapCodeComplianceStatusToVisual", () => {
  it("maps documented to verified pill", () => {
    const v = mapCodeComplianceStatusToVisual("documented");
    expect(v.tone).toBe("verified");
    expect(v.pillClass).toBe("fr-pill--verified");
  });

  it("maps missing to critical pill", () => {
    const v = mapCodeComplianceStatusToVisual("missing");
    expect(v.tone).toBe("critical");
    expect(v.pillClass).toBe("fr-pill--critical");
  });
});
