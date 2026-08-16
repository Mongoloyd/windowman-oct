import {
  assert,
  assertEquals,
  assertNotEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  WM_CHAT_NODE_IDS,
  WM_CHAT_OPTION_IDS,
} from "../../../src/pages/WmChat/wmChatTypes.ts";
import {
  buildStoredWmChatIntake,
  isProtectionKitWmChatIntake,
  mergeWmChatQualificationNamespace,
  validateStoredWmChatIntake,
  validateWmChatIntake,
  WMCHAT_SERVER_NODE_IDS,
  WMCHAT_SERVER_OPTION_IDS,
} from "./wmchatIntake.ts";

const validNeedQuote = () => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "need_quote",
  answer_path: [
    "entry:entry_need_quote",
    "need_reason:need_planning",
    "need_detail_planning:planning_price_baseline",
    "priorities:priority_price_baseline",
    "priorities:priority_low_pressure",
    "stakes:stakes_later_cost",
    "trust:trust_pressure",
    "recap:recap_confirm",
    "project_scope:scope_windows",
    "openings:openings_6_10",
    "budget:budget_baseline",
    "timing:timing_1_3_months",
  ],
  answers: {
    entry_intent: "need_quote",
    need_reason: "need_planning",
    need_detail: "planning_price_baseline",
    priorities: ["priority_price_baseline", "priority_low_pressure"],
    stakes: "stakes_later_cost",
    trust_concern: "trust_pressure",
    zip: "33301",
    project_scope: "scope_windows",
    openings: "openings_6_10",
    budget_posture: "budget_baseline",
    timing: "timing_1_3_months",
  },
  continuation: "sms_then_voice",
});

const validQuote = () => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "have_quote",
  answer_path: [
    "entry:entry_have_quote",
    "have_concern:have_price",
    "have_detail_price:price_total",
  ],
  answers: {
    entry_intent: "have_quote",
    have_concern: "have_price",
    have_detail: "price_total",
  },
  continuation: "sms_then_voice",
});

const validProtectionKit = () => ({
  schema_version: "1",
  intake_version: "wmchat_v1",
  entry_intent: "learn_powers",
  answer_path: [
    "entry:entry_learn_powers",
    "power_1:power_next_2",
    "power_2:power_next_3",
    "power_3:power_next_4",
    "power_4:power_next_5",
    "power_5:power_not_ready",
    "not_ready:not_ready_protection_kit",
  ],
  answers: {
    entry_intent: "learn_powers",
    powers: "power_not_ready",
    hesitation_action: "not_ready_protection_kit",
  },
  continuation: "email_only",
});

Deno.test("server stable ID registry stays in exact frontend lockstep", () => {
  assertEquals(WMCHAT_SERVER_NODE_IDS, WM_CHAT_NODE_IDS);
  assertEquals(WMCHAT_SERVER_OPTION_IDS, WM_CHAT_OPTION_IDS);
});

Deno.test("accepts a complete full-cadence no-quote intake", () => {
  const result = validateWmChatIntake(validNeedQuote());
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.intake.answers.zip, "33301");
    assertEquals(result.intake.answer_path.length, 12);
  }
});

Deno.test("accepts quote upload-first and Learn Powers canonical paths", () => {
  const uploadFirst = {
    ...validQuote(),
    answer_path: [
      "entry:entry_have_quote",
      "have_concern:have_upload_first",
    ],
    answers: {
      entry_intent: "have_quote",
      have_concern: "have_upload_first",
    },
  };
  assert(validateWmChatIntake(uploadFirst).ok);

  const powers = {
    schema_version: "1",
    intake_version: "wmchat_v1",
    entry_intent: "learn_powers",
    answer_path: [
      "entry:entry_learn_powers",
      "power_1:power_next_2",
      "power_2:power_next_3",
      "power_3:power_next_4",
      "power_4:power_next_5",
      "power_5:power_put_to_work",
      "power_route:power_route_have_quote",
      "have_concern:have_upload_first",
    ],
    answers: {
      entry_intent: "learn_powers",
      powers: "power_put_to_work",
      power_route: "power_route_have_quote",
      have_concern: "have_upload_first",
    },
    continuation: "sms_then_voice",
  };
  assert(validateWmChatIntake(powers).ok);
});

Deno.test("accepts only the exact email-only Protection Kit terminal path", () => {
  const result = validateWmChatIntake(validProtectionKit());
  assert(result.ok);
  if (result.ok) assert(isProtectionKitWmChatIntake(result.intake));

  const wrongContinuation = {
    ...validProtectionKit(),
    continuation: "sms_then_voice",
  };
  const rejectedContinuation = validateWmChatIntake(wrongContinuation);
  assert(!rejectedContinuation.ok);
  if (!rejectedContinuation.ok) {
    assertEquals(
      rejectedContinuation.code,
      "invalid_wmchat_continuation",
    );
  }

  const demo = {
    ...validProtectionKit(),
    answer_path: [
      ...validProtectionKit().answer_path.slice(0, -1),
      "not_ready:not_ready_demo",
    ],
    answers: {
      ...validProtectionKit().answers,
      hesitation_action: "not_ready_demo",
    },
    continuation: "sms_then_voice",
  };
  const demoResult = validateWmChatIntake(demo);
  assert(demoResult.ok);
  if (demoResult.ok) assert(!isProtectionKitWmChatIntake(demoResult.intake));
});

Deno.test("accepts the adaptive short path only when stakes are omitted", () => {
  const intake = validNeedQuote();
  intake.answer_path = intake.answer_path.filter((entry) =>
    entry !== "priorities:priority_price_baseline" &&
    entry !== "priorities:priority_low_pressure" &&
    entry !== "stakes:stakes_later_cost"
  );
  intake.answer_path.splice(3, 0, "priorities:priority_not_sure");
  (intake.answers as Record<string, unknown>).priorities = "priority_not_sure";
  delete (intake.answers as Record<string, unknown>).stakes;
  assert(validateWmChatIntake(intake).ok);

  (intake.answers as Record<string, unknown>).stakes = "stakes_later_cost";
  const rejected = validateWmChatIntake(intake);
  assert(!rejected.ok);
  if (!rejected.ok) assertEquals(rejected.code, "invalid_wmchat_answers");
});

Deno.test("rejects unknown node, unknown option, and invalid node-option pairing", () => {
  const unknownNode = validQuote();
  unknownNode.answer_path[1] = "made_up:have_price";
  const nodeResult = validateWmChatIntake(unknownNode);
  assert(!nodeResult.ok);
  if (!nodeResult.ok) assertEquals(nodeResult.code, "unknown_wmchat_node");

  const unknownOption = validQuote();
  unknownOption.answer_path[1] = "have_concern:made_up";
  const optionResult = validateWmChatIntake(unknownOption);
  assert(!optionResult.ok);
  if (!optionResult.ok) {
    assertEquals(optionResult.code, "unknown_wmchat_option");
  }

  const badPair = validQuote();
  badPair.answer_path[1] = "have_concern:price_total";
  const pairResult = validateWmChatIntake(badPair);
  assert(!pairResult.ok);
  if (!pairResult.ok) assertEquals(pairResult.code, "invalid_wmchat_pair");
});

Deno.test("rejects entry mismatch, out-of-order path, and incomplete path", () => {
  const wrongEntry = validQuote();
  wrongEntry.entry_intent = "need_quote";
  (wrongEntry.answers as Record<string, unknown>).entry_intent = "need_quote";
  const entryResult = validateWmChatIntake(wrongEntry);
  assert(!entryResult.ok);
  if (!entryResult.ok) assertEquals(entryResult.code, "invalid_wmchat_entry");

  const outOfOrder = validQuote();
  outOfOrder.answer_path[1] = "have_detail_price:price_total";
  const orderResult = validateWmChatIntake(outOfOrder);
  assert(!orderResult.ok);
  if (!orderResult.ok) assertEquals(orderResult.code, "invalid_wmchat_path");

  const incomplete = validQuote();
  incomplete.answer_path = ["entry:entry_have_quote"];
  const incompleteResult = validateWmChatIntake(incomplete);
  assert(!incompleteResult.ok);
  if (!incompleteResult.ok) {
    assertEquals(incompleteResult.code, "incomplete_wmchat_path");
  }
});

Deno.test("rejects more than two priorities", () => {
  const intake = validNeedQuote();
  intake.answer_path.splice(5, 0, "priorities:priority_complete_scope");
  (intake.answers.priorities as string[]).push("priority_complete_scope");
  const result = validateWmChatIntake(intake);
  assert(!result.ok);
  if (!result.ok) assertEquals(result.code, "invalid_wmchat_priorities");
});

Deno.test("guided Other is one line, bounded, required, and email/phone-free", () => {
  const base = validNeedQuote();
  base.answer_path[1] = "need_reason:need_other";
  base.answer_path[2] = "need_detail_other:other_explain";
  base.answers.need_reason = "need_other";
  base.answers.need_detail = "other_explain";
  const withOther = {
    ...base,
    other_text: "A salesperson raised a scope concern.",
  };
  assert(validateWmChatIntake(withOther).ok);

  for (
    const other_text of [
      "x".repeat(161),
      "first\nsecond",
      "Email me at maria@example.com",
      "Call 561-555-0123",
    ]
  ) {
    const result = validateWmChatIntake({ ...base, other_text });
    assert(!result.ok, other_text);
    if (!result.ok) assertEquals(result.code, "invalid_wmchat_other");
  }
  assert(!validateWmChatIntake(base).ok);
  assert(
    !validateWmChatIntake({ ...validQuote(), other_text: "Not selected" }).ok,
  );
});

Deno.test("rejects transcript, contact keys, arbitrary answers, and nested values", () => {
  for (
    const mutation of [
      { transcript: [] },
      { name: "Maria" },
      { first_name: "Maria" },
      { email: "maria@example.com" },
      { mobile: "+15615550123" },
      { consent: { granted: true } },
      { lead_id: "99999999-8888-4777-8666-555555555555" },
      { session_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" },
      { submission_id: "11111111-2222-4333-8444-555555555555" },
      { attribution: { utm_source: "meta" } },
    ]
  ) {
    const result = validateWmChatIntake({ ...validQuote(), ...mutation });
    assert(!result.ok);
    if (!result.ok) assertEquals(result.code, "unknown_wmchat_field");
  }

  const contactAnswer = validQuote();
  (contactAnswer.answers as Record<string, unknown>).phone = "+15615550123";
  const contactResult = validateWmChatIntake(contactAnswer);
  assert(!contactResult.ok);
  if (!contactResult.ok) {
    assertEquals(contactResult.code, "unknown_wmchat_answer");
  }

  const nested = validQuote();
  nested.answers.have_detail = { value: "price_total" } as unknown as string;
  const nestedResult = validateWmChatIntake(nested);
  assert(!nestedResult.ok);
  if (!nestedResult.ok) {
    assertEquals(nestedResult.code, "invalid_wmchat_answer");
  }
});

Deno.test("stored namespace adds a server timestamp and preserves sibling namespaces", () => {
  const validated = validateWmChatIntake(validQuote());
  assert(validated.ok);
  if (!validated.ok) return;
  const completedAt = "2026-08-15T12:00:00.000Z";
  const stored = buildStoredWmChatIntake(validated.intake, completedAt);
  assertEquals(stored.completed_at, completedAt);
  const merged = mergeWmChatQualificationNamespace(
    { nq4: { source: "existing" }, top_level: "keep" },
    stored,
  );
  assertEquals(merged.nq4, { source: "existing" });
  assertEquals(merged.top_level, "keep");
  assertEquals(merged.wmchat_v1, stored);
  assertNotEquals(merged.wmchat_v1, merged.nq4);
});

Deno.test("raw guided Other text is never copied into the stored namespace", () => {
  const intake = validNeedQuote();
  intake.answer_path[1] = "need_reason:need_other";
  intake.answer_path[2] = "need_detail_other:other_explain";
  intake.answers.need_reason = "need_other";
  intake.answers.need_detail = "other_explain";
  const rawOther = "My name is Maria and I live at 123 Palm Avenue.";
  const validated = validateWmChatIntake({ ...intake, other_text: rawOther });
  assert(validated.ok);
  if (!validated.ok) return;
  assertEquals(validated.intake.other_text, rawOther);

  const stored = buildStoredWmChatIntake(
    validated.intake,
    "2026-08-15T12:00:00.000Z",
  );
  assertEquals("other_text" in stored, false);
  assertEquals(JSON.stringify(stored).includes("Maria"), false);
  assertEquals(JSON.stringify(stored).includes("Palm Avenue"), false);
  const merged = mergeWmChatQualificationNamespace({}, stored);
  assertEquals(JSON.stringify(merged).includes(rawOther), false);
});

Deno.test("stored validator accepts canonical structured intake and guided-Other omission", () => {
  const quote = validateWmChatIntake(validQuote());
  assert(quote.ok);
  if (!quote.ok) return;
  const storedQuote = buildStoredWmChatIntake(
    quote.intake,
    "2026-08-15T12:00:00.000Z",
  );
  assert(validateStoredWmChatIntake(storedQuote).ok);

  const intake = validNeedQuote();
  intake.answer_path[1] = "need_reason:need_other";
  intake.answer_path[2] = "need_detail_other:other_explain";
  intake.answers.need_reason = "need_other";
  intake.answers.need_detail = "other_explain";
  const guidedOther = validateWmChatIntake({
    ...intake,
    other_text: "A project detail is hard to categorize.",
  });
  assert(guidedOther.ok);
  if (!guidedOther.ok) return;
  const storedOther = buildStoredWmChatIntake(
    guidedOther.intake,
    "2026-08-15T12:00:00.000Z",
  );
  assertEquals("other_text" in storedOther, false);
  assert(validateStoredWmChatIntake(storedOther).ok);
});

Deno.test("stored validator rejects missing, malformed, client-authored, or expanded completion data", () => {
  const validated = validateWmChatIntake(validQuote());
  assert(validated.ok);
  if (!validated.ok) return;
  const stored = buildStoredWmChatIntake(
    validated.intake,
    "2026-08-15T12:00:00.000Z",
  );

  for (
    const mutation of [
      { ...stored, completed_at: undefined },
      { ...stored, completed_at: "2026-08-15" },
      { ...stored, completed_at: "not-a-date" },
      { ...stored, completed_at: "2026-08-15T12:00:00Z" },
      { ...stored, other_text: "must never be stored" },
      { ...stored, transcript: [] },
      { ...stored, phone: "+15615550123" },
    ]
  ) {
    const result = validateStoredWmChatIntake(mutation);
    assert(!result.ok, JSON.stringify(mutation));
  }
});

Deno.test("stored validator rechecks exact versions, IDs, pairings, path, and answers", () => {
  const validated = validateWmChatIntake(validQuote());
  assert(validated.ok);
  if (!validated.ok) return;
  const stored = buildStoredWmChatIntake(
    validated.intake,
    "2026-08-15T12:00:00.000Z",
  );

  const mutations = [
    { ...stored, schema_version: "2" },
    { ...stored, intake_version: "wmchat_v2" },
    {
      ...stored,
      answer_path: ["entry:entry_have_quote", "unknown:have_price"],
    },
    {
      ...stored,
      answer_path: ["entry:entry_have_quote", "have_concern:unknown"],
    },
    {
      ...stored,
      answer_path: ["entry:entry_have_quote", "have_concern:price_total"],
    },
    { ...stored, answers: { ...stored.answers, have_detail: "price_fees" } },
  ];
  for (const mutation of mutations) {
    assert(!validateStoredWmChatIntake(mutation).ok, JSON.stringify(mutation));
  }
});

Deno.test("malformed existing qualification JSON safely becomes a namespace object", () => {
  const validated = validateWmChatIntake(validQuote());
  assert(validated.ok);
  if (!validated.ok) return;
  const stored = buildStoredWmChatIntake(
    validated.intake,
    "2026-08-15T12:00:00.000Z",
  );
  assertEquals(mergeWmChatQualificationNamespace([], stored), {
    wmchat_v1: stored,
  });
});
