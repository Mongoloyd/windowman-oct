import type {
  WmChatNodeId,
  WmChatOption,
  WmChatOptionId,
  WmChatResolvedNode,
  WmChatState,
} from "./wmChatTypes";

const option = (
  id: WmChatOptionId,
  label: string,
  extras: Pick<WmChatOption, "hint" | "tone"> = {},
): WmChatOption => ({ id, label, ...extras });

const ENTRY_OPTIONS = [
  option("entry_have_quote", "Check my existing quote"),
  option("entry_need_quote", "Help me get a fair quote", { tone: "primary" }),
  option("entry_learn_powers", "Show me how it works"),
] as const;

const NEED_REASON_OPTIONS = [
  option("need_moved", "I moved or bought the home"),
  option("need_problems", "They’re old, damaged, or giving me problems"),
  option("need_storm", "Storm or insurance concerns"),
  option("need_remodel", "I’m remodeling or changing the look"),
  option("need_comfort", "Comfort, outside noise, or energy use"),
  option("need_planning", "I’m planning, budgeting, or researching"),
  option("need_other", "Something else"),
] as const;

const MOVED_OPTIONS = [
  option("moved_inspection", "Something came up in the inspection"),
  option("moved_age_damage", "They look old or damaged"),
  option("moved_storm_insurance", "Storm or insurance questions"),
  option("moved_comfort_noise", "Heat, drafts, or outside noise"),
  option("moved_remodel", "I’m updating the home"),
  option("moved_baseline", "I just need a real baseline"),
] as const;

const PROBLEM_OPTIONS = [
  option("problems_drafts_leaks", "Drafts or water leaks"),
  option("problems_operation", "Hard to open, close, or lock"),
  option("problems_fogging", "Fogging between the panes"),
  option("problems_damage", "Cracks, rot, or visible damage"),
  option("problems_heat_noise", "Too much heat or outside noise"),
  option("problems_several", "Several of those"),
] as const;

const STORM_OPTIONS = [
  option("storm_insurer_question", "My insurer raised a question"),
  option("storm_older_nonimpact", "I may have older or non-impact products"),
  option("storm_active_damage", "There’s active damage or a leak"),
  option("storm_preparation", "I’m preparing before storm season"),
  option("storm_impact_uncertain", "I’m not sure what counts as impact-rated"),
  option("storm_not_sure", "I’m not sure yet"),
] as const;

const REMODEL_OPTIONS = [
  option("remodel_whole_home", "Change the whole-home look"),
  option("remodel_room_addition", "One room or an addition"),
  option("remodel_larger_openings", "Create larger openings"),
  option("remodel_doors_too", "Include exterior doors too"),
  option("remodel_resale", "Prepare the home for resale"),
  option("remodel_undecided", "I’m still deciding"),
] as const;

const COMFORT_OPTIONS = [
  option("comfort_hot_rooms", "Rooms get too hot"),
  option("comfort_energy_use", "Energy use feels too high"),
  option("comfort_outside_noise", "Too much outside noise"),
  option("comfort_drafts", "Drafts or uneven comfort"),
  option("comfort_glare_fading", "Glare or fading inside"),
  option("comfort_several", "Several of those"),
] as const;

const PLANNING_OPTIONS = [
  option("planning_price_baseline", "A realistic price baseline"),
  option("planning_scope", "How large the project may be"),
  option("planning_financing", "Whether financing matters"),
  option("planning_products", "Which products make sense"),
  option("planning_timing", "When I should start"),
  option("planning_where_start", "Honestly, where to begin"),
] as const;

const NEED_OTHER_OPTIONS = [
  option("other_sales_conversation", "A contractor or salesperson brought it up"),
  option("other_new_purchase", "I’m considering a home purchase"),
  option("other_property_issue", "There’s another property problem"),
  option("other_family_project", "I’m helping with someone else’s project"),
  option("other_explain", "None of these — I’ll explain"),
] as const;

const PRIORITY_OPTIONS = [
  option("priority_price_baseline", "A clear price baseline"),
  option("priority_correct_product", "The right product and ratings"),
  option("priority_complete_scope", "Knowing the full scope"),
  option("priority_payment_clarity", "Clear payment and financing"),
  option("priority_low_pressure", "A low-pressure process"),
  option("priority_followthrough", "Reliable follow-through"),
  option("priority_not_sure", "I’m not sure yet"),
] as const;

const STAKES_OPTIONS = [
  option("stakes_later_cost", "Unexpected cost later"),
  option("stakes_wrong_product", "Ending up with the wrong product"),
  option("stakes_storm_documents", "Missing storm or product documentation"),
  option("stakes_disruption", "A messy or disruptive installation"),
  option("stakes_comfort", "The original comfort problem staying unsolved"),
  option("stakes_delay", "The project dragging out"),
  option("stakes_uncertainty", "I’m still figuring that out"),
] as const;

const TRUST_OPTIONS = [
  option("trust_pressure", "Pressure to sign quickly"),
  option("trust_vague_scope", "A vague or incomplete scope"),
  option("trust_financing_first", "A conversation that starts with payment only"),
  option("trust_missing_product", "No exact product details in writing"),
  option("trust_too_many_calls", "My number getting sent everywhere"),
  option("trust_followthrough", "Promises that disappear after the sale"),
  option("trust_not_sure", "I’m not sure yet"),
] as const;

const RECAP_OPTIONS = [
  option("recap_confirm", "That’s right", { tone: "primary" }),
  option("recap_edit", "Change something", { tone: "quiet" }),
] as const;

const RECAP_EDIT_OPTIONS = [
  option("recap_edit_reason", "What brought me here"),
  option("recap_edit_detail", "The specific situation"),
  option("recap_edit_priorities", "What matters most"),
  option("recap_edit_stakes", "What I want to avoid"),
  option("recap_edit_trust", "My trust concern"),
] as const;

const PROJECT_SCOPE_OPTIONS = [
  option("scope_windows", "Windows"),
  option("scope_doors", "Exterior doors"),
  option("scope_both", "Both"),
  option("scope_not_sure", "Not sure"),
] as const;

const OPENINGS_OPTIONS = [
  option("openings_1_5", "1–5"),
  option("openings_6_10", "6–10"),
  option("openings_11_20", "11–20"),
  option("openings_20_plus", "20+"),
  option("openings_not_sure", "Not sure"),
] as const;

const BUDGET_OPTIONS = [
  option("budget_baseline", "I’m setting a baseline"),
  option("budget_financing", "Financing matters"),
  option("budget_ready", "I’m ready if the plan makes sense"),
  option("budget_researching", "I’m just researching"),
  option("budget_not_sure", "Not sure"),
] as const;

const TIMING_OPTIONS = [
  option("timing_urgent", "Urgent or within 30 days"),
  option("timing_1_3_months", "1–3 months"),
  option("timing_3_6_months", "3–6 months"),
  option("timing_no_deadline", "No deadline"),
  option("timing_not_sure", "Not sure"),
] as const;

const HAVE_CONCERN_OPTIONS = [
  option("have_price", "The price"),
  option("have_scope", "The scope is unclear"),
  option("have_product_company", "The product or company"),
  option("have_compare", "I’m comparing quotes"),
  option("have_check", "I just want it checked"),
  option("have_other", "Something else"),
  option("have_upload_first", "Upload first", { tone: "quiet" }),
] as const;

const HAVE_PRICE_OPTIONS = [
  option("price_total", "The total feels high"),
  option("price_monthly", "The monthly payment"),
  option("price_fees", "Fees or add-ons"),
  option("price_cannot_tell", "I can’t tell"),
] as const;

const HAVE_SCOPE_OPTIONS = [
  option("scope_included", "What’s included"),
  option("scope_excluded", "What’s excluded"),
  option("scope_install_permits", "Installation or permits"),
  option("scope_warranty", "Warranty"),
  option("scope_all", "Honestly, all of it"),
] as const;

const HAVE_PRODUCT_OPTIONS = [
  option("product_brand_model", "Brand or model"),
  option("product_impact_noa", "Required product approvals or ratings"),
  option("product_warranty", "Warranty"),
  option("product_contractor", "The contractor"),
  option("product_verbal_claim", "Something they told me"),
] as const;

const HAVE_COMPARE_OPTIONS = [
  option("compare_price", "Total price"),
  option("compare_products", "Products"),
  option("compare_scope", "Scope"),
  option("compare_financing", "Financing"),
  option("compare_everything", "Everything"),
] as const;

const HAVE_CHECK_OPTIONS = [
  option("check_price", "Price"),
  option("check_missing", "Missing details"),
  option("check_product", "Product"),
  option("check_terms", "Terms and warranty"),
  option("check_whole_quote", "The whole quote"),
] as const;

const HAVE_OTHER_OPTIONS = [
  option("have_other_salesperson", "Something the salesperson said"),
  option("have_other_missing", "Something seems missing"),
  option("have_other_fine_print", "Fine print or payment"),
  option("have_other_pressure", "Pressure to sign"),
  option("have_other_explain", "I’d rather explain it"),
] as const;

const ALL_OPTION_GROUPS: readonly (readonly WmChatOption[])[] = [
  ENTRY_OPTIONS,
  NEED_REASON_OPTIONS,
  MOVED_OPTIONS,
  PROBLEM_OPTIONS,
  STORM_OPTIONS,
  REMODEL_OPTIONS,
  COMFORT_OPTIONS,
  PLANNING_OPTIONS,
  NEED_OTHER_OPTIONS,
  PRIORITY_OPTIONS,
  STAKES_OPTIONS,
  TRUST_OPTIONS,
  RECAP_OPTIONS,
  RECAP_EDIT_OPTIONS,
  PROJECT_SCOPE_OPTIONS,
  OPENINGS_OPTIONS,
  BUDGET_OPTIONS,
  TIMING_OPTIONS,
  HAVE_CONCERN_OPTIONS,
  HAVE_PRICE_OPTIONS,
  HAVE_SCOPE_OPTIONS,
  HAVE_PRODUCT_OPTIONS,
  HAVE_COMPARE_OPTIONS,
  HAVE_CHECK_OPTIONS,
  HAVE_OTHER_OPTIONS,
];

const POWER_OPTIONS: Record<"power_1" | "power_2" | "power_3" | "power_4" | "power_5", readonly WmChatOption[]> = {
  power_1: [
    option("power_next_2", "Show me what quotes leave out", { tone: "primary" }),
  ],
  power_2: [
    option("power_next_3", "Show me how real comparisons work", { tone: "primary" }),
  ],
  power_3: [
    option("power_next_4", "Show me how my contact stays private", { tone: "primary" }),
  ],
  power_4: [
    option("power_next_5", "Show me how you track follow-through", { tone: "primary" }),
  ],
  power_5: [
    option("power_put_to_work", "Put WindowMan to work", { tone: "primary" }),
    option("power_not_ready", "Not ready yet", { tone: "quiet" }),
  ],
};

const POWER_ROUTE_OPTIONS = [
  option("power_route_have_quote", "Yes — I have one"),
  option("power_route_need_quote", "Not yet — I need one", { tone: "primary" }),
] as const;

const NOT_READY_OPTIONS = [
  option("not_ready_demo", "Run the Instant Demo", { tone: "primary" }),
  option("not_ready_protection_kit", "Email me what to watch for", {
    tone: "quiet",
  }),
] as const;

const POWER_COPY = {
  power_1: {
    title: "I build your Number to Beat.",
    body: "Price alone is easy to game. I keep it tied to scope, fees, and warranty, so the next quote has to improve the whole deal—not just the headline. A comparison target, not a savings guarantee.",
  },
  power_2: {
    title: "I read the parts people skip.",
    body: "Product details, installation scope, fees, warranty, and contract language—I flag what’s missing or unclear, then give you the questions worth asking before you sign. Clear questions, not contractor accusations or legal advice.",
  },
  power_3: {
    title: "I compare real outcomes—not internet guesses.",
    body: "When enough verified completed-project data exists for a truly similar job, I show where your quote sits. If the sample is thin, I say so. Pretend certainty isn’t one of my powers.",
  },
  power_4: {
    title: "I make the project compete—not your phone number.",
    body: "Your contact details aren’t blasted to a crowd. Any contractor introduction is a separate step you choose, and contractors still inspect the property and set final pricing.",
  },
  power_5: {
    title: "I keep receipts on follow-through.",
    body: "When WindowMan makes an introduction, I track the handoff and verified outcome. Follow-through matters more than the loudest pitch. Trust is earned project by project.",
  },
} as const;

const answerIds = (state: WmChatState, key: string): readonly string[] => {
  const value = state.answers[key];
  if (Array.isArray(value)) return value;
  return typeof value === "string" && value ? [value] : [];
};

export function getWmChatOption(id: WmChatOptionId): WmChatOption | undefined {
  for (const group of [...ALL_OPTION_GROUPS, ...Object.values(POWER_OPTIONS), POWER_ROUTE_OPTIONS, NOT_READY_OPTIONS]) {
    const found = group.find((candidate) => candidate.id === id);
    if (found) return found;
  }
  return undefined;
}

export function getWmChatOptionLabel(id: string): string {
  return getWmChatOption(id as WmChatOptionId)?.label ?? id;
}

function familyAcknowledgement(state: WmChatState): string {
  const reason = answerIds(state, "need_reason")[0];
  const acknowledgements: Record<string, string> = {
    need_moved:
      "That makes sense. A new home gives you plenty to sort out; I’ll help establish a clean baseline before anyone asks you to rush.",
    need_problems:
      "That tells me this isn’t only cosmetic. I’ll keep the problem, the proposed fix, and anything the quote leaves vague tied together.",
    need_storm:
      "Good reason to slow down and document it. I’ll keep written product ratings and scope separate from assumptions—without making insurance promises.",
    need_remodel:
      "Then the details need to match the design goal. I’ll keep product, dimensions, finish, and installation scope from blurring together.",
    need_comfort:
      "Comfort problems can have more than one cause. I’ll make sure a future quote says what it is intended to solve instead of just swapping units.",
    need_planning:
      "Starting with a baseline is smart. I’ll help you understand the scope and questions before the sales pressure begins.",
    need_other:
      "Got it. I’ll keep your actual reason at the center instead of forcing the project into a generic category.",
  };
  return acknowledgements[reason] ?? "Got it. I’m keeping that at the center of the project.";
}

function recapText(state: WmChatState): string {
  const reason = answerIds(state, "need_reason")[0];
  const detail = answerIds(state, "need_detail")[0];
  const priorities = answerIds(state, "priorities").map(getWmChatOptionLabel);
  const stakes = answerIds(state, "stakes")[0];
  const trust = answerIds(state, "trust_concern")[0];

  const reasonText = reason ? getWmChatOptionLabel(reason).toLowerCase() : "you’re planning a project";
  const detailText = detail ? ` The specific trigger is ${getWmChatOptionLabel(detail).toLowerCase()}.` : "";
  const priorityText = priorities.length
    ? priorities.join(" and ").toLowerCase()
    : "getting the next step clear";
  const stakesText = stakes
    ? ` The practical outcome you most want to avoid is ${getWmChatOptionLabel(stakes).toLowerCase()}.`
    : "";
  const trustText = trust ? getWmChatOptionLabel(trust).toLowerCase() : "a confusing process";

  return `Let me make sure I have this right: ${reasonText}.${detailText} You care most about ${priorityText}.${stakesText} Your biggest concern with the process is ${trustText}. Did I get that right?`;
}

function detailOptions(nodeId: WmChatNodeId): readonly WmChatOption[] {
  const groups: Partial<Record<WmChatNodeId, readonly WmChatOption[]>> = {
    need_detail_moved: MOVED_OPTIONS,
    need_detail_problems: PROBLEM_OPTIONS,
    need_detail_storm: STORM_OPTIONS,
    need_detail_remodel: REMODEL_OPTIONS,
    need_detail_comfort: COMFORT_OPTIONS,
    need_detail_planning: PLANNING_OPTIONS,
    need_detail_other: NEED_OTHER_OPTIONS,
    have_detail_price: HAVE_PRICE_OPTIONS,
    have_detail_scope: HAVE_SCOPE_OPTIONS,
    have_detail_product: HAVE_PRODUCT_OPTIONS,
    have_detail_compare: HAVE_COMPARE_OPTIONS,
    have_detail_check: HAVE_CHECK_OPTIONS,
    have_detail_other: HAVE_OTHER_OPTIONS,
  };
  return groups[nodeId] ?? [];
}

export function resolveWmChatNode(state: WmChatState): WmChatResolvedNode {
  switch (state.currentNodeId) {
    case "entry":
      return {
        id: "entry",
        kind: "single",
        prompt: "What can I help you with?",
        options: ENTRY_OPTIONS,
      };
    case "need_reason":
      return {
        id: "need_reason",
        kind: "single",
        prompt:
          "Good call. What’s got you looking into windows or doors right now? That helps me be useful instead of generic.",
        options: NEED_REASON_OPTIONS,
      };
    case "need_detail_moved":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Congrats on the place. A clean baseline is especially useful when everything about the home is still new to you. What put the windows on your list?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_problems":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "That’s worth defining before anyone recommends a product. What are the windows actually doing?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_storm":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Understood. I’ll focus on what a future quote documents, not assumptions. What started the concern?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_remodel":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Then the quote eventually needs to serve the design—not steer it. What are you trying to change?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_comfort":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Good—let’s name the actual problem before anyone sells you the fix. What’s most noticeable?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_planning":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "That’s the best time to get clear—before a price or payment starts driving the conversation. What do you want to learn first?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_detail_other":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt: "No problem. Which of these comes closest?",
        options: detailOptions(state.currentNodeId),
      };
    case "need_other_text":
      return {
        id: "need_other_text",
        kind: "other",
        prompt: "Tell me in one short sentence. I’ll keep it at the front of the conversation.",
        inputLabel: "What brought you here?",
        inputPlaceholder: "One sentence is enough",
      };
    case "priorities":
      return {
        id: "priorities",
        kind: "multi",
        prompt: `${familyAcknowledgement(state)}\n\nWhat matters most to you? Choose up to two.`,
        supporting: "Two is the maximum so I know what should win if trade-offs appear.",
        options: PRIORITY_OPTIONS,
        selectionLimit: 2,
      };
    case "stakes":
      return {
        id: "stakes",
        kind: "single",
        prompt:
          "That gives me the target. If the project goes sideways, what would bother you most?",
        options: STAKES_OPTIONS,
      };
    case "trust":
      return {
        id: "trust",
        kind: "single",
        prompt:
          "Fair. Last thing before I map the practical details: what would make you most cautious about the process?",
        options: TRUST_OPTIONS,
      };
    case "recap":
      return {
        id: "recap",
        kind: "recap",
        prompt: recapText(state),
        options: RECAP_OPTIONS,
      };
    case "recap_edit_menu": {
      const available = new Set<string>();
      if (answerIds(state, "need_reason").length) available.add("recap_edit_reason");
      if (answerIds(state, "need_detail").length) available.add("recap_edit_detail");
      if (answerIds(state, "priorities").length) available.add("recap_edit_priorities");
      if (answerIds(state, "stakes").length) available.add("recap_edit_stakes");
      if (answerIds(state, "trust_concern").length) available.add("recap_edit_trust");
      return {
        id: "recap_edit_menu",
        kind: "single",
        prompt: "Absolutely. What should we change?",
        supporting: "I’ll keep everything else that still fits.",
        options: RECAP_EDIT_OPTIONS.filter((item) => available.has(item.id)),
      };
    }
    case "zip":
      return {
        id: "zip",
        kind: "zip",
        prompt:
          "That’s enough for me to stop guessing. What’s the project ZIP?",
        inputLabel: "ZIP code",
        inputPlaceholder: "33301",
      };
    case "project_scope":
      return {
        id: "project_scope",
        kind: "single",
        prompt: "Got it. Are we talking windows, exterior doors, or both?",
        options: PROJECT_SCOPE_OPTIONS,
      };
    case "openings":
      return {
        id: "openings",
        kind: "single",
        prompt: "Roughly how many openings are involved? A range is enough.",
        options: OPENINGS_OPTIONS,
      };
    case "budget":
      return {
        id: "budget",
        kind: "single",
        prompt:
          "No dollar range needed. Which statement best describes how you’re thinking about the budget?",
        options: BUDGET_OPTIONS,
      };
    case "timing":
      return {
        id: "timing",
        kind: "single",
        prompt: "And what timing feels realistic right now?",
        options: TIMING_OPTIONS,
      };
    case "first_name":
      return {
        id: "first_name",
        kind: "name",
        prompt:
          state.captureMode === "quote_upload"
            ? "I know what made you pause. What should I call you? You can skip this."
            : "I understand the project now. What should I call you? You can skip this.",
        inputLabel: "First name (optional)",
        inputPlaceholder: "First name",
      };
    case "phone":
      return {
        id: "phone",
        kind: "phone",
        prompt:
          state.captureMode === "quote_upload"
            ? "I’ve got your review focus. What mobile should I use to save your request and open your secure quote scanner without making you start over?"
            : "Your first-quote game plan is ready. What mobile should I use to save it and continue without making you repeat these answers?",
        inputLabel: "Mobile number",
        inputPlaceholder: "(561) 555-0123",
      };
    case "have_concern":
      return {
        id: "have_concern",
        kind: "single",
        prompt:
          "Good—you already have the most useful thing: a real quote. What made you pause before signing?",
        supporting: "Pick the biggest concern. We can check the rest after.",
        options: HAVE_CONCERN_OPTIONS,
      };
    case "have_detail_price":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Trust the pause. A big number can be fair, incomplete, or hard to explain. What bothered you most?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_detail_scope":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "That’s worth checking now. Fuzzy scope is where misunderstandings and later costs begin. What feels least clear?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_detail_product":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Smart place to pause. A strong quote should make both the product and installer easier—not harder—to understand. What worries you?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_detail_compare":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "Good move. The goal isn’t only finding the lower number—it’s knowing whether both quotes price the same job. What are you comparing?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_detail_check":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt:
          "That’s exactly what a second set of eyes is for. You don’t need to know what is wrong first. Where should I be toughest?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_detail_other":
      return {
        id: state.currentNodeId,
        kind: "single",
        prompt: "No problem. Which of these comes closest?",
        options: detailOptions(state.currentNodeId),
      };
    case "have_other_text":
      return {
        id: "have_other_text",
        kind: "other",
        prompt: "Tell me in one sentence. I’ll keep that concern at the front of the review.",
        inputLabel: "What made you pause?",
        inputPlaceholder: "One sentence is enough",
      };
    case "power_1":
    case "power_2":
    case "power_3":
    case "power_4":
    case "power_5": {
      const copy = POWER_COPY[state.currentNodeId];
      return {
        id: state.currentNodeId,
        kind: "power",
        prompt: `${copy.title}\n\n${copy.body}`,
        supporting: `Power ${Number(state.currentNodeId.slice(-1))} of 5`,
        options: POWER_OPTIONS[state.currentNodeId],
      };
    }
    case "power_route":
      return {
        id: "power_route",
        kind: "single",
        prompt: "Good. I can start on either side. Do you already have a written estimate?",
        options: POWER_ROUTE_OPTIONS,
      };
    case "not_ready":
      return {
        id: "not_ready",
        kind: "single",
        prompt:
          "No pressure. Pick the kind of proof you want before you get a quote.",
        options: NOT_READY_OPTIONS,
      };
    case "protection_kit_email":
      return {
        id: "protection_kit_email",
        kind: "email",
        prompt: "Get the Answers Before You Get the Quote",
        supporting:
          "Leave your email and I’ll save your request for the pre-quote red flags. Automated delivery is not live yet.",
        inputLabel: "Email address",
        inputPlaceholder: "Enter your email address",
      };
    case "demo_launch":
      return {
        id: "demo_launch",
        kind: "terminal",
        prompt: "Opening the WindowMan Power Demo…",
        supporting: "Your sample audit opens here without leaving the conversation.",
      };
    case "success":
      return {
        id: "success",
        kind: "terminal",
        prompt: "Project request received.",
        supporting: "Your conversation was saved. WindowMan can continue from what you shared.",
      };
  }
}

export function resolveNextWmChatNode(
  nodeId: WmChatNodeId,
  optionId: WmChatOptionId,
): WmChatNodeId | null {
  const direct: Partial<Record<WmChatOptionId, WmChatNodeId>> = {
    entry_have_quote: "have_concern",
    entry_need_quote: "need_reason",
    entry_learn_powers: "power_1",
    need_moved: "need_detail_moved",
    need_problems: "need_detail_problems",
    need_storm: "need_detail_storm",
    need_remodel: "need_detail_remodel",
    need_comfort: "need_detail_comfort",
    need_planning: "need_detail_planning",
    need_other: "need_detail_other",
    other_explain: "need_other_text",
    have_price: "have_detail_price",
    have_scope: "have_detail_scope",
    have_product_company: "have_detail_product",
    have_compare: "have_detail_compare",
    have_check: "have_detail_check",
    have_other: "have_detail_other",
    have_upload_first: "phone",
    have_other_explain: "have_other_text",
    power_next_2: "power_2",
    power_next_3: "power_3",
    power_next_4: "power_4",
    power_next_5: "power_5",
    power_put_to_work: "power_route",
    power_not_ready: "not_ready",
    power_route_have_quote: "have_concern",
    power_route_need_quote: "need_reason",
    not_ready_have_quote: "have_concern",
    not_ready_need_quote: "need_reason",
    not_ready_protection_kit: "protection_kit_email",
    not_ready_demo: "demo_launch",
    recap_confirm: "zip",
    recap_edit: "recap_edit_menu",
  };

  if (direct[optionId]) return direct[optionId] ?? null;

  if (nodeId.startsWith("need_detail_")) return "priorities";
  if (nodeId === "priorities") return "stakes";
  if (nodeId === "stakes") return "trust";
  if (nodeId === "trust") return "recap";
  if (nodeId === "project_scope") return "openings";
  if (nodeId === "openings") return "budget";
  if (nodeId === "budget") return "timing";
  if (nodeId === "timing") return "first_name";
  if (nodeId.startsWith("have_detail_")) return "first_name";

  return null;
}

export function answerKeyForNode(nodeId: WmChatNodeId): string | null {
  if (nodeId === "entry") return "entry_intent";
  if (nodeId === "need_reason") return "need_reason";
  if (nodeId.startsWith("need_detail_")) return "need_detail";
  if (nodeId === "priorities") return "priorities";
  if (nodeId === "stakes") return "stakes";
  if (nodeId === "trust") return "trust_concern";
  if (nodeId === "project_scope") return "project_scope";
  if (nodeId === "openings") return "openings";
  if (nodeId === "budget") return "budget_posture";
  if (nodeId === "timing") return "timing";
  if (nodeId === "have_concern") return "have_concern";
  if (nodeId.startsWith("have_detail_")) return "have_detail";
  if (nodeId === "power_route") {
    return "power_route";
  }
  if (nodeId === "not_ready") return "hesitation_action";
  if (nodeId.startsWith("power_")) return "powers";
  return null;
}

export function shouldUseShortConversationBudget(state: WmChatState): boolean {
  const reason = answerIds(state, "need_reason")[0];
  const details = answerIds(state, "need_detail");
  const priorities = answerIds(state, "priorities");

  return (
    (reason === "need_planning" && priorities.includes("priority_not_sure")) ||
    details.some((id) => id.endsWith("not_sure"))
  );
}
