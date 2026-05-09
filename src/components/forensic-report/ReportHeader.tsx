/**
 * ReportHeader — title block with WM TRUTH REPORT, ID, generated date, audit chip.
 * Pure presentation. No data fetching.
 */
import { formatReportId } from "./tokens";

interface Props {
  analysisId: string | null | undefined;
  generatedAt?: Date;
}

export default function ReportHeader({ analysisId, generatedAt }: Props) {
  const date = generatedAt ?? new Date();
  const dateStr = date.toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  return (
    <header className="flex items-start justify-between gap-4 pb-6 border-b border-[hsl(var(--fr-border))]">
      <div>
        <h1
          className="font-mono text-[hsl(var(--fr-text))] text-2xl sm:text-3xl font-extrabold tracking-tight"
          style={{ letterSpacing: "0.04em" }}
        >
          WINDOWMAN TRUTH REPORT
        </h1>
        <p className="mt-2 text-xs sm:text-sm text-[hsl(var(--fr-text-dim))]">
          <span className="fr-mono text-[10px]">Report ID:</span>{" "}
          <span className="fr-mono text-[11px] text-[hsl(var(--fr-text-muted))]">
            {formatReportId(analysisId, date)}
          </span>
          <span className="mx-2 opacity-40">·</span>
          <span className="fr-mono text-[10px]">Generated:</span>{" "}
          <span className="text-[11px]">{dateStr}</span>
        </p>
      </div>
      <div
        className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-md border"
        style={{
          borderColor: "hsl(var(--fr-cyan) / 0.5)",
          background: "hsl(var(--fr-cyan) / 0.06)",
        }}
      >
        <span className="fr-mono text-[10px] font-bold text-[hsl(var(--fr-cyan))]">
          {"⟨ ⟩  FORENSIC AUDIT"}
        </span>
      </div>
    </header>
  );
}
