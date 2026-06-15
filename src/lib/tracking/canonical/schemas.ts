import { z } from "zod";
import {
  WM_ANOMALY_STATUSES,
  WM_DISPATCH_STATUSES,
  WM_EVENT_NAMES,
  WM_IDENTITY_QUALITIES,
  WM_PLATFORM_NAMES,
} from "./constants.ts";

export const wmEventNameSchema = z.enum(WM_EVENT_NAMES);
export const wmAnomalyStatusSchema = z.enum(WM_ANOMALY_STATUSES);
export const wmDispatchStatusSchema = z.enum(WM_DISPATCH_STATUSES);
export const wmPlatformNameSchema = z.enum(WM_PLATFORM_NAMES);
export const wmIdentityQualitySchema = z.enum(WM_IDENTITY_QUALITIES);

export const wmIdentityPayloadSchema = z.object({
  leadId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  email: z.string().optional(),
  emailHash: z.string().optional(),
  phone: z.string().optional(),
  phoneHash: z.string().optional(),
  phoneVerifiedAt: z.string().datetime().optional(),
  clickId: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  gclid: z.string().optional(),
  gbraid: z.string().optional(),
  wbraid: z.string().optional(),
  sameDeviceAsUpload: z.boolean().optional(),
  ipRiskLevel: z.enum(["low", "medium", "high"]).optional(),
  userAgent: z.string().optional(),
  clientIp: z.string().optional(),
});

export const wmJourneyPayloadSchema = z.object({
  route: z.string().min(1),
  flow: z.enum(["public", "vault", "admin"]),
  sessionId: z.string().optional(),
  scanSessionId: z.string().uuid().optional(),
});

export const wmQuotePayloadSchema = z.object({
  analysisId: z.string().uuid().optional(),
  quoteFileId: z.string().uuid().optional(),
  documentType: z.string().optional(),
  isQuoteDocument: z.boolean(),
  openingCount: z.number().int().nonnegative().optional(),
  quoteAmount: z.number().nonnegative().optional(),
  pricePerOpening: z.number().nonnegative().optional(),
  depositPercent: z.number().min(0).max(100).optional(),
  duplicateSuspected: z.boolean().optional(),
  impossibleValuesDetected: z.boolean().optional(),
});

export const wmAnalyticsPayloadSchema = z.object({
  ocrConfidence: z.number().min(0).max(1),
  completeness: z.number().min(0).max(1),
  mathConsistency: z.number().min(0).max(1),
  cohortFit: z.number().min(0).max(1),
  scopeConsistency: z.number().min(0).max(1),
  documentValidity: z.number().min(0).max(1),
  identityStrength: z.number().min(0).max(1),
  anomalyScore: z.number().min(0).max(1),
  trustScore: z.number().min(0).max(1),
  anomalyStatus: wmAnomalyStatusSchema,
  reasons: z.array(z.string()),
});

export const wmOptimizationPayloadSchema = z.object({
  approvedForIndex: z.boolean(),
  approvedForAds: z.boolean(),
  manualReviewRequired: z.boolean(),
  valueUsd: z.number().optional(),
  priority: z.number().int().min(0).max(100).optional(),
});

export const wmSourcePayloadSchema = z.object({
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  referrer: z.string().optional(),
  sourceSystem: z.enum(["frontend", "edge_function", "internal"]).optional(),
});

export const wmCanonicalEventPayloadSchema = z.object({
  identity: wmIdentityPayloadSchema,
  journey: wmJourneyPayloadSchema,
  quote: wmQuotePayloadSchema.optional(),
  analytics: wmAnalyticsPayloadSchema.optional(),
  optimization: wmOptimizationPayloadSchema.optional(),
  source: wmSourcePayloadSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const wmCanonicalEventSchema = z.object({
  eventId: z.string().min(1),
  eventName: wmEventNameSchema,
  eventTimestamp: z.string().datetime(),
  schemaVersion: z.string().min(1),
  modelVersion: z.string().optional(),
  rubricVersion: z.string().optional(),
  dispatchStatus: wmDispatchStatusSchema,
  identityQuality: wmIdentityQualitySchema,
  shouldSendMeta: z.boolean(),
  shouldSendGoogle: z.boolean(),
  shouldSendNextdoor: z.boolean(),
  payload: wmCanonicalEventPayloadSchema,
  rawPayload: z.record(z.unknown()).optional(),
});
