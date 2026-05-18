/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LEGACY SESSION SERVICE v3.0 — NOT THE CANONICAL SCANNER GOLDEN THREAD
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Legacy session management for the pre-scanner WindowMan AI Quote Audit funnel.
 *
 * Canonical Homeowner Scan Journey source of truth now flows through:
 * TruthGateFlow → UploadZone → start-upload-scan-session → scan-quote → preview → OTP.
 * This file may still support older/demo paths that use `impact-windows-session`,
 * but it must not be treated as proof of scanner `session_id → lead_id → quote_file_id → scan_session_id` continuity.
 *
 * Features:
 * - Single-funnel state machine (6 stages)
 * - localStorage persistence with cross-tab sync
 * - Server-side Supabase backup (non-blocking)
 * - GTM dataLayer integration
 * - Cross-device identity resolution
 * - 30-day session expiration with archival
 * - React hook for component integration
 *
 * @version 3.0.0
 * @author WindowMan Truth Engine Team
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const STORAGE_KEY = "impact-windows-session";
export const SESSION_EXPIRY_DAYS = 30;
export const SESSION_VERSION = "3.0.0";

// ═══════════════════════════════════════════════════════════════════════════════
// FUNNEL STAGES
// ═══════════════════════════════════════════════════════════════════════════════

export const FUNNEL_STAGES = {
  ANONYMOUS: "anonymous",
  AUDIT_STARTED: "audit_started",
  MID_FUNNEL: "mid_funnel",
  TRUTH_GATE: "truth_gate",
  LEAD_CAPTURED: "lead_captured",
  GRADE_REVEALED: "grade_revealed",
} as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[keyof typeof FUNNEL_STAGES];

// Ordered stages for progression validation
const STAGE_ORDER: FunnelStage[] = [
  FUNNEL_STAGES.ANONYMOUS,
  FUNNEL_STAGES.AUDIT_STARTED,
  FUNNEL_STAGES.MID_FUNNEL,
  FUNNEL_STAGES.TRUTH_GATE,
  FUNNEL_STAGES.LEAD_CAPTURED,
  FUNNEL_STAGES.GRADE_REVEALED,
];

// ═══════════════════════════════════════════════════════════════════════════════
// GRADE SCALE
// ═══════════════════════════════════════════════════════════════════════════════

export const GRADES = ["A", "B", "C", "D", "F"] as const;
export type Grade = (typeof GRADES)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// FORENSIC FLAGS
// ═══════════════════════════════════════════════════════════════════════════════

export const FORENSIC_FLAGS = [
  "missing_impact_rating",
  "no_noa_certification",
  "inflated_labor_rate",
  "missing_permit_line_item",
  "no_manufacturer_warranty",
  "suspicious_deposit_percentage",
  "missing_debris_removal",
  "no_installation_timeline",
  "generic_window_specs",
  "missing_flashing_details",
] as const;

export type ForensicFlag = (typeof FORENSIC_FLAGS)[number];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export interface UtmParams {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  gclid?: string;
  fbclid?: string;
}

export interface SessionData {
  // Identity
  anonymousId: string;
  leadId?: string;
  email?: string;
  phone?: string;
  name?: string;

  // Funnel Stage
  funnelStage: FunnelStage;

  // Attribution (First-Touch)
  initialUtm?: UtmParams;
  initialReferrer?: string;
  landingPage?: string;

  // Last-Touch Attribution (for multi-touch reporting)
  lastUtm?: UtmParams;

  // Mid-Funnel Data (Quote Context)
  county?: string;
  windowCount?: number;
  quoteAmount?: number;

  // Truth Gate
  truthGateHitAt?: string;
  truthGateAbandoned?: boolean;

  // Audit Results
  auditStartedAt?: string;
  auditCompletedAt?: string;
  grade?: Grade;
  gradeScore?: number;
  forensicFlags?: string[];
  flagCount?: number;

  // Timestamps
  firstSeenAt: string;
  lastActivityAt: string;
  promotedToLeadAt?: string;

  // Metadata
  sessionVersion: string;
  deviceFingerprint?: string;
  userAgent?: string;
}

export interface MidFunnelData {
  county: string;
  windowCount: number;
  quoteAmount: number;
}

export interface GradeResults {
  grade: Grade;
  gradeScore: number;
  forensicFlags: string[];
}

export interface LeadCaptureData {
  email: string;
  phone?: string;
  name?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE CLIENT (Lazy Initialization)
// ═══════════════════════════════════════════════════════════════════════════════

let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;

  const supabaseUrl =
    typeof window !== "undefined" ? (window as any).__SUPABASE_URL__ || import.meta.env?.VITE_SUPABASE_URL : null;
  const supabaseKey =
    typeof window !== "undefined"
      ? (window as any).__SUPABASE_ANON_KEY__ || import.meta.env?.VITE_SUPABASE_ANON_KEY
      : null;

  if (supabaseUrl && supabaseKey) {
    try {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    } catch (error) {
      console.warn("[GoldenThread] Supabase client initialization failed:", error);
    }
  }

  return supabaseClient;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UUID GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback for older browsers: use crypto.getRandomValues for a v4 UUID
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Per RFC 4122: set version to 4
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Per RFC 4122: set variant to 10xxxxxx
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex: string[] = [];
    for (let i = 0; i < bytes.length; i++) {
      const b = bytes[i].toString(16).padStart(2, "0");
      hex.push(b);
    }

    return (
      hex[0] +
      hex[1] +
      hex[2] +
      hex[3] +
      "-" +
      hex[4] +
      hex[5] +
      "-" +
      hex[6] +
      hex[7] +
      "-" +
      hex[8] +
      hex[9] +
      "-" +
      hex[10] +
      hex[11] +
      hex[12] +
      hex[13] +
      hex[14] +
      hex[15]
    );
  }

  // If no crypto is available, throw an error rather than using insecure Math.random
  throw new Error("Cryptographic random is unavailable in this environment");
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOCAL STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Safely read session from localStorage with corruption recovery
 */
function getLocalSession(): SessionData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const data = JSON.parse(raw);

    // Validate required fields
    if (!data.anonymousId || !data.funnelStage || !data.sessionVersion) {
      console.warn("[GoldenThread] Invalid session structure, clearing");
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return data as SessionData;
  } catch (error) {
    // Corrupted data - clear and return null
    console.warn("[GoldenThread] Corrupted session data, recovering:", error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Write session to localStorage
 */
function setLocalSession(session: SessionData): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("[GoldenThread] Failed to save session:", error);
  }
}

/**
 * Clear session from localStorage
 */
function clearLocalSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Archive expired session before clearing
 */
function archiveSession(session: SessionData): void {
  if (typeof window === "undefined") return;

  try {
    const archiveKey = `${STORAGE_KEY}-archived-${Date.now()}`;
    localStorage.setItem(archiveKey, JSON.stringify(session));

    // Also attempt server-side archival
    syncArchivedSessionToSupabase(session);
  } catch (error) {
    console.warn("[GoldenThread] Failed to archive session:", error);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION EXPIRATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if session has expired (30+ days since last activity)
 */
function isSessionExpired(session: SessionData): boolean {
  if (!session.lastActivityAt) return false;

  const lastActivity = new Date(session.lastActivityAt);
  const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);

  return daysSince > SESSION_EXPIRY_DAYS;
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTM PARAMETER CAPTURE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract UTM parameters from URL
 */
function captureUtmParams(): UtmParams | undefined {
  if (typeof window === "undefined") return undefined;

  const params = new URLSearchParams(window.location.search);

  const utm: UtmParams = {};
  let hasParams = false;

  const source = params.get("utm_source");
  const medium = params.get("utm_medium");
  const campaign = params.get("utm_campaign");
  const content = params.get("utm_content");
  const term = params.get("utm_term");
  const gclid = params.get("gclid");
  const fbclid = params.get("fbclid");

  if (source) {
    utm.source = source;
    hasParams = true;
  }
  if (medium) {
    utm.medium = medium;
    hasParams = true;
  }
  if (campaign) {
    utm.campaign = campaign;
    hasParams = true;
  }
  if (content) {
    utm.content = content;
    hasParams = true;
  }
  if (term) {
    utm.term = term;
    hasParams = true;
  }
  if (gclid) {
    utm.gclid = gclid;
    hasParams = true;
  }
  if (fbclid) {
    utm.fbclid = fbclid;
    hasParams = true;
  }

  return hasParams ? utm : undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GTM DATALAYER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Push event to GTM dataLayer
 */
export function pushToDataLayer(event: string, data: Record<string, any> = {}): void {
  if (typeof window === "undefined") return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({
    event,
    ...data,
    event_timestamp: new Date().toISOString(),
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD SCORE CALCULATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate lead score based on session data (0-100)
 */
export function calculateLeadScore(session: SessionData): number {
  let score = 0;

  // Contact info (45 points max)
  if (session.email) score += 25;
  if (session.phone) score += 20;

  // Funnel completion (30 points max)
  switch (session.funnelStage) {
    case FUNNEL_STAGES.GRADE_REVEALED:
      score += 30;
      break;
    case FUNNEL_STAGES.LEAD_CAPTURED:
      score += 25;
      break;
    case FUNNEL_STAGES.TRUTH_GATE:
      score += 15;
      break;
    case FUNNEL_STAGES.MID_FUNNEL:
      score += 10;
      break;
    case FUNNEL_STAGES.AUDIT_STARTED:
      score += 5;
      break;
    default:
      break;
  }

  // Quote context - indicates serious buyer (20 points max)
  if (session.quoteAmount) {
    if (session.quoteAmount > 30000) {
      score += 15;
    } else if (session.quoteAmount > 20000) {
      score += 10;
    } else if (session.quoteAmount > 10000) {
      score += 5;
    }
  }

  // Window count - project size indicator
  if (session.windowCount && session.windowCount > 10) {
    score += 5;
  }

  // Forensic flags - more issues = more need for help
  if (session.flagCount && session.flagCount >= 3) {
    score += 5;
  }

  // Bad grade - needs our help more
  if (session.grade === "D" || session.grade === "F") {
    score += 5;
  }

  return Math.min(score, 100);
}

/**
 * Get quote bracket string for analytics
 */
export function getQuoteBracket(amount: number | undefined): string {
  if (!amount) return "unknown";
  if (amount < 10000) return "under-10k";
  if (amount < 15000) return "10k-15k";
  if (amount < 20000) return "15k-20k";
  if (amount < 25000) return "20k-25k";
  if (amount < 35000) return "25k-35k";
  if (amount < 50000) return "35k-50k";
  return "over-50k";
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPABASE SYNC (Non-blocking)
// ═══════════════════════════════════════════════════════════════════════════════
// syncToSupabase (browser UPSERT into leads with protected scoring fields)
// was removed. It was dead code — no live UI component imported or called it.
// Grade, grade_score, forensic_flags, flag_count, and session_data must only
// be written by the scan-quote Edge Function via service role.

/**
 * Archive expired session to Supabase
 */
async function syncArchivedSessionToSupabase(session: SessionData): Promise<void> {
  try {
    const client = getSupabaseClient();
    if (!client) return;

    await client.from("archived_sessions").insert({
      lead_id: session.leadId,
      session_data: session,
      expired_at: new Date().toISOString(),
    });
  } catch (error) {
    // Silent fail
    console.warn("[GoldenThread] Archive sync failed:", error);
  }
}

/**
 * Attempt to resolve identity by email from server
 */
async function resolveIdentityByEmail(email: string, currentSession: SessionData): Promise<SessionData> {
  try {
    const client = getSupabaseClient();
    if (!client) return currentSession;

    // 1. Call the secure RPC (Use 'as any' to bypass the build error for unregistered functions)
    const { data: rpcResult, error } = await (client.rpc as any)("get_lead_by_email", {
      p_email: email,
    });

    // 2. Cast result to any[] to safely handle the first record
    const result = rpcResult as any[];
    const existingLead = result && result.length > 0 ? result[0] : null;

    if (error || !existingLead) {
      return currentSession;
    }

    // Merge: preserve first-touch attribution and earliest timestamps
    const merged: SessionData = {
      ...currentSession,
      // Use existing leadId if available
      leadId: existingLead.id || currentSession.leadId,
      // Keep earliest firstSeenAt (matches the 'created_at' column from the RPC)
      firstSeenAt:
        existingLead.created_at && new Date(existingLead.created_at) < new Date(currentSession.firstSeenAt)
          ? existingLead.created_at
          : currentSession.firstSeenAt,
      // Preserve first-touch UTM from original session (stored in session_data column)
      initialUtm: existingLead.session_data?.initialUtm || currentSession.initialUtm,
      initialReferrer: existingLead.session_data?.initialReferrer || currentSession.initialReferrer,
      landingPage: existingLead.session_data?.landingPage || currentSession.landingPage,
      // Preserve mid-funnel data from first session if current doesn't have it
      county: currentSession.county || existingLead.county,
      windowCount: currentSession.windowCount || existingLead.window_count,
      quoteAmount: currentSession.quoteAmount || existingLead.quote_amount,
      // Update lastActivityAt
      lastActivityAt: new Date().toISOString(),
    };

    return merged;
  } catch (error) {
    console.warn("[GoldenThread] Identity resolution failed:", error);
    return currentSession;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Initialize or resume session
 */
export function initSession(): SessionData {
  const now = new Date().toISOString();
  let session = getLocalSession();
  let isNewSession = false;
  let isReturning = false;

  // Check for expired session
  if (session && isSessionExpired(session)) {
    archiveSession(session);
    session = null;
  }

  if (!session) {
    // Create new anonymous session
    isNewSession = true;
    const utmParams = captureUtmParams();

    session = {
      anonymousId: generateUUID(),
      funnelStage: FUNNEL_STAGES.ANONYMOUS,
      initialUtm: utmParams,
      initialReferrer: typeof document !== "undefined" ? document.referrer : undefined,
      landingPage: typeof window !== "undefined" ? window.location.pathname : "/",
      firstSeenAt: now,
      lastActivityAt: now,
      sessionVersion: SESSION_VERSION,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    };
  } else {
    // Existing session - update lastActivityAt
    isReturning = true;
    session.lastActivityAt = now;

    // Capture any new UTM params as last-touch
    const newUtm = captureUtmParams();
    if (newUtm) {
      session.lastUtm = newUtm;
    }
  }

  setLocalSession(session);

  // Fire GTM event
  if (isNewSession) {
    pushToDataLayer("session_start", {
      session_type: "new",
      landing_page: session.landingPage,
      utm_source: session.initialUtm?.source,
      utm_medium: session.initialUtm?.medium,
      utm_campaign: session.initialUtm?.campaign,
      utm_content: session.initialUtm?.content,
      utm_term: session.initialUtm?.term,
      gclid: session.initialUtm?.gclid,
      fbclid: session.initialUtm?.fbclid,
    });
  } else if (isReturning) {
    const firstSeen = new Date(session.firstSeenAt);
    const daysSinceFirst = Math.floor((Date.now() - firstSeen.getTime()) / (1000 * 60 * 60 * 24));

    pushToDataLayer("session_resume", {
      session_type: "returning",
      days_since_first_visit: daysSinceFirst,
      funnel_stage: session.funnelStage,
      is_identified: !!session.leadId,
    });
  }

  return session;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current session (read-only)
 */
export function getSession(): SessionData | null {
  return getLocalSession();
}

/**
 * Update session with partial data
 */
export function updateSession(updates: Partial<SessionData>): SessionData {
  let session = getLocalSession() || initSession();

  session = {
    ...session,
    ...updates,
    lastActivityAt: new Date().toISOString(),
  };

  setLocalSession(session);

  return session;
}

// ═══════════════════════════════════════════════════════════════════════════════
// FUNNEL STAGE TRANSITIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Start the audit (Stage 2)
 */
export function startAudit(): SessionData {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  // Idempotent - only set auditStartedAt once
  if (!session.auditStartedAt) {
    session.auditStartedAt = now;
  }

  session.funnelStage = FUNNEL_STAGES.AUDIT_STARTED;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Fire GTM event
  pushToDataLayer("audit_started", {
    anonymous_id: session.anonymousId,
    time_on_page_seconds: calculateTimeOnPage(session),
  });

  return session;
}

/**
 * Capture mid-funnel data (Stage 3)
 */
export function captureMidFunnelData(data: MidFunnelData): SessionData {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  session.county = data.county;
  session.windowCount = data.windowCount;
  session.quoteAmount = data.quoteAmount;
  session.funnelStage = FUNNEL_STAGES.MID_FUNNEL;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Fire GTM events
  pushToDataLayer("county_identified", {
    county: data.county,
    anonymous_id: session.anonymousId,
  });

  pushToDataLayer("quote_entered", {
    quote_amount: data.quoteAmount,
    window_count: data.windowCount,
    price_per_window: data.windowCount > 0 ? Math.round(data.quoteAmount / data.windowCount) : 0,
    county: data.county,
  });

  return session;
}

/**
 * Hit the truth gate (Stage 4) - shadow audience seeding point
 */
export function hitTruthGate(): SessionData {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  session.funnelStage = FUNNEL_STAGES.TRUTH_GATE;
  session.truthGateHitAt = now;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Fire GTM event for retargeting audience
  pushToDataLayer("truth_gate_hit", {
    anonymous_id: session.anonymousId,
    county: session.county,
    window_count: session.windowCount,
    quote_amount: session.quoteAmount,
    time_in_funnel_seconds: calculateFunnelTime(session),
  });

  return session;
}

/**
 * Mark truth gate as abandoned (exit intent)
 */
export function markTruthGateAbandoned(): SessionData {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  session.truthGateAbandoned = true;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Fire GTM event
  pushToDataLayer("truth_gate_abandoned", {
    anonymous_id: session.anonymousId,
    time_at_gate_seconds: session.truthGateHitAt
      ? Math.floor((Date.now() - new Date(session.truthGateHitAt).getTime()) / 1000)
      : 0,
    county: session.county,
  });

  return session;
}

/**
 * Capture lead data (Stage 5) - convert anonymous to identified
 */
export async function captureLead(data: LeadCaptureData): Promise<SessionData> {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  // Attempt identity resolution by email
  session = await resolveIdentityByEmail(data.email, session);

  // Generate leadId if not already present (idempotent)
  if (!session.leadId) {
    session.leadId = generateUUID();
    session.promotedToLeadAt = now;
  }

  // Update contact info
  session.email = data.email;
  if (data.phone) session.phone = data.phone;
  if (data.name) session.name = data.name;

  // Update stage
  session.funnelStage = FUNNEL_STAGES.LEAD_CAPTURED;
  session.truthGateAbandoned = false;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Fire GTM event
  pushToDataLayer("lead_captured", {
    lead_id: session.leadId,
    anonymous_id: session.anonymousId,
    county: session.county,
    window_count: session.windowCount,
    quote_amount: session.quoteAmount,
    time_to_conversion_seconds: calculateFunnelTime(session),
  });

  // Fire user properties event
  pushToDataLayer("user_properties_set", {
    user_id: session.leadId,
    user_properties: {
      lead_id: session.leadId,
      lead_score: calculateLeadScore(session),
      funnel_stage: session.funnelStage,
      county: session.county,
      quote_bracket: getQuoteBracket(session.quoteAmount),
      first_touch_source: session.initialUtm?.source,
      first_touch_campaign: session.initialUtm?.campaign,
    },
  });

  return session;
}

/**
 * Reveal the grade (Stage 6)
 */
export function revealGrade(results: GradeResults): SessionData {
  let session = getLocalSession() || initSession();
  const now = new Date().toISOString();

  session.grade = results.grade;
  session.gradeScore = results.gradeScore;
  session.forensicFlags = results.forensicFlags;
  session.flagCount = results.forensicFlags.length;
  session.funnelStage = FUNNEL_STAGES.GRADE_REVEALED;
  session.auditCompletedAt = now;
  session.lastActivityAt = now;

  setLocalSession(session);

  // Calculate audit duration
  const auditDuration = session.auditStartedAt
    ? Math.floor((Date.now() - new Date(session.auditStartedAt).getTime()) / 1000)
    : 0;

  // Fire GTM event
  pushToDataLayer("grade_revealed", {
    lead_id: session.leadId,
    grade: session.grade,
    grade_score: session.gradeScore,
    flag_count: session.flagCount,
    forensic_flags: session.forensicFlags!.join(","),
    county: session.county,
    quote_amount: session.quoteAmount,
    window_count: session.windowCount,
    audit_duration_seconds: auditDuration,
  });

  // Update user properties
  pushToDataLayer("user_properties_set", {
    user_id: session.leadId,
    user_properties: {
      lead_id: session.leadId,
      lead_score: calculateLeadScore(session),
      funnel_stage: session.funnelStage,
      grade: results.grade,
      flag_count: results.forensicFlags.length,
      county: session.county,
      quote_bracket: getQuoteBracket(session.quoteAmount),
      first_touch_source: session.initialUtm?.source,
      first_touch_campaign: session.initialUtm?.campaign,
    },
  });

  return session;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Calculate time on page (seconds since firstSeenAt)
 */
function calculateTimeOnPage(session: SessionData): number {
  if (!session.firstSeenAt) return 0;
  return Math.floor((Date.now() - new Date(session.firstSeenAt).getTime()) / 1000);
}

/**
 * Calculate time in funnel (seconds since auditStartedAt)
 */
function calculateFunnelTime(session: SessionData): number {
  if (!session.auditStartedAt) return 0;
  return Math.floor((Date.now() - new Date(session.auditStartedAt).getTime()) / 1000);
}

/**
 * Get stage index for progression validation
 */
function getStageIndex(stage: FunnelStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * Check if progression to target stage is valid
 */
export function canProgressTo(currentStage: FunnelStage, targetStage: FunnelStage): boolean {
  const currentIndex = getStageIndex(currentStage);
  const targetIndex = getStageIndex(targetStage);
  return targetIndex >= currentIndex;
}

// ═══════════════════════════════════════════════════════════════════════════════
// REACT HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export interface UseGoldenThreadReturn {
  // Session state
  session: SessionData | null;
  isIdentified: boolean;
  leadId: string | undefined;
  anonymousId: string | undefined;
  funnelStage: FunnelStage | undefined;
  leadScore: number;
  grade: Grade | undefined;
  forensicFlags: string[] | undefined;

  // Stage transition actions
  startAudit: () => SessionData;
  captureMidFunnel: (data: MidFunnelData) => SessionData;
  hitTruthGate: () => SessionData;
  markAbandoned: () => SessionData;
  captureLead: (data: LeadCaptureData) => Promise<SessionData>;
  revealGrade: (results: GradeResults) => SessionData;

  // Utilities
  update: (updates: Partial<SessionData>) => SessionData;
  pushEvent: (event: string, data?: Record<string, any>) => void;
  refresh: () => void;
}

export function useGoldenThread(): UseGoldenThreadReturn {
  const [session, setSession] = useState<SessionData | null>(null);
  const isInitialized = useRef(false);

  // Initialize session on mount
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    const initialSession = initSession();
    setSession(initialSession);
  }, []);

  // Cross-tab synchronization via storage event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;

      if (event.newValue) {
        try {
          const updatedSession = JSON.parse(event.newValue);
          setSession(updatedSession);
        } catch (error) {
          console.warn("[GoldenThread] Failed to parse storage update:", error);
        }
      } else {
        // Session was cleared in another tab
        setSession(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Memoized actions
  const handleStartAudit = useCallback(() => {
    const updated = startAudit();
    setSession(updated);
    return updated;
  }, []);

  const handleCaptureMidFunnel = useCallback((data: MidFunnelData) => {
    const updated = captureMidFunnelData(data);
    setSession(updated);
    return updated;
  }, []);

  const handleHitTruthGate = useCallback(() => {
    const updated = hitTruthGate();
    setSession(updated);
    return updated;
  }, []);

  const handleMarkAbandoned = useCallback(() => {
    const updated = markTruthGateAbandoned();
    setSession(updated);
    return updated;
  }, []);

  const handleCaptureLead = useCallback(async (data: LeadCaptureData) => {
    const updated = await captureLead(data);
    setSession(updated);
    return updated;
  }, []);

  const handleRevealGrade = useCallback((results: GradeResults) => {
    const updated = revealGrade(results);
    setSession(updated);
    return updated;
  }, []);

  const handleUpdate = useCallback((updates: Partial<SessionData>) => {
    const updated = updateSession(updates);
    setSession(updated);
    return updated;
  }, []);

  const handleRefresh = useCallback(() => {
    const current = getLocalSession();
    setSession(current);
  }, []);

  return {
    // Session state
    session,
    isIdentified: !!session?.leadId,
    leadId: session?.leadId,
    anonymousId: session?.anonymousId,
    funnelStage: session?.funnelStage,
    leadScore: session ? calculateLeadScore(session) : 0,
    grade: session?.grade,
    forensicFlags: session?.forensicFlags,

    // Actions
    startAudit: handleStartAudit,
    captureMidFunnel: handleCaptureMidFunnel,
    hitTruthGate: handleHitTruthGate,
    markAbandoned: handleMarkAbandoned,
    captureLead: handleCaptureLead,
    revealGrade: handleRevealGrade,

    // Utilities
    update: handleUpdate,
    pushEvent: pushToDataLayer,
    refresh: handleRefresh,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export default {
  // Constants
  STORAGE_KEY,
  SESSION_EXPIRY_DAYS,
  SESSION_VERSION,
  FUNNEL_STAGES,
  GRADES,
  FORENSIC_FLAGS,

  // Core functions
  initSession,
  getSession,
  updateSession,

  // Stage transitions
  startAudit,
  captureMidFunnelData,
  hitTruthGate,
  markTruthGateAbandoned,
  captureLead,
  revealGrade,

  // Utilities
  calculateLeadScore,
  getQuoteBracket,
  pushToDataLayer,
  canProgressTo,

  // React hook
  useGoldenThread,
};
