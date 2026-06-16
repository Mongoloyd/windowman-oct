/**
 * OTP Observability read model — server-side only, redacted responses.
 * Does not authorize report unlock. Never returns phone_e164, OTP codes, or full_json.
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const METADATA_WHITELIST = new Set([
  "reason",
  "branch",
  "request_origin",
  "has_lead_id",
  "has_scan_session_id",
  "has_phone_verification_id",
  "twilio_status",
  "twilio_error_code",
  "rate_limit_bucket",
  "retry_after_sec",
  "qa_bypass",
  "pending_row_source",
]);

export interface OtpObservabilityPayload {
  windowMinutes?: number;
  limit?: number;
  filters?: {
    client_slug?: string;
    utm_source?: string;
    utm_campaign?: string;
    zip?: string;
  };
}

type LifecycleRow = {
  id: string;
  created_at: string;
  event_type: string;
  event_status: string;
  actor: string;
  source: string;
  lead_id: string | null;
  scan_session_id: string | null;
  phone_verification_id: string | null;
  twilio_error_code: number | null;
  twilio_verification_sid: string | null;
  metadata: Record<string, unknown> | null;
};

type LeadRow = {
  id: string;
  client_slug: string | null;
  utm_source: string | null;
  utm_campaign: string | null;
  utm_medium: string | null;
  utm_content: string | null;
  zip: string | null;
  county: string | null;
  source: string | null;
  phone_verified_at: string | null;
  report_unlocked_at: string | null;
  latest_analysis_id: string | null;
};

/** Columns present on staging/production leads; avoids optional denormalized fields. */
const LEAD_OBS_SELECT =
  "id, client_slug, utm_source, utm_campaign, utm_medium, utm_content, zip, county, source, phone_verified_at, report_unlocked_at, latest_analysis_id";

type PvRow = {
  id: string;
  lead_id: string | null;
  scan_session_id: string | null;
  phone_e164: string;
  send_outcome: string | null;
  verify_attempt_count: number | null;
  verification_channel: string | null;
};

function safeMetadata(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!METADATA_WHITELIST.has(key)) continue;
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number" ||
      typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

function maskPhoneE164(e164: string | null | undefined): string {
  if (!e164 || typeof e164 !== "string") return "masked";
  const digits = e164.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  if (last4.length !== 4) return "masked";
  return `(•••) •••-${last4}`;
}

function sidSuffix(sid: string | null | undefined): string | null {
  if (!sid || typeof sid !== "string") return null;
  return sid.length > 6 ? sid.slice(-6) : sid;
}

function rate(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

function roundPct(r: number): number {
  return Math.round(r * 10000) / 100;
}

function classifyFailure(
  event: LifecycleRow,
): {
  bucketKey: string;
  category: "send" | "verify" | "delivery" | "lookup" | "user_behavior" | "technical";
  label: string;
} | null {
  const meta = event.metadata ?? {};
  const reason = typeof meta.reason === "string" ? meta.reason : null;
  const code = event.twilio_error_code;

  if (event.event_type === "rate_limited") {
    return { bucketKey: "send:rate_limited", category: "send", label: "Rate limited" };
  }
  if (event.event_type === "send_failed" && reason === "lookup_rejected") {
    return { bucketKey: "lookup:rejected", category: "lookup", label: "Phone lookup rejected" };
  }
  if (event.event_type === "send_failed") {
    return { bucketKey: "send:failed", category: "technical", label: "Send failed (technical)" };
  }
  if (event.event_type === "verify_failed") {
    if (code != null && code >= 60200 && code <= 60205) {
      return {
        bucketKey: `verify:user_${code}`,
        category: "user_behavior",
        label: `Verify failed (user/code ${code})`,
      };
    }
    if (code === 20429 || (code != null && code >= 30000 && code <= 39999) ||
      (code != null && code >= 50000)) {
      return {
        bucketKey: `verify:technical_${code ?? "unknown"}`,
        category: "technical",
        label: `Verify failed (technical ${code ?? "unknown"})`,
      };
    }
    return {
      bucketKey: "verify:user_behavior",
      category: "user_behavior",
      label: "Verify failed (user behavior)",
    };
  }
  return null;
}

function followUpPriority(
  _lead: LeadRow,
  minutesStuck: number,
  verifyAttemptCount: number | null,
  hadSendAccepted: boolean,
  hadVerifySubmitted: boolean,
): "high" | "medium" | "low" {
  if (minutesStuck >= 60) {
    return "high";
  }
  if ((hadSendAccepted && !hadVerifySubmitted) || (verifyAttemptCount ?? 0) >= 1) {
    return "medium";
  }
  return "low";
}

function leadMatchesFilters(
  lead: LeadRow | undefined,
  filters: OtpObservabilityPayload["filters"],
): boolean {
  if (!filters || !lead) return true;
  if (filters.client_slug && lead.client_slug !== filters.client_slug) return false;
  if (filters.utm_source && lead.utm_source !== filters.utm_source) return false;
  if (filters.utm_campaign && lead.utm_campaign !== filters.utm_campaign) return false;
  if (filters.zip && lead.zip !== filters.zip) return false;
  return true;
}

export async function buildOtpObservabilityReadModel(
  supabaseAdmin: SupabaseClient,
  payload: OtpObservabilityPayload,
) {
  const windowMinutes = Math.min(
    Math.max(typeof payload.windowMinutes === "number" ? payload.windowMinutes : 1440, 60),
    10080,
  );
  const limit = Math.min(
    Math.max(typeof payload.limit === "number" ? payload.limit : 100, 1),
    200,
  );
  const filters = payload.filters ?? {};
  const sinceIso = new Date(Date.now() - windowMinutes * 60_000).toISOString();

  const { data: eventsRaw, error: eventsErr } = await supabaseAdmin
    .from("otp_lifecycle_events")
    .select(
      "id, created_at, event_type, event_status, actor, source, lead_id, scan_session_id, phone_verification_id, twilio_error_code, twilio_verification_sid, metadata",
    )
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (eventsErr) throw eventsErr;
  const events = (eventsRaw ?? []) as LifecycleRow[];

  const leadIds = new Set<string>();
  const pvIds = new Set<string>();
  for (const e of events) {
    if (e.lead_id) leadIds.add(e.lead_id);
    if (e.phone_verification_id) pvIds.add(e.phone_verification_id);
  }

  const { data: analysisStuckRaw, error: stuckErr } = await supabaseAdmin
    .from("leads")
    .select(LEAD_OBS_SELECT)
    .is("phone_verified_at", null)
    .not("latest_analysis_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(300);

  if (stuckErr) throw stuckErr;
  for (const l of analysisStuckRaw ?? []) {
    leadIds.add((l as LeadRow).id);
  }

  let leadsMap = new Map<string, LeadRow>();
  if (leadIds.size > 0) {
    const { data: leadsRaw, error: leadsErr } = await supabaseAdmin
      .from("leads")
      .select(LEAD_OBS_SELECT)
      .in("id", [...leadIds]);
    if (leadsErr) throw leadsErr;
    leadsMap = new Map(
      ((leadsRaw ?? []) as LeadRow[]).map((l) => [l.id, l]),
    );
  }

  const stuckCandidateIds = new Set<string>();
  for (const l of analysisStuckRaw ?? []) {
    stuckCandidateIds.add((l as LeadRow).id);
  }
  for (const e of events) {
    if (e.lead_id) stuckCandidateIds.add(e.lead_id);
  }
  const stuckCandidates = [...stuckCandidateIds]
    .map((id) => leadsMap.get(id))
    .filter((l): l is LeadRow => !!l && !l.phone_verified_at);

  let pvMap = new Map<string, PvRow>();
  if (pvIds.size > 0) {
    const { data: pvRaw, error: pvErr } = await supabaseAdmin
      .from("phone_verifications")
      .select(
        "id, lead_id, scan_session_id, phone_e164, send_outcome, verify_attempt_count, verification_channel",
      )
      .in("id", [...pvIds]);
    if (pvErr) throw pvErr;
    pvMap = new Map(((pvRaw ?? []) as PvRow[]).map((p) => [p.id, p]));
  }

  const filteredEvents = events.filter((e) => {
    if (!e.lead_id) return true;
    return leadMatchesFilters(leadsMap.get(e.lead_id), filters);
  });

  const countByType = (type: string) =>
    filteredEvents.filter((e) => e.event_type === type).length;

  const sendRequested = countByType("send_requested");
  const sendAccepted = countByType("send_accepted");
  const sendFailed = countByType("send_failed");
  const rateLimited = countByType("rate_limited");
  const verifySubmitted = countByType("verify_submitted");
  const verifyApproved = countByType("verify_approved");
  const verifyFailed = countByType("verify_failed");

  let qaBypassCount = 0;
  for (const e of filteredEvents) {
    const meta = e.metadata ?? {};
    if (meta.qa_bypass === true) qaBypassCount++;
  }
  for (const pv of pvMap.values()) {
    if (pv.verification_channel === "qa_bypass" ||
      pv.send_outcome === "qa_bypass") {
      qaBypassCount++;
    }
  }

  const sendAcceptanceRate = roundPct(rate(sendAccepted, sendRequested));
  const verifyApprovalRate = roundPct(rate(verifyApproved, verifySubmitted));
  const sendToVerifyRate = roundPct(rate(verifySubmitted, sendAccepted));
  const otpHealthScore = Math.round(
    0.35 * sendAcceptanceRate + 0.45 * verifyApprovalRate +
      0.20 * sendToVerifyRate,
  );

  const lastEventAt = filteredEvents.length > 0
    ? filteredEvents[0].created_at
    : null;

  const recentEvents = filteredEvents.slice(0, limit).map((e) => {
    const lead = e.lead_id ? leadsMap.get(e.lead_id) : undefined;
    return {
      id: e.id,
      createdAt: e.created_at,
      eventType: e.event_type,
      eventStatus: e.event_status,
      actor: e.actor,
      source: e.source,
      leadId: e.lead_id,
      scanSessionId: e.scan_session_id,
      phoneVerificationId: e.phone_verification_id,
      twilioErrorCode: e.twilio_error_code,
      twilioVerificationSidSuffix: sidSuffix(e.twilio_verification_sid),
      metadataSafe: safeMetadata(e.metadata),
      clientSlug: lead?.client_slug ?? null,
      utmSource: lead?.utm_source ?? null,
      utmCampaign: lead?.utm_campaign ?? null,
      zip: lead?.zip ?? null,
      county: lead?.county ?? null,
    };
  });

  const eventsByLeadSession = new Map<string, LifecycleRow[]>();
  for (const e of filteredEvents) {
    const key = `${e.lead_id ?? ""}:${e.scan_session_id ?? ""}`;
    const arr = eventsByLeadSession.get(key) ?? [];
    arr.push(e);
    eventsByLeadSession.set(key, arr);
  }

  const stuckSessions: Array<Record<string, unknown>> = [];
  for (const lead of stuckCandidates) {
    if (!leadMatchesFilters(lead, filters)) continue;

    const sessionId = leadEvents.length > 0
      ? (leadEvents.find((e) => e.scan_session_id)?.scan_session_id ?? null)
      : null;
    const key = `${lead.id}:${sessionId ?? ""}`;
    const leadEvents = eventsByLeadSession.get(key) ??
      filteredEvents.filter((e) => e.lead_id === lead.id);

    if (leadEvents.length === 0) continue;

    const sorted = [...leadEvents].sort((a, b) =>
      b.created_at.localeCompare(a.created_at)
    );
    const lastEvent = sorted[0];

    const lastSendAccepted = sorted.find((e) => e.event_type === "send_accepted");
    const approvedAfterSend = lastSendAccepted
      ? sorted.some((e) =>
        e.event_type === "verify_approved" &&
        e.created_at >= lastSendAccepted.created_at
      )
      : false;

    if (approvedAfterSend) continue;

    const hadSendAccepted = !!lastSendAccepted;
    const hadVerifySubmitted = sorted.some((e) =>
      e.event_type === "verify_submitted"
    );

    let stuckReason = "send_ok_no_verify_attempt";
    if (!hadSendAccepted) {
      if (sorted.some((e) => e.event_type === "rate_limited")) {
        stuckReason = "rate_limited";
      } else if (
        sorted.some((e) =>
          e.event_type === "send_failed" &&
          (e.metadata as Record<string, unknown>)?.reason === "lookup_rejected"
        )
      ) {
        stuckReason = "lookup_rejected";
      } else if (sorted.some((e) => e.event_type === "send_failed")) {
        stuckReason = "send_never_accepted";
      } else {
        continue;
      }
    } else if (hadVerifySubmitted && !approvedAfterSend) {
      stuckReason = "verify_attempts_no_success";
    }

    const pvForLead = [...pvMap.values()].find((p) =>
      p.lead_id === lead.id &&
      (!sessionId || p.scan_session_id === sessionId)
    );
    const minutesStuck = Math.round(
      (Date.now() - new Date(lastEvent.created_at).getTime()) / 60_000,
    );

    stuckSessions.push({
      leadId: lead.id,
      scanSessionId: sessionId,
      phoneVerificationId: pvForLead?.id ?? lastEvent.phone_verification_id,
      stuckReason,
      minutesStuck,
      sendOutcome: pvForLead?.send_outcome ?? null,
      verifyAttemptCount: pvForLead?.verify_attempt_count ?? null,
      lastLifecycleEventAt: lastEvent.created_at,
      lastLifecycleEventType: lastEvent.event_type,
      grade: null,
      flagCount: null,
      redFlagCount: null,
      clientSlug: lead.client_slug,
      utmSource: lead.utm_source,
      utmCampaign: lead.utm_campaign,
      zip: lead.zip,
      county: lead.county,
      phoneMasked: maskPhoneE164(pvForLead?.phone_e164),
      reportUnlockedAt: lead.report_unlocked_at,
      followUpPriority: followUpPriority(
        lead,
        minutesStuck,
        pvForLead?.verify_attempt_count ?? null,
        hadSendAccepted,
        hadVerifySubmitted,
      ),
    });
  }

  stuckSessions.sort((a, b) => {
    const prio = { high: 0, medium: 1, low: 2 };
    const pa = prio[a.followUpPriority as keyof typeof prio] ?? 3;
    const pb = prio[b.followUpPriority as keyof typeof prio] ?? 3;
    if (pa !== pb) return pa - pb;
    return (b.minutesStuck as number) - (a.minutesStuck as number);
  });

  const failureEvents = filteredEvents.filter((e) =>
    ["send_failed", "rate_limited", "verify_failed"].includes(e.event_type)
  );
  const bucketAcc = new Map<string, {
    bucketKey: string;
    category: "send" | "verify" | "delivery" | "lookup" | "user_behavior" | "technical";
    label: string;
    count: number;
    codes: number[];
    sampleScanSessionIds: string[];
  }>();

  for (const e of failureEvents) {
    const classified = classifyFailure(e);
    if (!classified) continue;
    const existing = bucketAcc.get(classified.bucketKey) ?? {
      ...classified,
      count: 0,
      codes: [],
      sampleScanSessionIds: [],
    };
    existing.count++;
    if (e.twilio_error_code != null) existing.codes.push(e.twilio_error_code);
    if (e.scan_session_id && existing.sampleScanSessionIds.length < 5) {
      if (!existing.sampleScanSessionIds.includes(e.scan_session_id)) {
        existing.sampleScanSessionIds.push(e.scan_session_id);
      }
    }
    bucketAcc.set(classified.bucketKey, existing);
  }

  const totalFailures = failureEvents.length;
  const failureBuckets = [...bucketAcc.values()]
    .sort((a, b) => b.count - a.count)
    .map((b) => ({
      bucketKey: b.bucketKey,
      category: b.category,
      label: b.label,
      count: b.count,
      pctOfFailures: totalFailures > 0
        ? roundPct(rate(b.count, totalFailures))
        : 0,
      topTwilioCodes: [...new Set(b.codes)].slice(0, 5),
      sampleScanSessionIds: b.sampleScanSessionIds,
    }));

  type SourceAgg = {
    sendAccepted: number;
    verifyApproved: number;
    verifyAttempts: number;
    verifyAttemptRows: number;
  };
  const sourceAggs = new Map<string, SourceAgg>();

  function bumpSource(dimension: string, value: string, event: LifecycleRow) {
    const key = `${dimension}:${value}`;
    const agg = sourceAggs.get(key) ?? {
      sendAccepted: 0,
      verifyApproved: 0,
      verifyAttempts: 0,
      verifyAttemptRows: 0,
    };
    if (event.event_type === "send_accepted") agg.sendAccepted++;
    if (event.event_type === "verify_approved") agg.verifyApproved++;
    if (event.event_type === "verify_submitted") agg.verifyAttempts++;
    if (event.event_type === "verify_failed") agg.verifyAttemptRows++;
    sourceAggs.set(key, agg);
  }

  for (const e of filteredEvents) {
    if (!e.lead_id) continue;
    const lead = leadsMap.get(e.lead_id);
    if (!lead) continue;
    if (lead.utm_source) bumpSource("utm_source", lead.utm_source, e);
    if (lead.source) bumpSource("lead_source", lead.source, e);
    if (lead.client_slug) bumpSource("client_slug", lead.client_slug, e);
  }

  const sourceBreakdown = [...sourceAggs.entries()].map(([key, agg]) => {
    const [dimension, value] = key.split(":");
    const sendToVerify = roundPct(rate(agg.verifyApproved, agg.sendAccepted));
    const avgAttempts = agg.verifyAttemptRows > 0
      ? Math.round((agg.verifyAttempts + agg.verifyAttemptRows) /
        agg.verifyAttemptRows * 10) / 10
      : 0;
    return {
      dimension: dimension as "utm_source" | "lead_source" | "client_slug",
      value,
      sendAccepted: agg.sendAccepted,
      verifyApproved: agg.verifyApproved,
      sendToVerifyRate: sendToVerify,
      avgVerifyAttempts: avgAttempts,
      frictionScore: Math.round(100 - sendToVerify),
    };
  }).sort((a, b) => b.frictionScore - a.frictionScore);

  type CampaignAgg = {
    utmSource: string | null;
    utmMedium: string | null;
    utmContent: string | null;
    scans: number;
    sendAccepted: number;
    verifyApproved: number;
    reportUnlocked: number;
  };
  const campaignAggs = new Map<string, CampaignAgg>();

  for (const lead of leadsMap.values()) {
    if (!lead.utm_campaign) continue;
    if (!leadMatchesFilters(lead, filters)) continue;
    const agg = campaignAggs.get(lead.utm_campaign) ?? {
      utmSource: lead.utm_source,
      utmMedium: lead.utm_medium,
      utmContent: lead.utm_content,
      scans: 0,
      sendAccepted: 0,
      verifyApproved: 0,
      reportUnlocked: 0,
    };
    if (lead.latest_analysis_id) agg.scans++;
    if (lead.report_unlocked_at && lead.report_unlocked_at >= sinceIso) {
      agg.reportUnlocked++;
    }
    campaignAggs.set(lead.utm_campaign, agg);
  }

  for (const e of filteredEvents) {
    if (!e.lead_id) continue;
    const lead = leadsMap.get(e.lead_id);
    if (!lead?.utm_campaign) continue;
    const agg = campaignAggs.get(lead.utm_campaign);
    if (!agg) continue;
    if (e.event_type === "send_accepted") agg.sendAccepted++;
    if (e.event_type === "verify_approved") agg.verifyApproved++;
  }

  const campaignBreakdown = [...campaignAggs.entries()].map(([utmCampaign, agg]) => ({
    utmCampaign,
    utmSource: agg.utmSource,
    utmMedium: agg.utmMedium,
    utmContent: agg.utmContent,
    scans: agg.scans,
    sendAccepted: agg.sendAccepted,
    verifyApproved: agg.verifyApproved,
    reportUnlocked: agg.reportUnlocked,
    curiosityScore: agg.scans >= 10
      ? Math.round(agg.scans / Math.max(agg.verifyApproved, 1) * 10) / 10
      : 0,
  })).sort((a, b) => b.curiosityScore - a.curiosityScore);

  const recommendations: Array<{
    severity: "info" | "warning" | "critical";
    title: string;
    reason: string;
    suggestedAction: string;
  }> = [];

  if (sendRequested > 0 && sendAcceptanceRate < 80) {
    recommendations.push({
      severity: sendAcceptanceRate < 50 ? "critical" : "warning",
      title: "Low OTP send acceptance rate",
      reason: `${sendAcceptanceRate}% of send requests were accepted in the last ${windowMinutes} minutes.`,
      suggestedAction:
        "Check Twilio Verify health, phone lookup branch, and rate-limit settings.",
    });
  }

  if (sendAccepted >= 5 && sendToVerifyRate < 50) {
    recommendations.push({
      severity: "warning",
      title: "Send accepted but verify not started",
      reason: `${sendToVerifyRate}% of accepted sends led to a verify attempt.`,
      suggestedAction:
        "Review OTP gate copy, trust signals, and mobile UX on the report reveal step.",
    });
  }

  if (verifySubmitted >= 3 && verifyApprovalRate < 60) {
    recommendations.push({
      severity: "warning",
      title: "Verify submission failures elevated",
      reason: `${verifyApprovalRate}% verify approval rate across ${verifySubmitted} submissions.`,
      suggestedAction:
        "Check user error patterns in failure buckets; distinguish wrong-code vs technical Twilio errors.",
    });
  }

  const highStuck = stuckSessions.filter((s) => s.followUpPriority === "high");
  if (highStuck.length > 0) {
    recommendations.push({
      severity: "warning",
      title: `${highStuck.length} high-priority stuck leads`,
      reason:
        "Scanned homeowners with OTP friction and strong report signals are waiting.",
      suggestedAction:
        "Follow up manually from Lead Dossier (/admin/leads/:id). No automated resend in this sprint.",
    });
  }

  const curious = campaignBreakdown.filter((c) =>
    c.scans >= 10 && c.curiosityScore >= 5
  );
  if (curious.length > 0) {
    recommendations.push({
      severity: "info",
      title: "High curiosity campaigns detected",
      reason: `${curious[0].utmCampaign} has ${curious[0].scans} scans but only ${curious[0].verifyApproved} verifies.`,
      suggestedAction:
        "Review ad targeting and landing page — may be attracting curiosity traffic, not committed homeowners.",
    });
  }

  if (filteredEvents.length === 0) {
    recommendations.push({
      severity: "info",
      title: "No OTP lifecycle events in window",
      reason: `No events recorded in the last ${windowMinutes} minutes.`,
      suggestedAction:
        "Confirm send-otp/verify-otp instrumentation is deployed and traffic exists.",
    });
  }

  if (qaBypassCount > 0) {
    recommendations.push({
      severity: "info",
      title: "QA bypass events observed",
      reason: `${qaBypassCount} QA bypass signal(s) in window.`,
      suggestedAction:
        "Ensure QA bypass is disabled in production environments.",
    });
  }

  return {
    health: {
      windowMinutes,
      sendRequested,
      sendAccepted,
      sendFailed,
      rateLimited,
      verifySubmitted,
      verifyApproved,
      verifyFailed,
      sendAcceptanceRate,
      verifyApprovalRate,
      sendToVerifyRate,
      qaBypassCount,
      lastEventAt,
      otpHealthScore,
    },
    recentEvents,
    stuckSessions: stuckSessions.slice(0, limit),
    failureBuckets,
    sourceBreakdown,
    campaignBreakdown,
    recommendations,
  };
}
