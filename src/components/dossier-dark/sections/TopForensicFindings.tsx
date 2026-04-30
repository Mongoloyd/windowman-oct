import { AlertTriangle } from "lucide-react";
import { SectionCard } from "../primitives/SectionCard";
import { StatusPill } from "../primitives/StatusPill";
import { LockOverlay } from "../primitives/LockOverlay";
import type { DossierFinding } from "../fixtures";

interface TopForensicFindingsProps {
  findings: DossierFinding[];
  locked: boolean;
}

export function TopForensicFindings({ findings, locked }: TopForensicFindingsProps) {
  return (
    <div className="relative">
      <SectionCard eyebrow="Top Forensic Findings" title="Critical Issues Detected">
        <div
          className="space-y-3"
          style={{
            filter: locked ? "blur(6px)" : "blur(0px)",
            userSelect: locked ? "none" : "auto",
            pointerEvents: locked ? "none" : "auto",
            transition: "filter 0.6s ease-out",
          }}
          aria-hidden={locked}
        >
          {findings.slice(0, 3).map((f) => (
            <article
              key={f.signalNumber}
              className="bg-dossier-surface/70 rounded-lg p-5 border border-dossier-border"
              style={{ borderLeft: "3px solid #ff4444" }}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-dossier-danger shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-2">
                    <h4 className="text-base font-bold text-white">{f.title}</h4>
                    <StatusPill variant="critical">Signal #{f.signalNumber}</StatusPill>
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">{f.explanation}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </SectionCard>
      {locked && <LockOverlay />}
    </div>
  );
}
