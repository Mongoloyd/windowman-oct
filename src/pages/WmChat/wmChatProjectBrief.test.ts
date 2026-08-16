import { describe, expect, it } from "vitest";

import { buildWmChatProjectBrief } from "./wmChatProjectBrief";
import type { WmChatIntakeV1 } from "./wmChatTypes";

function createIntake(
  overrides: Partial<WmChatIntakeV1> = {},
): WmChatIntakeV1 {
  return {
    schema_version: "1",
    intake_version: "wmchat_v1",
    entry_intent: "need_quote",
    answer_path: [],
    answers: {},
    continuation: "sms_then_voice",
    ...overrides,
  };
}

describe("buildWmChatProjectBrief", () => {
  it("builds a detailed need-quote brief from validated answers", () => {
    const brief = buildWmChatProjectBrief(
      createIntake({
        answers: {
          need_reason: "need_storm",
          need_detail: "storm_impact_uncertain",
          priorities: [
            "priority_correct_product",
            "priority_complete_scope",
          ],
          stakes: "stakes_storm_documents",
          trust_concern: "trust_missing_product",
          zip: "33301",
          project_scope: "scope_both",
          openings: "openings_11_20",
          budget_posture: "budget_baseline",
          timing: "timing_1_3_months",
        },
      }),
    );

    expect(brief.projectSummary).toEqual(
      expect.arrayContaining([
        "Starting point: Preparing to request a quote.",
        "Project trigger: Storm or insurance concerns.",
        "Specific situation: Impact-rating uncertainty.",
        "Project scope: Windows and exterior doors.",
        "Estimated size: 11–20 openings.",
        "Timing: 1–3 months.",
        "Project ZIP: 33301.",
      ]),
    );
    expect(brief.recommendation).toContain(
      "Require the exact product approvals, ratings, and installation scope in writing.",
    );
    expect(brief.recommendation).toContain(
      "Do not compare totals until the exact products and relevant ratings are documented.",
    );
    expect(brief.estimateRequirements).toEqual(
      expect.arrayContaining([
        "Exact approval or rating identifiers applicable to each proposed window or door product.",
        "Separate window and exterior-door schedules so quantities, hardware, products, and installation responsibilities remain clear.",
        "Product, permit, approval, and installation records identified as deliverables without promising an insurance outcome.",
      ]),
    );
    expect(brief.contractorQuestions).toContain(
      "Where can I verify the approval or rating for this exact product and size?",
    );
    expect(brief.nextActions.map(({ id }) => id)).toEqual([
      "build_quote_request_game_plan",
      "schedule_windowman_conversation",
      "review_quote_when_ready",
    ]);
  });

  it("builds a quote-review brief around price and financing concerns", () => {
    const brief = buildWmChatProjectBrief(
      createIntake({
        entry_intent: "have_quote",
        answers: {
          have_concern: "have_price",
          have_detail: "price_monthly",
        },
      }),
    );

    expect(brief.projectSummary).toEqual([
      "Starting point: Reviewing an existing quote.",
      "Primary quote concern: Price.",
      "Review focus: Monthly payment.",
    ]);
    expect(brief.recommendation).toContain(
      "Test the price against the complete written scope, product, fees, and warranty",
    );
    expect(brief.estimateRequirements).toContain(
      "Monthly payment should be accompanied by cash price, financed principal, term, rate, and total repayment where applicable.",
    );
    expect(brief.contractorQuestions).toContain(
      "What are the cash price and total repayment, not only the monthly payment?",
    );
    expect(brief.nextActions[0]?.id).toBe("review_existing_quote");
  });

  it("preserves the learn-powers origin while using the selected real path", () => {
    const brief = buildWmChatProjectBrief(
      createIntake({
        entry_intent: "learn_powers",
        answers: {
          power_route: "power_route_have_quote",
          have_concern: "have_scope",
          have_detail: "scope_install_permits",
        },
      }),
    );

    expect(brief.projectSummary[0]).toBe(
      "Starting point: Exploring how WindowMan can help.",
    );
    expect(brief.projectSummary).toContain(
      "Primary quote concern: Unclear scope.",
    );
    expect(brief.recommendation).toContain("Make the scope explicit before signing.");
    expect(brief.nextActions[0]?.id).toBe("review_existing_quote");
  });

  it("returns useful fallbacks when optional answers are absent", () => {
    const brief = buildWmChatProjectBrief(createIntake());

    expect(brief.projectSummary).toEqual([
      "Starting point: Preparing to request a quote.",
      "Project trigger: Still being defined.",
    ]);
    expect(brief.recommendation).toContain(
      "Define the project in writing before comparing prices.",
    );
    expect(brief.estimateRequirements.length).toBeGreaterThan(0);
    expect(brief.contractorQuestions.length).toBeGreaterThan(0);
    expect(JSON.stringify(brief)).not.toContain("undefined");
  });

  it("deduplicates compiled requirements and questions", () => {
    const brief = buildWmChatProjectBrief(
      createIntake({
        answers: {
          need_reason: "need_problems",
          need_detail: "problems_drafts_leaks",
          priorities: ["priority_complete_scope", "priority_complete_scope"],
          trust_concern: "trust_vague_scope",
        },
      }),
    );

    expect(new Set(brief.estimateRequirements).size).toBe(
      brief.estimateRequirements.length,
    );
    expect(new Set(brief.contractorQuestions).size).toBe(
      brief.contractorQuestions.length,
    );
  });

  it("never consumes contact fields or free-form text", () => {
    const intake = createIntake({
      answers: {
        need_reason: "need_other",
        name: "Peter Private",
        first_name: "Peter Private",
        phone: "+15615550123",
        email: "private@example.com",
      },
      other_text: "My private street address is 123 Example Avenue.",
    });

    const brief = buildWmChatProjectBrief(intake);
    const serialized = JSON.stringify(brief);

    expect(serialized).not.toContain("Peter Private");
    expect(serialized).not.toContain("+15615550123");
    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("123 Example Avenue");
  });

  it("is deterministic and does not mutate its intake", () => {
    const intake = createIntake({
      answers: {
        need_reason: "need_planning",
        need_detail: "planning_price_baseline",
        priorities: ["priority_price_baseline"],
      },
    });
    const before = JSON.stringify(intake);

    expect(buildWmChatProjectBrief(intake)).toEqual(
      buildWmChatProjectBrief(intake),
    );
    expect(JSON.stringify(intake)).toBe(before);
  });
});
