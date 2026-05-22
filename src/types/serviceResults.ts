/**
 * Shared service-level result types.
 *
 * These decouple hooks from raw Supabase response shapes so the
 * transport layer can change without touching UI state logic.
 */

import type { V2SourceProjection } from "@/types/v2ReportTransport";

// ── Generic envelope ────────────────────────────────────────────────────────

export interface ServiceOk<T> {
  readonly ok: true;
  readonly data: T;
}

export interface ServiceErr {
  readonly ok: false;
  readonly code: string;
  readonly message: string;
}

export type ServiceResult<T> = ServiceOk<T> | ServiceErr;

// ── Report service ──────────────────────────────────────────────────────────

export interface RawPreviewRow {
  analysis_id: string | null;
  grade: string;
  flag_count: number;
  flag_red_count: number;
  flag_amber_count: number;
  proof_of_read: Record<string, unknown> | null;
  preview_json: Record<string, unknown> | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
}

export interface RawFullRow {
  analysis_id: string | null;
  grade: string;
  flags: unknown;
  full_json: Record<string, unknown> | null;
  proof_of_read: Record<string, unknown> | null;
  preview_json: Record<string, unknown> | null;
  confidence_score: number | null;
  document_type: string | null;
  rubric_version: string | null;
  v2_source_version?: string | null;
  v2_source?: V2SourceProjection | null;
}

export interface ScanStatusRow {
  id: string;
  status: string;
}

// ── Phone verification service ──────────────────────────────────────────────

export type OtpErrorCode =
  | "rate_limit"
  | "blocked_prefix"
  | "expired_session"
  | "invalid_code"
  | "network"
  | "generic";

export interface OtpServiceOk<T> {
  readonly ok: true;
  readonly data: T;
}

export interface OtpServiceErr {
  readonly ok: false;
  readonly message: string;
  readonly errorCode: OtpErrorCode;
}

export type OtpServiceResult<T> = OtpServiceOk<T> | OtpServiceErr;
