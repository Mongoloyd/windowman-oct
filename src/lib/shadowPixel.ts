/**
 * shadowPixel.ts — Shadow Retargeting Architecture
 * 
 * THE STRATEGY:
 * wm_shadow_created (Step 2 completion) = your warm abandonment audience
 * 
 * AUDIENCE RECIPE:
 *   Include: wm_shadow_created
 *   Exclude: Lead (standard Meta event, fires at lead gate submit)
 *   Result:  People who started an audit and DIDN'T complete the lead gate
 *            These are the highest-intent non-converted visitors in your pixel.
 *            Expected CPM: $12–18 vs $28–40 cold interest targeting.
 *            Expected ROAS: 4–6x vs 1.5–2x cold.
 *
 * CAPI DEDUPLICATION:
 *   Browser events fire immediately (low latency, high match rate on iOS)
 *   Server events fire from Supabase edge function (survive iOS/Safari blocking)
 *   Meta deduplicates using event_id — same event_id from both = counted once
 *   Result: ~30% improvement in match rate vs browser-only
 */

import { v4 as uuidv4 } from 'uuid'; // add uuid to package.json if not present

// ── TYPES ─────────────────────────────────────────────────────────────────────

interface ShadowEventPayload {
  eventName:     string;
  eventId:       string;         // dedup key — must match CAPI call
  userId?:       string;         // hashed email or phone (never plain text)
  county?:       string;
  windowCount?:  string;
  projectType?:  string;
  quoteRange?:   string;
  flow?:         string;
  step?:         number;
  utmSource?:    string;
  utmCampaign?:  string;
  value?:        number;
  currency?:     string;
}

// ── SHA-256 HASHER (required by Meta CAPI spec) ───────────────────────────────

async function sha256(text: string): Promise<string> {
  const buffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(text.toLowerCase().trim())
  );
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── BROWSER PIXEL FIRE ────────────────────────────────────────────────────────

function fireBrowserPixel(
  eventName: string,
  params: Record<string, unknown>,
  eventId: string
) {
  if (typeof window === 'undefined' || !(window as any).fbq) return;
  (window as any).fbq('trackCustom', eventName, params, { eventID: eventId });
}

// ── SERVER-SIDE CAPI FIRE (via Supabase edge function) ────────────────────────

async function fireCAPI(payload: ShadowEventPayload) {
  const capiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capi-event`;
  if (!capiUrl) return;

  try {
    await fetch(capiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    // Silent fail — CAPI is supplementary, not blocking
  }
}

// ── MAIN EVENT FUNCTION ───────────────────────────────────────────────────────

async function fireEvent(
  eventName: string,
  params: Record<string, unknown> & {
    email?: string;
    phone?: string;
    county?: string;
    windowCount?: string;
    projectType?: string;
    quoteRange?: string;
    flow?: string;
    step?: number;
  }
): Promise<string> {
  const eventId = `wm_${eventName}_${Date.now()}_${uuidv4().slice(0,8)}`;

  // Hash PII for CAPI (never send plain text email/phone to Meta)
  const hashedEmail = params.email ? await sha256(params.email) : undefined;
  const hashedPhone = params.phone
    ? await sha256(params.phone.replace(/\D/g, ''))
    : undefined;

  // 1. Browser pixel (immediate, high latency tolerance)
  const browserParams: Record<string, unknown> = { ...params };
  delete browserParams.email;
  delete browserParams.phone;
  fireBrowserPixel(eventName, browserParams, eventId);

  // 2. Server-side CAPI (async, survives iOS blocking)
  await fireCAPI({
    eventName,
    eventId,
    userId:      hashedEmail || hashedPhone,
    county:      params.county as string | undefined,
    windowCount: params.windowCount as string | undefined,
    projectType: params.projectType as string | undefined,
    quoteRange:  params.quoteRange as string | undefined,
    flow:        params.flow as string | undefined,
    step:        params.step as number | undefined,
    utmSource:   (params.utmSource ?? new URLSearchParams(window.location.search).get('utm_source') ?? undefined) as string | undefined,
    utmCampaign: (params.utmCampaign ?? new URLSearchParams(window.location.search).get('utm_campaign') ?? undefined) as string | undefined,
  });

  return eventId;
}

// ── PUBLIC API — Named events ─────────────────────────────────────────────────

export const shadowPixel = {

  /**
   * wm_shadow_created — fires at Step 2 completion
   * THIS is your abandonment retargeting audience seed.
   * Required params: county, windowCount, projectType
   */
  shadowCreated: (params: {
    county:      string | null;
    windowCount: string;
    projectType: string;
    utmSource?:  string;
    utmCampaign?:string;
  }) => fireEvent('wm_shadow_created', {
    ...params,
    step: 2,
    // Also fire standard Meta events for broad audience building
  }).then(eventId => {
    // Fire standard ViewContent to signal high-intent page engagement
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'ViewContent', {
        content_name: 'Impact Window Quote Analysis',
        content_category: 'Home Improvement',
        content_ids: [params.county || 'FL'],
      }, { eventID: `vc_${eventId}` });
    }
    return eventId;
  }),

  /**
   * wm_step3_county — fires when county is identified
   * Enables county-specific abandonment ads
   */
  countyIdentified: (county: string, utmCounty?: string | null) =>
    fireEvent('wm_county_identified', { county, utmCounty }),

  /**
   * wm_flow_routed — fires when Step 4 is answered
   * Audience: people who answered Step 4 but didn't give phone
   * Ad copy: "You're one step from your [County] forensic grade"
   */
  flowRouted: (params: { county: string | null; flow: string; quoteRange: string }) =>
    fireEvent('wm_flow_routed', params),

  /**
   * Lead (standard Meta event) — fires at lead gate submit
   * This is what you EXCLUDE from the shadow audience
   * Audience math: shadow_created - Lead = abandonments
   */
  leadCaptured: async (params: {
    county:     string | null;
    flow:       string | null;
    email?:     string;
    phone?:     string;
  }) => {
    const eventId = await fireEvent('wm_lead_submitted', params);
    // Also fire standard Meta Lead event (required for conversion optimization)
    if (typeof window !== 'undefined' && (window as any).fbq) {
      (window as any).fbq('track', 'Lead', {
        content_name: 'Impact Window Lead',
        content_category: params.flow === 'C' ? 'Pre-Quote High Urgency' :
                          params.flow === 'A' ? 'Has Written Quote' : 'Research Phase',
      }, { eventID: `lead_${eventId}` });
    }
    return eventId;
  },

  /**
   * wm_otp_verified — fires on successful phone verification
   * Your highest-value audience — verified, high-intent homeowners
   */
  otpVerified: (params: { county: string | null; flow: string | null; phone?: string }) =>
    fireEvent('wm_otp_verified', params).then(eventId => {
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Purchase', { value: 0, currency: 'USD' }, { eventID: `purchase_${eventId}` });
        (window as any).fbq('track', 'CompleteRegistration', {}, { eventID: `reg_${eventId}` });
      }
      return eventId;
    }),

  /**
   * wm_grade_revealed — fires when grade is shown
   * Audience: people who saw a D or F grade (highest contractor-match intent)
   */
  gradeRevealed: (params: { grade: string; dollarDelta: number; county: string | null }) =>
    fireEvent('wm_grade_revealed', params).then(eventId => {
      if ((params.grade === 'D' || params.grade === 'F') && typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('trackCustom', 'wm_grade_critical', params, { eventID: `critical_${eventId}` });
      }
      return eventId;
    }),

  /**
   * wm_contractor_match_requested — fires when they click the final CTA
   * Standard Meta Schedule event — your highest-conversion signal
   */
  contractorMatchRequested: (params: { county: string | null; grade: string }) =>
    fireEvent('wm_contractor_match_requested', params).then(eventId => {
      if (typeof window !== 'undefined' && (window as any).fbq) {
        (window as any).fbq('track', 'Schedule', {}, { eventID: `schedule_${eventId}` });
      }
      return eventId;
    }),
};

// ── RETARGETING AD COPY LIBRARY ───────────────────────────────────────────────

/**
 * Use these in your Facebook Ad Manager.
 * Each audience → ad set → copy variant.
 * Keep frequency cap at 3x/7 days for abandonment audiences.
 * Exclusion audiences prevent overlap.
 */

export const RETARGETING_PLAYBOOK = {

  audience1: {
    name: 'Shadow Abandonment — County Unknown',
    facebookAudience: {
      include: ['wm_shadow_created'],
      exclude: ['Lead'],
      lookback: 14,  // days
      frequency: { cap: 3, window: 7 },
    },
    adCopy: [
      {
        headline: "You Started Your Impact Window Audit",
        body: "You answered 2 questions and never finished. Florida homeowners who complete the scan find $4,800 on average. One question left.\n\nComplete your scan — it's free.",
        cta: "FINISH MY SCAN",
        utm_content: "shadow_abnd_no_county",
      },
    ],
  },

  audience2: {
    name: 'Shadow Abandonment — County Known (Highest Value)',
    facebookAudience: {
      include: ['wm_county_identified'],
      exclude: ['Lead'],
      lookback: 7,
      frequency: { cap: 3, window: 7 },
      note: 'Segment by county using custom parameters for hyper-local copy',
    },
    // County-specific copy — generates one per county
    buildAdCopy: (county: string, verdictLow: number, verdictHigh: number, topFlag: string) => ([
      {
        headline: `You Started Your ${county} County Audit`,
        body: `Your ${county} County data is loaded. ${county} homeowners found $${verdictLow.toLocaleString()}–$${verdictHigh.toLocaleString()} in overpayments last month.\n\nThe most common issue in your market: ${topFlag}.\n\nYou're one question from your forensic grade.`,
        cta: "UNLOCK MY GRADE",
        utm_content: `shadow_abnd_${county.toLowerCase().replace(' ','-')}`,
      },
      {
        headline: `Don't Sign Before Checking This`,
        body: `You checked your ${county} impact window quote against our database. The scan isn't finished.\n\nYou answered 3 of 4 questions. Don't let $4,800 sit on the table.`,
        cta: "FINISH MY ANALYSIS",
        utm_content: `shadow_abnd_${county.toLowerCase().replace(' ','-')}_v2`,
      },
    ]),
  },

  audience3: {
    name: 'Flow C High-Urgency Re-engagement',
    facebookAudience: {
      include: ['wm_flow_routed'], // where flow = C
      exclude: ['Lead'],
      lookback: 3,   // 3 days only — urgency decays fast
      frequency: { cap: 5, window: 3 },  // more aggressive — time-sensitive
    },
    adCopy: [
      {
        headline: "The Contractor Arrives Soon",
        body: "You told us a contractor visit is coming up. Before they arrive, get your county's fair-market baseline — it changes every conversation.\n\nFree. Takes 4 minutes.",
        cta: "GET MY BASELINE",
        utm_content: "flow_c_reengagement",
      },
    ],
  },

  audience4: {
    name: 'Grade D/F Re-engagement (Contractor Match)',
    facebookAudience: {
      include: ['wm_grade_critical'],  // grade D or F
      exclude: ['wm_contractor_match_requested'],
      lookback: 30,
      frequency: { cap: 4, window: 7 },
    },
    adCopy: [
      {
        headline: "Your Quote Got an F. Here's What to Do.",
        body: "WindowMan found critical issues in your impact window quote. We have a verified contractor in your county who can beat it — and fix the problems.\n\nYou approved the introduction. We're ready when you are.",
        cta: "CONNECT ME NOW",
        utm_content: "grade_f_retarget",
      },
    ],
  },

  audience5: {
    name: 'Verified Leads — Lookalike Seed (Best Quality)',
    facebookAudience: {
      source: 'wm_otp_verified',
      lookback: 180,    // 6 months for a large enough seed audience
      lookalike: { size: 1, countries: ['US'], states: ['FL'] },
      note: 'Use as seed for 1% lookalike — your highest-quality cold traffic audience',
    },
    usageNote: 'This is not a retargeting audience. Use as lookalike seed for prospecting campaigns.',
  },
};

// ── CAMPAIGN BUDGET ALLOCATION (starting point) ───────────────────────────────

export const CAMPAIGN_BUDGET_GUIDE = {
  phase1_south_florida: {
    daily_budget: 30,
    allocation: {
      cold_interest_targeting:   '60%',  // $18/day
      shadow_abandonment:        '25%',  // $7.50/day (highest ROAS once audience builds)
      county_abandonment:        '15%',  // $4.50/day (most personalized)
    },
    expected_leads_per_day:     '4-8',
    expected_cpl:               '$8-15',
    expected_roas_at_30_days:   '8-12x',
  },
  phase2_tampa_bay: {
    daily_budget: 20,
    allocation: {
      cold_interest_targeting:  '70%',
      shadow_abandonment:       '30%',
    },
    note: 'Shadow audience needs 2 weeks of data before it performs. Start with cold targeting.',
  },
  phase3_statewide: {
    daily_budget_per_dma: 15,
    dmas: ['Orlando', 'Jacksonville', 'Fort Myers-Naples', 'Gainesville'],
    note: 'Scale DMAs that hit CPL < $12 in first 2 weeks.',
  },
};
