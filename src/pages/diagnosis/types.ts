import type React from 'react';

export type StepId = 'intake' | 'diagnosis' | 'prescription' | 'success';

export type DiagnosisCode =
  | 'price_shock'
  | 'trust_breakdown'
  | 'financial'
  | 'timing'
  | 'scope_mismatch'
  | 'other'
  | 'not_sure';

export interface DiagnosticConfig {
  code: DiagnosisCode;
  label: string;
  cardDescription: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string;
  accentBg: string;
  accentBorder: string;
  reflectionTitle: string;
  reflectionBody: string;
  secondaryQuestion: string;
  secondaryOptions: string[];
  prescriptionSetup: string;
  prescriptionHeadline: string;
  prescriptionSubhead: string;
  guaranteeTitle: string;
  guarantees: string[];
  ctaText: string;
  prescriptionPath: string;
}

export interface SLAPromise {
  text: string;
  callbackIso: string;
  urgency: 'hour' | 'next_morning' | 'monday';
}

export interface DiagnosticContext {
  lead_id: string;
  scan_session_id: string;
  report_grade: string;
  top_insights: string[];
  first_name: string;
  phone: string;
  email: string;
}
