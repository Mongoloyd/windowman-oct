import { GradeBadge } from "../primitives/GradeBadge";
import { SectionCard } from "../primitives/SectionCard";

interface ExecutiveSummaryProps {
  grade: string;
  signalsExtracted: number;
  signalsTotal: number;
  criticalFlags: number;
  confidencePct: number;
  verdict: string;
}

function StatBox({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="bg-dossier-surface/70 border border-dossier-border rounded-lg p-4 flex flex-col gap-1">
      <span className="text-xs uppercase tracking-wider text-dossier-txt-secondary">{label}</span>
      <span className={`font-mono text-xl font-bold ${accent ?? "text-dossier-txt-primary"}`}>
        {value}
      </span>
    </div>
  );
}

export function ExecutiveSummary({
  grade,
  signalsExtracted,
  signalsTotal,
  criticalFlags,
  confidencePct,
  verdict,
}: ExecutiveSummaryProps) {
  return (
    <SectionCard eyebrow="Executive Summary" title="Forensic Quote Dossier">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        <GradeBadge grade={grade} />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 w-full">
          <StatBox label="Signals Extracted" value={`${signalsExtracted}/${signalsTotal}`} />
          <StatBox
            label="Critical Flags"
            value={String(criticalFlags)}
            accent={criticalFlags > 0 ? "text-dossier-danger" : "text-dossier-success"}
          />
          <StatBox label="Confidence" value={`${confidencePct}%`} accent="text-dossier-info" />
        </div>
      </div>
      <p className="text-sm text-dossier-txt-secondary leading-relaxed mt-4">{verdict}</p>
    </SectionCard>
  );
}
