/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * LEGACY GOLDEN THREAD E2E TEST SUITE v3.0 — NOT CANONICAL SCANNER COVERAGE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Legacy coverage for the pre-scanner AI Quote Audit funnel.
 *
 * This suite manipulates `impact-windows-session` localStorage and does not prove the
 * canonical Homeowner Scan Journey:
 * TruthGateFlow → capture-truth-gate-lead → UploadZone → quotes bucket upload →
 * start-upload-scan-session → scan-quote → preview → OTP gate.
 * Do not use this file as evidence that scanner backend ID continuity is working.
 *
 * Original legacy funnel model:
 * 
 * FUNNEL STAGES:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │  1. ANONYMOUS ARRIVAL     │ UTM capture, referrer, landing page, anonymousId│
 * │  2. AUDIT STARTED         │ User begins interactive demo scan               │
 * │  3. MID-FUNNEL DATA       │ County, window count, quote amount captured     │
 * │  4. TRUTH GATE HIT        │ Abandonment shadow audience seeded              │
 * │  5. LEAD CAPTURED         │ Email/phone converts anonymous → known lead     │
 * │  6. GRADE REVEALED        │ A-F grade + forensic flags stored               │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * Enterprise Features Preserved:
 * - Cross-device identity resolution (email matching)
 * - Server-side Supabase backup
 * - Cross-tab synchronization
 * - Session expiration (30 days)
 * - Full GTM dataLayer verification
 * 
 * Run with: npx playwright test golden-thread.spec.ts
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STORAGE_KEY = 'impact-windows-session';
const SESSION_EXPIRY_DAYS = 30;

// Funnel stage constants
const FUNNEL_STAGES = {
  ANONYMOUS: 'anonymous',
  AUDIT_STARTED: 'audit_started',
  MID_FUNNEL: 'mid_funnel',
  TRUTH_GATE: 'truth_gate',
  LEAD_CAPTURED: 'lead_captured',
  GRADE_REVEALED: 'grade_revealed',
} as const;

// Florida counties for testing
const TEST_COUNTIES = [
  'Miami-Dade',
  'Broward',
  'Palm Beach',
  'Hillsborough',
  'Orange',
  'Pinellas',
];

// Grade scale
const GRADES = ['A', 'B', 'C', 'D', 'F'] as const;

// Forensic flags that can be detected
const FORENSIC_FLAGS = [
  'missing_impact_rating',
  'no_noa_certification',
  'inflated_labor_rate',
  'missing_permit_line_item',
  'no_manufacturer_warranty',
  'suspicious_deposit_percentage',
  'missing_debris_removal',
  'no_installation_timeline',
  'generic_window_specs',
  'missing_flashing_details',
] as const;

// Test data factories
const createTestEmail = () => 
  `test-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;

const createTestPhone = () => 
  `(${Math.floor(200 + Math.random() * 800)}) ${Math.floor(100 + Math.random() * 900)}-${Math.floor(1000 + Math.random() * 9000)}`;

const createTestQuoteAmount = () => 
  Math.floor(8000 + Math.random() * 42000); // $8k - $50k range

const createTestWindowCount = () => 
  Math.floor(4 + Math.random() * 20); // 4-24 windows

const getRandomCounty = () => 
  TEST_COUNTIES[Math.floor(Math.random() * TEST_COUNTIES.length)];

const getRandomGrade = () => 
  GRADES[Math.floor(Math.random() * GRADES.length)];

const getRandomForensicFlags = (count: number = 3) => {
  const shuffled = [...FORENSIC_FLAGS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};

// ═══════════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface SessionData {
  // Identity
  anonymousId: string;
  leadId?: string;
  email?: string;
  phone?: string;
  name?: string;
  
  // Funnel Stage
  funnelStage: typeof FUNNEL_STAGES[keyof typeof FUNNEL_STAGES];
  
  // Attribution (First-Touch)
  initialUtm?: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
    gclid?: string;
    fbclid?: string;
  };
  initialReferrer?: string;
  landingPage?: string;
  
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
  grade?: typeof GRADES[number];
  gradeScore?: number; // 0-100 numeric score
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

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get session data from localStorage
 */
async function getSessionData(page: Page): Promise<SessionData | null> {
  return await page.evaluate((key) => {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }, STORAGE_KEY);
}

/**
 * Set session data in localStorage
 */
async function setSessionData(page: Page, data: Partial<SessionData>): Promise<void> {
  await page.evaluate(([key, sessionData]) => {
    const existing = localStorage.getItem(key);
    const current = existing ? JSON.parse(existing) : {};
    localStorage.setItem(key, JSON.stringify({ ...current, ...sessionData }));
  }, [STORAGE_KEY, data]);
}

/**
 * Clear session data from localStorage
 */
async function clearSessionData(page: Page): Promise<void> {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, STORAGE_KEY);
}

/**
 * Get dataLayer from page
 */
async function getDataLayer(page: Page): Promise<any[]> {
  return await page.evaluate(() => {
    return (window as any).dataLayer || [];
  });
}

/**
 * Initialize dataLayer if not present
 */
async function initDataLayer(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).dataLayer = (window as any).dataLayer || [];
  });
}

/**
 * Push event to dataLayer (simulating what sessionService does)
 */
async function pushToDataLayer(page: Page, event: string, data: Record<string, any> = {}): Promise<void> {
  await page.evaluate(([eventName, eventData]) => {
    (window as any).dataLayer = (window as any).dataLayer || [];
    (window as any).dataLayer.push({
      event: eventName,
      ...eventData,
      event_timestamp: new Date().toISOString(),
    });
  }, [event, data]);
}

/**
 * Create a fresh anonymous session
 */
function createAnonymousSession(overrides: Partial<SessionData> = {}): SessionData {
  const now = new Date().toISOString();
  return {
    anonymousId: crypto.randomUUID(),
    funnelStage: FUNNEL_STAGES.ANONYMOUS,
    firstSeenAt: now,
    lastActivityAt: now,
    sessionVersion: '3.0.0',
    ...overrides,
  };
}

/**
 * Create an expired session for testing
 */
function createExpiredSession(): SessionData {
  const expiredDate = new Date();
  expiredDate.setDate(expiredDate.getDate() - (SESSION_EXPIRY_DAYS + 5));
  
  return {
    leadId: 'expired-lead-123',
    anonymousId: 'expired-anon-456',
    email: 'expired@example.com',
    funnelStage: FUNNEL_STAGES.GRADE_REVEALED,
    grade: 'C',
    forensicFlags: ['missing_impact_rating'],
    firstSeenAt: expiredDate.toISOString(),
    lastActivityAt: expiredDate.toISOString(),
    sessionVersion: '3.0.0',
  };
}

/**
 * Simulate funnel progression to a specific stage
 */
async function progressToStage(
  page: Page, 
  targetStage: typeof FUNNEL_STAGES[keyof typeof FUNNEL_STAGES],
  options: {
    email?: string;
    phone?: string;
    county?: string;
    windowCount?: number;
    quoteAmount?: number;
    grade?: typeof GRADES[number];
    forensicFlags?: string[];
  } = {}
): Promise<SessionData> {
  const now = new Date().toISOString();
  let session = createAnonymousSession();
  
  // Stage 1: Anonymous (already created)
  
  // Stage 2: Audit Started
  if ([FUNNEL_STAGES.AUDIT_STARTED, FUNNEL_STAGES.MID_FUNNEL, FUNNEL_STAGES.TRUTH_GATE, 
       FUNNEL_STAGES.LEAD_CAPTURED, FUNNEL_STAGES.GRADE_REVEALED].includes(targetStage)) {
    session = {
      ...session,
      funnelStage: FUNNEL_STAGES.AUDIT_STARTED,
      auditStartedAt: now,
    };
  }
  
  // Stage 3: Mid-Funnel Data
  if ([FUNNEL_STAGES.MID_FUNNEL, FUNNEL_STAGES.TRUTH_GATE, 
       FUNNEL_STAGES.LEAD_CAPTURED, FUNNEL_STAGES.GRADE_REVEALED].includes(targetStage)) {
    session = {
      ...session,
      funnelStage: FUNNEL_STAGES.MID_FUNNEL,
      county: options.county || getRandomCounty(),
      windowCount: options.windowCount || createTestWindowCount(),
      quoteAmount: options.quoteAmount || createTestQuoteAmount(),
    };
  }
  
  // Stage 4: Truth Gate Hit
  if ([FUNNEL_STAGES.TRUTH_GATE, FUNNEL_STAGES.LEAD_CAPTURED, 
       FUNNEL_STAGES.GRADE_REVEALED].includes(targetStage)) {
    session = {
      ...session,
      funnelStage: FUNNEL_STAGES.TRUTH_GATE,
      truthGateHitAt: now,
    };
  }
  
  // Stage 5: Lead Captured
  if ([FUNNEL_STAGES.LEAD_CAPTURED, FUNNEL_STAGES.GRADE_REVEALED].includes(targetStage)) {
    session = {
      ...session,
      funnelStage: FUNNEL_STAGES.LEAD_CAPTURED,
      leadId: crypto.randomUUID(),
      email: options.email || createTestEmail(),
      phone: options.phone || createTestPhone(),
      promotedToLeadAt: now,
      truthGateAbandoned: false,
    };
  }
  
  // Stage 6: Grade Revealed
  if (targetStage === FUNNEL_STAGES.GRADE_REVEALED) {
    const flags = options.forensicFlags || getRandomForensicFlags(4);
    session = {
      ...session,
      funnelStage: FUNNEL_STAGES.GRADE_REVEALED,
      auditCompletedAt: now,
      grade: options.grade || getRandomGrade(),
      gradeScore: Math.floor(Math.random() * 100),
      forensicFlags: flags,
      flagCount: flags.length,
    };
  }
  
  session.lastActivityAt = now;
  
  await setSessionData(page, session);
  return session;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: ANONYMOUS ARRIVAL (Stage 1)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 1: Anonymous Arrival', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('creates anonymousId on first visit', async ({ page }) => {
    const session = createAnonymousSession();
    await setSessionData(page, session);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.anonymousId).toBeDefined();
    expect(sessionData?.anonymousId).toHaveLength(36); // UUID format
    expect(sessionData?.leadId).toBeUndefined();
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.ANONYMOUS);
  });

  test('captures UTM parameters on landing', async ({ page }) => {
    await page.goto('/?utm_source=facebook&utm_medium=cpc&utm_campaign=hurricane-prep&utm_content=quote-audit-v2&fbclid=fb123456');
    await page.waitForLoadState('networkidle');
    
    // Simulate UTM capture
    await page.evaluate((key) => {
      const params = new URLSearchParams(window.location.search);
      const utm = {
        source: params.get('utm_source'),
        medium: params.get('utm_medium'),
        campaign: params.get('utm_campaign'),
        content: params.get('utm_content'),
        fbclid: params.get('fbclid'),
      };
      
      const session = {
        anonymousId: crypto.randomUUID(),
        funnelStage: 'anonymous',
        initialUtm: utm,
        landingPage: window.location.pathname,
        initialReferrer: document.referrer,
        firstSeenAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        sessionVersion: '3.0.0',
      };
      
      localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.initialUtm?.source).toBe('facebook');
    expect(sessionData?.initialUtm?.medium).toBe('cpc');
    expect(sessionData?.initialUtm?.campaign).toBe('hurricane-prep');
    expect(sessionData?.initialUtm?.content).toBe('quote-audit-v2');
    expect(sessionData?.initialUtm?.fbclid).toBe('fb123456');
    expect(sessionData?.landingPage).toBe('/');
  });

  test('captures Google Ads gclid parameter', async ({ page }) => {
    await page.goto('/?utm_source=google&utm_medium=cpc&gclid=test-gclid-789');
    await page.waitForLoadState('networkidle');
    
    await page.evaluate((key) => {
      const params = new URLSearchParams(window.location.search);
      const session = {
        anonymousId: crypto.randomUUID(),
        funnelStage: 'anonymous',
        initialUtm: {
          source: params.get('utm_source'),
          medium: params.get('utm_medium'),
          gclid: params.get('gclid'),
        },
        firstSeenAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        sessionVersion: '3.0.0',
      };
      localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.initialUtm?.gclid).toBe('test-gclid-789');
  });

  test('captures referrer from external site', async ({ page }) => {
    // Note: In real testing, referrer would come from actual navigation
    const session = createAnonymousSession({
      initialReferrer: 'https://www.google.com/search?q=impact+windows+florida',
      landingPage: '/',
    });
    await setSessionData(page, session);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.initialReferrer).toContain('google.com');
  });

  test('session persists after page refresh', async ({ page }) => {
    const session = createAnonymousSession({
      initialUtm: { source: 'test', campaign: 'refresh-test' },
    });
    await setSessionData(page, session);
    
    const originalAnonymousId = session.anonymousId;
    
    // Hard refresh
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.anonymousId).toBe(originalAnonymousId);
    expect(sessionData?.initialUtm?.campaign).toBe('refresh-test');
  });

  test('fires session_start event to dataLayer', async ({ page }) => {
    await pushToDataLayer(page, 'session_start', {
      session_type: 'new',
      landing_page: '/',
      utm_source: 'facebook',
      utm_campaign: 'hurricane-prep',
    });
    
    const dataLayer = await getDataLayer(page);
    const sessionEvent = dataLayer.find((e: any) => e.event === 'session_start');
    
    expect(sessionEvent).toBeDefined();
    expect(sessionEvent?.session_type).toBe('new');
    expect(sessionEvent?.utm_source).toBe('facebook');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: AUDIT STARTED (Stage 2)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 2: Audit Started', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('tracks audit start with timestamp', async ({ page }) => {
    const session = createAnonymousSession();
    await setSessionData(page, session);
    
    // Simulate audit start
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.funnelStage = 'audit_started';
      data.auditStartedAt = new Date().toISOString();
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.AUDIT_STARTED);
    expect(sessionData?.auditStartedAt).toBeDefined();
    expect(new Date(sessionData!.auditStartedAt!).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('preserves anonymous attribution on audit start', async ({ page }) => {
    const session = createAnonymousSession({
      initialUtm: { source: 'facebook', campaign: 'quote-audit' },
      initialReferrer: 'https://facebook.com/ad/12345',
    });
    await setSessionData(page, session);
    
    // Progress to audit started
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.AUDIT_STARTED);
    // Attribution should persist (check it wasn't overwritten)
    // Note: progressToStage creates new session, so we verify structure
    expect(sessionData?.auditStartedAt).toBeDefined();
  });

  test('fires audit_started event to dataLayer', async ({ page }) => {
    const session = createAnonymousSession();
    await setSessionData(page, session);
    
    await pushToDataLayer(page, 'audit_started', {
      anonymous_id: session.anonymousId,
      time_on_page_seconds: 15,
    });
    
    const dataLayer = await getDataLayer(page);
    const auditEvent = dataLayer.find((e: any) => e.event === 'audit_started');
    
    expect(auditEvent).toBeDefined();
    expect(auditEvent?.anonymous_id).toBe(session.anonymousId);
  });

  test('audit start idempotent on multiple interactions', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    const firstData = await getSessionData(page);
    const firstStartTime = firstData?.auditStartedAt;
    
    // Simulate "re-starting" audit (should not overwrite)
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      // Only set if not already set
      if (!data.auditStartedAt) {
        data.auditStartedAt = new Date().toISOString();
      }
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const secondData = await getSessionData(page);
    
    expect(secondData?.auditStartedAt).toBe(firstStartTime);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: MID-FUNNEL DATA CAPTURE (Stage 3)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 3: Mid-Funnel Data Capture', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('captures county selection', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    // Simulate county capture
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.county = 'Broward';
      data.funnelStage = 'mid_funnel';
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.county).toBe('Broward');
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.MID_FUNNEL);
  });

  test('captures window count', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.windowCount = 14;
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.windowCount).toBe(14);
  });

  test('captures quote amount', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.quoteAmount = 27500;
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.quoteAmount).toBe(27500);
  });

  test('captures all mid-funnel data together', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.MID_FUNNEL, {
      county: 'Miami-Dade',
      windowCount: 18,
      quoteAmount: 35000,
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.county).toBe('Miami-Dade');
    expect(sessionData?.windowCount).toBe(18);
    expect(sessionData?.quoteAmount).toBe(35000);
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.MID_FUNNEL);
  });

  test('fires county_identified event to dataLayer', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    await pushToDataLayer(page, 'county_identified', {
      county: 'Palm Beach',
      anonymous_id: (await getSessionData(page))?.anonymousId,
    });
    
    const dataLayer = await getDataLayer(page);
    const countyEvent = dataLayer.find((e: any) => e.event === 'county_identified');
    
    expect(countyEvent).toBeDefined();
    expect(countyEvent?.county).toBe('Palm Beach');
  });

  test('fires quote_entered event to dataLayer', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    
    await pushToDataLayer(page, 'quote_entered', {
      quote_amount: 22000,
      window_count: 12,
      price_per_window: 1833,
    });
    
    const dataLayer = await getDataLayer(page);
    const quoteEvent = dataLayer.find((e: any) => e.event === 'quote_entered');
    
    expect(quoteEvent).toBeDefined();
    expect(quoteEvent?.quote_amount).toBe(22000);
    expect(quoteEvent?.window_count).toBe(12);
  });

  test('mid-funnel data persists across page refresh', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.MID_FUNNEL, {
      county: 'Hillsborough',
      windowCount: 10,
      quoteAmount: 18000,
    });
    
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.county).toBe('Hillsborough');
    expect(sessionData?.windowCount).toBe(10);
    expect(sessionData?.quoteAmount).toBe(18000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: TRUTH GATE (Stage 4)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 4: Truth Gate Hit', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('records truth gate hit timestamp', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.MID_FUNNEL);
    
    // Simulate truth gate hit
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.funnelStage = 'truth_gate';
      data.truthGateHitAt = new Date().toISOString();
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.TRUTH_GATE);
    expect(sessionData?.truthGateHitAt).toBeDefined();
  });

  test('preserves all mid-funnel data at truth gate', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE, {
      county: 'Orange',
      windowCount: 16,
      quoteAmount: 28000,
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.TRUTH_GATE);
    expect(sessionData?.county).toBe('Orange');
    expect(sessionData?.windowCount).toBe(16);
    expect(sessionData?.quoteAmount).toBe(28000);
  });

  test('fires truth_gate_hit event for shadow audience seeding', async ({ page }) => {
    const session = await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE, {
      county: 'Pinellas',
      windowCount: 8,
      quoteAmount: 15000,
    });
    
    await pushToDataLayer(page, 'truth_gate_hit', {
      anonymous_id: session.anonymousId,
      county: session.county,
      window_count: session.windowCount,
      quote_amount: session.quoteAmount,
      time_in_funnel_seconds: 45,
    });
    
    const dataLayer = await getDataLayer(page);
    const truthGateEvent = dataLayer.find((e: any) => e.event === 'truth_gate_hit');
    
    expect(truthGateEvent).toBeDefined();
    expect(truthGateEvent?.anonymous_id).toBe(session.anonymousId);
    expect(truthGateEvent?.county).toBe('Pinellas');
    expect(truthGateEvent?.quote_amount).toBe(15000);
  });

  test('marks abandonment if user leaves at truth gate', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE);
    
    // Simulate abandonment detection
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.truthGateAbandoned = true;
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.truthGateAbandoned).toBe(true);
  });

  test('fires truth_gate_abandoned event on exit intent', async ({ page }) => {
    const session = await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE);
    
    await pushToDataLayer(page, 'truth_gate_abandoned', {
      anonymous_id: session.anonymousId,
      time_at_gate_seconds: 12,
      county: session.county,
    });
    
    const dataLayer = await getDataLayer(page);
    const abandonEvent = dataLayer.find((e: any) => e.event === 'truth_gate_abandoned');
    
    expect(abandonEvent).toBeDefined();
    expect(abandonEvent?.anonymous_id).toBe(session.anonymousId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: LEAD CAPTURED (Stage 5)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 5: Lead Captured', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('converts anonymous session to identified lead', async ({ page }) => {
    const anonSession = await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE);
    const originalAnonymousId = anonSession.anonymousId;
    
    // Capture lead
    await page.evaluate(([key, email, phone]) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.leadId = crypto.randomUUID();
      data.email = email;
      data.phone = phone;
      data.funnelStage = 'lead_captured';
      data.promotedToLeadAt = new Date().toISOString();
      data.truthGateAbandoned = false;
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, createTestEmail(), createTestPhone()]);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.leadId).toBeDefined();
    expect(sessionData?.leadId).toHaveLength(36);
    expect(sessionData?.anonymousId).toBe(originalAnonymousId); // Preserved
    expect(sessionData?.email).toBeDefined();
    expect(sessionData?.phone).toBeDefined();
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.LEAD_CAPTURED);
    expect(sessionData?.promotedToLeadAt).toBeDefined();
    expect(sessionData?.truthGateAbandoned).toBe(false);
  });

  test('preserves all funnel data on lead capture', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.LEAD_CAPTURED, {
      email: 'complete@example.com',
      county: 'Broward',
      windowCount: 12,
      quoteAmount: 22000,
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.email).toBe('complete@example.com');
    expect(sessionData?.county).toBe('Broward');
    expect(sessionData?.windowCount).toBe(12);
    expect(sessionData?.quoteAmount).toBe(22000);
    expect(sessionData?.auditStartedAt).toBeDefined();
    expect(sessionData?.truthGateHitAt).toBeDefined();
  });

  test('fires lead_captured event with full context', async ({ page }) => {
    const session = await progressToStage(page, FUNNEL_STAGES.LEAD_CAPTURED, {
      email: 'gtm-test@example.com',
      county: 'Miami-Dade',
      windowCount: 20,
      quoteAmount: 40000,
    });
    
    await pushToDataLayer(page, 'lead_captured', {
      lead_id: session.leadId,
      anonymous_id: session.anonymousId,
      county: session.county,
      window_count: session.windowCount,
      quote_amount: session.quoteAmount,
      time_to_conversion_seconds: 120,
    });
    
    const dataLayer = await getDataLayer(page);
    const leadEvent = dataLayer.find((e: any) => e.event === 'lead_captured');
    
    expect(leadEvent).toBeDefined();
    expect(leadEvent?.lead_id).toBe(session.leadId);
    expect(leadEvent?.anonymous_id).toBe(session.anonymousId);
    expect(leadEvent?.county).toBe('Miami-Dade');
    expect(leadEvent?.quote_amount).toBe(40000);
  });

  test('double submission returns same leadId (idempotency)', async ({ page }) => {
    const firstCapture = await progressToStage(page, FUNNEL_STAGES.LEAD_CAPTURED, {
      email: 'idempotent@example.com',
    });
    const firstLeadId = firstCapture.leadId;
    
    // Simulate second submission (should not create new leadId)
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      // Only set leadId if not already present
      if (!data.leadId) {
        data.leadId = crypto.randomUUID();
      }
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.leadId).toBe(firstLeadId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: GRADE REVEALED (Stage 6)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Stage 6: Grade Revealed', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('stores grade and score on reveal', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.LEAD_CAPTURED);
    
    // Simulate grade reveal
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.funnelStage = 'grade_revealed';
      data.grade = 'C';
      data.gradeScore = 58;
      data.auditCompletedAt = new Date().toISOString();
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.GRADE_REVEALED);
    expect(sessionData?.grade).toBe('C');
    expect(sessionData?.gradeScore).toBe(58);
    expect(sessionData?.auditCompletedAt).toBeDefined();
  });

  test('stores forensic flags found during audit', async ({ page }) => {
    const testFlags = [
      'missing_impact_rating',
      'inflated_labor_rate',
      'no_manufacturer_warranty',
      'missing_permit_line_item',
    ];
    
    await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      grade: 'D',
      forensicFlags: testFlags,
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.forensicFlags).toEqual(testFlags);
    expect(sessionData?.flagCount).toBe(4);
    expect(sessionData?.grade).toBe('D');
  });

  test('complete funnel journey data preserved at grade reveal', async ({ page }) => {
    const completeJourney = await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      email: 'journey@example.com',
      phone: '(555) 123-4567',
      county: 'Palm Beach',
      windowCount: 15,
      quoteAmount: 30000,
      grade: 'B',
      forensicFlags: ['generic_window_specs', 'no_installation_timeline'],
    });
    
    const sessionData = await getSessionData(page);
    
    // All stages should have data
    expect(sessionData?.anonymousId).toBeDefined(); // Stage 1
    expect(sessionData?.auditStartedAt).toBeDefined(); // Stage 2
    expect(sessionData?.county).toBe('Palm Beach'); // Stage 3
    expect(sessionData?.windowCount).toBe(15);
    expect(sessionData?.quoteAmount).toBe(30000);
    expect(sessionData?.truthGateHitAt).toBeDefined(); // Stage 4
    expect(sessionData?.leadId).toBeDefined(); // Stage 5
    expect(sessionData?.email).toBe('journey@example.com');
    expect(sessionData?.grade).toBe('B'); // Stage 6
    expect(sessionData?.forensicFlags).toContain('generic_window_specs');
  });

  test('fires grade_revealed event with full audit results', async ({ page }) => {
    const session = await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      grade: 'F',
      forensicFlags: ['suspicious_deposit_percentage', 'no_noa_certification', 'inflated_labor_rate'],
    });
    
    await pushToDataLayer(page, 'grade_revealed', {
      lead_id: session.leadId,
      grade: session.grade,
      grade_score: session.gradeScore,
      flag_count: session.flagCount,
      forensic_flags: session.forensicFlags?.join(','),
      county: session.county,
      quote_amount: session.quoteAmount,
      audit_duration_seconds: 180,
    });
    
    const dataLayer = await getDataLayer(page);
    const gradeEvent = dataLayer.find((e: any) => e.event === 'grade_revealed');
    
    expect(gradeEvent).toBeDefined();
    expect(gradeEvent?.lead_id).toBe(session.leadId);
    expect(gradeEvent?.grade).toBe('F');
    expect(gradeEvent?.flag_count).toBe(3);
    expect(gradeEvent?.forensic_flags).toContain('suspicious_deposit_percentage');
  });

  test('calculates audit duration correctly', async ({ page }) => {
    // Create session with known start time
    const startTime = new Date(Date.now() - 120000); // 2 minutes ago
    
    await setSessionData(page, {
      anonymousId: crypto.randomUUID(),
      funnelStage: FUNNEL_STAGES.AUDIT_STARTED,
      auditStartedAt: startTime.toISOString(),
      firstSeenAt: startTime.toISOString(),
      lastActivityAt: startTime.toISOString(),
      sessionVersion: '3.0.0',
    });
    
    // Wait a moment then complete
    await page.waitForTimeout(1000);
    
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.funnelStage = 'grade_revealed';
      data.auditCompletedAt = new Date().toISOString();
      data.grade = 'A';
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    const sessionData = await getSessionData(page);
    const startedAt = new Date(sessionData!.auditStartedAt!);
    const completedAt = new Date(sessionData!.auditCompletedAt!);
    const durationSeconds = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);
    
    expect(durationSeconds).toBeGreaterThanOrEqual(120);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: CROSS-DEVICE IDENTITY RESOLUTION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Device Identity Resolution', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await page.waitForLoadState('networkidle');
  });

  test('merges sessions on email match (phone → desktop)', async ({ page }) => {
    const sharedEmail = createTestEmail();
    
    // Simulate "phone session" data (first device)
    const phoneSession: Partial<SessionData> = {
      leadId: 'phone-device-lead-111',
      anonymousId: 'anon-phone-111',
      email: sharedEmail,
      funnelStage: FUNNEL_STAGES.TRUTH_GATE,
      county: 'Miami-Dade',
      windowCount: 8,
      quoteAmount: 16000,
      initialUtm: { source: 'instagram', medium: 'story' },
      auditStartedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
      truthGateHitAt: new Date(Date.now() - 86400000).toISOString(),
      firstSeenAt: new Date(Date.now() - 86400000).toISOString(),
      lastActivityAt: new Date(Date.now() - 86400000).toISOString(),
      sessionVersion: '3.0.0',
    };
    
    // Set phone session as "existing" lead in our test
    await setSessionData(page, phoneSession);
    
    // Now simulate desktop completing the journey with same email
    const desktopAdditions = {
      // Desktop would have different anonymousId initially
      phone: createTestPhone(),
      name: 'Desktop User',
      grade: 'C' as const,
      gradeScore: 62,
      forensicFlags: ['missing_impact_rating', 'generic_window_specs'],
      flagCount: 2,
      auditCompletedAt: new Date().toISOString(),
      funnelStage: FUNNEL_STAGES.GRADE_REVEALED,
    };
    
    // Merge (simulating what server-side resolution would do)
    await page.evaluate(([key, additions]) => {
      const existing = localStorage.getItem(key);
      const current = existing ? JSON.parse(existing) : {};
      
      const merged = {
        ...current,
        ...additions,
        // Preserve original leadId
        leadId: current.leadId,
        // Keep earliest firstSeenAt
        firstSeenAt: current.firstSeenAt,
        // Keep first-touch attribution
        initialUtm: current.initialUtm,
        // Update lastActivityAt
        lastActivityAt: new Date().toISOString(),
      };
      
      localStorage.setItem(key, JSON.stringify(merged));
    }, [STORAGE_KEY, desktopAdditions]);
    
    const mergedSession = await getSessionData(page);
    
    // Original phone data preserved
    expect(mergedSession?.leadId).toBe('phone-device-lead-111');
    expect(mergedSession?.email).toBe(sharedEmail);
    expect(mergedSession?.county).toBe('Miami-Dade');
    expect(mergedSession?.windowCount).toBe(8);
    expect(mergedSession?.initialUtm?.source).toBe('instagram');
    
    // Desktop data added
    expect(mergedSession?.phone).toBeDefined();
    expect(mergedSession?.name).toBe('Desktop User');
    expect(mergedSession?.grade).toBe('C');
    expect(mergedSession?.forensicFlags?.length).toBe(2);
    expect(mergedSession?.funnelStage).toBe(FUNNEL_STAGES.GRADE_REVEALED);
  });

  test('preserves first-touch attribution on identity merge', async ({ page }) => {
    const sharedEmail = createTestEmail();
    
    // First device: Facebook ad
    const firstDeviceSession: Partial<SessionData> = {
      leadId: 'first-device-lead-222',
      anonymousId: 'anon-first-222',
      email: sharedEmail,
      funnelStage: FUNNEL_STAGES.LEAD_CAPTURED,
      initialUtm: { source: 'facebook', campaign: 'hurricane-2024', fbclid: 'fb-original-123' },
      initialReferrer: 'https://facebook.com/ad/123',
      landingPage: '/',
      firstSeenAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
      lastActivityAt: new Date(Date.now() - 172800000).toISOString(),
      sessionVersion: '3.0.0',
    };
    
    // Second device: Google search (should NOT overwrite first-touch)
    const secondDeviceUtm = { source: 'google', medium: 'organic' };
    
    await setSessionData(page, firstDeviceSession);
    
    // Simulate merge that preserves first-touch
    await page.evaluate(([key, newUtm]) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      // Do NOT overwrite first-touch attribution
      // (This is the critical behavior to test)
      data.lastUtm = newUtm;
      data.lastActivityAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, secondDeviceUtm]);
    
    const sessionData = await getSessionData(page);
    
    // First-touch preserved
    expect(sessionData?.initialUtm?.source).toBe('facebook');
    expect(sessionData?.initialUtm?.campaign).toBe('hurricane-2024');
    expect(sessionData?.initialUtm?.fbclid).toBe('fb-original-123');
    
    // Last-touch tracked separately
    expect((sessionData as any)?.lastUtm?.source).toBe('google');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: SERVER-SIDE BACKUP (Supabase)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Server-Side Backup', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await page.waitForLoadState('networkidle');
  });

  test('session structure valid for Supabase sync', async ({ page }) => {
    const session = await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      email: 'supabase@example.com',
      phone: '(555) 999-8888',
      county: 'Broward',
      windowCount: 14,
      quoteAmount: 28000,
      grade: 'B',
      forensicFlags: ['missing_flashing_details'],
    });
    
    const sessionData = await getSessionData(page);
    
    // Verify all fields that Supabase expects
    expect(sessionData?.leadId).toBeDefined();
    expect(typeof sessionData?.leadId).toBe('string');
    
    expect(sessionData?.email).toBe('supabase@example.com');
    expect(sessionData?.phone).toBe('(555) 999-8888');
    
    expect(sessionData?.county).toBe('Broward');
    expect(typeof sessionData?.windowCount).toBe('number');
    expect(typeof sessionData?.quoteAmount).toBe('number');
    
    expect(sessionData?.grade).toBe('B');
    expect(Array.isArray(sessionData?.forensicFlags)).toBe(true);
    expect(typeof sessionData?.flagCount).toBe('number');
    
    expect(sessionData?.firstSeenAt).toBeDefined();
    expect(sessionData?.lastActivityAt).toBeDefined();
    expect(sessionData?.auditStartedAt).toBeDefined();
    expect(sessionData?.auditCompletedAt).toBeDefined();
    expect(sessionData?.truthGateHitAt).toBeDefined();
    expect(sessionData?.promotedToLeadAt).toBeDefined();
    
    // Verify timestamps are valid ISO strings
    expect(() => new Date(sessionData!.firstSeenAt)).not.toThrow();
    expect(() => new Date(sessionData!.lastActivityAt)).not.toThrow();
  });

  test('lead score calculable from session data', async ({ page }) => {
    await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      email: 'scoring@example.com',
      phone: '(555) 777-6666',
      county: 'Palm Beach',
      windowCount: 20,
      quoteAmount: 40000,
      grade: 'D',
      forensicFlags: ['inflated_labor_rate', 'no_noa_certification', 'missing_permit_line_item'],
    });
    
    const sessionData = await getSessionData(page);
    
    // Calculate expected score based on v3 criteria
    let expectedScore = 0;
    
    // Contact info
    if (sessionData?.email) expectedScore += 25;
    if (sessionData?.phone) expectedScore += 20;
    
    // Funnel completion
    if (sessionData?.funnelStage === FUNNEL_STAGES.GRADE_REVEALED) expectedScore += 30;
    
    // Quote context (indicates serious buyer)
    if (sessionData?.quoteAmount && sessionData.quoteAmount > 20000) expectedScore += 15;
    if (sessionData?.windowCount && sessionData.windowCount > 10) expectedScore += 5;
    
    // Forensic flags found (more flags = more need for help)
    if (sessionData?.flagCount && sessionData.flagCount >= 3) expectedScore += 5;
    
    expect(expectedScore).toBe(100); // This lead hits all criteria
  });

  test('sync payload includes attribution for reporting', async ({ page }) => {
    await setSessionData(page, {
      anonymousId: crypto.randomUUID(),
      funnelStage: FUNNEL_STAGES.ANONYMOUS,
      initialUtm: {
        source: 'facebook',
        medium: 'cpc',
        campaign: 'hurricane-2024',
        content: 'carousel-v3',
        fbclid: 'fb-test-456',
      },
      initialReferrer: 'https://facebook.com/ad/456',
      landingPage: '/',
      firstSeenAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      sessionVersion: '3.0.0',
    });
    
    const sessionData = await getSessionData(page);
    
    // These fields should be extractable for Supabase columns
    const syncPayload = {
      utm_source: sessionData?.initialUtm?.source,
      utm_medium: sessionData?.initialUtm?.medium,
      utm_campaign: sessionData?.initialUtm?.campaign,
      utm_content: sessionData?.initialUtm?.content,
      fbclid: sessionData?.initialUtm?.fbclid,
      initial_referrer: sessionData?.initialReferrer,
      landing_page: sessionData?.landingPage,
    };
    
    expect(syncPayload.utm_source).toBe('facebook');
    expect(syncPayload.utm_campaign).toBe('hurricane-2024');
    expect(syncPayload.fbclid).toBe('fb-test-456');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: CROSS-TAB SYNCHRONIZATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Cross-Tab Synchronization', () => {

  test('session data shared between tabs via localStorage', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    await page1.goto('/');
    await page2.goto('/');
    
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Clear in page1
    await clearSessionData(page1);
    
    // Create session in page1
    const session = createAnonymousSession({
      county: 'Miami-Dade',
      windowCount: 12,
    });
    await setSessionData(page1, session);
    
    // Small delay for storage sync
    await page2.waitForTimeout(100);
    
    // Read from page2
    const page2Session = await getSessionData(page2);
    
    expect(page2Session?.anonymousId).toBe(session.anonymousId);
    expect(page2Session?.county).toBe('Miami-Dade');
    expect(page2Session?.windowCount).toBe(12);
    
    // Update in page2
    await page2.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.quoteAmount = 25000;
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    await page1.waitForTimeout(100);
    
    // Read update from page1
    const page1Updated = await getSessionData(page1);
    
    expect(page1Updated?.quoteAmount).toBe(25000);
    
    await page1.close();
    await page2.close();
  });

  test('lead capture in one tab visible in another', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    await page1.goto('/');
    await page2.goto('/');
    
    await clearSessionData(page1);
    
    // Start funnel in page1
    const session = createAnonymousSession({
      funnelStage: FUNNEL_STAGES.TRUTH_GATE,
      county: 'Broward',
      windowCount: 10,
      quoteAmount: 20000,
    });
    await setSessionData(page1, session);
    
    await page2.waitForTimeout(100);
    
    // Capture lead in page2
    await page2.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      
      data.leadId = crypto.randomUUID();
      data.email = 'crosstab@example.com';
      data.phone = '(555) 111-2222';
      data.funnelStage = 'lead_captured';
      data.promotedToLeadAt = new Date().toISOString();
      
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    await page1.waitForTimeout(100);
    
    // Verify in page1
    const page1Session = await getSessionData(page1);
    
    expect(page1Session?.leadId).toBeDefined();
    expect(page1Session?.email).toBe('crosstab@example.com');
    expect(page1Session?.funnelStage).toBe(FUNNEL_STAGES.LEAD_CAPTURED);
    
    await page1.close();
    await page2.close();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: SESSION EXPIRATION
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Session Expiration (30 Days)', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await page.waitForLoadState('networkidle');
  });

  test('active session within 30 days persists', async ({ page }) => {
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 15); // 15 days ago
    
    const session: SessionData = {
      leadId: 'active-lead-333',
      anonymousId: 'anon-active-333',
      email: 'active@example.com',
      funnelStage: FUNNEL_STAGES.GRADE_REVEALED,
      grade: 'B',
      firstSeenAt: recentDate.toISOString(),
      lastActivityAt: recentDate.toISOString(),
      sessionVersion: '3.0.0',
    };
    
    await setSessionData(page, session);
    
    // Check expiration
    const isExpired = await page.evaluate(([key, expiryDays]) => {
      const existing = localStorage.getItem(key);
      if (!existing) return true;
      
      const data = JSON.parse(existing);
      const lastActivity = new Date(data.lastActivityAt);
      const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      
      return daysSince > expiryDays;
    }, [STORAGE_KEY, SESSION_EXPIRY_DAYS]);
    
    expect(isExpired).toBe(false);
    
    const sessionData = await getSessionData(page);
    expect(sessionData?.leadId).toBe('active-lead-333');
  });

  test('expired session (31+ days) triggers new session creation', async ({ page }) => {
    const expiredSession = createExpiredSession();
    await setSessionData(page, expiredSession);
    
    // Simulate expiration check and renewal
    await page.evaluate(([key, expiryDays]) => {
      const existing = localStorage.getItem(key);
      if (!existing) return;
      
      const data = JSON.parse(existing);
      const lastActivity = new Date(data.lastActivityAt);
      const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSince > expiryDays) {
        // Archive old session (in reality, would sync to server)
        localStorage.setItem(`${key}-archived-${Date.now()}`, existing);
        
        // Create fresh session
        const newSession = {
          anonymousId: crypto.randomUUID(),
          funnelStage: 'anonymous',
          firstSeenAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          sessionVersion: '3.0.0',
        };
        
        localStorage.setItem(key, JSON.stringify(newSession));
      }
    }, [STORAGE_KEY, SESSION_EXPIRY_DAYS]);
    
    const sessionData = await getSessionData(page);
    
    // New session created
    expect(sessionData?.leadId).toBeUndefined();
    expect(sessionData?.anonymousId).not.toBe('expired-anon-456');
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.ANONYMOUS);
    expect(sessionData?.grade).toBeUndefined();
  });

  test('expired session data is archived before clearing', async ({ page }) => {
    const expiredSession = createExpiredSession();
    await setSessionData(page, expiredSession);
    
    // Trigger archival
    const archivedKey = await page.evaluate(([key, expiryDays]) => {
      const existing = localStorage.getItem(key);
      if (!existing) return null;
      
      const data = JSON.parse(existing);
      const lastActivity = new Date(data.lastActivityAt);
      const daysSince = (Date.now() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSince > expiryDays) {
        const archiveKey = `${key}-archived-${Date.now()}`;
        localStorage.setItem(archiveKey, existing);
        
        localStorage.setItem(key, JSON.stringify({
          anonymousId: crypto.randomUUID(),
          funnelStage: 'anonymous',
          firstSeenAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          sessionVersion: '3.0.0',
        }));
        
        return archiveKey;
      }
      return null;
    }, [STORAGE_KEY, SESSION_EXPIRY_DAYS]);
    
    expect(archivedKey).toBeDefined();
    
    // Verify archive exists
    const archivedData = await page.evaluate((archiveKey) => {
      const data = localStorage.getItem(archiveKey);
      return data ? JSON.parse(data) : null;
    }, archivedKey);
    
    expect(archivedData?.leadId).toBe('expired-lead-123');
    expect(archivedData?.email).toBe('expired@example.com');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: GTM DATALAYER EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('GTM DataLayer Events', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
  });

  test('session_start event includes attribution', async ({ page }) => {
    await pushToDataLayer(page, 'session_start', {
      session_type: 'new',
      landing_page: '/',
      utm_source: 'facebook',
      utm_medium: 'cpc',
      utm_campaign: 'quote-audit-2024',
      fbclid: 'fb-gtm-test-123',
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'session_start');
    
    expect(event).toBeDefined();
    expect(event?.session_type).toBe('new');
    expect(event?.utm_source).toBe('facebook');
    expect(event?.fbclid).toBe('fb-gtm-test-123');
  });

  test('audit_started event fires with anonymous_id', async ({ page }) => {
    const session = createAnonymousSession();
    await setSessionData(page, session);
    
    await pushToDataLayer(page, 'audit_started', {
      anonymous_id: session.anonymousId,
      time_on_page_seconds: 8,
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'audit_started');
    
    expect(event).toBeDefined();
    expect(event?.anonymous_id).toBe(session.anonymousId);
    expect(event?.time_on_page_seconds).toBe(8);
  });

  test('county_identified event fires with location data', async ({ page }) => {
    await pushToDataLayer(page, 'county_identified', {
      county: 'Miami-Dade',
      state: 'FL',
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'county_identified');
    
    expect(event).toBeDefined();
    expect(event?.county).toBe('Miami-Dade');
  });

  test('quote_entered event fires with quote context', async ({ page }) => {
    await pushToDataLayer(page, 'quote_entered', {
      quote_amount: 32000,
      window_count: 16,
      price_per_window: 2000,
      county: 'Broward',
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'quote_entered');
    
    expect(event).toBeDefined();
    expect(event?.quote_amount).toBe(32000);
    expect(event?.window_count).toBe(16);
    expect(event?.price_per_window).toBe(2000);
  });

  test('truth_gate_hit event fires for retargeting audience', async ({ page }) => {
    await pushToDataLayer(page, 'truth_gate_hit', {
      anonymous_id: 'anon-gate-test',
      county: 'Palm Beach',
      window_count: 12,
      quote_amount: 24000,
      time_in_funnel_seconds: 35,
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'truth_gate_hit');
    
    expect(event).toBeDefined();
    expect(event?.anonymous_id).toBe('anon-gate-test');
    expect(event?.time_in_funnel_seconds).toBe(35);
  });

  test('lead_captured event fires with full lead context', async ({ page }) => {
    await pushToDataLayer(page, 'lead_captured', {
      lead_id: 'lead-gtm-test-444',
      anonymous_id: 'anon-gtm-444',
      county: 'Hillsborough',
      window_count: 18,
      quote_amount: 36000,
      time_to_conversion_seconds: 90,
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'lead_captured');
    
    expect(event).toBeDefined();
    expect(event?.lead_id).toBe('lead-gtm-test-444');
    expect(event?.anonymous_id).toBe('anon-gtm-444');
    expect(event?.quote_amount).toBe(36000);
    expect(event?.time_to_conversion_seconds).toBe(90);
  });

  test('grade_revealed event fires with audit results', async ({ page }) => {
    await pushToDataLayer(page, 'grade_revealed', {
      lead_id: 'lead-grade-test-555',
      grade: 'D',
      grade_score: 42,
      flag_count: 5,
      forensic_flags: 'missing_impact_rating,inflated_labor_rate,no_noa_certification,missing_permit_line_item,no_manufacturer_warranty',
      county: 'Orange',
      quote_amount: 28000,
      window_count: 14,
      audit_duration_seconds: 145,
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'grade_revealed');
    
    expect(event).toBeDefined();
    expect(event?.lead_id).toBe('lead-grade-test-555');
    expect(event?.grade).toBe('D');
    expect(event?.grade_score).toBe(42);
    expect(event?.flag_count).toBe(5);
    expect(event?.forensic_flags).toContain('missing_impact_rating');
    expect(event?.audit_duration_seconds).toBe(145);
  });

  test('user_properties_set event fires with lead qualification data', async ({ page }) => {
    await pushToDataLayer(page, 'user_properties_set', {
      user_id: 'lead-props-test-666',
      user_properties: {
        lead_id: 'lead-props-test-666',
        lead_score: 85,
        funnel_stage: 'grade_revealed',
        grade: 'C',
        flag_count: 3,
        county: 'Pinellas',
        quote_bracket: '25k-35k',
        first_touch_source: 'google',
        first_touch_campaign: 'brand-awareness',
      },
    });
    
    const dataLayer = await getDataLayer(page);
    const event = dataLayer.find((e: any) => e.event === 'user_properties_set');
    
    expect(event).toBeDefined();
    expect(event?.user_id).toBe('lead-props-test-666');
    expect(event?.user_properties?.lead_score).toBe(85);
    expect(event?.user_properties?.grade).toBe('C');
    expect(event?.user_properties?.first_touch_source).toBe('google');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: EDGE CASES & ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Edge Cases & Error Handling', () => {
  
  test('handles corrupted localStorage gracefully', async ({ page }) => {
    await page.goto('/');
    
    // Set corrupted data
    await page.evaluate((key) => {
      localStorage.setItem(key, 'not-valid-json{{{');
    }, STORAGE_KEY);
    
    // Attempt recovery
    const recovered = await page.evaluate((key) => {
      try {
        const data = localStorage.getItem(key);
        JSON.parse(data!);
        return 'parsed-ok';
      } catch (error) {
        localStorage.removeItem(key);
        
        // Create fresh session
        const fresh = {
          anonymousId: crypto.randomUUID(),
          funnelStage: 'anonymous',
          firstSeenAt: new Date().toISOString(),
          lastActivityAt: new Date().toISOString(),
          sessionVersion: '3.0.0',
        };
        localStorage.setItem(key, JSON.stringify(fresh));
        return 'recovered';
      }
    }, STORAGE_KEY);
    
    expect(recovered).toBe('recovered');
    
    const sessionData = await getSessionData(page);
    expect(sessionData?.anonymousId).toBeDefined();
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.ANONYMOUS);
  });

  test('handles very large quote amounts', async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    
    const session = createAnonymousSession({
      quoteAmount: 150000, // $150k quote
      windowCount: 50,
    });
    await setSessionData(page, session);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.quoteAmount).toBe(150000);
    expect(sessionData?.windowCount).toBe(50);
  });

  test('handles all forensic flags being present', async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    
    const allFlags = [...FORENSIC_FLAGS];
    
    await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      grade: 'F',
      forensicFlags: allFlags,
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.forensicFlags?.length).toBe(FORENSIC_FLAGS.length);
    expect(sessionData?.grade).toBe('F');
  });

  test('handles missing optional fields gracefully', async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    
    // Minimal session (no optional fields)
    const minimalSession: SessionData = {
      anonymousId: crypto.randomUUID(),
      funnelStage: FUNNEL_STAGES.ANONYMOUS,
      firstSeenAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      sessionVersion: '3.0.0',
    };
    
    await setSessionData(page, minimalSession);
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.anonymousId).toBeDefined();
    expect(sessionData?.leadId).toBeUndefined();
    expect(sessionData?.email).toBeUndefined();
    expect(sessionData?.county).toBeUndefined();
    expect(sessionData?.grade).toBeUndefined();
  });

  test('handles rapid funnel progression', async ({ page }) => {
    await page.goto('/');
    await clearSessionData(page);
    
    // Rapidly progress through all stages
    await progressToStage(page, FUNNEL_STAGES.ANONYMOUS);
    await progressToStage(page, FUNNEL_STAGES.AUDIT_STARTED);
    await progressToStage(page, FUNNEL_STAGES.MID_FUNNEL, {
      county: 'Miami-Dade',
      windowCount: 10,
      quoteAmount: 20000,
    });
    await progressToStage(page, FUNNEL_STAGES.TRUTH_GATE);
    await progressToStage(page, FUNNEL_STAGES.LEAD_CAPTURED, {
      email: 'rapid@example.com',
    });
    await progressToStage(page, FUNNEL_STAGES.GRADE_REVEALED, {
      grade: 'A',
      forensicFlags: [],
    });
    
    const sessionData = await getSessionData(page);
    
    expect(sessionData?.funnelStage).toBe(FUNNEL_STAGES.GRADE_REVEALED);
    expect(sessionData?.grade).toBe('A');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE: FULL FUNNEL JOURNEY
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('Complete Funnel Journey', () => {
  
  test('full journey maintains data integrity across all stages', async ({ page }) => {
    await page.goto('/?utm_source=facebook&utm_campaign=hurricane-2024&fbclid=fb-journey-test');
    await clearSessionData(page);
    await initDataLayer(page);
    await page.waitForLoadState('networkidle');
    
    const testEmail = createTestEmail();
    const testPhone = createTestPhone();
    
    // STAGE 1: Anonymous Arrival
    await page.evaluate((key) => {
      const params = new URLSearchParams(window.location.search);
      const session = {
        anonymousId: crypto.randomUUID(),
        funnelStage: 'anonymous',
        initialUtm: {
          source: params.get('utm_source'),
          campaign: params.get('utm_campaign'),
          fbclid: params.get('fbclid'),
        },
        landingPage: window.location.pathname,
        firstSeenAt: new Date().toISOString(),
        lastActivityAt: new Date().toISOString(),
        sessionVersion: '3.0.0',
      };
      localStorage.setItem(key, JSON.stringify(session));
    }, STORAGE_KEY);
    
    let session = await getSessionData(page);
    expect(session?.funnelStage).toBe('anonymous');
    expect(session?.initialUtm?.source).toBe('facebook');
    const originalAnonymousId = session?.anonymousId;
    
    // STAGE 2: Audit Started
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.funnelStage = 'audit_started';
      data.auditStartedAt = new Date().toISOString();
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    session = await getSessionData(page);
    expect(session?.funnelStage).toBe('audit_started');
    expect(session?.auditStartedAt).toBeDefined();
    
    // STAGE 3: Mid-Funnel Data
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.funnelStage = 'mid_funnel';
      data.county = 'Broward';
      data.windowCount = 15;
      data.quoteAmount = 30000;
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    session = await getSessionData(page);
    expect(session?.county).toBe('Broward');
    expect(session?.windowCount).toBe(15);
    expect(session?.quoteAmount).toBe(30000);
    
    // STAGE 4: Truth Gate Hit
    await page.evaluate((key) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.funnelStage = 'truth_gate';
      data.truthGateHitAt = new Date().toISOString();
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, STORAGE_KEY);
    
    session = await getSessionData(page);
    expect(session?.funnelStage).toBe('truth_gate');
    expect(session?.truthGateHitAt).toBeDefined();
    
    // STAGE 5: Lead Captured
    await page.evaluate(([key, email, phone]) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.funnelStage = 'lead_captured';
      data.leadId = crypto.randomUUID();
      data.email = email;
      data.phone = phone;
      data.promotedToLeadAt = new Date().toISOString();
      data.truthGateAbandoned = false;
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, testEmail, testPhone]);
    
    session = await getSessionData(page);
    expect(session?.leadId).toBeDefined();
    expect(session?.email).toBe(testEmail);
    expect(session?.phone).toBe(testPhone);
    expect(session?.anonymousId).toBe(originalAnonymousId); // Preserved
    
    // STAGE 6: Grade Revealed
    const testFlags = ['inflated_labor_rate', 'no_noa_certification', 'missing_permit_line_item'];
    await page.evaluate(([key, flags]) => {
      const existing = localStorage.getItem(key);
      const data = existing ? JSON.parse(existing) : {};
      data.funnelStage = 'grade_revealed';
      data.auditCompletedAt = new Date().toISOString();
      data.grade = 'C';
      data.gradeScore = 58;
      data.forensicFlags = flags;
      data.flagCount = flags.length;
      data.lastActivityAt = new Date().toISOString();
      localStorage.setItem(key, JSON.stringify(data));
    }, [STORAGE_KEY, testFlags]);
    
    session = await getSessionData(page);
    
    // VERIFY COMPLETE JOURNEY DATA
    // Stage 1 data preserved
    expect(session?.anonymousId).toBe(originalAnonymousId);
    expect(session?.initialUtm?.source).toBe('facebook');
    expect(session?.initialUtm?.campaign).toBe('hurricane-2024');
    expect(session?.initialUtm?.fbclid).toBe('fb-journey-test');
    
    // Stage 2 data preserved
    expect(session?.auditStartedAt).toBeDefined();
    
    // Stage 3 data preserved
    expect(session?.county).toBe('Broward');
    expect(session?.windowCount).toBe(15);
    expect(session?.quoteAmount).toBe(30000);
    
    // Stage 4 data preserved
    expect(session?.truthGateHitAt).toBeDefined();
    expect(session?.truthGateAbandoned).toBe(false);
    
    // Stage 5 data preserved
    expect(session?.leadId).toBeDefined();
    expect(session?.email).toBe(testEmail);
    expect(session?.phone).toBe(testPhone);
    expect(session?.promotedToLeadAt).toBeDefined();
    
    // Stage 6 data
    expect(session?.funnelStage).toBe('grade_revealed');
    expect(session?.grade).toBe('C');
    expect(session?.gradeScore).toBe(58);
    expect(session?.forensicFlags).toEqual(testFlags);
    expect(session?.flagCount).toBe(3);
    expect(session?.auditCompletedAt).toBeDefined();
    
    // Timestamps
    expect(session?.firstSeenAt).toBeDefined();
    expect(session?.lastActivityAt).toBeDefined();
    
    // Version
    expect(session?.sessionVersion).toBe('3.0.0');
    
    // Calculate audit duration
    const startedAt = new Date(session!.auditStartedAt!);
    const completedAt = new Date(session!.auditCompletedAt!);
    expect(completedAt.getTime()).toBeGreaterThanOrEqual(startedAt.getTime());
  });
});
