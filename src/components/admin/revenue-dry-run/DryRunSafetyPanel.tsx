import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RevenueSignalDryRunReport } from "@/services/revenueSignalDryRunAudit";

interface DryRunSafetyPanelProps {
  report: RevenueSignalDryRunReport | null;
}

export function DryRunSafetyPanel({ report }: DryRunSafetyPanelProps) {
  return (
    <section className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-800" />
          <div>
            <h3 className="text-base font-black text-emerald-950">No-Dispatch Proof</h3>
            <p className="mt-1 max-w-4xl text-sm font-bold text-emerald-900">
              Dry-Run Audit evaluates revenue signal sync without inserting provider dispatches, creating dispatch attempts, or sending external events.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className="border border-emerald-300 bg-white text-emerald-950">externalDispatch: {String(report?.externalDispatch ?? false)}</Badge>
          <Badge className="border border-emerald-300 bg-white text-emerald-950">dispatchCreated: {String(report?.dispatchCreated ?? false)}</Badge>
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          "No provider calls",
          "No dispatch attempts",
          "No outbox sent status",
          "Dry-run service path only",
        ].map((item) => (
          <div key={item} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-black text-emerald-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
            {item}
          </div>
        ))}
      </div>
    </section>
  );
}
