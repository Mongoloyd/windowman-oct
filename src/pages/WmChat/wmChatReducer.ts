import {
  answerKeyForNode,
  getWmChatOption,
  resolveNextWmChatNode,
  resolveWmChatNode,
  shouldUseShortConversationBudget,
} from "./wmChatContent";
import {
  WM_CHAT_INTAKE_VERSION,
  WM_CHAT_SCHEMA_VERSION,
  type WmChatAction,
  type WmChatAnswerValue,
  type WmChatEntryIntent,
  type WmChatHistorySelection,
  type WmChatIntakeV1,
  type WmChatNodeId,
  type WmChatOptionId,
  type WmChatRecapEditSession,
  type WmChatRecapEditTarget,
  type WmChatResumeV1,
  type WmChatRuntimeSnapshot,
  type WmChatState,
  type WmChatTranscriptEntry,
} from "./wmChatTypes";

const EMPTY_CONTACT = {
  zip: "",
  firstName: "",
  phone: "",
} as const;

const EMPTY_PROPERTY_ADDRESS = {
  line1: "",
  line2: "",
  city: "",
  region: "",
  postalCode: "",
} as const;

function emptyPostCaptureState() {
  return {
    postCaptureNodeId: null,
    postCaptureAction: null,
    propertyAddressDraft: EMPTY_PROPERTY_ADDRESS,
    propertyAddressDecision: null,
    conversationTimePreference: null,
    quoteReadiness: null,
    callbackPreference: null,
    continuationStatus: "idle" as const,
    continuationError: null,
    continuationSubmissionId: null,
  };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isNonZeroUuid(value: string): boolean {
  return UUID_PATTERN.test(value) &&
    value.toLowerCase() !== "00000000-0000-0000-0000-000000000000";
}

export function createWmChatInitialState(): WmChatState {
  return {
    currentNodeId: "entry",
    entryIntent: null,
    answers: {},
    contact: EMPTY_CONTACT,
    otherText: "",
    history: [],
    transcript: [],
    captureMode: "lead",
    recapEdit: null,
    past: [],
    isThinking: false,
    status: "active",
    submitError: null,
    submitErrorCode: null,
    leadId: null,
    sessionId: null,
    ...emptyPostCaptureState(),
  };
}

function toRuntimeSnapshot(state: WmChatState): WmChatRuntimeSnapshot {
  return {
    currentNodeId: state.currentNodeId,
    entryIntent: state.entryIntent,
    answers: state.answers,
    contact: state.contact,
    otherText: state.otherText,
    history: state.history,
    transcript: state.transcript,
    captureMode: state.captureMode,
    recapEdit: state.recapEdit,
    status: state.status === "not_ready" ? "not_ready" : "active",
  };
}

function restoreRuntime(
  state: WmChatState,
  snapshot: WmChatRuntimeSnapshot,
  past: readonly WmChatRuntimeSnapshot[],
): WmChatState {
  return {
    ...state,
    ...snapshot,
    past,
    isThinking: false,
    status: snapshot.status,
    submitError: null,
    submitErrorCode: null,
    leadId: null,
    sessionId: null,
    ...emptyPostCaptureState(),
  };
}

function returnToPostCaptureChoices(state: WmChatState): WmChatState {
  const hasPersistedContinuation =
    state.postCaptureNodeId === "confirmation" &&
    state.continuationStatus === "success";
  if (
    !state.postCaptureNodeId ||
    state.continuationStatus === "submitting" ||
    hasPersistedContinuation
  ) {
    return state;
  }

  return {
    ...state,
    ...emptyPostCaptureState(),
    currentNodeId: "success",
    postCaptureNodeId: "choice",
    status: "success",
    past: [],
    isThinking: false,
    submitError: null,
    submitErrorCode: null,
  };
}

function appendExchange(
  state: WmChatState,
  visitorText: string,
): readonly WmChatTranscriptEntry[] {
  const node = resolveWmChatNode(state);
  const index = state.transcript.length;
  return [
    ...state.transcript,
    {
      id: `${state.currentNodeId}-${index}-windowman`,
      role: "windowman" as const,
      text: node.prompt,
    },
    {
      id: `${state.currentNodeId}-${index + 1}-visitor`,
      role: "visitor" as const,
      text: visitorText,
    },
  ];
}

function entryIntentForOption(
  optionId: WmChatOptionId,
): WmChatEntryIntent | null {
  if (optionId === "entry_have_quote") return "have_quote";
  if (optionId === "entry_need_quote") return "need_quote";
  if (optionId === "entry_learn_powers") return "learn_powers";
  return null;
}

function answerValueForSelection(
  nodeId: WmChatNodeId,
  optionIds: readonly WmChatOptionId[],
): WmChatAnswerValue {
  if (nodeId === "entry") {
    const intent = entryIntentForOption(optionIds[0]);
    return intent ?? optionIds[0];
  }
  return optionIds.length === 1 ? optionIds[0] : optionIds;
}

function nextStatus(nodeId: WmChatNodeId): "active" | "not_ready" {
  return nodeId === "not_ready" ? "not_ready" : "active";
}

const RECAP_EDIT_TARGET_BY_OPTION: Partial<
  Record<WmChatOptionId, WmChatRecapEditTarget>
> = {
  recap_edit_reason: "need_reason",
  recap_edit_detail: "need_detail",
  recap_edit_priorities: "priorities",
  recap_edit_stakes: "stakes",
  recap_edit_trust: "trust_concern",
};

function answerOptionIds(
  answers: Readonly<Record<string, WmChatAnswerValue>>,
  key: string,
): readonly WmChatOptionId[] {
  const raw = answers[key];
  const values = Array.isArray(raw) ? raw : typeof raw === "string" ? [raw] : [];
  return values.filter(
    (value): value is WmChatOptionId =>
      typeof value === "string" && Boolean(getWmChatOption(value as WmChatOptionId)),
  );
}

function firstAnswerOption(
  answers: Readonly<Record<string, WmChatAnswerValue>>,
  key: string,
): WmChatOptionId | null {
  return answerOptionIds(answers, key)[0] ?? null;
}

function withoutAnswerKeys(
  answers: Readonly<Record<string, WmChatAnswerValue>>,
  ...keys: readonly string[]
): Record<string, WmChatAnswerValue> {
  const next = { ...answers };
  for (const key of keys) delete next[key];
  return next;
}

function detailNodeForReason(reason: WmChatOptionId): WmChatNodeId | null {
  const next = resolveNextWmChatNode("need_reason", reason);
  return next?.startsWith("need_detail_") ? next : null;
}

function optionIsAvailable(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionId: WmChatOptionId,
  answers: Readonly<Record<string, WmChatAnswerValue>> = state.answers,
): boolean {
  const node = resolveWmChatNode({ ...state, currentNodeId: nodeId, answers });
  return Boolean(node.options?.some((option) => option.id === optionId));
}

function openRecapEditor(state: WmChatState): WmChatState {
  const recapEdit: WmChatRecapEditSession = {
    target: null,
    baseHistory: state.history,
    baseAnswers: state.answers,
    baseOtherText: state.otherText,
  };

  return {
    ...state,
    currentNodeId: "recap_edit_menu",
    recapEdit,
    past: [...state.past, toRuntimeSnapshot(state)],
    status: "active",
    submitError: null,
  };
}

function targetNodeForRecapEdit(
  target: WmChatRecapEditTarget,
  answers: Readonly<Record<string, WmChatAnswerValue>>,
): WmChatNodeId | null {
  if (target === "need_reason") return "need_reason";
  if (target === "need_detail") {
    const reason = firstAnswerOption(answers, "need_reason");
    return reason ? detailNodeForReason(reason) : null;
  }
  if (target === "priorities") return "priorities";
  if (target === "stakes") return "stakes";
  if (target === "trust_concern") return "trust";
  return null;
}

function beginRecapEditTarget(
  state: WmChatState,
  optionId: WmChatOptionId,
): WmChatState {
  const session = state.recapEdit;
  const target = RECAP_EDIT_TARGET_BY_OPTION[optionId];
  if (!session || !target) return state;

  const currentNodeId = targetNodeForRecapEdit(target, session.baseAnswers);
  if (!currentNodeId) return state;

  return {
    ...state,
    currentNodeId,
    answers: session.baseAnswers,
    otherText: session.baseOtherText,
    recapEdit: { ...session, target },
    status: "active",
    submitError: null,
  };
}

function restoreRecapEditMenu(state: WmChatState): WmChatState {
  const session = state.recapEdit;
  if (!session) return state;
  return {
    ...state,
    currentNodeId: "recap_edit_menu",
    answers: session.baseAnswers,
    otherText: session.baseOtherText,
    recapEdit: { ...session, target: null },
    status: "active",
    submitError: null,
  };
}

function replaySelection(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionIds: readonly WmChatOptionId[],
): WmChatState | null {
  if (state.currentNodeId !== nodeId || optionIds.length === 0) return null;
  const next = applySelection(state, nodeId, optionIds, { recordPast: true });
  return next === state ? null : next;
}

function rebuildNoQuotePath(
  session: WmChatRecapEditSession,
  correctedAnswers: Readonly<Record<string, WmChatAnswerValue>>,
  correctedOtherText: string,
): WmChatState | null {
  let rebuilt = createWmChatInitialState();

  for (const selection of session.baseHistory) {
    if (selection.nodeId === "need_reason") break;
    const next = replaySelection(rebuilt, selection.nodeId, selection.optionIds);
    if (!next) return null;
    rebuilt = next;
  }

  const reason = firstAnswerOption(correctedAnswers, "need_reason");
  if (!reason || rebuilt.currentNodeId !== "need_reason") return null;
  const afterReason = replaySelection(rebuilt, "need_reason", [reason]);
  if (!afterReason) return null;
  rebuilt = afterReason;

  const detail = firstAnswerOption(correctedAnswers, "need_detail");
  if (!detail || !rebuilt.currentNodeId.startsWith("need_detail_")) return null;
  const detailNode = rebuilt.currentNodeId;
  const afterDetail = replaySelection(rebuilt, detailNode, [detail]);
  if (!afterDetail) return null;
  rebuilt = afterDetail;

  if (rebuilt.currentNodeId === "need_other_text") {
    if (!correctedOtherText) return null;
    const afterOther = continueOther(
      rebuilt,
      "need_other_text",
      correctedOtherText,
    );
    if (afterOther === rebuilt) return null;
    rebuilt = afterOther;
  }

  const priorities = answerOptionIds(correctedAnswers, "priorities");
  const afterPriorities = replaySelection(rebuilt, "priorities", priorities);
  if (!afterPriorities) return null;
  rebuilt = afterPriorities;

  if (rebuilt.currentNodeId === "stakes") {
    const stakes = firstAnswerOption(correctedAnswers, "stakes");
    if (!stakes) return null;
    const afterStakes = replaySelection(rebuilt, "stakes", [stakes]);
    if (!afterStakes) return null;
    rebuilt = afterStakes;
  }

  const trust = firstAnswerOption(correctedAnswers, "trust_concern");
  if (!trust || rebuilt.currentNodeId !== "trust") return null;
  const afterTrust = replaySelection(rebuilt, "trust", [trust]);
  if (!afterTrust || afterTrust.currentNodeId !== "recap") return null;

  return {
    ...afterTrust,
    recapEdit: null,
    leadId: null,
    sessionId: null,
  };
}

function finishRecapEdit(state: WmChatState): WmChatState {
  const session = state.recapEdit;
  if (!session) return state;

  let correctedAnswers: Record<string, WmChatAnswerValue> = {
    ...state.answers,
  };
  const shortConversation = shouldUseShortConversationBudget({
    ...state,
    answers: correctedAnswers,
  });

  if (shortConversation) {
    correctedAnswers = withoutAnswerKeys(correctedAnswers, "stakes");
  } else if (!firstAnswerOption(correctedAnswers, "stakes")) {
    return {
      ...state,
      currentNodeId: "stakes",
      answers: correctedAnswers,
      status: "active",
      submitError: null,
    };
  }

  if (!firstAnswerOption(correctedAnswers, "trust_concern")) {
    return {
      ...state,
      currentNodeId: "trust",
      answers: correctedAnswers,
      status: "active",
      submitError: null,
    };
  }

  return rebuildNoQuotePath(session, correctedAnswers, state.otherText) ?? state;
}

function applyRecapEditSelection(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionIds: readonly WmChatOptionId[],
): WmChatState {
  const session = state.recapEdit;
  if (!session || !session.target || optionIds.length === 0) return state;

  const selected = optionIds[0];
  let answers: Record<string, WmChatAnswerValue> = { ...state.answers };

  if (nodeId === "need_reason") {
    const previousReason = firstAnswerOption(session.baseAnswers, "need_reason");
    const previousDetail = firstAnswerOption(session.baseAnswers, "need_detail");
    const detailNode = detailNodeForReason(selected);
    if (!detailNode) return state;

    answers.need_reason = selected;
    const detailRemainsValid =
      selected === previousReason &&
      Boolean(previousDetail) &&
      optionIsAvailable(state, detailNode, previousDetail!, answers);

    if (detailRemainsValid) {
      answers.need_detail = previousDetail!;
      return finishRecapEdit({
        ...state,
        answers,
        otherText:
          previousDetail === "other_explain" ? session.baseOtherText : "",
      });
    }

    answers = withoutAnswerKeys(answers, "need_detail");
    return {
      ...state,
      currentNodeId: detailNode,
      answers,
      otherText: "",
      status: "active",
      submitError: null,
    };
  }

  if (nodeId.startsWith("need_detail_")) {
    answers.need_detail = selected;
    if (selected === "other_explain") {
      return {
        ...state,
        currentNodeId: "need_other_text",
        answers,
        otherText: "",
        status: "active",
        submitError: null,
      };
    }
    return finishRecapEdit({ ...state, answers, otherText: "" });
  }

  if (nodeId === "priorities") {
    answers.priorities = answerValueForSelection(nodeId, optionIds);
    return finishRecapEdit({ ...state, answers });
  }

  if (nodeId === "stakes") {
    answers.stakes = selected;
    return finishRecapEdit({ ...state, answers });
  }

  if (nodeId === "trust") {
    answers.trust_concern = selected;
    return finishRecapEdit({ ...state, answers });
  }

  return state;
}

function applySelection(
  state: WmChatState,
  nodeId: WmChatNodeId,
  optionIds: readonly WmChatOptionId[],
  options: { recordPast: boolean },
): WmChatState {
  if (state.currentNodeId !== nodeId || optionIds.length === 0) return state;

  const node = resolveWmChatNode(state);
  const available = new Set((node.options ?? []).map((item) => item.id));
  if (optionIds.some((id) => !available.has(id))) return state;
  if (node.kind === "multi") {
    const limit = node.selectionLimit ?? 1;
    if (optionIds.length > limit || new Set(optionIds).size !== optionIds.length) {
      return state;
    }
  } else if (optionIds.length !== 1) {
    return state;
  }

  if (nodeId === "recap" && optionIds[0] === "recap_edit") {
    return openRecapEditor(state);
  }

  if (nodeId === "recap_edit_menu") {
    return beginRecapEditTarget(state, optionIds[0]);
  }

  if (
    state.recapEdit &&
    (nodeId === "need_reason" ||
      nodeId.startsWith("need_detail_") ||
      nodeId === "priorities" ||
      nodeId === "stakes" ||
      nodeId === "trust")
  ) {
    return applyRecapEditSelection(state, nodeId, optionIds);
  }

  const answerKey = answerKeyForNode(nodeId);
  const answers = answerKey
    ? {
        ...state.answers,
        [answerKey]: answerValueForSelection(nodeId, optionIds),
      }
    : state.answers;

  let entryIntent = state.entryIntent;
  let captureMode = state.captureMode;
  const selected = optionIds[0];
  const nextFromSelection = resolveNextWmChatNode(nodeId, selected);
  if (!nextFromSelection) return state;

  const selectedEntryIntent = entryIntentForOption(selected);
  if (selectedEntryIntent) entryIntent = selectedEntryIntent;
  if (
    selected === "entry_have_quote" ||
    selected === "have_upload_first" ||
    selected === "power_route_have_quote" ||
    selected === "not_ready_have_quote"
  ) {
    captureMode = "quote_upload";
  }
  if (
    selected === "entry_need_quote" ||
    selected === "power_route_need_quote" ||
    selected === "not_ready_need_quote"
  ) {
    captureMode = "lead";
  }
  if (selected === "not_ready_protection_kit") {
    captureMode = "protection_kit";
  }

  const visitorText = optionIds
    .map((id) => getWmChatOption(id)?.label ?? id)
    .join(" + ");
  const historyEntry: WmChatHistorySelection = { nodeId, optionIds };
  const past = options.recordPast
    ? [...state.past, toRuntimeSnapshot(state)]
    : state.past;

  let nextNodeId = nextFromSelection;
  const candidateState: WmChatState = {
    ...state,
    answers,
    entryIntent,
    captureMode,
    history: [...state.history, historyEntry],
    transcript: appendExchange(state, visitorText),
    past,
    status: nextStatus(nextFromSelection),
    submitError: null,
    currentNodeId: nextFromSelection,
  };

  if (nodeId === "priorities" && shouldUseShortConversationBudget(candidateState)) {
    nextNodeId = "trust";
  }

  return {
    ...candidateState,
    currentNodeId: nextNodeId,
    status: nextStatus(nextNodeId),
  };
}

function continueOther(
  state: WmChatState,
  nodeId: "need_other_text" | "have_other_text",
  rawValue: string,
): WmChatState {
  if (state.currentNodeId !== nodeId) return state;
  const value = rawValue.trim().replace(/\s+/g, " ").slice(0, 160);
  if (!value || /[\r\n]/.test(rawValue.trim())) return state;

  const nextNodeId: WmChatNodeId =
    nodeId === "need_other_text" ? "priorities" : "first_name";

  if (state.recapEdit && nodeId === "need_other_text") {
    return finishRecapEdit({
      ...state,
      otherText: value,
      status: "active",
      submitError: null,
    });
  }

  return {
    ...state,
    currentNodeId: nextNodeId,
    otherText: value,
    history: [...state.history, { nodeId, optionIds: [] }],
    transcript: appendExchange(state, value),
    past: [...state.past, toRuntimeSnapshot(state)],
    status: "active",
    submitError: null,
  };
}

function continueContact(
  state: WmChatState,
  nodeId: "zip" | "first_name",
  rawValue: string,
): WmChatState {
  if (state.currentNodeId !== nodeId) return state;
  const value = rawValue.trim();
  if (nodeId === "zip" && !/^\d{5}$/.test(value)) return state;
  if (nodeId === "first_name" && (value.length < 2 || value.length > 60)) {
    return state;
  }

  const nextNodeId: WmChatNodeId =
    nodeId === "zip" ? "project_scope" : "phone";
  const answers =
    nodeId === "zip" ? { ...state.answers, zip: value } : state.answers;

  return {
    ...state,
    currentNodeId: nextNodeId,
    answers,
    contact: {
      ...state.contact,
      [nodeId === "zip" ? "zip" : "firstName"]: value,
    },
    history: [...state.history, { nodeId, optionIds: [] }],
    transcript: appendExchange(state, value),
    past: [...state.past, toRuntimeSnapshot(state)],
    status: "active",
    submitError: null,
  };
}

function restoreFromResume(snapshot: WmChatResumeV1): WmChatState {
  let restored = createWmChatInitialState();
  for (const selection of snapshot.history) {
    if (restored.currentNodeId !== selection.nodeId || selection.optionIds.length === 0) {
      break;
    }
    restored = applySelection(restored, selection.nodeId, selection.optionIds, {
      recordPast: true,
    });
  }
  return {
    ...restored,
    submitError: null,
    leadId: null,
    sessionId: null,
  };
}

export function wmChatReducer(
  state: WmChatState,
  action: WmChatAction,
): WmChatState {
  switch (action.type) {
    case "thinking_started":
      if (
        state.isThinking ||
        (state.status !== "active" && state.status !== "not_ready")
      ) {
        return state;
      }
      return { ...state, isThinking: true };
    case "thinking_finished":
      if (!state.isThinking) return state;
      return { ...state, isThinking: false };
    case "select_single":
      return applySelection(state, action.nodeId, [action.optionId], {
        recordPast: true,
      });
    case "continue_multi":
      return applySelection(state, action.nodeId, action.optionIds, {
        recordPast: true,
      });
    case "continue_other":
      if (
        action.nodeId !== "need_other_text" &&
        action.nodeId !== "have_other_text"
      ) {
        return state;
      }
      return continueOther(state, action.nodeId, action.value);
    case "continue_contact":
      return continueContact(state, action.nodeId, action.value);
    case "skip_name":
      if (state.currentNodeId !== "first_name") return state;
      return {
        ...state,
        currentNodeId: "phone",
        history: [...state.history, { nodeId: "first_name", optionIds: [] }],
        transcript: appendExchange(state, "Skip"),
        past: [...state.past, toRuntimeSnapshot(state)],
        status: "active",
        submitError: null,
      };
    case "update_phone":
      if (state.currentNodeId !== "phone") return state;
      return {
        ...state,
        contact: { ...state.contact, phone: action.value },
        submitError: null,
        submitErrorCode: null,
        status: "active",
      };
    case "back": {
      if (state.isThinking) return state;
      if (state.recapEdit && state.currentNodeId !== "recap_edit_menu") {
        return restoreRecapEditMenu(state);
      }
      const previous = state.past[state.past.length - 1];
      if (!previous || state.status === "submitting") return state;
      return restoreRuntime(state, previous, state.past.slice(0, -1));
    }
    case "restart":
      return state.postCaptureNodeId
        ? returnToPostCaptureChoices(state)
        : createWmChatInitialState();
    case "restore":
      return restoreFromResume(action.snapshot);
    case "capture_started":
      if (
        (state.currentNodeId !== "phone" &&
          state.currentNodeId !== "protection_kit_email") ||
        state.status === "submitting" ||
        (state.currentNodeId === "phone" && !state.contact.phone.trim())
      ) {
        return state;
      }
      return {
        ...state,
        status: "submitting",
        submitError: null,
        submitErrorCode: null,
      };
    case "capture_succeeded":
      if (
        (state.currentNodeId !== "phone" &&
          state.currentNodeId !== "protection_kit_email") ||
        state.status !== "submitting" ||
        !isNonZeroUuid(action.leadId) ||
        !isNonZeroUuid(action.sessionId)
      ) {
        return state;
      }
      return {
        ...state,
        ...emptyPostCaptureState(),
        currentNodeId: "success",
        status: "success",
        submitError: null,
        submitErrorCode: null,
        leadId: action.leadId,
        sessionId: action.sessionId,
        postCaptureNodeId: state.captureMode === "lead" ? "choice" : null,
        past: [],
      };
    case "capture_failed":
      if (
        (state.currentNodeId !== "phone" &&
          state.currentNodeId !== "protection_kit_email") ||
        state.status !== "submitting"
      ) {
        return state;
      }
      return {
        ...state,
        status: "error",
        submitError: action.message,
        submitErrorCode: action.code ?? "capture_failed",
        leadId: null,
        sessionId: null,
      };
    case "select_post_capture_action":
      if (
        state.postCaptureNodeId !== "choice" ||
        state.continuationStatus === "submitting"
      ) {
        return state;
      }
      return {
        ...state,
        postCaptureAction: action.postCaptureAction,
        postCaptureNodeId:
          action.postCaptureAction === "schedule_windowman_conversation"
            ? "conversation_time"
            : action.postCaptureAction === "review_quote_when_ready"
              ? "quote_readiness"
              : "address",
        propertyAddressDraft: EMPTY_PROPERTY_ADDRESS,
        propertyAddressDecision: null,
        conversationTimePreference: null,
        quoteReadiness: null,
        callbackPreference: null,
        continuationStatus: "idle",
        continuationError: null,
        continuationSubmissionId: null,
      };
    case "update_property_address":
      if (
        state.postCaptureNodeId !== "address" ||
        state.continuationStatus === "submitting"
      ) {
        return state;
      }
      return {
        ...state,
        propertyAddressDraft: {
          ...state.propertyAddressDraft,
          [action.field]: action.value,
        },
        continuationError: null,
      };
    case "skip_property_address":
      if (state.postCaptureNodeId !== "address") return state;
      return {
        ...state,
        propertyAddressDecision: "skip",
        propertyAddressDraft: EMPTY_PROPERTY_ADDRESS,
        postCaptureNodeId: "review",
        continuationError: null,
      };
    case "continue_property_address":
      if (state.postCaptureNodeId !== "address") return state;
      return {
        ...state,
        propertyAddressDecision: "add",
        postCaptureNodeId: "review",
        continuationError: null,
      };
    case "select_conversation_time":
      if (
        state.postCaptureNodeId !== "conversation_time" ||
        state.postCaptureAction !== "schedule_windowman_conversation"
      ) {
        return state;
      }
      return {
        ...state,
        conversationTimePreference: action.value,
        postCaptureNodeId: "address",
        continuationError: null,
      };
    case "select_quote_readiness":
      if (
        state.postCaptureNodeId !== "quote_readiness" ||
        state.postCaptureAction !== "review_quote_when_ready"
      ) {
        return state;
      }
      return {
        ...state,
        quoteReadiness: action.value,
        postCaptureNodeId:
          action.value === "ready_now"
            ? "scanner_transition"
            : "callback_preference",
        continuationError: null,
      };
    case "select_callback_preference":
      if (
        state.postCaptureNodeId !== "callback_preference" ||
        state.postCaptureAction !== "review_quote_when_ready"
      ) {
        return state;
      }
      return {
        ...state,
        callbackPreference: action.value,
        postCaptureNodeId: "review",
        continuationError: null,
      };
    case "post_capture_back": {
      const hasPersistedContinuation =
        state.postCaptureNodeId === "confirmation" &&
        state.continuationStatus === "success";
      if (
        !state.postCaptureNodeId ||
        state.postCaptureNodeId === "choice" ||
        state.continuationStatus === "submitting" ||
        hasPersistedContinuation
      ) {
        return state;
      }

      let postCaptureNodeId = state.postCaptureNodeId;
      if (state.postCaptureNodeId === "conversation_time") {
        postCaptureNodeId = "choice";
      } else if (state.postCaptureNodeId === "address") {
        postCaptureNodeId =
          state.postCaptureAction === "schedule_windowman_conversation"
            ? "conversation_time"
            : "choice";
      } else if (state.postCaptureNodeId === "quote_readiness") {
        postCaptureNodeId = "choice";
      } else if (state.postCaptureNodeId === "callback_preference") {
        postCaptureNodeId = "quote_readiness";
      } else if (state.postCaptureNodeId === "scanner_transition") {
        postCaptureNodeId = "quote_readiness";
      } else if (state.postCaptureNodeId === "review") {
        postCaptureNodeId =
          state.postCaptureAction === "review_quote_when_ready"
            ? "callback_preference"
            : "address";
      } else if (state.postCaptureNodeId === "confirmation") {
        postCaptureNodeId = "choice";
      }

      return {
        ...state,
        postCaptureNodeId,
        continuationError: null,
        continuationStatus:
          state.continuationStatus === "error"
            ? "idle"
            : state.continuationStatus,
      };
    }
    case "return_to_post_capture_choices":
      return returnToPostCaptureChoices(state);
    case "continuation_started":
      if (
        state.postCaptureNodeId !== "review" ||
        !isNonZeroUuid(state.leadId ?? "") ||
        !isNonZeroUuid(state.sessionId ?? "") ||
        !isNonZeroUuid(action.submissionId) ||
        state.continuationStatus === "submitting"
      ) {
        return state;
      }
      return {
        ...state,
        continuationStatus: "submitting",
        continuationError: null,
        continuationSubmissionId: action.submissionId,
      };
    case "continuation_succeeded":
      if (
        state.postCaptureNodeId !== "review" ||
        state.continuationStatus !== "submitting" ||
        state.continuationSubmissionId !== action.submissionId ||
        state.leadId !== action.leadId ||
        state.sessionId !== action.sessionId ||
        !isNonZeroUuid(action.leadId) ||
        !isNonZeroUuid(action.sessionId)
      ) {
        return state;
      }
      return {
        ...state,
        postCaptureNodeId: "confirmation",
        continuationStatus: "success",
        continuationError: null,
      };
    case "continuation_failed":
      if (
        state.postCaptureNodeId !== "review" ||
        state.continuationStatus !== "submitting" ||
        state.continuationSubmissionId !== action.submissionId
      ) {
        return state;
      }
      return {
        ...state,
        continuationStatus: "error",
        continuationError: action.message,
      };
    default:
      return state;
  }
}

export function buildWmChatIntake(state: WmChatState): WmChatIntakeV1 | null {
  if (!state.entryIntent || state.recapEdit) return null;

  const answerPath = state.history.flatMap((entry) =>
    entry.optionIds.map((optionId) => `${entry.nodeId}:${optionId}`),
  );

  const answers: Record<string, WmChatAnswerValue> = {};
  for (const [key, value] of Object.entries(state.answers)) {
    if (
      key === "phone" ||
      key === "firstName" ||
      key === "email" ||
      key === "consent"
    ) {
      continue;
    }
    answers[key] = value;
  }

  return {
    schema_version: WM_CHAT_SCHEMA_VERSION,
    intake_version: WM_CHAT_INTAKE_VERSION,
    entry_intent: state.entryIntent,
    answer_path: answerPath,
    answers,
    continuation:
      state.captureMode === "protection_kit" ? "email_only" : "sms_then_voice",
    ...(state.otherText ? { other_text: state.otherText } : {}),
  };
}
