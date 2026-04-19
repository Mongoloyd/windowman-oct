/**
 * useFunnelStore.ts — WindowMan Funnel State
 * SYNTHESIS: Their version (persistence + milestones) + Our version (Supabase linkage + UTM + scan results)
 *
 * WHAT PERSISTS TO LOCALSTORAGE (safe, non-PII):
 *   Intelligence payload: windowCount, projectType, county, quoteRange, processStage
 *   Flow assignment: assignedFlow
 *   Behavioral: highestStepReached, isLeadCaptured, isQuoteUploaded, isScanComplete
 *   Attribution: utmSource, utmCampaign, utmCounty
 *
 * WHAT NEVER PERSISTS (session only — clears on browser close):
 *   currentStep, currentScreen, sectionsViewed (UI navigation)
 *   shadowId, leadId (Supabase row IDs)
 *   grade, dollarDelta, pillarScores, flags (scan results)
 *   phoneVerified (OTP state)
 *   firstName, email, phone — NEVER IN STORAGE
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { trackGtmEvent } from '@/lib/trackConversion';
import { trackBusinessEvent } from '@/lib/tracking/trackBusinessEvent';
import { BUSINESS_EVENTS } from '@/lib/tracking/events';

// ── TYPES ─────────────────────────────────────────────────────────────────────

export type FlowType = 'A' | 'B' | 'C' | null;
// A = "I have a written quote from a contractor"   → forensic scan + grade
// B = "I'm still in the research phase"            → market baseline tool
// C = verbal/appointment (ballpark or visit)       → leverage mode, highest urgency

export type FunnelScreen =
  | 'hero'
  | 'gate_step_1' | 'gate_step_2' | 'gate_step_3' | 'gate_step_4'
  | 'micro_verdict'
  | 'lead_gate'
  | 'upload'
  | 'scanning'
  | 'otp'
  | 'grade_reveal'
  | 'contractor_match'
  | 'flow_b_baseline'
  | 'flow_c_leverage';

export interface PillarScores {
  priceFairness: number;
  finePrint:     number;
  warrantyValue: number;
  installClarity: number;
  safetyCode:    number;
}

export interface FlagItem {
  severity: 'CRITICAL' | 'HIGH' | 'LEVERAGE';
  title:    string;
  body:     string;
  script:   string; // Negotiation script for the homeowner
}

// ── COUNTY MAP — UTM code → display name ─────────────────────────────────────

export const UTM_COUNTY_MAP: Record<string, { name: string; slug: string }> = {
  MDA: { name: 'Miami-Dade',   slug: 'miami-dade'   },
  BRO: { name: 'Broward',      slug: 'broward'      },
  PLB: { name: 'Palm Beach',   slug: 'palm-beach'   },
  MON: { name: 'Monroe',       slug: 'monroe'       },
  HCO: { name: 'Hillsborough', slug: 'hillsborough' },
  PIN: { name: 'Pinellas',     slug: 'pinellas'     },
  LEE: { name: 'Lee',          slug: 'lee'          },
  COL: { name: 'Collier',      slug: 'collier'      },
  SAR: { name: 'Sarasota',     slug: 'sarasota'     },
  DUV: { name: 'Duval',        slug: 'duval'        },
  ORA: { name: 'Orange',       slug: 'orange'       },
  SEM: { name: 'Seminole',     slug: 'seminole'     },
  BRE: { name: 'Brevard',      slug: 'brevard'      },
  SLU: { name: 'St. Lucie',    slug: 'st-lucie'     },
  ESC: { name: 'Escambia',     slug: 'escambia'     },
  BAY: { name: 'Bay',          slug: 'bay'          },
};

// ── COUNTY VERDICT DATA — for Micro-Verdict card ──────────────────────────────

export const COUNTY_VERDICT_DATA: Record<string, { low: number; high: number; flag: string }> = {
  'Miami-Dade':   { low: 4200, high: 7100, flag: 'unlicensed brand substitution'      },
  'Broward':      { low: 3800, high: 6200, flag: 'unspecified window brands'           },
  'Palm Beach':   { low: 4100, high: 6800, flag: 'inflated permit fees'               },
  'Monroe':       { low: 5200, high: 9100, flag: 'scope padding on multi-story homes' },
  'Lee':          { low: 3600, high: 5900, flag: 'post-storm demand surcharges'        },
  'Collier':      { low: 4400, high: 7200, flag: 'unlicensed subcontractor disclosure' },
  'Hillsborough': { low: 3200, high: 5400, flag: 'unspecified installation method'    },
  'Pinellas':     { low: 3400, high: 5600, flag: 'missing warranty documentation'     },
  'Orange':       { low: 2800, high: 4600, flag: 'vague scope language'               },
  'Seminole':     { low: 2900, high: 4800, flag: 'missing permit line item'           },
  'Duval':        { low: 2900, high: 4800, flag: 'missing permit line item'           },
  'Brevard':      { low: 3100, high: 5200, flag: 'unspecified window brands'          },
  'St. Lucie':    { low: 3000, high: 5000, flag: 'missing warranty documentation'     },
  'Sarasota':     { low: 3300, high: 5500, flag: 'vague scope language'               },
  'Escambia':     { low: 2700, high: 4400, flag: 'non-Florida NOA products'           },
  'Bay':          { low: 2800, high: 4600, flag: 'non-Florida NOA products'           },
  'default':      { low: 3200, high: 5400, flag: 'unspecified window brands'          },
};

// ── STATE INTERFACE ───────────────────────────────────────────────────────────

interface FunnelState {
  // 1. INTELLIGENCE PAYLOAD (persisted to localStorage — non-PII safe)
  windowCount:         string | null;
  projectType:         string | null;
  county:              string | null;
  countySlug:          string | null;
  quoteRange:          string | null;
  processStage:        string | null;  // exact Step 4 answer text
  assignedFlow:        FlowType;
  highestStepReached:  number;         // for Exit Intent accuracy
  utmSource:           string | null;
  utmCampaign:         string | null;
  utmCounty:           string | null;  // raw UTM code, e.g. "BRO"

  // 2. SUPABASE LINKAGE (session only — never persisted)
  shadowId:  string | null;
  leadId:    string | null;

  // 3. NAVIGATION (session only)
  currentStep:     number;
  currentScreen:   FunnelScreen;
  sectionsViewed:  string[];

  // 4. CONVERSION MILESTONES (persisted — drives Sticky Recovery Bar)
  isLeadCaptured:  boolean;
  isQuoteUploaded: boolean;
  isScanComplete:  boolean;
  phoneVerified:   boolean;

  // 5. SCAN RESULTS (session only)
  grade:           'A' | 'B' | 'C' | 'D' | 'F' | null;
  dollarDelta:     number | null;
  deltaDirection:  'above' | 'below' | 'at' | null;
  flagCount:       number;
  leverageCount:   number;
  topFlag:         FlagItem | null;
  pillarScores:    PillarScores | null;
  allFlags:        FlagItem[];

  // ── ACTIONS ────────────────────────────────────────────────────────────────

  // Intelligence setters
  setWindowCount: (count: string)  => void;
  setProjectType: (type: string)   => void;
  setCounty:      (name: string, slug: string) => void;

  // THE HIDDEN FORK — atomic action for Step 4
  // Sets quoteRange + processStage + assignedFlow + advances step in one call
  setQuoteRangeAndFlow: (range: string, processStage: string) => void;

  // Navigation
  nextStep:           () => void;
  setScreen:          (screen: FunnelScreen) => void;
  markSectionViewed:  (sectionId: string)    => void;

  // Supabase linkage
  setShadowId: (id: string) => void;
  setLeadId:   (id: string) => void;

  // Conversion milestones
  captureLead:     () => void;
  completeUpload:  () => void;
  completeScan:    () => void;
  setPhoneVerified:(verified: boolean) => void;

  // Scan result setter
  setScanResult: (result: {
    grade:          'A' | 'B' | 'C' | 'D' | 'F';
    dollarDelta:    number;
    deltaDirection: 'above' | 'below' | 'at';
    flagCount:      number;
    leverageCount:  number;
    topFlag:        FlagItem;
    pillarScores:   PillarScores;
    allFlags:       FlagItem[];
  }) => void;

  // UTM capture — call once on app mount
  captureUTM: () => void;

  // Derived getters (computed values — no need to call, read directly)
  getCountyVerdict: () => typeof COUNTY_VERDICT_DATA['default'];
  getExitIntentMessage: () => string;

  // Reset
  resetSession: () => void;
}

// ── INITIAL STATE ──────────────────────────────────────────────────────────────

const initialState = {
  windowCount: null,  projectType: null,   county: null,
  countySlug: null,   quoteRange: null,    processStage: null,
  assignedFlow: null as FlowType,
  highestStepReached: 0,
  utmSource: null,    utmCampaign: null,   utmCounty: null,

  shadowId: null,     leadId: null,

  currentStep: 0,     currentScreen: 'hero' as FunnelScreen,
  sectionsViewed: [],

  isLeadCaptured: false,  isQuoteUploaded: false,
  isScanComplete: false,  phoneVerified: false,

  grade: null,        dollarDelta: null,   deltaDirection: null,
  flagCount: 0,       leverageCount: 0,   topFlag: null,
  pillarScores: null, allFlags: [],
};

// ── FLOW ROUTING LOGIC ─────────────────────────────────────────────────────────

function deriveFlow(processStage: string): FlowType {
  if (processStage === 'I have a written quote from a contractor') return 'A';
  if (processStage === "I'm still in the research phase")          return 'B';
  // "I got a ballpark number but nothing in writing" or "I have a contractor visit coming up"
  return 'C';
}

function deriveScreenFromFlow(flow: FlowType): FunnelScreen {
  if (flow === 'A') return 'micro_verdict';
  if (flow === 'B') return 'flow_b_baseline';
  return 'flow_c_leverage'; // C — most urgent
}

// ── (Browser Meta/fbq helpers removed — all tracking now flows through
//     the canonical dataLayer via trackGtmEvent / trackBusinessEvent.) ─────────

// ── THE STORE ─────────────────────────────────────────────────────────────────

export const useFunnelStore = create<FunnelState>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ── DATA SETTERS ─────────────────────────────────────────────────────────

      setWindowCount: (count) => {
        set({ windowCount: count });
        trackGtmEvent('wm_step1_complete', { window_count: count });
      },

      setProjectType: (type) => {
        set({ projectType: type });
        trackGtmEvent('wm_step2_complete', { project_type: type });
      },

      setCounty: (name, slug) => {
        set({ county: name, countySlug: slug });
        trackGtmEvent('wm_step3_complete', { county: name });
        trackGtmEvent('wm_county_identified', { county: name });
      },

      // ── THE HIDDEN FORK — most critical action ────────────────────────────────
      setQuoteRangeAndFlow: (range, processStage) => {
        const flow    = deriveFlow(processStage);
        const screen  = deriveScreenFromFlow(flow);
        const nextStp = get().currentStep + 1;

        set({
          quoteRange:         range,
          processStage,
          assignedFlow:       flow,
          currentStep:        nextStp,
          currentScreen:      screen,
          highestStepReached: Math.max(get().highestStepReached, nextStp),
        });

        trackGtmEvent('wm_step4_complete', {
          quote_range:   range,
          process_stage: processStage,
          flow,
          county:        get().county,
        });
        trackGtmEvent('wm_flow_routed', { flow, county: get().county });
      },

      // ── NAVIGATION ───────────────────────────────────────────────────────────

      nextStep: () => {
        const next = get().currentStep + 1;
        set({
          currentStep:        next,
          highestStepReached: Math.max(get().highestStepReached, next),
        });
      },

      setScreen: (screen) => set({ currentScreen: screen }),

      markSectionViewed: (sectionId) =>
        set((s) => ({
          sectionsViewed: s.sectionsViewed.includes(sectionId)
            ? s.sectionsViewed
            : [...s.sectionsViewed, sectionId],
        })),

      // ── SUPABASE LINKAGE ─────────────────────────────────────────────────────

      setShadowId: (id) => set({ shadowId: id }),
      setLeadId:   (id) => set({ leadId:   id }),

      // ── CONVERSION MILESTONES ─────────────────────────────────────────────────

      captureLead: () => {
        set({ isLeadCaptured: true });
        trackGtmEvent('wm_lead_submitted', {
          county: get().county,
          flow:   get().assignedFlow,
        });
      },

      completeUpload: () => {
        set({ isQuoteUploaded: true });
        trackBusinessEvent(BUSINESS_EVENTS.quote_uploaded, {
          county: get().county,
        });
      },

      completeScan: () => {
        set({ isScanComplete: true });
        trackGtmEvent('wm_scan_completed', { county: get().county });
      },

      setPhoneVerified: (verified) => {
        set({ phoneVerified: verified });
        // NOTE: Canonical `phone_verified` business event is owned by the
        // post-scan reveal path (PostScanReportSwitcher). This setter only
        // mirrors verification state into the funnel store and intentionally
        // does NOT emit a duplicate browser event.
      },

      // ── SCAN RESULT SETTER ────────────────────────────────────────────────────

      setScanResult: (result) => {
        set({
          grade:          result.grade,
          dollarDelta:    result.dollarDelta,
          deltaDirection: result.deltaDirection,
          flagCount:      result.flagCount,
          leverageCount:  result.leverageCount,
          topFlag:        result.topFlag,
          pillarScores:   result.pillarScores,
          allFlags:       result.allFlags,
          isScanComplete: true,
        });
        trackGtmEvent('wm_grade_revealed', {
          grade:        result.grade,
          dollar_delta: result.dollarDelta,
          county:       get().county,
        });
      },

      // ── UTM CAPTURE ───────────────────────────────────────────────────────────

      captureUTM: () => {
        if (typeof window === 'undefined') return;
        const p = new URLSearchParams(window.location.search);
        const rawCounty = p.get('utm_term') || p.get('county');
        const resolved  = rawCounty ? UTM_COUNTY_MAP[rawCounty.toUpperCase()] : null;

        set({
          utmSource:   p.get('utm_source'),
          utmCampaign: p.get('utm_campaign'),
          utmCounty:   rawCounty,
          // Pre-fill county if ad-click brought them in with a county code
          ...(resolved && !get().county
            ? { county: resolved.name, countySlug: resolved.slug }
            : {}),
        });
      },

      // ── DERIVED GETTERS ───────────────────────────────────────────────────────

      getCountyVerdict: () => {
        const c = get().county;
        return c
          ? (COUNTY_VERDICT_DATA[c] ?? COUNTY_VERDICT_DATA['default'])
          : COUNTY_VERDICT_DATA['default'];
      },

      // Exit Intent modal copy — driven by highestStepReached
      getExitIntentMessage: () => {
        const step    = get().highestStepReached;
        const county  = get().county;
        const verdict = get().getCountyVerdict();

        if (step === 0) {
          return "Before you go — 73% of Florida impact window quotes have at least one flag. Is yours in the 27%?";
        }
        if (step === 1) {
          return `You started your analysis. ${county ? `${county} County homeowners` : 'Florida homeowners'} found an average of $4,800 in overpayments last month.`;
        }
        if (step === 2) {
          return `You're two steps from your county baseline. Don't leave without knowing the fair-market range for ${county || 'your county'}.`;
        }
        if (step === 3) {
          // Most powerful — they answered county, Zeigarnik is maximum
          return `You answered 3 of 4 questions. Your ${county || ''} County analysis is 75% configured. Don't leave $${verdict.low.toLocaleString()}–$${verdict.high.toLocaleString()} on the table.`;
        }
        // Step 4+ — they saw the micro-verdict, maximum investment
        return `Your analysis is ready. The ${county || 'Florida'} data is loaded. One more step unlocks your forensic grade.`;
      },

      // ── RESET ─────────────────────────────────────────────────────────────────

      resetSession: () => set(initialState),
    }),
    {
      name: 'windowman-shadow-profile',
      storage: createJSONStorage(() => localStorage),
      // PARTIALIZE — persist ONLY non-PII intelligence payload
      // Never persist: currentStep, currentScreen, shadowId, leadId, PII, scan results
      partialize: (s) => ({
        windowCount:        s.windowCount,
        projectType:        s.projectType,
        county:             s.county,
        countySlug:         s.countySlug,
        quoteRange:         s.quoteRange,
        processStage:       s.processStage,
        assignedFlow:       s.assignedFlow,
        highestStepReached: s.highestStepReached,
        utmSource:          s.utmSource,
        utmCampaign:        s.utmCampaign,
        utmCounty:          s.utmCounty,
        isLeadCaptured:     s.isLeadCaptured,
        isQuoteUploaded:    s.isQuoteUploaded,
        isScanComplete:     s.isScanComplete,
      }),
    }
  )
);
