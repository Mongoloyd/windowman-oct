import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LeadHumanContextPanel } from "./LeadHumanContextPanel";

const baseLead = {
  first_name: "Jane",
  last_name: "Doe",
  county: "Miami-Dade",
  property_type_detail: "single_family",
  hoa_or_condo_complexity: "none",
  handoff_consent_status: "accepted_today",
  timeline_bucket: "this_month",
};

function renderPanel(
  diagnosisIntake: Record<string, unknown> | null,
) {
  return render(
    <LeadHumanContextPanel
      lead={baseLead}
      diagnosisIntake={diagnosisIntake as any}
      analysis={null}
      latestRoute={null}
    />,
  );
}

describe("LeadHumanContextPanel — Advisor Note", () => {
  it("renders non-empty counter_offer.terms_free_text under Advisor Note", () => {
    renderPanel({
      primary_diagnosis: "price_shock",
      secondary_clarifiers: { codes: [] },
      other_text: null,
      counter_offer: { terms_free_text: "Please call after 5pm" },
      created_at: "2026-07-17T00:00:00Z",
    });

    expect(screen.getByText("Advisor Note")).toBeInTheDocument();
    expect(screen.getByText("Please call after 5pm")).toBeInTheDocument();
  });

  it("omits Advisor Note for empty and whitespace-only notes", () => {
    const { unmount } = renderPanel({
      primary_diagnosis: "price_shock",
      secondary_clarifiers: { codes: [] },
      other_text: null,
      counter_offer: { terms_free_text: "" },
      created_at: null,
    });
    expect(screen.queryByText("Advisor Note")).toBeNull();
    unmount();

    renderPanel({
      primary_diagnosis: "price_shock",
      secondary_clarifiers: { codes: [] },
      other_text: null,
      counter_offer: { terms_free_text: "   \n\t  " },
      created_at: null,
    });
    expect(screen.queryByText("Advisor Note")).toBeNull();
  });

  it("omits Advisor Note for malformed or non-string values", () => {
    const cases: unknown[] = [
      null,
      undefined,
      42,
      { nested: "nope" },
      ["array"],
    ];

    for (const value of cases) {
      const { unmount } = renderPanel({
        primary_diagnosis: "price_shock",
        secondary_clarifiers: { codes: [] },
        other_text: null,
        counter_offer: value === undefined ? null : { terms_free_text: value },
        created_at: null,
      });
      expect(screen.queryByText("Advisor Note")).toBeNull();
      unmount();
    }

    // Entire counter_offer missing
    renderPanel({
      primary_diagnosis: "price_shock",
      secondary_clarifiers: { codes: [] },
      other_text: null,
      created_at: null,
    });
    expect(screen.queryByText("Advisor Note")).toBeNull();
  });

  it("still renders existing other_text independently of Advisor Note", () => {
    renderPanel({
      primary_diagnosis: "price_shock",
      secondary_clarifiers: { codes: [] },
      other_text: "Custom concern about financing",
      counter_offer: { terms_free_text: "Call after 5pm" },
      created_at: null,
    });

    expect(screen.getByText(/Notes: Custom concern about financing/)).toBeInTheDocument();
    expect(screen.getByText("Advisor Note")).toBeInTheDocument();
    expect(screen.getByText("Call after 5pm")).toBeInTheDocument();
  });
});
