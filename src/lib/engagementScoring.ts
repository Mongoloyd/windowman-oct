import { trackGtmEvent } from "@/lib/trackConversion";
import { getLeadId } from "@/lib/useLeadId";
import { getUtmPayload } from "@/lib/useUtmCapture";

const STORAGE_KEY = "wm_engagement_state_v1";
const MAX_DEDUPE_KEYS = 80;
const MAX_EVENT_HISTORY = 40;

export const HIGH_INTENT_THRESHOLD = 25;
export const QUALIFIED_PROSPECT_THRESHOLD = 50;

export const ENGAGEMENT_SCORES = {
  readiness_select: 20,
  readiness_select_has_estimate: 10,
  quote_upload_start: 30,
  identity_save: 25,
  scroll_depth_50: 5,
  scroll_depth_90: 10,
  time_on_page_30s: 5,
  time_on_page_120s: 10,
} as const;

export type EngagementAction = keyof typeof ENGAGEMENT_SCORES;

export type EngagementEvent = {
  action: EngagementAction;
  delta: number;
  dedupeKey: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
};

export type EngagementState = {
  score: number;
  dedupeKeys: string[];
  highIntentFired: boolean;
  qualifiedFired: boolean;
  events: EngagementEvent[];
  createdAt: string;
  updatedAt: string;
};

type TrackEngagementOptions = {
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  bonusActions?: EngagementAction[];
};

type TrackEngagementResult = {
  applied: boolean;
  score: number;
  delta: number;
  reason?: "duplicate" | "non_browser";
};

function timestamp(): string {
  return new Date().toISOString();
}

function createInitialState(): EngagementState {
  const now = timestamp();

  return {
    score: 0,
    dedupeKeys: [],
    highIntentFired: false,
    qualifiedFired: false,
    events: [],
    createdAt: now,
    updatedAt: now,
  };
}

function normalizeState(value: unknown): EngagementState {
  const base = createInitialState();

  if (!value || typeof value !== "object") {
    return base;
  }

  const parsed = value as Partial<EngagementState>;

  return {
    score: typeof parsed.score === "number" ? parsed.score : 0,
    dedupeKeys: Array.isArray(parsed.dedupeKeys)
      ? parsed.dedupeKeys.filter((key): key is string => typeof key === "string").slice(-MAX_DEDUPE_KEYS)
      : [],
    highIntentFired: Boolean(parsed.highIntentFired),
    qualifiedFired: Boolean(parsed.qualifiedFired),
    events: Array.isArray(parsed.events)
      ? parsed.events
          .filter((event): event is EngagementEvent => {
            return (
              Boolean(event) &&
              typeof event === "object" &&
              typeof (event as EngagementEvent).action === "string" &&
              typeof (event as EngagementEvent).delta === "number" &&
              typeof (event as EngagementEvent).dedupeKey === "string" &&
              typeof (event as EngagementEvent).timestamp === "string"
            );
          })
          .slice(-MAX_EVENT_HISTORY)
      : [],
    createdAt: typeof parsed.createdAt === "string" ? parsed.createdAt : base.createdAt,
    updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : base.updatedAt,
  };
}

function readState(): EngagementState {
  if (typeof window === "undefined") {
    return createInitialState();
  }

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return createInitialState();
    }

    return normalizeState(JSON.parse(raw));
  } catch {
    return createInitialState();
  }
}

function writeState(state: EngagementState): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Engagement scoring must never block the funnel.
  }
}

function routeContext(): Record<string, unknown> {
  if (typeof window === "undefined") {
    return {
      route: "/",
      referrer: null,
    };
  }

  return {
    route: window.location.pathname,
    referrer: typeof document !== "undefined" && document.referrer ? document.referrer : null,
  };
}

function basePayload(state: EngagementState): Record<string, unknown> {
  return {
    lead_id: getLeadId(),
    ...routeContext(),
    ...getUtmPayload(),
    engagement_score: state.score,
    engagement_events_count: state.events.length,
  };
}

function pushEngagementEvent(
  eventName: "wm_engagement_score" | "wm_high_intent_user" | "wm_qualified_prospect",
  state: EngagementState,
  extra: Record<string, unknown> = {},
): void {
  trackGtmEvent(eventName, {
    ...basePayload(state),
    ...extra,
  });
}

export function getEngagementScore(): number {
  return readState().score;
}

export function getEngagementState(): EngagementState {
  return readState();
}

export function resetEngagement(): void {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export function trackEngagement(
  action: EngagementAction,
  options: TrackEngagementOptions = {},
): TrackEngagementResult {
  if (typeof window === "undefined") {
    return {
      applied: false,
      score: 0,
      delta: 0,
      reason: "non_browser",
    };
  }

  const state = readState();
  const dedupeKey = options.dedupeKey ?? action;

  if (state.dedupeKeys.includes(dedupeKey)) {
    return {
      applied: false,
      score: state.score,
      delta: 0,
      reason: "duplicate",
    };
  }

  const bonusDelta = (options.bonusActions ?? []).reduce((sum, bonusAction) => {
    return sum + ENGAGEMENT_SCORES[bonusAction];
  }, 0);

  const delta = ENGAGEMENT_SCORES[action] + bonusDelta;
  const now = timestamp();

  const nextEvent: EngagementEvent = {
    action,
    delta,
    dedupeKey,
    timestamp: now,
    metadata: options.metadata,
  };

  const nextState: EngagementState = {
    ...state,
    score: state.score + delta,
    dedupeKeys: [...state.dedupeKeys, dedupeKey].slice(-MAX_DEDUPE_KEYS),
    events: [...state.events, nextEvent].slice(-MAX_EVENT_HISTORY),
    updatedAt: now,
  };

  writeState(nextState);

  pushEngagementEvent("wm_engagement_score", nextState, {
    engagement_action: action,
    engagement_delta: delta,
    engagement_dedupe_key: dedupeKey,
    ...options.metadata,
  });

  if (!nextState.highIntentFired && nextState.score >= HIGH_INTENT_THRESHOLD) {
    nextState.highIntentFired = true;
    writeState(nextState);

    pushEngagementEvent("wm_high_intent_user", nextState, {
      engagement_threshold: HIGH_INTENT_THRESHOLD,
      engagement_trigger_action: action,
      ...options.metadata,
    });
  }

  if (!nextState.qualifiedFired && nextState.score >= QUALIFIED_PROSPECT_THRESHOLD) {
    nextState.qualifiedFired = true;
    writeState(nextState);

    pushEngagementEvent("wm_qualified_prospect", nextState, {
      engagement_threshold: QUALIFIED_PROSPECT_THRESHOLD,
      engagement_trigger_action: action,
      ...options.metadata,
    });
  }

  return {
    applied: true,
    score: nextState.score,
    delta,
  };
}
