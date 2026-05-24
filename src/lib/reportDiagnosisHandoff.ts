export interface ReportDiagnosisHandoff {
  lead_id: string;
  scan_session_id: string;
  analysis_id?: string | null;
  report_grade: string;
  first_name?: string | null;
  phone?: string | null;
  email?: string | null;
  top_insights: string[];
  returnTo: string;
  saved_at: string;
}

const STORAGE_KEY = "wm_report_diagnosis_handoff_v1";
/** One-shot marker: homepage Dark V2 report was open before Diagnosis navigation (Back/remount recovery). */
export const HOMEPAGE_DARK_V2_RETURN_SESSION_KEY = "wm_homepage_diagnosis_return_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizeString = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

function validateHandoff(value: unknown): ReportDiagnosisHandoff | null {
  if (!isRecord(value)) return null;

  const scan_session_id = normalizeString(value.scan_session_id);
  const report_grade = normalizeString(value.report_grade);
  const saved_at = normalizeString(value.saved_at);
  const savedTime = Date.parse(saved_at);

  if (!scan_session_id || !report_grade || !saved_at || Number.isNaN(savedTime)) return null;
  if (Date.now() - savedTime > MAX_AGE_MS) return null;

  const top_insights = Array.isArray(value.top_insights)
    ? value.top_insights.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean).slice(0, 3)
    : [];

  return {
    lead_id: normalizeString(value.lead_id),
    scan_session_id,
    analysis_id: normalizeString(value.analysis_id) || null,
    report_grade,
    first_name: normalizeString(value.first_name) || null,
    phone: normalizeString(value.phone) || null,
    email: normalizeString(value.email) || null,
    top_insights,
    returnTo: normalizeString(value.returnTo) || `/report/classic/${scan_session_id}`,
    saved_at,
  };
}

export function saveReportDiagnosisHandoff(payload: ReportDiagnosisHandoff): void {
  if (typeof window === "undefined") return;

  const safePayload = validateHandoff({
    ...payload,
    top_insights: payload.top_insights.slice(0, 3),
  });
  if (!safePayload) return;

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(safePayload));
}

export function readReportDiagnosisHandoff(): ReportDiagnosisHandoff | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const valid = validateHandoff(parsed);
    if (!valid) clearReportDiagnosisHandoff();
    return valid;
  } catch {
    clearReportDiagnosisHandoff();
    return null;
  }
}

export function clearReportDiagnosisHandoff(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Set before homepage → Diagnosis navigation when Dark V2 homepage flag is on. */
export function markHomepageDarkV2ReportReturn(scanSessionId: string): void {
  if (typeof window === "undefined" || !scanSessionId.trim()) return;
  sessionStorage.setItem(HOMEPAGE_DARK_V2_RETURN_SESSION_KEY, scanSessionId.trim());
}

/** Read and clear the one-shot homepage return marker (mount-time recovery only). */
export function consumeHomepageDarkV2ReportReturn(): string | null {
  if (typeof window === "undefined") return null;
  const id = sessionStorage.getItem(HOMEPAGE_DARK_V2_RETURN_SESSION_KEY);
  if (id) sessionStorage.removeItem(HOMEPAGE_DARK_V2_RETURN_SESSION_KEY);
  return id?.trim() || null;
}

export function clearHomepageDarkV2ReportReturn(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(HOMEPAGE_DARK_V2_RETURN_SESSION_KEY);
}
