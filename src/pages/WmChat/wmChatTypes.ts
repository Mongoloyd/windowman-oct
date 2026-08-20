export const WM_CHAT_SCHEMA_VERSION = "1" as const;
export const WM_CHAT_INTAKE_VERSION = "wmchat_v1" as const;
export const WM_CHAT_RESUME_VERSION = 1 as const;

export const WM_CHAT_NODE_IDS = [
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

export type WmChatNodeId = (typeof WM_CHAT_NODE_IDS)[number];

export const WM_CHAT_OPTION_IDS = [
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

export type WmChatOptionId = (typeof WM_CHAT_OPTION_IDS)[number];

export type WmChatEntryIntent =
  | "have_quote"
  | "need_quote"
  | "learn_powers";

export type WmChatAnswerValue = string | readonly string[];

export type WmChatTranscriptEntry = {
  readonly id: string;
  readonly role: "windowman" | "visitor";
  readonly text: string;
};

export type WmChatHistorySelection = {
  readonly nodeId: WmChatNodeId;
  readonly optionIds: readonly WmChatOptionId[];
};

export type WmChatContactDraft = {
  readonly zip: string;
  readonly firstName: string;
  readonly phone: string;
};

export type WmChatCaptureMode = "lead" | "quote_upload" | "protection_kit";

export const WM_CHAT_POST_CAPTURE_NODE_IDS = [
  "choice",
  "address",
  "conversation_time",
  "quote_readiness",
  "callback_preference",
  "review",
  "scanner_transition",
  "confirmation",
] as const;

export type WmChatPostCaptureNodeId =
  (typeof WM_CHAT_POST_CAPTURE_NODE_IDS)[number];

export type WmChatPostCaptureAction =
  | "quote_request_game_plan"
  | "schedule_windowman_conversation"
  | "review_quote_when_ready";

export type WmChatConversationTimePreference =
  | "asap"
  | "weekday_morning"
  | "weekday_afternoon"
  | "weekday_evening";

export type WmChatQuoteReadiness = "ready_now" | "not_yet";

export type WmChatCallbackPreference =
  | "next_week"
  | "one_month"
  | "three_months"
  | "self_return";

export type WmChatPropertyAddressDraft = {
  readonly line1: string;
  readonly line2: string;
  readonly city: string;
  readonly region: string;
  readonly postalCode: string;
};

export type WmChatContinuationStatus =
  | "unavailable"
  | "idle"
  | "submitting"
  | "success"
  | "error";

export type WmChatRecapEditTarget =
  | "need_reason"
  | "need_detail"
  | "priorities"
  | "stakes"
  | "trust_concern";

/**
 * Transient correction state. It exists only in React memory and is never
 * included in the versioned resume record or the persisted intake payload.
 */
export type WmChatRecapEditSession = {
  readonly target: WmChatRecapEditTarget | null;
  readonly baseHistory: readonly WmChatHistorySelection[];
  readonly baseAnswers: Readonly<Record<string, WmChatAnswerValue>>;
  readonly baseOtherText: string;
};

export type WmChatRuntimeSnapshot = {
  readonly currentNodeId: WmChatNodeId;
  readonly entryIntent: WmChatEntryIntent | null;
  readonly answers: Readonly<Record<string, WmChatAnswerValue>>;
  readonly contact: WmChatContactDraft;
  readonly otherText: string;
  readonly history: readonly WmChatHistorySelection[];
  readonly transcript: readonly WmChatTranscriptEntry[];
  readonly captureMode: WmChatCaptureMode;
  readonly recapEdit: WmChatRecapEditSession | null;
  readonly status: "active" | "not_ready";
};

export type WmChatState = Omit<WmChatRuntimeSnapshot, "status"> & {
  readonly past: readonly WmChatRuntimeSnapshot[];
  /** Transient UI pacing only. Never persisted or treated as authorization. */
  readonly isThinking: boolean;
  readonly status:
    | "active"
    | "submitting"
    | "success"
    | "error"
    | "not_ready";
  readonly submitError: string | null;
  readonly submitErrorCode: WmChatSubmitErrorCode | null;
  readonly leadId: string | null;
  readonly sessionId: string | null;
  /** Post-capture state is React-memory only and never enters wmchat_v1. */
  readonly postCaptureNodeId: WmChatPostCaptureNodeId | null;
  readonly postCaptureAction: WmChatPostCaptureAction | null;
  readonly propertyAddressDraft: WmChatPropertyAddressDraft;
  readonly propertyAddressDecision: "add" | "skip" | null;
  readonly conversationTimePreference: WmChatConversationTimePreference | null;
  readonly quoteReadiness: WmChatQuoteReadiness | null;
  readonly callbackPreference: WmChatCallbackPreference | null;
  readonly continuationStatus: WmChatContinuationStatus;
  readonly continuationError: string | null;
  readonly continuationSubmissionId: string | null;
};

export type WmChatAction =
  | { type: "thinking_started" }
  | { type: "thinking_finished" }
  | { type: "select_single"; nodeId: WmChatNodeId; optionId: WmChatOptionId }
  | {
      type: "continue_multi";
      nodeId: WmChatNodeId;
      optionIds: readonly WmChatOptionId[];
    }
  | { type: "continue_other"; nodeId: WmChatNodeId; value: string }
  | {
      type: "continue_contact";
      nodeId: "zip" | "first_name";
      value: string;
    }
  | { type: "skip_name" }
  | { type: "update_phone"; value: string }
  | { type: "back" }
  | { type: "restart" }
  | { type: "restore"; snapshot: WmChatResumeV1 }
  | { type: "capture_started" }
  | {
      type: "capture_succeeded";
      leadId: string;
      sessionId: string;
    }
  | {
      type: "capture_failed";
      message: string;
      code?: WmChatSubmitErrorCode;
    }
  | {
      type: "select_post_capture_action";
      postCaptureAction: WmChatPostCaptureAction;
    }
  | {
      type: "update_property_address";
      field: keyof WmChatPropertyAddressDraft;
      value: string;
    }
  | { type: "skip_property_address" }
  | { type: "continue_property_address" }
  | {
      type: "select_conversation_time";
      value: WmChatConversationTimePreference;
    }
  | { type: "select_quote_readiness"; value: WmChatQuoteReadiness }
  | { type: "select_callback_preference"; value: WmChatCallbackPreference }
  | { type: "post_capture_back" }
  | { type: "return_to_post_capture_choices" }
  | { type: "continuation_started"; submissionId: string }
  | {
      type: "continuation_succeeded";
      submissionId: string;
      leadId: string;
      sessionId: string;
    }
  | {
      type: "continuation_failed";
      submissionId: string;
      message: string;
    };

export interface WmChatOption {
  readonly id: WmChatOptionId;
  readonly label: string;
  readonly hint?: string;
  readonly tone?: "primary" | "quiet";
}

export type WmChatResolvedNode = {
  readonly id: WmChatNodeId;
  readonly kind:
    | "single"
    | "multi"
    | "other"
    | "email"
    | "zip"
    | "name"
    | "phone"
    | "recap"
    | "power"
    | "terminal";
  readonly prompt: string;
  readonly supporting?: string;
  readonly options?: readonly WmChatOption[];
  readonly selectionLimit?: number;
  readonly inputLabel?: string;
  readonly inputPlaceholder?: string;
};

export interface WmChatIntakeV1 {
  readonly schema_version: typeof WM_CHAT_SCHEMA_VERSION;
  readonly intake_version: typeof WM_CHAT_INTAKE_VERSION;
  readonly entry_intent: WmChatEntryIntent;
  readonly answer_path: readonly string[];
  readonly answers: Readonly<Record<string, WmChatAnswerValue>>;
  readonly continuation: "sms_then_voice" | "email_only";
  readonly other_text?: string;
}

export interface WmChatSubmitInput {
  readonly sessionId: string;
  readonly submissionId: string;
  readonly firstName: string | null;
  readonly phoneE164: string;
  readonly serviceCommunicationsGranted: true;
  readonly marketingConsentPresented: false;
  readonly marketingCommunicationsGranted: false;
  readonly advertisingMeasurementDecision: "granted" | "declined" | null;
  readonly wmchatIntake: WmChatIntakeV1;
}

export type WmChatSubmitErrorCode =
  | "invalid_phone"
  | "lookup_unavailable"
  /** This tab's session is bound to a lead with different contact details. */
  | "identity_conflict"
  | "capture_failed";

export type WmChatSubmitResult =
  | {
      readonly ok: true;
      readonly leadId: string;
      readonly sessionId: string;
      readonly reused: boolean;
    }
  | {
      readonly ok: false;
      readonly message: string;
      /** Optional so the existing email-only submitter remains compatible. */
      readonly code?: WmChatSubmitErrorCode;
    };

export type WmChatSubmitter = (
  input: WmChatSubmitInput,
) => Promise<WmChatSubmitResult>;

export interface WmChatEmailSubmitInput {
  readonly email: string;
  readonly wmchatIntake: WmChatIntakeV1;
}

export type WmChatEmailSubmitter = (
  input: WmChatEmailSubmitInput,
) => Promise<WmChatSubmitResult>;

export interface WmChatPostCaptureSubmitInput {
  readonly leadId: string;
  readonly sessionId: string;
  readonly submissionId: string;
  readonly action: WmChatPostCaptureAction;
  readonly propertyAddress: WmChatPropertyAddressDraft | null;
  readonly conversationTimePreference: WmChatConversationTimePreference | null;
  readonly quoteReadiness: WmChatQuoteReadiness | null;
  readonly callbackPreference: WmChatCallbackPreference | null;
}

export type WmChatPostCaptureSubmitResult =
  | {
      readonly ok: true;
      readonly leadId: string;
      readonly sessionId: string;
    }
  | { readonly ok: false; readonly message: string };

export type WmChatPostCaptureSubmitter = (
  input: WmChatPostCaptureSubmitInput,
) => Promise<WmChatPostCaptureSubmitResult>;

export interface WmChatResumeV1 {
  readonly schemaVersion: typeof WM_CHAT_RESUME_VERSION;
  readonly savedAtMs: number;
  readonly entryIntent: WmChatEntryIntent | null;
  readonly currentNodeId: WmChatNodeId;
  readonly history: readonly WmChatHistorySelection[];
}

export const isWmChatNodeId = (value: unknown): value is WmChatNodeId =>
  typeof value === "string" &&
  (WM_CHAT_NODE_IDS as readonly string[]).includes(value);

export const isWmChatOptionId = (value: unknown): value is WmChatOptionId =>
  typeof value === "string" &&
  (WM_CHAT_OPTION_IDS as readonly string[]).includes(value);
