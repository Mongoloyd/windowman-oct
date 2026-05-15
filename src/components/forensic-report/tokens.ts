/**
 * Shared spacing/typography constants for the Forensic Audit Report (v3).
 * Color tokens live in index.css under `.report-dark` scope.
 */
export const FR = {
  pagePad: "px-4 sm:px-6 lg:px-8",
  cardPad: "p-6 sm:p-7",
  sectionGap: "space-y-6 sm:space-y-7",
  maxWidth: "max-w-5xl mx-auto",
} as const;

export function formatReportId(analysisId: string | null | undefined, createdAt?: Date): string {
  const d = createdAt ?? new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const last4 = (analysisId ?? "0000").replace(/-/g, "").slice(-4).toUpperCase();
  return `WM-${yyyy}-${mm}-${last4}`;
}
