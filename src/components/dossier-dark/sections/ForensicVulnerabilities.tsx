import { AlertCircle, CheckCircle2 } from "lucide-react";
import { SectionCard } from "../primitives/SectionCard";
import { StatusPill } from "../primitives/StatusPill";
import type { DossierVulnerability } from "../fixtures";

interface Props {
  vulnerabilities: DossierVulnerability[];
}

export function ForensicVulnerabilities({ vulnerabilities }: Props) {
  return (
    <SectionCard eyebrow="Forensic Vulnerabilities" title="Signals 33–37">
      <div className="space-y-3">
        {vulnerabilities.map((v) => {
          const triggered = v.triggered;
          const Icon = triggered ? AlertCircle : CheckCircle2;
          return (
            <article
              key={v.signalNumber}
              className={`rounded-lg p-4 border ${
                triggered
                  ? "bg-red-900/15 border-red-500/30"
                  : "bg-green-900/10 border-green-500/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <Icon
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    triggered ? "text-dossier-danger" : "text-dossier-success"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                    <h4 className="text-sm font-bold text-white">{v.label}</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-dossier-txt-muted">
                        #{v.signalNumber}
                      </span>
                      {triggered ? (
                        <StatusPill variant="critical">Detected</StatusPill>
                      ) : (
                        <StatusPill variant="clear">Clear</StatusPill>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-slate-300">{v.detail}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </SectionCard>
  );
}
