/**
 * Phase 10 — humanContext deterministic helpers
 *
 * These tests lock the contract that the operator dossier and routing desk
 * depend on. If you change the wording, update the tests in the same commit.
 */

import { describe, it, expect } from "vitest";
import {
  buildOpeningScript,
  deriveLeadFitWarnings,
  handoffConsentLabel,
  motivationLabelFromDiagnosis,
  propertyTypeLabel,
  timelineLabel,
} from "./humanContext";

describe("buildOpeningScript", () => {
  it("uses warm-handoff preamble when consent is accepted_today", () => {
    const out = buildOpeningScript({
      homeownerFirstName: "Sarah",
      contractorName: "Mike with ABC Windows",
      topFlag: "your current quote does not clearly show the NOA and installation scope",
      primary_diagnosis: "price_shock",
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      timeline_bucket: "this_month",
      handoff_consent_status: "accepted_today",
    });
    expect(out.script).toContain("Hi Sarah, this is Mike with ABC Windows.");
    expect(out.script).toContain("WindowMan asked me to follow up");
    expect(out.script).toContain("apples-to-apples");
    expect(out.isUrgent).toBe(true);
    expect(out.isReportOnly).toBe(false);
  });

  it("never says WindowMan asked me to call when consent is report_only", () => {
    const out = buildOpeningScript({
      homeownerFirstName: "Pat",
      contractorName: "Mike",
      topFlag: null,
      primary_diagnosis: "trust_breakdown",
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      timeline_bucket: "researching",
      handoff_consent_status: "report_only",
    });
    expect(out.script).not.toContain("WindowMan asked me to follow up");
    expect(out.script).toContain("I'm following up on the report");
    expect(out.isReportOnly).toBe(true);
    expect(out.isUrgent).toBe(false);
  });

  it("appends HOA confirmation line for condos", () => {
    const out = buildOpeningScript({
      homeownerFirstName: "Maria",
      contractorName: "John from XYZ",
      topFlag: "the quote omits permit handling",
      primary_diagnosis: "scope_mismatch",
      property_type_detail: "condo",
      hoa_or_condo_complexity: "hoa_complex",
      timeline_bucket: "asap",
      handoff_consent_status: "accepted_today",
    });
    expect(out.script).toContain("HOA / engineering requirements");
    expect(out.isUrgent).toBe(true);
  });

  it("falls back to safe defaults when names and flag are missing", () => {
    const out = buildOpeningScript({
      homeownerFirstName: null,
      contractorName: null,
      topFlag: null,
      primary_diagnosis: null,
      property_type_detail: null,
      hoa_or_condo_complexity: null,
      timeline_bucket: null,
      handoff_consent_status: null,
    });
    expect(out.script).toContain("Hi there, this is your assigned contractor");
    expect(out.script).toContain("WindowMan asked me to follow up"); // default = warm
    expect(out.isUrgent).toBe(false);
    expect(out.isReportOnly).toBe(false);
  });

  it("price_shock with no top flag still produces a coherent sentence", () => {
    const out = buildOpeningScript({
      homeownerFirstName: "Sam",
      contractorName: "Lee",
      topFlag: null,
      primary_diagnosis: "price_shock",
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      timeline_bucket: "this_month",
      handoff_consent_status: "accepted_today",
    });
    expect(out.script).toContain("Hi Sam, this is Lee.");
    expect(out.script).toContain("apples-to-apples");
  });
});

describe("deriveLeadFitWarnings", () => {
  it("emits report_only block warning first", () => {
    const w = deriveLeadFitWarnings({
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      handoff_consent_status: "report_only",
      timeline_bucket: "this_month",
      primary_diagnosis: "trust_breakdown",
      secondary_clarifier_count: 2,
    });
    expect(w[0].code).toBe("report_only");
    expect(w[0].severity).toBe("block");
  });

  it("flags condo as complex approval", () => {
    const w = deriveLeadFitWarnings({
      property_type_detail: "condo",
      hoa_or_condo_complexity: "hoa_simple",
      handoff_consent_status: "accepted_today",
      timeline_bucket: "asap",
      primary_diagnosis: "scope_mismatch",
      secondary_clarifier_count: 1,
    });
    expect(w.some((x) => x.code === "complex_approval")).toBe(true);
  });

  it("flags high_rise_engineering even on a non-condo property type", () => {
    const w = deriveLeadFitWarnings({
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "high_rise_engineering",
      handoff_consent_status: "accepted_today",
      timeline_bucket: "asap",
      primary_diagnosis: "price_shock",
      secondary_clarifier_count: 1,
    });
    expect(w.some((x) => x.code === "complex_approval")).toBe(true);
  });

  it("flags possible price shopper only when no clarifiers", () => {
    const noClar = deriveLeadFitWarnings({
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      handoff_consent_status: "accepted_today",
      timeline_bucket: "this_month",
      primary_diagnosis: "price_shock",
      secondary_clarifier_count: 0,
    });
    expect(noClar.some((x) => x.code === "possible_price_shopper")).toBe(true);

    const withClar = deriveLeadFitWarnings({
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      handoff_consent_status: "accepted_today",
      timeline_bucket: "this_month",
      primary_diagnosis: "price_shock",
      secondary_clarifier_count: 3,
    });
    expect(withClar.some((x) => x.code === "possible_price_shopper")).toBe(false);
  });

  it("flags property_unknown when type is missing", () => {
    const w = deriveLeadFitWarnings({
      property_type_detail: null,
      hoa_or_condo_complexity: null,
      handoff_consent_status: "accepted_today",
      timeline_bucket: "this_month",
      primary_diagnosis: "trust_breakdown",
      secondary_clarifier_count: 1,
    });
    expect(w.some((x) => x.code === "property_unknown")).toBe(true);
  });

  it("emits no warnings for a clean serious buyer", () => {
    const w = deriveLeadFitWarnings({
      property_type_detail: "single_family",
      hoa_or_condo_complexity: "none",
      handoff_consent_status: "accepted_today",
      timeline_bucket: "this_month",
      primary_diagnosis: "trust_breakdown",
      secondary_clarifier_count: 2,
    });
    expect(w.length).toBe(0);
  });
});

describe("display helpers", () => {
  it("returns null for unknown enum values", () => {
    expect(propertyTypeLabel("alien_dome")).toBeNull();
    expect(propertyTypeLabel(null)).toBeNull();
    expect(timelineLabel(undefined)).toBeNull();
    expect(handoffConsentLabel("garbage")).toBeNull();
    expect(motivationLabelFromDiagnosis(null)).toBeNull();
  });

  it("returns expected labels for known values", () => {
    expect(propertyTypeLabel("condo")).toBe("Condo");
    expect(timelineLabel("asap")).toContain("ASAP");
    expect(handoffConsentLabel("report_only")?.short).toBe("Report only");
    expect(motivationLabelFromDiagnosis("price_shock")?.short).toBe("Price felt high");
  });
});
