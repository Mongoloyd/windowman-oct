/**
 * Strict server authority for the versioned /wmchat intake namespace.
 *
 * The frontend owns presentation and copy. This module independently owns the
 * wire allowlists, path grammar, and PII-free persistence projection.
 */

export const WMCHAT_SCHEMA_VERSION = "1" as const;
export const WMCHAT_INTAKE_VERSION = "wmchat_v1" as const;
export const WMCHAT_CONTINUATION = "sms_then_voice" as const;
export const WMCHAT_EMAIL_CONTINUATION = "email_only" as const;

export const WMCHAT_SERVER_NODE_IDS = [
  "entry",
  "need_reason",
  "need_detail_moved",
  "need_detail_problems",
  "need_detail_storm",
  "need_detail_remodel",
  "need_detail_comfort",
  "need_detail_planning",
  "need_detail_other",
  "need_other_text",
  "priorities",
  "stakes",
  "trust",
  "recap",
  "recap_edit_menu",
  "zip",
  "project_scope",
  "openings",
  "budget",
  "timing",
  "first_name",
  "phone",
  "have_concern",
  "have_detail_price",
  "have_detail_scope",
  "have_detail_product",
  "have_detail_compare",
  "have_detail_check",
  "have_detail_other",
  "have_other_text",
  "power_1",
  "power_2",
  "power_3",
  "power_4",
  "power_5",
  "power_route",
  "not_ready",
  "protection_kit_email",
  "demo_launch",
  "success",
] as const;

export const WMCHAT_SERVER_OPTION_IDS = [
  "entry_have_quote",
  "entry_need_quote",
  "entry_learn_powers",
  "need_moved",
  "need_problems",
  "need_storm",
  "need_remodel",
  "need_comfort",
  "need_planning",
  "need_other",
  "moved_inspection",
  "moved_age_damage",
  "moved_storm_insurance",
  "moved_comfort_noise",
  "moved_remodel",
  "moved_baseline",
  "problems_drafts_leaks",
  "problems_operation",
  "problems_fogging",
  "problems_damage",
  "problems_heat_noise",
  "problems_several",
  "storm_insurer_question",
  "storm_older_nonimpact",
  "storm_active_damage",
  "storm_preparation",
  "storm_impact_uncertain",
  "storm_not_sure",
  "remodel_whole_home",
  "remodel_room_addition",
  "remodel_larger_openings",
  "remodel_doors_too",
  "remodel_resale",
  "remodel_undecided",
  "comfort_hot_rooms",
  "comfort_energy_use",
  "comfort_outside_noise",
  "comfort_drafts",
  "comfort_glare_fading",
  "comfort_several",
  "planning_price_baseline",
  "planning_scope",
  "planning_financing",
  "planning_products",
  "planning_timing",
  "planning_where_start",
  "other_sales_conversation",
  "other_new_purchase",
  "other_property_issue",
  "other_family_project",
  "other_explain",
  "priority_price_baseline",
  "priority_correct_product",
  "priority_complete_scope",
  "priority_payment_clarity",
  "priority_low_pressure",
  "priority_followthrough",
  "priority_not_sure",
  "stakes_later_cost",
  "stakes_wrong_product",
  "stakes_storm_documents",
  "stakes_disruption",
  "stakes_comfort",
  "stakes_delay",
  "stakes_uncertainty",
  "trust_pressure",
  "trust_vague_scope",
  "trust_financing_first",
  "trust_missing_product",
  "trust_too_many_calls",
  "trust_followthrough",
  "trust_not_sure",
  "recap_confirm",
  "recap_edit",
  "recap_edit_reason",
  "recap_edit_detail",
  "recap_edit_priorities",
  "recap_edit_stakes",
  "recap_edit_trust",
  "scope_windows",
  "scope_doors",
  "scope_both",
  "scope_not_sure",
  "openings_1_5",
  "openings_6_10",
  "openings_11_20",
  "openings_20_plus",
  "openings_not_sure",
  "budget_baseline",
  "budget_financing",
  "budget_ready",
  "budget_researching",
  "budget_not_sure",
  "timing_urgent",
  "timing_1_3_months",
  "timing_3_6_months",
  "timing_no_deadline",
  "timing_not_sure",
  "have_price",
  "have_scope",
  "have_product_company",
  "have_compare",
  "have_check",
  "have_other",
  "have_upload_first",
  "price_total",
  "price_monthly",
  "price_fees",
  "price_cannot_tell",
  "scope_included",
  "scope_excluded",
  "scope_install_permits",
  "scope_warranty",
  "scope_all",
  "product_brand_model",
  "product_impact_noa",
  "product_warranty",
  "product_contractor",
  "product_verbal_claim",
  "compare_price",
  "compare_products",
  "compare_scope",
  "compare_financing",
  "compare_everything",
  "check_price",
  "check_missing",
  "check_product",
  "check_terms",
  "check_whole_quote",
  "have_other_salesperson",
  "have_other_missing",
  "have_other_fine_print",
  "have_other_pressure",
  "have_other_explain",
  "power_next_2",
  "power_next_3",
  "power_next_4",
  "power_next_5",
  "power_put_to_work",
  "power_not_ready",
  "power_route_have_quote",
  "power_route_need_quote",
  "not_ready_have_quote",
  "not_ready_need_quote",
  "not_ready_protection_kit",
  "not_ready_demo",
] as const;

export type WmChatServerNodeId = typeof WMCHAT_SERVER_NODE_IDS[number];
export type WmChatServerOptionId = typeof WMCHAT_SERVER_OPTION_IDS[number];
export type WmChatServerEntryIntent =
  | "have_quote"
  | "need_quote"
  | "learn_powers";

export interface ValidatedWmChatIntake {
  readonly schema_version: "1";
  readonly intake_version: "wmchat_v1";
  readonly entry_intent: WmChatServerEntryIntent;
  readonly answer_path: readonly string[];
  readonly answers: Readonly<Record<string, string | readonly string[]>>;
  readonly continuation: "sms_then_voice" | "email_only";
  readonly other_text?: string;
}

export type StoredWmChatIntake =
  & Omit<
    ValidatedWmChatIntake,
    "other_text"
  >
  & {
    readonly completed_at: string;
  };

export type WmChatValidationResult =
  | { readonly ok: true; readonly intake: ValidatedWmChatIntake }
  | { readonly ok: false; readonly code: string; readonly message: string };

export type StoredWmChatValidationResult =
  | { readonly ok: true; readonly intake: StoredWmChatIntake }
  | { readonly ok: false; readonly code: string; readonly message: string };

function storedFail(
  code: string,
  message: string,
): StoredWmChatValidationResult {
  return { ok: false, code, message };
}

const NODE_SET = new Set<string>(WMCHAT_SERVER_NODE_IDS);
const OPTION_SET = new Set<string>(WMCHAT_SERVER_OPTION_IDS);
const ENTRY_INTENTS = new Set<string>([
  "have_quote",
  "need_quote",
  "learn_powers",
]);
const ROOT_KEYS = new Set([
  "schema_version",
  "intake_version",
  "entry_intent",
  "answer_path",
  "answers",
  "continuation",
  "other_text",
]);
const STORED_ROOT_KEYS = new Set([
  "schema_version",
  "intake_version",
  "entry_intent",
  "answer_path",
  "answers",
  "continuation",
  "completed_at",
]);
const ANSWER_KEYS = new Set([
  "entry_intent",
  "need_reason",
  "need_detail",
  "priorities",
  "stakes",
  "trust_concern",
  "zip",
  "project_scope",
  "openings",
  "budget_posture",
  "timing",
  "have_concern",
  "have_detail",
  "powers",
  "power_route",
  "hesitation_action",
]);

const NODE_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  entry: ["entry_have_quote", "entry_need_quote", "entry_learn_powers"],
  need_reason: [
    "need_moved",
    "need_problems",
    "need_storm",
    "need_remodel",
    "need_comfort",
    "need_planning",
    "need_other",
  ],
  need_detail_moved: [
    "moved_inspection",
    "moved_age_damage",
    "moved_storm_insurance",
    "moved_comfort_noise",
    "moved_remodel",
    "moved_baseline",
  ],
  need_detail_problems: [
    "problems_drafts_leaks",
    "problems_operation",
    "problems_fogging",
    "problems_damage",
    "problems_heat_noise",
    "problems_several",
  ],
  need_detail_storm: [
    "storm_insurer_question",
    "storm_older_nonimpact",
    "storm_active_damage",
    "storm_preparation",
    "storm_impact_uncertain",
    "storm_not_sure",
  ],
  need_detail_remodel: [
    "remodel_whole_home",
    "remodel_room_addition",
    "remodel_larger_openings",
    "remodel_doors_too",
    "remodel_resale",
    "remodel_undecided",
  ],
  need_detail_comfort: [
    "comfort_hot_rooms",
    "comfort_energy_use",
    "comfort_outside_noise",
    "comfort_drafts",
    "comfort_glare_fading",
    "comfort_several",
  ],
  need_detail_planning: [
    "planning_price_baseline",
    "planning_scope",
    "planning_financing",
    "planning_products",
    "planning_timing",
    "planning_where_start",
  ],
  need_detail_other: [
    "other_sales_conversation",
    "other_new_purchase",
    "other_property_issue",
    "other_family_project",
    "other_explain",
  ],
  priorities: [
    "priority_price_baseline",
    "priority_correct_product",
    "priority_complete_scope",
    "priority_payment_clarity",
    "priority_low_pressure",
    "priority_followthrough",
    "priority_not_sure",
  ],
  stakes: [
    "stakes_later_cost",
    "stakes_wrong_product",
    "stakes_storm_documents",
    "stakes_disruption",
    "stakes_comfort",
    "stakes_delay",
    "stakes_uncertainty",
  ],
  trust: [
    "trust_pressure",
    "trust_vague_scope",
    "trust_financing_first",
    "trust_missing_product",
    "trust_too_many_calls",
    "trust_followthrough",
    "trust_not_sure",
  ],
  recap: ["recap_confirm"],
  project_scope: [
    "scope_windows",
    "scope_doors",
    "scope_both",
    "scope_not_sure",
  ],
  openings: [
    "openings_1_5",
    "openings_6_10",
    "openings_11_20",
    "openings_20_plus",
    "openings_not_sure",
  ],
  budget: [
    "budget_baseline",
    "budget_financing",
    "budget_ready",
    "budget_researching",
    "budget_not_sure",
  ],
  timing: [
    "timing_urgent",
    "timing_1_3_months",
    "timing_3_6_months",
    "timing_no_deadline",
    "timing_not_sure",
  ],
  have_concern: [
    "have_price",
    "have_scope",
    "have_product_company",
    "have_compare",
    "have_check",
    "have_other",
    "have_upload_first",
  ],
  have_detail_price: [
    "price_total",
    "price_monthly",
    "price_fees",
    "price_cannot_tell",
  ],
  have_detail_scope: [
    "scope_included",
    "scope_excluded",
    "scope_install_permits",
    "scope_warranty",
    "scope_all",
  ],
  have_detail_product: [
    "product_brand_model",
    "product_impact_noa",
    "product_warranty",
    "product_contractor",
    "product_verbal_claim",
  ],
  have_detail_compare: [
    "compare_price",
    "compare_products",
    "compare_scope",
    "compare_financing",
    "compare_everything",
  ],
  have_detail_check: [
    "check_price",
    "check_missing",
    "check_product",
    "check_terms",
    "check_whole_quote",
  ],
  have_detail_other: [
    "have_other_salesperson",
    "have_other_missing",
    "have_other_fine_print",
    "have_other_pressure",
    "have_other_explain",
  ],
  power_1: ["power_next_2"],
  power_2: ["power_next_3"],
  power_3: ["power_next_4"],
  power_4: ["power_next_5"],
  power_5: ["power_put_to_work", "power_not_ready"],
  power_route: ["power_route_have_quote", "power_route_need_quote"],
  not_ready: ["not_ready_protection_kit", "not_ready_demo"],
};

const ENTRY_OPTION_BY_INTENT: Readonly<
  Record<WmChatServerEntryIntent, string>
> = {
  have_quote: "entry_have_quote",
  need_quote: "entry_need_quote",
  learn_powers: "entry_learn_powers",
};

const DETAIL_NODE_BY_REASON: Readonly<Record<string, string>> = {
  need_moved: "need_detail_moved",
  need_problems: "need_detail_problems",
  need_storm: "need_detail_storm",
  need_remodel: "need_detail_remodel",
  need_comfort: "need_detail_comfort",
  need_planning: "need_detail_planning",
  need_other: "need_detail_other",
};

const HAVE_DETAIL_NODE: Readonly<Record<string, string>> = {
  have_price: "have_detail_price",
  have_scope: "have_detail_scope",
  have_product_company: "have_detail_product",
  have_compare: "have_detail_compare",
  have_check: "have_detail_check",
  have_other: "have_detail_other",
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function fail(code: string, message: string): WmChatValidationResult {
  return { ok: false, code, message };
}

function sameValue(
  actual: unknown,
  expected: string | readonly string[],
): boolean {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) &&
      actual.length === expected.length &&
      actual.every((value, index) => value === expected[index]);
  }
  return actual === expected;
}

function isShortNoQuotePath(
  answers: Record<string, string | readonly string[]>,
): boolean {
  const reason = answers.need_reason;
  const detail = answers.need_detail;
  const priorities = answers.priorities;
  const priorityValues = Array.isArray(priorities) ? priorities : [priorities];
  return (
    (reason === "need_planning" &&
      priorityValues.includes("priority_not_sure")) ||
    (typeof detail === "string" && detail.endsWith("not_sure"))
  );
}

function nextNode(
  nodeId: string,
  optionIds: readonly string[],
  answers: Record<string, string | readonly string[]>,
): string | null {
  const selected = optionIds[0];
  if (nodeId === "entry") {
    if (selected === "entry_have_quote") return "have_concern";
    if (selected === "entry_need_quote") return "need_reason";
    return "power_1";
  }
  if (nodeId === "need_reason") return DETAIL_NODE_BY_REASON[selected] ?? null;
  if (nodeId.startsWith("need_detail_")) return "priorities";
  if (nodeId === "priorities") {
    return isShortNoQuotePath(answers) ? "trust" : "stakes";
  }
  if (nodeId === "stakes") return "trust";
  if (nodeId === "trust") return "recap";
  if (nodeId === "recap") return "project_scope";
  if (nodeId === "project_scope") return "openings";
  if (nodeId === "openings") return "budget";
  if (nodeId === "budget") return "timing";
  if (nodeId === "timing") return null;
  if (nodeId === "have_concern") {
    if (selected === "have_upload_first") return null;
    return HAVE_DETAIL_NODE[selected] ?? null;
  }
  if (nodeId.startsWith("have_detail_")) return null;
  if (nodeId === "power_1") {
    return selected === "power_next_2" ? "power_2" : "power_route";
  }
  if (nodeId === "power_2") {
    return selected === "power_next_3" ? "power_3" : "power_route";
  }
  if (nodeId === "power_3") {
    return selected === "power_next_4" ? "power_4" : "power_route";
  }
  if (nodeId === "power_4") {
    return selected === "power_next_5" ? "power_5" : "power_route";
  }
  if (nodeId === "power_5") {
    return selected === "power_not_ready" ? "not_ready" : "power_route";
  }
  if (nodeId === "power_route") {
    return selected.endsWith("have_quote") ? "have_concern" : "need_reason";
  }
  if (nodeId === "not_ready") return null;
  return null;
}

function setDerivedAnswer(
  nodeId: string,
  optionIds: readonly string[],
  answers: Record<string, string | readonly string[]>,
): void {
  const selected = optionIds[0];
  if (nodeId === "entry") {
    answers.entry_intent = selected === "entry_have_quote"
      ? "have_quote"
      : selected === "entry_need_quote"
      ? "need_quote"
      : "learn_powers";
  } else if (nodeId === "need_reason") {
    answers.need_reason = selected;
  } else if (nodeId.startsWith("need_detail_")) {
    answers.need_detail = selected;
  } else if (nodeId === "priorities") {
    answers.priorities = optionIds.length === 1 ? selected : [...optionIds];
  } else if (nodeId === "stakes") {
    answers.stakes = selected;
  } else if (nodeId === "trust") {
    answers.trust_concern = selected;
  } else if (nodeId === "project_scope") {
    answers.project_scope = selected;
  } else if (nodeId === "openings") {
    answers.openings = selected;
  } else if (nodeId === "budget") {
    answers.budget_posture = selected;
  } else if (nodeId === "timing") {
    answers.timing = selected;
  } else if (nodeId === "have_concern") {
    answers.have_concern = selected;
  } else if (nodeId.startsWith("have_detail_")) {
    answers.have_detail = selected;
  } else if (nodeId.startsWith("power_")) {
    if (nodeId === "power_route") answers.power_route = selected;
    else answers.powers = selected;
  } else if (nodeId === "not_ready") {
    answers.hesitation_action = selected;
  }
}

const PROTECTION_KIT_PATH = [
  "entry:entry_learn_powers",
  "power_1:power_next_2",
  "power_2:power_next_3",
  "power_3:power_next_4",
  "power_4:power_next_5",
  "power_5:power_not_ready",
  "not_ready:not_ready_protection_kit",
] as const;

export function isProtectionKitWmChatIntake(
  intake: ValidatedWmChatIntake,
): boolean {
  return intake.continuation === WMCHAT_EMAIL_CONTINUATION &&
    intake.entry_intent === "learn_powers" &&
    intake.answer_path.length === PROTECTION_KIT_PATH.length &&
    intake.answer_path.every((item, index) =>
      item === PROTECTION_KIT_PATH[index]
    ) &&
    intake.answers.entry_intent === "learn_powers" &&
    intake.answers.powers === "power_not_ready" &&
    intake.answers.hesitation_action === "not_ready_protection_kit" &&
    intake.other_text === undefined;
}

function deriveAnswersFromPath(
  path: readonly string[],
):
  | { ok: true; answers: Record<string, string | readonly string[]> }
  | { ok: false; code: string; message: string } {
  const answers: Record<string, string | readonly string[]> = {};
  let expectedNode = "entry";

  for (let index = 0; index < path.length;) {
    const item = path[index];
    if (typeof item !== "string" || item.length === 0 || item.length > 120) {
      return {
        ok: false,
        code: "invalid_wmchat_path",
        message: "Invalid answer path entry.",
      };
    }
    const separator = item.indexOf(":");
    if (separator <= 0 || separator !== item.lastIndexOf(":")) {
      return {
        ok: false,
        code: "invalid_wmchat_path",
        message: "Invalid answer path entry.",
      };
    }
    const nodeId = item.slice(0, separator);
    const optionIds = [item.slice(separator + 1)];

    if (!NODE_SET.has(nodeId)) {
      return {
        ok: false,
        code: "unknown_wmchat_node",
        message: "Unknown WindowMan node.",
      };
    }
    if (!OPTION_SET.has(optionIds[0])) {
      return {
        ok: false,
        code: "unknown_wmchat_option",
        message: "Unknown WindowMan option.",
      };
    }
    if (nodeId !== expectedNode) {
      return {
        ok: false,
        code: "invalid_wmchat_path",
        message: "WindowMan answer path is out of order.",
      };
    }

    if (nodeId === "priorities") {
      while (index + optionIds.length < path.length && optionIds.length < 3) {
        const next = path[index + optionIds.length];
        if (typeof next !== "string" || !next.startsWith("priorities:")) break;
        optionIds.push(next.slice("priorities:".length));
      }
    }

    if (optionIds.length > 2 || new Set(optionIds).size !== optionIds.length) {
      return {
        ok: false,
        code: "invalid_wmchat_priorities",
        message: "Choose no more than two distinct priorities.",
      };
    }
    const available = NODE_OPTIONS[nodeId];
    if (
      !available || optionIds.some((optionId) => !available.includes(optionId))
    ) {
      return {
        ok: false,
        code: "invalid_wmchat_pair",
        message: "WindowMan node and option do not match.",
      };
    }
    if (nodeId !== "priorities" && optionIds.length !== 1) {
      return {
        ok: false,
        code: "invalid_wmchat_path",
        message: "Invalid WindowMan selection count.",
      };
    }

    setDerivedAnswer(nodeId, optionIds, answers);
    expectedNode = nextNode(nodeId, optionIds, answers) ?? "";
    index += optionIds.length;
  }

  if (expectedNode) {
    return {
      ok: false,
      code: "incomplete_wmchat_path",
      message: "WindowMan intake is incomplete.",
    };
  }
  return { ok: true, answers };
}

function looksLikeContact(value: string): boolean {
  if (/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i.test(value)) return true;
  return (value.match(/\d/g) ?? []).length >= 7;
}

export function validateWmChatIntake(raw: unknown): WmChatValidationResult {
  if (!isPlainObject(raw)) {
    return fail("invalid_wmchat_intake", "wmchat_intake must be an object.");
  }
  if (Object.keys(raw).some((key) => !ROOT_KEYS.has(key))) {
    return fail(
      "unknown_wmchat_field",
      "wmchat_intake contains an unknown field.",
    );
  }
  if (
    raw.schema_version !== WMCHAT_SCHEMA_VERSION ||
    raw.intake_version !== WMCHAT_INTAKE_VERSION ||
    (raw.continuation !== WMCHAT_CONTINUATION &&
      raw.continuation !== WMCHAT_EMAIL_CONTINUATION) ||
    typeof raw.entry_intent !== "string" ||
    !ENTRY_INTENTS.has(raw.entry_intent)
  ) {
    return fail(
      "invalid_wmchat_version",
      "Unsupported WindowMan intake contract.",
    );
  }
  if (
    !Array.isArray(raw.answer_path) || raw.answer_path.length === 0 ||
    raw.answer_path.length > 32
  ) {
    return fail(
      "invalid_wmchat_path",
      "WindowMan answer path is required and bounded.",
    );
  }
  if (
    !isPlainObject(raw.answers) ||
    Object.keys(raw.answers).length > ANSWER_KEYS.size
  ) {
    return fail("invalid_wmchat_answers", "WindowMan answers are invalid.");
  }
  if (Object.keys(raw.answers).some((key) => !ANSWER_KEYS.has(key))) {
    return fail(
      "unknown_wmchat_answer",
      "WindowMan answers contain an unknown field.",
    );
  }
  for (const [key, value] of Object.entries(raw.answers)) {
    if (typeof value === "string") {
      if (!value || value.length > 120) {
        return fail(
          "invalid_wmchat_answer",
          "WindowMan answer value is invalid.",
        );
      }
    } else if (Array.isArray(value)) {
      if (key === "priorities" && value.length > 2) {
        return fail(
          "invalid_wmchat_priorities",
          "Choose no more than two distinct priorities.",
        );
      }
      if (
        value.length === 0 ||
        value.length > 2 ||
        value.some((item) =>
          typeof item !== "string" || !item || item.length > 120
        )
      ) {
        return fail(
          "invalid_wmchat_answer",
          "WindowMan answer list is invalid.",
        );
      }
    } else {
      return fail(
        "invalid_wmchat_answer",
        "Nested WindowMan answer objects are forbidden.",
      );
    }
  }

  const pathResult = deriveAnswersFromPath(
    raw.answer_path as unknown[] as string[],
  );
  if (!pathResult.ok) return pathResult;
  const entryIntent = raw.entry_intent as WmChatServerEntryIntent;
  if (
    pathResult.answers.entry_intent !== entryIntent ||
    raw.answer_path[0] !== `entry:${ENTRY_OPTION_BY_INTENT[entryIntent]}`
  ) {
    return fail(
      "invalid_wmchat_entry",
      "WindowMan entry intent and path disagree.",
    );
  }

  const expectedAnswers = { ...pathResult.answers };
  const isNoQuoteCapture = "timing" in expectedAnswers;
  if (isNoQuoteCapture) {
    const zip = raw.answers.zip;
    if (typeof zip !== "string" || !/^\d{5}$/.test(zip)) {
      return fail(
        "invalid_wmchat_zip",
        "A five-digit ZIP is required for this path.",
      );
    }
    expectedAnswers.zip = zip;
  }

  const expectedKeys = Object.keys(expectedAnswers).sort();
  const actualKeys = Object.keys(raw.answers).sort();
  if (
    expectedKeys.length !== actualKeys.length ||
    expectedKeys.some((key, index) => key !== actualKeys[index])
  ) {
    return fail(
      "invalid_wmchat_answers",
      "WindowMan answers do not match the canonical path.",
    );
  }
  for (const [key, expected] of Object.entries(expectedAnswers)) {
    if (!sameValue(raw.answers[key], expected)) {
      return fail(
        "invalid_wmchat_answers",
        "WindowMan answers do not match the canonical path.",
      );
    }
  }

  const needsOther = expectedAnswers.need_detail === "other_explain" ||
    expectedAnswers.have_detail === "have_other_explain";
  let otherText: string | undefined;
  if (raw.other_text !== undefined) {
    if (
      typeof raw.other_text !== "string" ||
      !raw.other_text.trim() ||
      raw.other_text.length > 160 ||
      /[\r\n]/.test(raw.other_text) ||
      looksLikeContact(raw.other_text)
    ) {
      return fail(
        "invalid_wmchat_other",
        "WindowMan Other text must be one PII-free sentence of 160 characters or fewer.",
      );
    }
    otherText = raw.other_text.trim();
  }
  if (needsOther !== Boolean(otherText)) {
    return fail(
      "invalid_wmchat_other",
      "WindowMan Other text does not match the selected path.",
    );
  }

  const answers: Record<string, string | readonly string[]> = {};
  for (const [key, value] of Object.entries(raw.answers)) {
    answers[key] = Array.isArray(value)
      ? [...value] as string[]
      : value as string;
  }
  const continuation = raw.continuation as
    | typeof WMCHAT_CONTINUATION
    | typeof WMCHAT_EMAIL_CONTINUATION;
  const isProtectionKit = continuation === WMCHAT_EMAIL_CONTINUATION;
  if (
    isProtectionKit !==
      (answers.hesitation_action === "not_ready_protection_kit")
  ) {
    return fail(
      "invalid_wmchat_continuation",
      "WindowMan continuation does not match the selected path.",
    );
  }
  return {
    ok: true,
    intake: {
      schema_version: WMCHAT_SCHEMA_VERSION,
      intake_version: WMCHAT_INTAKE_VERSION,
      entry_intent: entryIntent,
      answer_path: [...raw.answer_path] as string[],
      answers,
      continuation,
      ...(otherText ? { other_text: otherText } : {}),
    },
  };
}

export function buildStoredWmChatIntake(
  intake: ValidatedWmChatIntake,
  completedAt: string,
): StoredWmChatIntake {
  // Arbitrary free text cannot be proven PII-free with pattern matching.
  // Validate it for flow integrity, but persist only structured selections.
  const { other_text: _otherText, ...structuredIntake } = intake;
  return { ...structuredIntake, completed_at: completedAt };
}

/**
 * Validate the exact server-persisted qualification namespace used by the
 * upload gate. Stored intake deliberately omits guided free text, so it cannot
 * be passed directly back through the browser wire validator on an Other path.
 * A fixed non-PII placeholder is used only to re-run the canonical path and
 * answer checks; it is never returned or persisted.
 */
export function validateStoredWmChatIntake(
  raw: unknown,
): StoredWmChatValidationResult {
  if (!isPlainObject(raw)) {
    return storedFail(
      "invalid_stored_wmchat_intake",
      "Stored WindowMan intake must be an object.",
    );
  }
  if (Object.keys(raw).some((key) => !STORED_ROOT_KEYS.has(key))) {
    return storedFail(
      "unknown_stored_wmchat_field",
      "Stored WindowMan intake contains an unknown field.",
    );
  }

  const completedAt = raw.completed_at;
  if (
    typeof completedAt !== "string" ||
    completedAt.length > 40 ||
    !Number.isFinite(Date.parse(completedAt)) ||
    new Date(completedAt).toISOString() !== completedAt
  ) {
    return storedFail(
      "invalid_wmchat_completion",
      "Stored WindowMan intake requires a server completion timestamp.",
    );
  }

  const candidate: Record<string, unknown> = { ...raw };
  delete candidate.completed_at;
  const storedAnswers = isPlainObject(candidate.answers)
    ? candidate.answers
    : null;
  if (
    storedAnswers?.need_detail === "other_explain" ||
    storedAnswers?.have_detail === "have_other_explain"
  ) {
    candidate.other_text = "Guided response omitted from stored intake.";
  }

  const validated = validateWmChatIntake(candidate);
  if (!validated.ok) return validated;

  return {
    ok: true,
    intake: buildStoredWmChatIntake(validated.intake, completedAt),
  };
}

export function asSafeWmChatJsonObject(
  value: unknown,
): Record<string, unknown> {
  return isPlainObject(value) ? { ...value } : {};
}

export function mergeWmChatQualificationNamespace(
  existing: unknown,
  intake: StoredWmChatIntake,
): Record<string, unknown> {
  return {
    ...asSafeWmChatJsonObject(existing),
    wmchat_v1: intake,
  };
}
