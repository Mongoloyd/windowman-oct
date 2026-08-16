import type {
  WmChatEntryIntent,
  WmChatIntakeV1 as WmChatIntake,
  WmChatOptionId,
} from "./wmChatTypes";

export interface WmChatNextAction {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
}

export interface WmChatProjectBrief {
  readonly projectSummary: readonly string[];
  readonly recommendation: string;
  readonly estimateRequirements: readonly string[];
  readonly contractorQuestions: readonly string[];
  readonly nextActions: readonly WmChatNextAction[];
}

type BriefPath = "need_quote" | "have_quote" | "learn_powers";

interface BriefContentBlock {
  readonly recommendation: string;
  readonly estimateRequirements: readonly string[];
  readonly contractorQuestions: readonly string[];
}

interface DetailGuidance {
  readonly requirement: string;
  readonly question: string;
}

const ENTRY_INTENT_LABELS: Readonly<Record<WmChatEntryIntent, string>> = {
  need_quote: "Preparing to request a quote",
  have_quote: "Reviewing an existing quote",
  learn_powers: "Exploring how WindowMan can help",
};

const ANSWER_LABELS = {
  need_moved: "Moved or bought the home",
  need_problems: "Old, damaged, or problem windows or doors",
  need_storm: "Storm or insurance concerns",
  need_remodel: "Remodeling or changing the look",
  need_comfort: "Comfort, outside noise, or energy use",
  need_planning: "Planning, budgeting, or researching",
  need_other: "Another project trigger",
  have_price: "Price",
  have_scope: "Unclear scope",
  have_product_company: "Product or company",
  have_compare: "Quote comparison",
  have_check: "A complete second look",
  have_other: "Another quote concern",
  have_upload_first: "Upload-first review",
  priority_price_baseline: "Clear price baseline",
  priority_correct_product: "Correct product and ratings",
  priority_complete_scope: "Complete written scope",
  priority_payment_clarity: "Payment and financing clarity",
  priority_low_pressure: "Low-pressure process",
  priority_followthrough: "Reliable follow-through",
  priority_not_sure: "Priorities still being defined",
  stakes_later_cost: "Unexpected cost later",
  stakes_wrong_product: "The wrong product",
  stakes_storm_documents: "Missing storm or product documentation",
  stakes_disruption: "A disruptive installation",
  stakes_comfort: "The original comfort problem remaining",
  stakes_delay: "Project delay",
  stakes_uncertainty: "Uncertainty",
  trust_pressure: "Pressure to sign quickly",
  trust_vague_scope: "Vague or incomplete scope",
  trust_financing_first: "Financing-first selling",
  trust_missing_product: "Missing exact product details",
  trust_too_many_calls: "Too many calls",
  trust_followthrough: "Poor follow-through",
  trust_not_sure: "Trust concern still being defined",
  scope_windows: "Windows",
  scope_doors: "Exterior doors",
  scope_both: "Windows and exterior doors",
  scope_not_sure: "Project scope not decided",
  openings_1_5: "1–5 openings",
  openings_6_10: "6–10 openings",
  openings_11_20: "11–20 openings",
  openings_20_plus: "20+ openings",
  openings_not_sure: "Opening count not decided",
  budget_baseline: "Setting a baseline",
  budget_financing: "Financing matters",
  budget_ready: "Ready if the plan makes sense",
  budget_researching: "Researching",
  budget_not_sure: "Budget posture not decided",
  timing_urgent: "Urgent or within 30 days",
  timing_1_3_months: "1–3 months",
  timing_3_6_months: "3–6 months",
  timing_no_deadline: "No deadline",
  timing_not_sure: "Timing not decided",
  moved_inspection: "Inspection concern",
  moved_age_damage: "Visible age or damage",
  moved_storm_insurance: "Storm or insurance questions",
  moved_comfort_noise: "Heat, drafts, or outside noise",
  moved_remodel: "Updating the home",
  moved_baseline: "Establishing a baseline",
  problems_drafts_leaks: "Drafts or water leaks",
  problems_operation: "Difficult operation or locking",
  problems_fogging: "Fogging between panes",
  problems_damage: "Cracks, rot, or visible damage",
  problems_heat_noise: "Heat or outside noise",
  problems_several: "Several performance problems",
  storm_insurer_question: "An insurer raised a question",
  storm_older_nonimpact: "Older or possibly non-impact products",
  storm_active_damage: "Active damage or a leak",
  storm_preparation: "Preparing before storm season",
  storm_impact_uncertain: "Impact-rating uncertainty",
  storm_not_sure: "Storm concern still being defined",
  remodel_whole_home: "Whole-home appearance",
  remodel_room_addition: "One room or an addition",
  remodel_larger_openings: "Larger openings",
  remodel_doors_too: "Exterior doors included",
  remodel_resale: "Preparing for resale",
  remodel_undecided: "Remodel scope still being decided",
  comfort_hot_rooms: "Hot rooms",
  comfort_energy_use: "Energy use",
  comfort_outside_noise: "Outside noise",
  comfort_drafts: "Drafts or uneven comfort",
  comfort_glare_fading: "Glare or fading",
  comfort_several: "Several comfort problems",
  planning_price_baseline: "Realistic price baseline",
  planning_scope: "Likely project scope",
  planning_financing: "Financing importance",
  planning_products: "Product choices",
  planning_timing: "Project timing",
  planning_where_start: "Where to begin",
  other_sales_conversation: "A contractor or salesperson raised the project",
  other_new_purchase: "Considering a home purchase",
  other_property_issue: "Another property issue",
  other_family_project: "Helping with someone else’s project",
  other_explain: "Another explained reason",
  price_total: "Total price feels high",
  price_monthly: "Monthly payment",
  price_fees: "Fees or add-ons",
  price_cannot_tell: "Price is difficult to evaluate",
  scope_included: "Included work",
  scope_excluded: "Exclusions",
  scope_install_permits: "Installation or permits",
  scope_warranty: "Warranty",
  scope_all: "Overall scope clarity",
  product_brand_model: "Brand or model",
  product_impact_noa: "Required product approvals or ratings",
  product_warranty: "Product warranty",
  product_contractor: "Contractor confidence",
  product_verbal_claim: "A verbal product or company claim",
  compare_price: "Total price",
  compare_products: "Products",
  compare_scope: "Scope",
  compare_financing: "Financing",
  compare_everything: "Price, product, scope, and financing",
  check_price: "Price",
  check_missing: "Missing details",
  check_product: "Product",
  check_terms: "Terms and warranty",
  check_whole_quote: "The complete quote",
  have_other_salesperson: "A salesperson statement",
  have_other_missing: "A missing item",
  have_other_fine_print: "Fine print or payment",
  have_other_pressure: "Pressure to sign",
  have_other_explain: "Another explained concern",
} satisfies Partial<Record<WmChatOptionId, string>>;

const UNIVERSAL_ESTIMATE_REQUIREMENTS = [
  "An itemized total that separates products, installation, permits, fees, and optional work.",
  "Exact product manufacturer, product line, model or series, and performance ratings in writing.",
  "A written installation scope covering removal, disposal, opening preparation, finish work, and cleanup.",
  "Clear exclusions, payment milestones, change-order rules, warranty terms, and quote expiration date.",
] as const;

const UNIVERSAL_CONTRACTOR_QUESTIONS = [
  "Which exact products and ratings are included, and where are they identified in the written quote?",
  "What work, fees, repairs, and finish items are excluded from this total?",
  "Who is responsible for permits, measurements, cleanup, warranty service, and schedule updates?",
] as const;

const NEED_QUOTE_FALLBACK: BriefContentBlock = {
  recommendation:
    "Define the project in writing before comparing prices. A useful first estimate should make product, scope, fees, and warranty clear enough for another contractor to price the same job.",
  estimateRequirements: [
    "A written opening-by-opening scope or a clearly documented project allowance.",
  ],
  contractorQuestions: [
    "What information do you still need before this estimate can represent the complete project?",
  ],
};

const NEED_REASON_CONTENT = {
  need_moved: {
    recommendation:
      "Establish a clean written baseline before anyone pressures you to choose. Start with the current condition, the intended improvements, and a scope that another contractor could price consistently.",
    estimateRequirements: [
      "A documented assessment of which openings need replacement now and which can reasonably wait.",
      "Separate pricing for required work and optional upgrades.",
    ],
    contractorQuestions: [
      "Which conditions are urgent, and which recommendations are optional improvements?",
      "What existing conditions could change the price after measurements or removal?",
    ],
  },
  need_problems: {
    recommendation:
      "Tie each observed problem to the proposed fix. The estimate should explain what the product and installation are intended to solve instead of treating replacement as the explanation by itself.",
    estimateRequirements: [
      "A written link between each reported problem, the proposed product, and the installation remedy.",
      "Documentation of any diagnostic uncertainty or repair that requires further inspection.",
    ],
    contractorQuestions: [
      "What evidence shows this product and installation approach addresses the problem I described?",
      "Could any surrounding opening, drainage, or wall condition remain after replacement?",
    ],
  },
  need_storm: {
    recommendation:
      "Require the exact product approvals, ratings, and installation scope in writing. Verify documentation without assuming an insurance outcome or treating a verbal claim as proof.",
    estimateRequirements: [
      "Exact approval or rating identifiers applicable to each proposed window or door product.",
      "Written anchoring, opening preparation, and permit scope where applicable.",
    ],
    contractorQuestions: [
      "Which written product approvals or ratings apply to these exact models and sizes?",
      "What documentation will I receive for permit, product, and installation records?",
    ],
  },
  need_remodel: {
    recommendation:
      "Connect the design goal to product, dimensions, finish, and installation. Preserve those choices in the written scope before comparing totals.",
    estimateRequirements: [
      "Opening dimensions, configuration, frame and glass selections, colors, hardware, and finish details.",
      "Separate scope for structural changes, interior or exterior repairs, and surrounding finishes.",
    ],
    contractorQuestions: [
      "Which visual and dimensional choices are included in this price, and which remain allowances?",
      "Who owns structural, finish, paint, stucco, trim, or interior repair work?",
    ],
  },
  need_comfort: {
    recommendation:
      "Clarify the comfort problem first, then require the quote to state what the proposed work is intended to improve. Avoid paying for an upgrade without a written performance rationale.",
    estimateRequirements: [
      "Written product characteristics relevant to the stated heat, draft, glare, fading, or noise concern.",
      "Any limitations or surrounding conditions that replacement alone may not resolve.",
    ],
    contractorQuestions: [
      "Which product characteristics address my specific comfort concern, and what should I realistically expect?",
      "What else should be inspected before concluding that replacement will solve the problem?",
    ],
  },
  need_planning: {
    recommendation:
      "Build a comparable baseline before sales pressure begins. Define likely scope, essential questions, and decision criteria before focusing on a payment or headline price.",
    estimateRequirements: [
      "A base scope with clearly separated alternates so planning choices do not blur together.",
      "A written explanation of assumptions used when measurements or product decisions remain preliminary.",
    ],
    contractorQuestions: [
      "What decisions have the largest effect on scope and installed price?",
      "Which assumptions should be replaced with measurements or written selections before I compare bids?",
    ],
  },
  need_other: NEED_QUOTE_FALLBACK,
} satisfies Partial<Record<WmChatOptionId, BriefContentBlock>>;

const HAVE_QUOTE_FALLBACK: BriefContentBlock = {
  recommendation:
    "Review the quote as a complete deal—not only a total. Confirm the exact product, installation scope, fees, exclusions, payment terms, and warranty before deciding whether the number is comparable or complete.",
  estimateRequirements: [
    "A revised written quote for any material detail that currently exists only in a conversation.",
  ],
  contractorQuestions: [
    "What would need to be added to this document so another professional could understand exactly what I am buying?",
  ],
};

const HAVE_CONCERN_CONTENT = {
  have_price: {
    recommendation:
      "Test the price against the complete written scope, product, fees, and warranty before calling it high or low. A total without those anchors cannot be compared reliably.",
    estimateRequirements: [
      "An itemized reconciliation of base price, upgrades, add-ons, fees, discounts, and financing effects.",
      "The cash price and financed cost shown separately when financing is offered.",
    ],
    contractorQuestions: [
      "Which parts of the total are product, labor, permits, fees, optional upgrades, and financing cost?",
      "Would the scope or total change if I used a different payment method?",
    ],
  },
  have_scope: {
    recommendation:
      "Make the scope explicit before signing. Missing responsibilities and exclusions are where later cost and disagreement usually enter the project.",
    estimateRequirements: [
      "A line-by-line statement of included labor, permits, repairs, finish work, disposal, cleanup, and exclusions.",
      "Written change-order conditions for concealed or unexpected work.",
    ],
    contractorQuestions: [
      "What work could reasonably arise that is not included in this quote?",
      "How will additional work be documented, priced, and approved before it begins?",
    ],
  },
  have_product_company: {
    recommendation:
      "Verify the exact product and the company’s written responsibilities. Replace verbal assurances with model, rating, warranty, licensing, and service details that can be checked.",
    estimateRequirements: [
      "Manufacturer, product line, model or series, ratings, color, glass, hardware, and warranty documentation.",
      "The legal contracting entity and the party responsible for installation and warranty service.",
    ],
    contractorQuestions: [
      "Where are the exact product model, ratings, and warranty written into this agreement?",
      "Who performs the installation and who handles service if something goes wrong later?",
    ],
  },
  have_compare: {
    recommendation:
      "Normalize the quotes before choosing. Confirm that product, quantities, installation, fees, financing, exclusions, and warranties describe the same job.",
    estimateRequirements: [
      "A comparison-ready schedule of products, opening counts, scope, fees, exclusions, payment terms, and warranty.",
      "Written clarification of every material mismatch between the quotes.",
    ],
    contractorQuestions: [
      "Which specific scope or product differences explain the price gap between these quotes?",
      "Can you revise this quote so the alternatives are priced on the same assumptions?",
    ],
  },
  have_check: {
    recommendation:
      "Audit the whole quote for completeness before focusing on any single concern. The strongest review checks price, product, scope, fees, terms, and warranty together.",
    estimateRequirements: [
      "A complete written package containing product, scope, price, terms, exclusions, and warranty without relying on verbal additions.",
    ],
    contractorQuestions: [
      "What important project detail is not yet stated in this written agreement?",
      "Which terms would you want clarified if this were your own home?",
    ],
  },
  have_other: HAVE_QUOTE_FALLBACK,
  have_upload_first: HAVE_QUOTE_FALLBACK,
} satisfies Partial<Record<WmChatOptionId, BriefContentBlock>>;

const DETAIL_GUIDANCE = {
  moved_inspection: {
    requirement: "The inspection concern and the proposed corrective scope should be identified in writing.",
    question: "Which inspection finding does this work address, and what evidence will show it was corrected?",
  },
  moved_age_damage: {
    requirement: "The estimate should distinguish visible damage, age-based recommendations, and optional upgrades.",
    question: "Which openings need action because of condition, and which are recommended mainly because of age?",
  },
  moved_storm_insurance: {
    requirement: "Product approvals, ratings, and documentation should be written without promising an insurance result.",
    question: "What product and permit records will document the installed work?",
  },
  moved_comfort_noise: {
    requirement: "The proposed product should identify the characteristics relevant to heat, drafts, or noise.",
    question: "Which part of the proposed assembly is intended to address the comfort or noise concern?",
  },
  moved_remodel: {
    requirement: "Design selections and finish responsibilities should be separated from basic replacement work.",
    question: "Which appearance and finish choices are included rather than left as allowances?",
  },
  moved_baseline: {
    requirement: "Required work and elective upgrades should be priced separately to create a useful baseline.",
    question: "What is the minimum complete scope, and what would each optional upgrade add?",
  },
  problems_drafts_leaks: {
    requirement: "The quote should state how opening preparation, sealing, drainage, and surrounding damage are handled.",
    question: "How will you determine whether the leak or draft comes from the unit, installation, or surrounding wall?",
  },
  problems_operation: {
    requirement: "Operation and locking problems should be tied to the proposed repair or replacement scope.",
    question: "What condition is causing the operation problem, and how does this scope correct it?",
  },
  problems_fogging: {
    requirement: "The quote should distinguish failed insulated glass from full-frame replacement needs.",
    question: "Does the fogging require glass replacement, full-unit replacement, or further inspection—and why?",
  },
  problems_damage: {
    requirement: "Visible cracks, rot, water damage, and surrounding repairs should be documented separately.",
    question: "What damaged material is included in the repair, and what surrounding damage is excluded?",
  },
  problems_heat_noise: {
    requirement: "Product performance selections should be connected to the stated heat or noise goal.",
    question: "Which specified product characteristics are relevant to heat or sound performance?",
  },
  problems_several: {
    requirement: "Each reported problem should appear in the assessment so one symptom does not hide another.",
    question: "Can you show how the proposed scope addresses each problem separately?",
  },
  storm_insurer_question: {
    requirement: "The insurer’s exact question and the supporting product or permit documentation should remain separate from assumptions.",
    question: "Which documents can you provide, and which insurance determination must come from the insurer?",
  },
  storm_older_nonimpact: {
    requirement: "Existing and proposed product ratings should be identified from records or labels when available.",
    question: "What evidence identifies the existing products and the ratings of the proposed replacements?",
  },
  storm_active_damage: {
    requirement: "Active damage, temporary protection, and permanent replacement scope should be clearly separated.",
    question: "What must be stabilized now, and what work belongs in the permanent replacement plan?",
  },
  storm_preparation: {
    requirement: "Product ratings, lead times, permit responsibilities, and installation assumptions should be documented before urgency rises.",
    question: "Which decisions or lead times could affect readiness, and what remains outside your control?",
  },
  storm_impact_uncertain: {
    requirement: "The proposal should name the exact approvals or ratings instead of using impact-rated as a generic label.",
    question: "Where can I verify the approval or rating for this exact product and size?",
  },
  remodel_whole_home: {
    requirement: "A whole-home schedule should keep configuration, sightlines, finish, and room-to-room consistency explicit.",
    question: "How will the selected products stay visually consistent across different opening types?",
  },
  remodel_room_addition: {
    requirement: "New and existing openings should be identified separately with any matching assumptions.",
    question: "What must match the existing home, and what can differ in the new room or addition?",
  },
  remodel_larger_openings: {
    requirement: "Structural, engineering, permit, finish, and product work should be separated from standard installation.",
    question: "Which structural or engineering work is included, and what requires separate approval or pricing?",
  },
  remodel_doors_too: {
    requirement: "Window and exterior-door products, hardware, thresholds, and installation scope should be scheduled separately.",
    question: "Are door hardware, thresholds, finishing, and access-control details included?",
  },
  remodel_resale: {
    requirement: "Essential condition work and elective resale upgrades should be priced separately.",
    question: "Which improvements address condition or documentation, and which are primarily cosmetic?",
  },
  comfort_hot_rooms: {
    requirement: "Glass, shading, orientation, sealing, and surrounding heat sources should be considered before promising improvement.",
    question: "What evidence suggests the proposed windows will address the hot-room condition?",
  },
  comfort_energy_use: {
    requirement: "Energy-related product ratings and assumptions should be listed without promising a specific bill reduction.",
    question: "Which written ratings are relevant, and what factors prevent a guaranteed energy saving?",
  },
  comfort_outside_noise: {
    requirement: "Product and installation details relevant to sound control should be identified in writing.",
    question: "Which part of this assembly is intended to reduce outside noise, and what limitations should I expect?",
  },
  comfort_drafts: {
    requirement: "Sealing, opening condition, and installation scope should be explicit rather than assumed.",
    question: "How will you identify and address drafts around the opening, not only through the unit?",
  },
  comfort_glare_fading: {
    requirement: "Glass selections relevant to glare and fading should be named with their trade-offs.",
    question: "Which glass option addresses glare or fading, and how does it affect visible light and appearance?",
  },
  planning_price_baseline: {
    requirement: "The baseline should separate core scope, options, fees, and assumptions.",
    question: "What is included in the base number, and which decisions could materially change it?",
  },
  planning_scope: {
    requirement: "The quote should state whether quantities and scope are measured, estimated, or allowances.",
    question: "Which parts of the scope are confirmed and which still depend on a site visit or selection?",
  },
  planning_financing: {
    requirement: "Cash price, financed amount, term, payment, and material financing costs should remain distinguishable.",
    question: "What is the cash price, and what is the total financed cost under the proposed terms?",
  },
  planning_products: {
    requirement: "Product alternatives should be compared on the same scope and clearly stated performance criteria.",
    question: "What changes between these product options besides the brand name and price?",
  },
  planning_timing: {
    requirement: "Estimated lead time, permit time, installation duration, and dependencies should be stated separately.",
    question: "Which parts of the schedule are estimates, and what events could move them?",
  },
  planning_where_start: {
    requirement: "A preliminary scope should identify the next decisions needed before pricing becomes reliable.",
    question: "What are the first three decisions needed to turn this into a comparable written estimate?",
  },
  price_total: {
    requirement: "The total should reconcile to quantities, products, labor, fees, upgrades, and discounts.",
    question: "Can you walk me from the opening schedule to the final total without relying on bundled unexplained amounts?",
  },
  price_monthly: {
    requirement: "Monthly payment should be accompanied by cash price, financed principal, term, rate, and total repayment where applicable.",
    question: "What are the cash price and total repayment, not only the monthly payment?",
  },
  price_fees: {
    requirement: "Every fee and add-on should have a written purpose and inclusion status.",
    question: "Which fees are mandatory, optional, conditional, or already included elsewhere?",
  },
  scope_install_permits: {
    requirement: "Installation method, permit responsibility, inspections, and correction obligations should be explicit.",
    question: "Who obtains permits, schedules inspections, and pays for corrections if the work does not pass?",
  },
  scope_excluded: {
    requirement: "Exclusions should be specific enough to identify likely homeowner costs after signing.",
    question: "Which excluded items commonly become necessary on a project like this?",
  },
  product_brand_model: {
    requirement: "The exact manufacturer, product line, model or series, configuration, and options should appear in writing.",
    question: "Where is the exact model or series identified, and can it be substituted without my written approval?",
  },
  product_impact_noa: {
    requirement: "The exact approval or rating identifiers should match the proposed model, configuration, and size.",
    question: "Which approval or rating applies to each proposed product, and where can I verify it?",
  },
  product_warranty: {
    requirement: "Manufacturer, installation, labor, service, and transfer terms should be distinguished.",
    question: "Who provides each warranty, what is excluded, and who handles a claim?",
  },
  compare_price: {
    requirement: "Price comparisons should use matching quantities, products, scope, fees, and payment assumptions.",
    question: "Which scope or product differences explain the price difference?",
  },
  compare_products: {
    requirement: "Product comparisons should show exact models, ratings, options, and warranty differences.",
    question: "Are these exact products equivalent for the performance and scope I requested?",
  },
  compare_scope: {
    requirement: "Both quotes should be normalized to the same installation, permit, finish, cleanup, and warranty responsibilities.",
    question: "What is included in one quote but missing or excluded in the other?",
  },
  compare_financing: {
    requirement: "Cash prices and financing costs should be compared separately from monthly payments.",
    question: "How do the cash totals and total financed costs compare under equivalent terms?",
  },
  compare_everything: {
    requirement: "A side-by-side comparison should cover product, quantity, scope, fees, exclusions, financing, and warranty.",
    question: "Can each contractor restate the quote using the same comparison checklist?",
  },
  check_missing: {
    requirement: "Any material verbal promise should be added to the written quote before signing.",
    question: "What important product, scope, fee, or warranty detail is missing from this document?",
  },
  check_terms: {
    requirement: "Payment, cancellation, change-order, warranty, schedule, and dispute terms should be readable and complete.",
    question: "Which term creates an obligation before the corresponding product or work is delivered?",
  },
  have_other_pressure: {
    requirement: "Price expiration and cancellation terms should be written without requiring an immediate decision to preserve clarity.",
    question: "What specifically changes if I take time to review this agreement before signing?",
  },
  have_other_fine_print: {
    requirement: "Fine print should be reconciled with the headline price, payment terms, warranty, and verbal promises.",
    question: "Which written term materially changes the price, obligation, remedy, or cancellation right?",
  },
} satisfies Partial<Record<WmChatOptionId, DetailGuidance>>;

const PROJECT_SCOPE_REQUIREMENTS = {
  scope_windows:
    "A window schedule listing quantity, opening type, dimensions or measurement status, product, glass, frame, and installation method.",
  scope_doors:
    "A door schedule listing configuration, dimensions or measurement status, product, glass, frame, threshold, hardware, and installation method.",
  scope_both:
    "Separate window and exterior-door schedules so quantities, hardware, products, and installation responsibilities remain clear.",
  scope_not_sure:
    "A site assessment that separates necessary windows, exterior doors, and optional work before final pricing.",
} satisfies Partial<Record<WmChatOptionId, string>>;

const PRIORITY_REQUIREMENTS = {
  priority_price_baseline:
    "A comparison-ready base price with upgrades, alternates, fees, and assumptions separated.",
  priority_correct_product:
    "Exact product identifiers and ratings tied to the homeowner’s stated project goals.",
  priority_complete_scope:
    "A complete written responsibility matrix covering included work, exclusions, and change orders.",
  priority_payment_clarity:
    "Cash price, payment milestones, financing assumptions, and total financed cost clearly separated.",
  priority_low_pressure:
    "Written expiration and cancellation terms that can be reviewed without relying on same-day verbal pressure.",
  priority_followthrough:
    "Named responsibility for scheduling, updates, inspections, punch-list work, and warranty service.",
} satisfies Partial<Record<WmChatOptionId, string>>;

const TRUST_QUESTIONS = {
  trust_pressure: "What specifically changes if I do not sign today?",
  trust_vague_scope: "Can every included task and material exclusion be added to the written scope?",
  trust_financing_first: "What is the cash price before we discuss monthly payment options?",
  trust_missing_product: "What exact manufacturer, product line, model or series, and ratings am I buying?",
  trust_too_many_calls: "Who receives my contact information, and will it be shared without a separate choice from me?",
  trust_followthrough: "Who owns updates, corrections, final walkthrough, and warranty service after the sale?",
} satisfies Partial<Record<WmChatOptionId, string>>;

const STAKES_REQUIREMENTS = {
  stakes_later_cost:
    "Likely additional costs, allowances, exclusions, and change-order triggers identified before signing.",
  stakes_wrong_product:
    "Exact product identifiers and relevant ratings protected from substitution without written approval.",
  stakes_storm_documents:
    "Product, permit, approval, and installation records identified as deliverables without promising an insurance outcome.",
  stakes_disruption:
    "Installation sequencing, access, protection, cleanup, duration, and occupied-home responsibilities documented.",
  stakes_comfort:
    "The intended comfort outcome and the limits of the proposed work stated without a performance guarantee.",
  stakes_delay:
    "Lead-time assumptions, scheduling dependencies, delay communication, and completion responsibilities documented.",
} satisfies Partial<Record<WmChatOptionId, string>>;

const PRIORITY_RECOMMENDATIONS = {
  priority_price_baseline:
    "Use a normalized written baseline so later quotes compete on the same job.",
  priority_correct_product:
    "Do not compare totals until the exact products and relevant ratings are documented.",
  priority_complete_scope:
    "Treat any missing responsibility or exclusion as unresolved before comparing prices.",
  priority_payment_clarity:
    "Evaluate the cash price and complete financing economics separately.",
  priority_low_pressure:
    "Preserve time to review the written deal without same-day pressure driving the decision.",
  priority_followthrough:
    "Make ownership of scheduling, corrections, and warranty service part of the deal—not an assumption.",
} satisfies Partial<Record<WmChatOptionId, string>>;

const NEXT_ACTIONS: Readonly<Record<BriefPath, readonly WmChatNextAction[]>> = {
  need_quote: [
    {
      id: "build_quote_request_game_plan",
      label: "Build my quote-request game plan",
      description: "Turn this brief into the scope and questions to use before requesting estimates.",
    },
    {
      id: "schedule_windowman_conversation",
      label: "Schedule a WindowMan conversation",
      description: "Review priorities and decide the most useful next move with a person.",
    },
    {
      id: "review_quote_when_ready",
      label: "Review my quote when I get it",
      description: "Bring back the written estimate so WindowMan can check price, product, scope, fees, and warranty together.",
    },
  ],
  have_quote: [
    {
      id: "review_existing_quote",
      label: "Review my existing quote",
      description: "Continue into the private quote-review path using this brief as context.",
    },
    {
      id: "build_quote_comparison_plan",
      label: "Build my comparison plan",
      description: "Create the exact checklist needed to compare this quote with another proposal.",
    },
    {
      id: "schedule_windowman_conversation",
      label: "Schedule a WindowMan conversation",
      description: "Talk through the concern before signing or requesting a revision.",
    },
  ],
  learn_powers: [
    {
      id: "choose_project_path",
      label: "Put WindowMan to work",
      description: "Choose whether to prepare for a first estimate or review an existing one.",
    },
    {
      id: "see_sample_quote_review",
      label: "See a sample quote review",
      description: "Preview how WindowMan organizes price, product, scope, fees, and warranty questions.",
    },
    {
      id: "schedule_windowman_conversation",
      label: "Schedule a WindowMan conversation",
      description: "Ask how the process would apply to a specific project.",
    },
  ],
};

const LEARN_POWERS_RECOMMENDATION =
  "Choose the real project path next: prepare a comparison-ready first estimate or review an existing written quote. WindowMan is most useful when the product, scope, fees, and warranty can be evaluated together.";

function readSingleAnswer(intake: WmChatIntake, key: string): string | null {
  const value = intake.answers[key];
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    const first = value.find((item) => typeof item === "string" && item.trim());
    return first ?? null;
  }
  return null;
}

function readAnswerList(intake: WmChatIntake, key: string): readonly string[] {
  const value = intake.answers[key];
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim());
  }
  return typeof value === "string" && value.trim() ? [value] : [];
}

function labelFor(answerId: string | null, fallback: string): string {
  if (!answerId) return fallback;
  return ANSWER_LABELS[answerId as keyof typeof ANSWER_LABELS] ?? fallback;
}

function unique(items: readonly string[]): readonly string[] {
  return [...new Set(items.filter(Boolean))];
}

function resolveBriefPath(intake: WmChatIntake): BriefPath {
  if (intake.entry_intent !== "learn_powers") return intake.entry_intent;

  const routedPath = readSingleAnswer(intake, "power_route");
  if (routedPath === "power_route_have_quote") return "have_quote";
  if (routedPath === "power_route_need_quote") return "need_quote";

  if (readSingleAnswer(intake, "have_concern")) return "have_quote";
  if (readSingleAnswer(intake, "need_reason")) return "need_quote";
  return "learn_powers";
}

function contentFor(intake: WmChatIntake, path: BriefPath): BriefContentBlock {
  if (path === "need_quote") {
    const reason = readSingleAnswer(intake, "need_reason");
    return (
      NEED_REASON_CONTENT[reason as keyof typeof NEED_REASON_CONTENT] ??
      NEED_QUOTE_FALLBACK
    );
  }

  if (path === "have_quote") {
    const concern = readSingleAnswer(intake, "have_concern");
    return (
      HAVE_CONCERN_CONTENT[concern as keyof typeof HAVE_CONCERN_CONTENT] ??
      HAVE_QUOTE_FALLBACK
    );
  }

  return {
    recommendation: LEARN_POWERS_RECOMMENDATION,
    estimateRequirements: NEED_QUOTE_FALLBACK.estimateRequirements,
    contractorQuestions: NEED_QUOTE_FALLBACK.contractorQuestions,
  };
}

function buildProjectSummary(
  intake: WmChatIntake,
  path: BriefPath,
): readonly string[] {
  const summary = [`Starting point: ${ENTRY_INTENT_LABELS[intake.entry_intent]}.`];

  if (path === "need_quote") {
    summary.push(
      `Project trigger: ${labelFor(readSingleAnswer(intake, "need_reason"), "Still being defined")}.`,
    );
    const detail = readSingleAnswer(intake, "need_detail");
    if (detail) summary.push(`Specific situation: ${labelFor(detail, "Additional project context")}.`);
  }

  if (path === "have_quote") {
    summary.push(
      `Primary quote concern: ${labelFor(readSingleAnswer(intake, "have_concern"), "Complete quote review")}.`,
    );
    const detail = readSingleAnswer(intake, "have_detail");
    if (detail) summary.push(`Review focus: ${labelFor(detail, "Additional quote context")}.`);
  }

  const priorities = readAnswerList(intake, "priorities");
  if (priorities.length) {
    summary.push(
      `Top priorities: ${priorities.map((id) => labelFor(id, "Project clarity")).join("; ")}.`,
    );
  }

  const scope = readSingleAnswer(intake, "project_scope");
  if (scope) summary.push(`Project scope: ${labelFor(scope, "Not decided")}.`);

  const openings = readSingleAnswer(intake, "openings");
  if (openings) summary.push(`Estimated size: ${labelFor(openings, "Not decided")}.`);

  const timing = readSingleAnswer(intake, "timing");
  if (timing) summary.push(`Timing: ${labelFor(timing, "Not decided")}.`);

  const budget = readSingleAnswer(intake, "budget_posture");
  if (budget) summary.push(`Budget posture: ${labelFor(budget, "Not decided")}.`);

  const trust = readSingleAnswer(intake, "trust_concern");
  if (trust) summary.push(`Process concern: ${labelFor(trust, "Still being defined")}.`);

  const zip = readSingleAnswer(intake, "zip");
  if (zip && /^\d{5}$/.test(zip)) summary.push(`Project ZIP: ${zip}.`);

  return summary;
}

export function buildWmChatProjectBrief(
  intake: WmChatIntake,
): WmChatProjectBrief {
  const path = resolveBriefPath(intake);
  const content = contentFor(intake, path);
  const detail =
    readSingleAnswer(intake, path === "have_quote" ? "have_detail" : "need_detail");
  const detailGuidance = detail
    ? DETAIL_GUIDANCE[detail as keyof typeof DETAIL_GUIDANCE]
    : undefined;
  const scope = readSingleAnswer(intake, "project_scope");
  const priorities = readAnswerList(intake, "priorities");
  const stakes = readSingleAnswer(intake, "stakes");
  const trust = readSingleAnswer(intake, "trust_concern");

  const priorityRecommendation = priorities
    .map(
      (id) =>
        PRIORITY_RECOMMENDATIONS[id as keyof typeof PRIORITY_RECOMMENDATIONS],
    )
    .find(Boolean);

  const estimateRequirements = unique([
    ...UNIVERSAL_ESTIMATE_REQUIREMENTS,
    ...content.estimateRequirements,
    ...(detailGuidance ? [detailGuidance.requirement] : []),
    ...(scope && PROJECT_SCOPE_REQUIREMENTS[scope as keyof typeof PROJECT_SCOPE_REQUIREMENTS]
      ? [PROJECT_SCOPE_REQUIREMENTS[scope as keyof typeof PROJECT_SCOPE_REQUIREMENTS]]
      : []),
    ...priorities.flatMap((id) => {
      const requirement =
        PRIORITY_REQUIREMENTS[id as keyof typeof PRIORITY_REQUIREMENTS];
      return requirement ? [requirement] : [];
    }),
    ...(stakes && STAKES_REQUIREMENTS[stakes as keyof typeof STAKES_REQUIREMENTS]
      ? [STAKES_REQUIREMENTS[stakes as keyof typeof STAKES_REQUIREMENTS]]
      : []),
  ]);

  const contractorQuestions = unique([
    ...UNIVERSAL_CONTRACTOR_QUESTIONS,
    ...content.contractorQuestions,
    ...(detailGuidance ? [detailGuidance.question] : []),
    ...(trust && TRUST_QUESTIONS[trust as keyof typeof TRUST_QUESTIONS]
      ? [TRUST_QUESTIONS[trust as keyof typeof TRUST_QUESTIONS]]
      : []),
  ]);

  return {
    projectSummary: buildProjectSummary(intake, path),
    recommendation: priorityRecommendation
      ? `${content.recommendation} ${priorityRecommendation}`
      : content.recommendation,
    estimateRequirements,
    contractorQuestions,
    nextActions: NEXT_ACTIONS[path].map((action) => ({ ...action })),
  };
}
