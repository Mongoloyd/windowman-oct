import { afterEach, describe, expect, it } from "vitest";
import { buildCanonicalTruthGateHandoffUrl } from "./landingHandoff";

function mockSearch(search: string) {
  const query = search.startsWith("?") ? search : search ? `?${search}` : "";
  window.history.replaceState({}, "", `/windowman${query}`);
}

describe("buildCanonicalTruthGateHandoffUrl", () => {
  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("preserves UTMs and sets wm_intent=has_quote", () => {
    mockSearch("?utm_source=nextdoor&utm_campaign=test");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?utm_source=nextdoor&utm_campaign=test&wm_intent=has_quote#truth-gate",
    );
  });

  it("preserves click IDs", () => {
    mockSearch("?fbclid=abc&gclid=xyz&ndclid=nd1");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?gclid=xyz&fbclid=abc&ndclid=nd1&wm_intent=has_quote#truth-gate",
    );
  });

  it("drops email", () => {
    mockSearch("?email=test@example.com&utm_source=google");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?utm_source=google&wm_intent=has_quote#truth-gate",
    );
  });

  it("drops scan_session_id", () => {
    mockSearch("?scan_session_id=123&utm_source=nextdoor");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?utm_source=nextdoor&wm_intent=has_quote#truth-gate",
    );
  });

  it("overwrites existing wm_intent=education_mode", () => {
    mockSearch("?wm_intent=education_mode&utm_source=nextdoor");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?utm_source=nextdoor&wm_intent=has_quote#truth-gate",
    );
  });

  it("does not preserve resume=1", () => {
    mockSearch("?resume=1&utm_source=nextdoor");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?utm_source=nextdoor&wm_intent=has_quote#truth-gate",
    );
  });

  it("returns intent-only URL when no allowlisted params exist", () => {
    mockSearch("");
    expect(buildCanonicalTruthGateHandoffUrl("has_quote")).toBe(
      "/?wm_intent=has_quote#truth-gate",
    );
  });
});
