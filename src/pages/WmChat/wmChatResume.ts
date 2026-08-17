import { resolveWmChatNode } from "./wmChatContent";
import { createWmChatInitialState, wmChatReducer } from "./wmChatReducer";
import {
  WM_CHAT_RESUME_VERSION,
  isWmChatNodeId,
  isWmChatOptionId,
  type WmChatEntryIntent,
  type WmChatHistorySelection,
  type WmChatNodeId,
  type WmChatResumeV1,
  type WmChatState,
} from "./wmChatTypes";

export const WM_CHAT_RESUME_STORAGE_KEY = "wm_wmchat_resume_v1";
export const WM_CHAT_RESUME_TTL_MS = 24 * 60 * 60 * 1000;

type WmChatResumeStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

const MAX_RESUME_SELECTIONS = 64;

const TYPED_INPUT_NODE_IDS = new Set<WmChatNodeId>([
  "need_other_text",
  "have_other_text",
  "zip",
  "first_name",
  "phone",
  "protection_kit_email",
]);

const ROOT_KEYS = new Set([
  "schemaVersion",
  "savedAtMs",
  "entryIntent",
  "currentNodeId",
  "history",
]);

const HISTORY_KEYS = new Set(["nodeId", "optionIds"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: ReadonlySet<string>,
): boolean {
  return Object.keys(value).every((key) => allowedKeys.has(key));
}

function isEntryIntent(value: unknown): value is WmChatEntryIntent {
  return (
    value === "have_quote" ||
    value === "need_quote" ||
    value === "learn_powers"
  );
}

function getBrowserStorage(): WmChatResumeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function replaySelections(
  history: readonly WmChatHistorySelection[],
): WmChatState | null {
  let state = createWmChatInitialState();

  for (const selection of history) {
    if (state.currentNodeId !== selection.nodeId) return null;

    const node = resolveWmChatNode(state);
    const available = new Set((node.options ?? []).map((option) => option.id));
    if (
      selection.optionIds.length === 0 ||
      selection.optionIds.some((optionId) => !available.has(optionId)) ||
      new Set(selection.optionIds).size !== selection.optionIds.length
    ) {
      return null;
    }

    const beforeHistoryLength = state.history.length;
    if (node.kind === "multi") {
      if (selection.optionIds.length > (node.selectionLimit ?? 1)) return null;
      state = wmChatReducer(state, {
        type: "continue_multi",
        nodeId: selection.nodeId,
        optionIds: selection.optionIds,
      });
    } else {
      if (selection.optionIds.length !== 1) return null;
      state = wmChatReducer(state, {
        type: "select_single",
        nodeId: selection.nodeId,
        optionId: selection.optionIds[0],
      });
    }

    if (state.history.length !== beforeHistoryLength + 1) return null;
  }

  return state;
}

function sanitizeHistory(value: unknown): WmChatHistorySelection[] | null {
  if (!Array.isArray(value) || value.length > MAX_RESUME_SELECTIONS) {
    return null;
  }

  const history: WmChatHistorySelection[] = [];
  for (const item of value) {
    if (!isRecord(item) || !hasOnlyKeys(item, HISTORY_KEYS)) return null;
    if (!isWmChatNodeId(item.nodeId) || !Array.isArray(item.optionIds)) {
      return null;
    }
    if (
      item.optionIds.length === 0 ||
      item.optionIds.some((optionId) => !isWmChatOptionId(optionId))
    ) {
      return null;
    }

    history.push({
      nodeId: item.nodeId,
      optionIds: [...item.optionIds],
    });
  }

  return history;
}

function parseWmChatResume(
  value: unknown,
  nowMs: number,
): WmChatResumeV1 | null {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOT_KEYS)) return null;
  if (value.schemaVersion !== WM_CHAT_RESUME_VERSION) return null;
  if (
    typeof value.savedAtMs !== "number" ||
    !Number.isSafeInteger(value.savedAtMs) ||
    value.savedAtMs > nowMs ||
    nowMs - value.savedAtMs > WM_CHAT_RESUME_TTL_MS
  ) {
    return null;
  }
  if (
    value.entryIntent !== null &&
    !isEntryIntent(value.entryIntent)
  ) {
    return null;
  }
  if (
    !isWmChatNodeId(value.currentNodeId) ||
    value.currentNodeId === "success"
  ) {
    return null;
  }

  const history = sanitizeHistory(value.history);
  if (!history) return null;

  const replayed = replaySelections(history);
  if (
    !replayed ||
    replayed.currentNodeId !== value.currentNodeId ||
    replayed.entryIntent !== value.entryIntent
  ) {
    return null;
  }

  if (
    value.currentNodeId === "entry" &&
    value.entryIntent === null &&
    history.length === 0
  ) {
    return null;
  }

  return {
    schemaVersion: WM_CHAT_RESUME_VERSION,
    savedAtMs: value.savedAtMs,
    entryIntent: value.entryIntent,
    currentNodeId: value.currentNodeId,
    history,
  };
}

function safeProgressFromHistory(
  sourceHistory: readonly WmChatHistorySelection[],
  sourceCurrentNodeId: WmChatNodeId,
): {
  history: readonly WmChatHistorySelection[];
  currentNodeId: WmChatNodeId;
} | null {
  const history: WmChatHistorySelection[] = [];

  for (const selection of sourceHistory) {
    if (TYPED_INPUT_NODE_IDS.has(selection.nodeId)) {
      return { history, currentNodeId: selection.nodeId };
    }
    if (selection.optionIds.length === 0) return null;
    history.push({
      nodeId: selection.nodeId,
      optionIds: [...selection.optionIds],
    });
  }

  if (sourceCurrentNodeId === "success") return null;
  return { history, currentNodeId: sourceCurrentNodeId };
}

function safeProgressFromState(state: WmChatState): {
  history: readonly WmChatHistorySelection[];
  currentNodeId: WmChatNodeId;
} | null {
  // A recap correction is an atomic in-memory draft. Resume from the last
  // coherent path, applying the same typed-input privacy boundary as usual.
  if (state.recapEdit) {
    return safeProgressFromHistory(state.recapEdit.baseHistory, "recap");
  }

  return safeProgressFromHistory(state.history, state.currentNodeId);
}

/**
 * Produces the strict, non-PII resume record. Typed answers are a hard boundary:
 * once one has been entered, resume rewinds to that first typed-input node.
 */
export function createWmChatResumeSnapshot(
  state: WmChatState,
  nowMs = Date.now(),
): WmChatResumeV1 | null {
  if (
    !Number.isSafeInteger(nowMs) ||
    state.status === "success" ||
    state.postCaptureNodeId !== null
  ) {
    return null;
  }

  const progress = safeProgressFromState(state);
  if (!progress) return null;

  const replayed = replaySelections(progress.history);
  if (
    !replayed ||
    replayed.currentNodeId !== progress.currentNodeId ||
    replayed.entryIntent !== state.entryIntent ||
    (progress.currentNodeId === "entry" && progress.history.length === 0)
  ) {
    return null;
  }

  return {
    schemaVersion: WM_CHAT_RESUME_VERSION,
    savedAtMs: nowMs,
    entryIntent: replayed.entryIntent,
    currentNodeId: progress.currentNodeId,
    history: progress.history,
  };
}

export function saveWmChatResume(
  state: WmChatState,
  storage: WmChatResumeStorage | null = getBrowserStorage(),
  nowMs = Date.now(),
): WmChatResumeV1 | null {
  const snapshot = createWmChatResumeSnapshot(state, nowMs);

  try {
    if (!storage) return null;
    if (!snapshot) {
      storage.removeItem(WM_CHAT_RESUME_STORAGE_KEY);
      return null;
    }
    storage.setItem(WM_CHAT_RESUME_STORAGE_KEY, JSON.stringify(snapshot));
    return snapshot;
  } catch {
    return null;
  }
}

export function loadWmChatResume(
  storage: WmChatResumeStorage | null = getBrowserStorage(),
  nowMs = Date.now(),
): WmChatResumeV1 | null {
  try {
    if (!storage) return null;
    const raw = storage.getItem(WM_CHAT_RESUME_STORAGE_KEY);
    if (!raw) return null;

    const parsed = parseWmChatResume(JSON.parse(raw), nowMs);
    if (!parsed) storage.removeItem(WM_CHAT_RESUME_STORAGE_KEY);
    return parsed;
  } catch {
    try {
      storage?.removeItem(WM_CHAT_RESUME_STORAGE_KEY);
    } catch {
      // Storage may be unavailable or blocked; resume is optional.
    }
    return null;
  }
}

export function clearWmChatResume(
  storage: WmChatResumeStorage | null = getBrowserStorage(),
): void {
  try {
    storage?.removeItem(WM_CHAT_RESUME_STORAGE_KEY);
  } catch {
    // Storage may be unavailable or blocked; resume is optional.
  }
}
