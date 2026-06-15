import type {
  WM_ANOMALY_STATUSES,
  WM_DISPATCH_STATUSES,
  WM_EVENT_NAMES,
  WM_IDENTITY_QUALITIES,
  WM_PLATFORM_NAMES,
} from "./constants.ts";

export type WMEventName = (typeof WM_EVENT_NAMES)[number];
export type WMAnomalyStatus = (typeof WM_ANOMALY_STATUSES)[number];
export type WMDispatchStatus = (typeof WM_DISPATCH_STATUSES)[number];
export type WMPlatformName = (typeof WM_PLATFORM_NAMES)[number];
export type WMIdentityQuality = (typeof WM_IDENTITY_QUALITIES)[number];

export interface WMIdentityPayload {
  leadId?: string;
  userId?: string;
  email?: string;
  emailHash?: string;
  phone?: string;
  phoneHash?: string;
  phoneVerifiedAt?: string;
  clickId?: string;
  fbc?: string;
  fbp?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  sameDeviceAsUpload?: boolean;
  ipRiskLevel?: "low" | "medium" | "high";
  userAgent?: string;
  clientIp?: string;
}

export interface WMJourneyPayload {
  route: string;
  flow: "public" | "vault" | "admin";
  sessionId?: string;
  scanSessionId?: string;
}

export interface WMQuotePayload {
  analysisId?: string;
  quoteFileId?: string;
  documentType?: string;
  isQuoteDocument: boolean;
  openingCount?: number;
  quoteAmount?: number;
  pricePerOpening?: number;
  depositPercent?: number;
  duplicateSuspected?: boolean;
  impossibleValuesDetected?: boolean;
}

export interface WMAnalyticsPayload {
  ocrConfidence: number;
  completeness: number;
  mathConsistency: number;
  cohortFit: number;
  scopeConsistency: number;
  documentValidity: number;
  identityStrength: number;
  anomalyScore: number;
  trustScore: number;
  anomalyStatus: WMAnomalyStatus;
  reasons: string[];
}

export interface WMOptimizationPayload {
  approvedForIndex: boolean;
  approvedForAds: boolean;
  manualReviewRequired: boolean;
  valueUsd?: number;
  priority?: number;
}

export interface WMSourcePayload {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  referrer?: string;
  sourceSystem?: "frontend" | "edge_function" | "internal";
}

export interface WMCanonicalEventPayload {
  identity: WMIdentityPayload;
  journey: WMJourneyPayload;
  quote?: WMQuotePayload;
  analytics?: WMAnalyticsPayload;
  optimization?: WMOptimizationPayload;
  source?: WMSourcePayload;
  metadata?: Record<string, unknown>;
}

export interface WMCanonicalEvent {
  eventId: string;
  eventName: WMEventName;
  eventTimestamp: string;
  schemaVersion: string;
  modelVersion?: string;
  rubricVersion?: string;
  dispatchStatus: WMDispatchStatus;
  identityQuality: WMIdentityQuality;
  shouldSendMeta: boolean;
  shouldSendGoogle: boolean;
  shouldSendNextdoor: boolean;
  payload: WMCanonicalEventPayload;
  rawPayload?: Record<string, unknown>;
}

export interface CreateCanonicalEventInput {
  eventId?: string;
  eventName: WMEventName;
  eventTimestamp?: string;
  payload: WMCanonicalEventPayload;
  /**
   * Trusted tenant slug from an edge function caller only.
   * Never accept from browser or public CAPI payloads.
   */
  clientSlug?: string;
  leadId?: string;
  userId?: string;
  analysisId?: string;
  scanSessionId?: string;
  quoteFileId?: string;
  schemaVersion?: string;
  modelVersion?: string;
  rubricVersion?: string;
  marginUsd?: number;
  rawPayload?: Record<string, unknown>;
}

export interface WMAnomalyInput {
  quoteAmount?: number;
  pricePerOpening?: number;
  depositPercent?: number;
  cohortStats?: {
    median?: number;
    mad?: number;
    p10?: number;
    p25?: number;
    p75?: number;
    p90?: number;
  };
  impossibleValuesDetected?: boolean;
}

export interface WMAnomalyResult {
  anomalyScoreContribution: number;
  reasons: string[];
}

export interface WMTrustScoreInput {
  documentType?: string;
  isQuoteDocument: boolean;
  duplicateSuspected?: boolean;
  impossibleValuesDetected?: boolean;
  ocrConfidence: number;
  completeness: number;
  mathConsistency: number;
  cohortFit: number;
  scopeConsistency: number;
  documentValidity: number;
  identityStrength: number;
  anomalyInput: WMAnomalyInput;
}

export interface WMTrustScoreResult {
  trustScore: number;
  anomalyScore: number;
  anomalyStatus: WMAnomalyStatus;
  manualReviewRequired: boolean;
  approvedForIndex: boolean;
  approvedForAds: boolean;
  reasons: string[];
}
