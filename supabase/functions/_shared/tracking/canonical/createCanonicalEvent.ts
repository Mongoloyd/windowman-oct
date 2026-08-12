import {
  mergeAttribution,
  mergeQueryParams,
} from "../../attributionMerge.ts";
import { WM_QUOTE_TRUST_MIN_FOR_DISPATCH } from "./constants.ts";
import {
  isDenoNextdoorCapiEnabled,
  resolveShouldSendNextdoor,
} from "./nextdoorDispatchEligibility.ts";
import {
  evaluateTikTokDispatchEligibility,
} from "./tiktokDispatchEligibility.ts";
import {
  computeIdentityQuality,
  normalizeAndHashIdentity,
} from "./identity.ts";
import { evaluateQuoteTrust } from "./trustScore.ts";
import { buildOptimizationPayload } from "./valueModel.ts";
import type {
  CreateCanonicalEventInput,
  WMCanonicalEvent,
  WMDispatchStatus,
  WMPlatformName,
} from "./types.ts";

interface DBLike {
  from(table: string): {
    insert(
      payload: Record<string, unknown> | Record<string, unknown>[],
    ): Promise<{ data?: unknown; error?: { message?: string } | null }>;
    upsert(
      payload: Record<string, unknown> | Record<string, unknown>[],
      options?: { onConflict?: string; ignoreDuplicates?: boolean },
    ): Promise<{ data?: unknown; error?: { message?: string } | null }>;
    select(columns: string): {
      eq(column: string, value: string): {
        maybeSingle(): Promise<
          {
            data?: Record<string, unknown> | null;
            error?: { message?: string } | null;
          }
        >;
      };
    };
  };
}

function isDuplicateEventIdInsertError(
  error: { message?: string } | null | undefined,
): boolean {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    message.includes("duplicate key") ||
    message.includes("unique constraint") ||
    message.includes("wm_event_log_event_id") ||
    (message.includes("event_id") && message.includes("already exists"))
  );
}

interface CreateCanonicalEventDeps {
  db: DBLike;
  now?: () => Date;
  createId?: () => string;
}

interface CreateCanonicalEventResult {
  canonicalEvent: WMCanonicalEvent;
  eventLogId: string | null;
  dispatchPlatforms: WMPlatformName[];
}

// Both names are included so legacy `quote_upload_completed` events still receive
// trust/anomaly enrichment alongside the canonical `quote_uploaded` name.
const QUOTE_EVENTS = new Set([
  "quote_validation_passed",
  "quote_upload_completed",
  "quote_uploaded",
]);

function sanitizeEventIdSegment(value: unknown): string {
  if (value === null || value === undefined) {
    return "unknown";
  }

  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function getInputStringValue(
  input: CreateCanonicalEventInput,
  key: string,
): string | null {
  const value = (input as unknown as Record<string, unknown>)[key];
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getDefaultEventTimestampBucket(
  input: CreateCanonicalEventInput,
  now: Date,
): string {
  const timestampKeys = [
    "eventTimestamp",
    "occurredAt",
    "timestamp",
    "createdAt",
  ];

  for (const key of timestampKeys) {
    const rawValue = getInputStringValue(input, key);
    if (!rawValue) {
      continue;
    }

    const parsed = Date.parse(rawValue);
    if (!Number.isNaN(parsed)) {
      return new Date(Math.floor(parsed / 60000) * 60000).toISOString();
    }
  }

  return new Date(Math.floor(now.getTime() / 60000) * 60000).toISOString();
}

function defaultCreateId(input: CreateCanonicalEventInput, now: Date): string {
  const eventName = sanitizeEventIdSegment(
    (input as unknown as Record<string, unknown>).eventName,
  );
  const entityKeys = ["leadId", "scanSessionId", "analysisId"];
  const entitySegments = entityKeys
    .map((key) => {
      const value = getInputStringValue(input, key);
      return value ? `${key}-${sanitizeEventIdSegment(value)}` : null;
    })
    .filter((value): value is string => value !== null);
  const entityPart = entitySegments.length > 0
    ? entitySegments.join("__")
    : "no-entity";
  const bucket = sanitizeEventIdSegment(
    getDefaultEventTimestampBucket(input, now),
  );

  return `wmc_${eventName}_${entityPart}_${bucket}`;
}

function resolveDispatchStatus(shouldDispatch: boolean): WMDispatchStatus {
  return shouldDispatch ? "pending" : "not_applicable";
}

interface DispatchRowPlan {
  platform: WMPlatformName;
  dispatch_status: "pending" | "suppressed";
  error_message?: string | null;
}

function applyDispatchPolicy(args: {
  policy: CreateCanonicalEventInput["dispatchPolicy"];
  identityEligibleMeta: boolean;
  quoteSafe: boolean;
  shouldSendNextdoor: boolean;
}): {
  shouldSendMeta: boolean;
  shouldSendGoogle: boolean;
  shouldSendNextdoor: boolean;
  allowTikTok: boolean;
  approvedForAds: boolean;
  dispatchStatus: WMDispatchStatus;
  forcedMetaRow: DispatchRowPlan | null;
} {
  const identityEligibleMeta = args.identityEligibleMeta;
  const shouldSendGoogleDefault = args.quoteSafe;
  const shouldSendNextdoorDefault = args.shouldSendNextdoor;

  if (!args.policy) {
    return {
      shouldSendMeta: identityEligibleMeta,
      shouldSendGoogle: shouldSendGoogleDefault,
      shouldSendNextdoor: shouldSendNextdoorDefault,
      allowTikTok: true,
      approvedForAds: identityEligibleMeta,
      dispatchStatus: resolveDispatchStatus(
        identityEligibleMeta || shouldSendGoogleDefault,
      ),
      forcedMetaRow: null,
    };
  }

  const allowed = args.policy.allowedPlatforms;
  const metaAllowed = !allowed || allowed.includes("meta");
  const googleAllowed = !allowed || allowed.includes("google_ads");
  const nextdoorAllowed = !allowed || allowed.includes("nextdoor");
  const tiktokAllowed = !allowed || allowed.includes("tiktok");

  const shouldSendGoogle = shouldSendGoogleDefault && googleAllowed;
  const shouldSendNextdoor = shouldSendNextdoorDefault && nextdoorAllowed;

  let shouldSendMeta = identityEligibleMeta && metaAllowed;
  let approvedForAds = shouldSendMeta;
  let forcedMetaRow: DispatchRowPlan | null = null;

  if (metaAllowed && args.policy.metaConsent !== undefined) {
    if (args.policy.metaConsent === "granted" && identityEligibleMeta) {
      shouldSendMeta = true;
      approvedForAds = true;
    } else {
      shouldSendMeta = false;
      approvedForAds = false;
      const reason = args.policy.metaSuppressionReason ??
        (args.policy.metaConsent === "denied"
          ? "consent_declined"
          : "consent_missing");
      forcedMetaRow = {
        platform: "meta",
        dispatch_status: "suppressed",
        error_message: reason,
      };
    }
  }

  const onlyMeta = !!allowed && allowed.length === 1 && allowed[0] === "meta";
  let dispatchStatus: WMDispatchStatus;
  if (onlyMeta) {
    dispatchStatus = shouldSendMeta
      ? "pending"
      : forcedMetaRow
      ? "suppressed"
      : "not_applicable";
  } else {
    dispatchStatus = resolveDispatchStatus(shouldSendMeta || shouldSendGoogle);
  }

  return {
    shouldSendMeta,
    shouldSendGoogle,
    shouldSendNextdoor,
    allowTikTok: tiktokAllowed,
    approvedForAds,
    dispatchStatus,
    forcedMetaRow,
  };
}

function normalizeClientSlug(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.toLowerCase() : null;
}

async function resolveClientSlug(
  input: CreateCanonicalEventInput,
  deps: CreateCanonicalEventDeps,
): Promise<string | null> {
  const trustedSlug = normalizeClientSlug(input.clientSlug);
  if (trustedSlug) {
    return trustedSlug;
  }

  const leadId = input.leadId ?? null;
  if (leadId) {
    const leadResult = await deps.db
      .from("leads")
      .select("client_slug")
      .eq("id", leadId)
      .maybeSingle();
    if (!leadResult.error) {
      const slug = normalizeClientSlug(leadResult.data?.client_slug);
      if (slug) {
        return slug;
      }
    }
  }

  const scanSessionId = input.scanSessionId ??
    input.payload.journey.scanSessionId ??
    null;
  if (scanSessionId) {
    const sessionResult = await deps.db
      .from("scan_sessions")
      .select("client_slug")
      .eq("id", scanSessionId)
      .maybeSingle();
    if (!sessionResult.error) {
      const slug = normalizeClientSlug(sessionResult.data?.client_slug);
      if (slug) {
        return slug;
      }
    }
  }

  const analysisId = input.analysisId ?? input.payload.quote?.analysisId ?? null;
  if (analysisId) {
    const analysisResult = await deps.db
      .from("analyses")
      .select("client_slug")
      .eq("id", analysisId)
      .maybeSingle();
    if (!analysisResult.error) {
      const slug = normalizeClientSlug(analysisResult.data?.client_slug);
      if (slug) {
        return slug;
      }
    }
  }

  return null;
}

interface ResolvedAttributionSnapshot {
  attribution: Record<string, unknown>;
  queryParams: Record<string, string | string[]>;
}

async function resolveAttributionSnapshot(
  input: CreateCanonicalEventInput,
  deps: CreateCanonicalEventDeps,
): Promise<ResolvedAttributionSnapshot> {
  let attribution: Record<string, unknown> = {};
  let queryParams: Record<string, string | string[]> = {};

  const leadId = input.leadId ?? null;
  if (leadId) {
    const leadResult = await deps.db
      .from("leads")
      .select("attribution, query_params")
      .eq("id", leadId)
      .maybeSingle();
    if (!leadResult.error && leadResult.data) {
      attribution = mergeAttribution(attribution, leadResult.data.attribution);
      queryParams = mergeQueryParams(
        queryParams,
        leadResult.data.query_params,
      );
    }
  }

  const scanSessionId = input.scanSessionId ??
    input.payload.journey.scanSessionId ??
    null;
  if (scanSessionId) {
    const sessionResult = await deps.db
      .from("scan_sessions")
      .select("attribution, query_params")
      .eq("id", scanSessionId)
      .maybeSingle();
    if (!sessionResult.error && sessionResult.data) {
      attribution = mergeAttribution(
        attribution,
        sessionResult.data.attribution,
      );
      queryParams = mergeQueryParams(
        queryParams,
        sessionResult.data.query_params,
      );
    }
  }

  return { attribution, queryParams };
}

export async function createCanonicalEvent(
  input: CreateCanonicalEventInput,
  deps: CreateCanonicalEventDeps,
): Promise<CreateCanonicalEventResult> {
  const now = deps.now?.() ?? new Date();
  const eventId = input.eventId ?? deps.createId?.() ??
    defaultCreateId(input, now);
  const eventTimestamp = input.eventTimestamp ?? now.toISOString();

  const normalizedIdentity = await normalizeAndHashIdentity(
    input.payload.identity,
  );
  const identityQuality = computeIdentityQuality(normalizedIdentity);

  const basePayload = {
    ...input.payload,
    identity: {
      ...input.payload.identity,
      ...normalizedIdentity,
    },
  };

  let analytics = input.payload.analytics;

  if (input.payload.quote && input.payload.analytics) {
    const trust = evaluateQuoteTrust({
      documentType: input.payload.quote.documentType,
      isQuoteDocument: input.payload.quote.isQuoteDocument,
      duplicateSuspected: input.payload.quote.duplicateSuspected,
      impossibleValuesDetected: input.payload.quote.impossibleValuesDetected,
      ocrConfidence: input.payload.analytics.ocrConfidence,
      completeness: input.payload.analytics.completeness,
      mathConsistency: input.payload.analytics.mathConsistency,
      cohortFit: input.payload.analytics.cohortFit,
      scopeConsistency: input.payload.analytics.scopeConsistency,
      documentValidity: input.payload.analytics.documentValidity,
      identityStrength: input.payload.analytics.identityStrength,
      anomalyInput: {
        quoteAmount: input.payload.quote.quoteAmount,
        pricePerOpening: input.payload.quote.pricePerOpening,
        depositPercent: input.payload.quote.depositPercent,
        impossibleValuesDetected: input.payload.quote.impossibleValuesDetected,
      },
    });

    analytics = {
      ...input.payload.analytics,
      trustScore: trust.trustScore,
      anomalyScore: trust.anomalyScore,
      anomalyStatus: trust.anomalyStatus,
      reasons: trust.reasons,
    };
  }

  const trustScore = analytics?.trustScore ?? 0;
  const anomalyStatus = analytics?.anomalyStatus ?? "safe";
  const isQuoteEvent = QUOTE_EVENTS.has(input.eventName);
  const quoteSafe = !isQuoteEvent ||
    (analytics
      ? (anomalyStatus === "safe" &&
        trustScore >= WM_QUOTE_TRUST_MIN_FOR_DISPATCH)
      : true);

  const identityEligibleMeta = identityQuality !== "low" &&
    identityQuality !== "unknown" && quoteSafe;
  const nextdoorEligible = resolveShouldSendNextdoor({
    envEnabled: isDenoNextdoorCapiEnabled(),
    eventName: input.eventName,
    identityQuality,
    quoteSafe,
    payload: basePayload,
  });
  const policyPlan = applyDispatchPolicy({
    policy: input.dispatchPolicy,
    identityEligibleMeta,
    quoteSafe,
    shouldSendNextdoor: nextdoorEligible,
  });
  const shouldSendMeta = policyPlan.shouldSendMeta;
  const shouldSendGoogle = policyPlan.shouldSendGoogle;
  const shouldSendNextdoor = policyPlan.shouldSendNextdoor;

  const optimization = buildOptimizationPayload({
    eventName: input.eventName,
    marginUsd: input.marginUsd,
    approvedForAds: policyPlan.approvedForAds,
    approvedForIndex: shouldSendGoogle,
    manualReviewRequired: anomalyStatus !== "safe",
  });

  const dispatchStatus = policyPlan.dispatchStatus;

  const canonicalEvent: WMCanonicalEvent = {
    eventId,
    eventName: input.eventName,
    eventTimestamp,
    schemaVersion: input.schemaVersion ?? "1.0.0",
    modelVersion: input.modelVersion,
    rubricVersion: input.rubricVersion,
    identityQuality,
    shouldSendMeta,
    shouldSendGoogle,
    shouldSendNextdoor,
    dispatchStatus,
    payload: {
      ...basePayload,
      analytics,
      optimization,
    },
    rawPayload: input.rawPayload,
  };

  const analysisId = input.analysisId ?? input.payload.quote?.analysisId ??
    null;
  const resolvedClientSlug = await resolveClientSlug(input, deps);
  const resolvedAttribution = await resolveAttributionSnapshot(input, deps);
  const wmEventInsert = {
    event_id: canonicalEvent.eventId,
    event_name: canonicalEvent.eventName,
    event_timestamp: canonicalEvent.eventTimestamp,
    lead_id: input.leadId ?? normalizedIdentity.leadId ?? null,
    account_user_id: input.userId ?? normalizedIdentity.userId ?? null,
    scan_session_id: input.scanSessionId ??
      input.payload.journey.scanSessionId ?? null,
    analysis_id: analysisId,
    quote_file_id: input.quoteFileId ?? input.payload.quote?.quoteFileId ??
      null,
    client_slug: resolvedClientSlug,
    attribution: resolvedAttribution.attribution,
    query_params: resolvedAttribution.queryParams,
    schema_version: canonicalEvent.schemaVersion,
    model_version: canonicalEvent.modelVersion ?? null,
    rubric_version: canonicalEvent.rubricVersion ?? null,
    trust_score: canonicalEvent.payload.analytics?.trustScore ?? null,
    anomaly_score: canonicalEvent.payload.analytics?.anomalyScore ?? null,
    anomaly_status: canonicalEvent.payload.analytics?.anomalyStatus ?? null,
    manual_review_required:
      canonicalEvent.payload.optimization?.manualReviewRequired ?? false,
    approved_for_index: canonicalEvent.payload.optimization?.approvedForIndex ??
      false,
    approved_for_ads: canonicalEvent.payload.optimization?.approvedForAds ??
      false,
    optimization_value_usd: canonicalEvent.payload.optimization?.valueUsd ??
      null,
    optimization_priority: canonicalEvent.payload.optimization?.priority ??
      null,
    dispatch_status: canonicalEvent.dispatchStatus,
    payload: canonicalEvent.payload as unknown as Record<string, unknown>,
    raw_payload: canonicalEvent.rawPayload ?? {},
  };

  const eventInsertResult = await deps.db.from("wm_event_log").insert(
    wmEventInsert,
  );
  const shouldRecoverFromDuplicateInsert = isDuplicateEventIdInsertError(
    eventInsertResult.error,
  );
  if (eventInsertResult.error && !shouldRecoverFromDuplicateInsert) {
    throw new Error(
      `wm_event_log insert failed: ${
        eventInsertResult.error.message ?? "unknown"
      }`,
    );
  }

  let eventLogId: string | null = null;
  const lookupResult = await deps.db
    .from("wm_event_log")
    .select("id")
    .eq("event_id", canonicalEvent.eventId)
    .maybeSingle();
  if (lookupResult.error) {
    throw new Error(
      `wm_event_log lookup failed: ${lookupResult.error.message ?? "unknown"}`,
    );
  }
  if (lookupResult.data && typeof lookupResult.data.id === "string") {
    eventLogId = lookupResult.data.id;
  }
  if (shouldRecoverFromDuplicateInsert && !eventLogId) {
    throw new Error(
      `wm_event_log duplicate insert recovery failed for event_id ${canonicalEvent.eventId}`,
    );
  }

  if (analysisId && canonicalEvent.payload.quote) {
    const quoteUpsert = await deps.db.from("wm_quote_facts").upsert(
      {
        analysis_id: analysisId,
        lead_id: wmEventInsert.lead_id,
        scan_session_id: wmEventInsert.scan_session_id,
        quote_file_id: wmEventInsert.quote_file_id,
        document_type: canonicalEvent.payload.quote.documentType ?? null,
        is_quote_document: canonicalEvent.payload.quote.isQuoteDocument,
        ocr_confidence: canonicalEvent.payload.analytics?.ocrConfidence ?? null,
        completeness_score: canonicalEvent.payload.analytics?.completeness ??
          null,
        math_consistency_score:
          canonicalEvent.payload.analytics?.mathConsistency ?? null,
        cohort_fit_score: canonicalEvent.payload.analytics?.cohortFit ?? null,
        scope_consistency_score:
          canonicalEvent.payload.analytics?.scopeConsistency ?? null,
        document_validity_score:
          canonicalEvent.payload.analytics?.documentValidity ?? null,
        identity_strength_score:
          canonicalEvent.payload.analytics?.identityStrength ?? null,
        trust_score: canonicalEvent.payload.analytics?.trustScore ?? 0,
        anomaly_score: canonicalEvent.payload.analytics?.anomalyScore ?? 0,
        anomaly_status: canonicalEvent.payload.analytics?.anomalyStatus ??
          "safe",
        duplicate_suspected: canonicalEvent.payload.quote.duplicateSuspected ??
          false,
        impossible_values_detected:
          canonicalEvent.payload.quote.impossibleValuesDetected ?? false,
        manual_review_required:
          canonicalEvent.payload.optimization?.manualReviewRequired ?? false,
        approved_for_index:
          canonicalEvent.payload.optimization?.approvedForIndex ?? false,
        approved_for_ads: canonicalEvent.payload.optimization?.approvedForAds ??
          false,
        reasons: canonicalEvent.payload.analytics?.reasons ?? [],
        opening_count: canonicalEvent.payload.quote.openingCount ?? null,
        quote_amount: canonicalEvent.payload.quote.quoteAmount ?? null,
        price_per_opening: canonicalEvent.payload.quote.pricePerOpening ?? null,
        deposit_percent: canonicalEvent.payload.quote.depositPercent ?? null,
        normalized_facts: canonicalEvent.payload.quote as unknown as Record<
          string,
          unknown
        >,
        trust_inputs: {
          identity_quality: canonicalEvent.identityQuality,
        },
      },
      { onConflict: "analysis_id" },
    );

    if (quoteUpsert.error) {
      throw new Error(
        `wm_quote_facts upsert failed: ${
          quoteUpsert.error.message ?? "unknown"
        }`,
      );
    }
  }

  const dispatchPlatforms: WMPlatformName[] = [];
  if (eventLogId) {
    const dispatchRows: Array<Record<string, unknown>> = [];
    if (policyPlan.forcedMetaRow) {
      dispatchPlatforms.push("meta");
      dispatchRows.push({
        event_log_id: eventLogId,
        platform_name: "meta",
        dispatch_status: policyPlan.forcedMetaRow.dispatch_status,
        error_message: policyPlan.forcedMetaRow.error_message ?? null,
      });
    } else if (canonicalEvent.shouldSendMeta) {
      dispatchPlatforms.push("meta");
      dispatchRows.push({
        event_log_id: eventLogId,
        platform_name: "meta",
        dispatch_status: "pending",
      });
    }
    if (canonicalEvent.shouldSendGoogle) {
      dispatchPlatforms.push("google_ads");
      dispatchRows.push({
        event_log_id: eventLogId,
        platform_name: "google_ads",
        dispatch_status: "pending",
      });
    }
    if (canonicalEvent.shouldSendNextdoor) {
      dispatchPlatforms.push("nextdoor");
      dispatchRows.push({
        event_log_id: eventLogId,
        platform_name: "nextdoor",
        dispatch_status: "pending",
      });
    }

    if (policyPlan.allowTikTok) {
      const tiktokEligibility = evaluateTikTokDispatchEligibility({
        eventName: canonicalEvent.eventName,
        env: {
          TIKTOK_CAPI_ENABLED: Deno.env.get("TIKTOK_CAPI_ENABLED") ?? undefined,
        },
      });
      if (tiktokEligibility.shouldEnqueue) {
        dispatchPlatforms.push("tiktok");
        dispatchRows.push({
          event_log_id: eventLogId,
          platform_name: "tiktok",
          dispatch_status: "pending",
        });
      }
    }

    if (dispatchRows.length > 0) {
      const dispatchInsert = await deps.db
        .from("wm_platform_dispatch_log")
        .upsert(dispatchRows, {
          onConflict: "event_log_id,platform_name",
          ignoreDuplicates: true,
        });
      if (dispatchInsert.error) {
        throw new Error(
          `wm_platform_dispatch_log upsert failed: ${
            dispatchInsert.error.message ?? "unknown"
          }`,
        );
      }
    }
  }

  return {
    canonicalEvent,
    eventLogId,
    dispatchPlatforms,
  };
}
