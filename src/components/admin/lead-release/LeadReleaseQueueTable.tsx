import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LeadReleaseQueueItem } from "@/services/leadReleaseQueue";
import { formatAllowedContactField, formatLeadReleaseStatus } from "@/services/leadReleaseQueue";

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

export function LeadReleaseQueueTable({ rows, onOpen }: { rows: LeadReleaseQueueItem[]; onOpen: (row: LeadReleaseQueueItem) => void }) {
  if (rows.length === 0) {
    return <div className="rounded-lg border border-slate-300 bg-white p-6 text-sm font-semibold text-slate-700 shadow-sm">No assigned opportunities match the current release filters.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
      <div className="wm-slim-scrollbar overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-100 text-xs font-black uppercase text-slate-600">
            <tr>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Contractor</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3">Assignment Status</th>
              <th className="px-4 py-3">Release Status</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">County</th>
              <th className="px-4 py-3">Allowed Fields</th>
              <th className="px-4 py-3">Warnings</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row) => (
              <tr key={row.assignmentId} className="align-top text-slate-800">
                <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{row.assignmentIdMasked}</td>
                <td className="px-4 py-3 font-extrabold text-slate-950"><div>{row.contractorDisplayName}</div><div className="font-mono text-xs font-bold text-slate-500">{row.contractorAccountIdMasked}</div></td>
                <td className="px-4 py-3 font-bold">{row.clientSlug}</td>
                <td className="px-4 py-3 font-semibold">{formatDate(row.assignedAt)}</td>
                <td className="px-4 py-3 font-semibold">{row.assignmentStatus}</td>
                <td className="px-4 py-3"><span className="inline-flex rounded-md border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-black uppercase text-slate-800">{formatLeadReleaseStatus(row.releaseStatus)}</span></td>
                <td className="px-4 py-3 font-semibold">{row.projectType ?? "—"}</td>
                <td className="px-4 py-3 font-semibold">{row.county ?? "—"}</td>
                <td className="px-4 py-3 font-semibold">{row.allowedContactFields.length ? row.allowedContactFields.map(formatAllowedContactField).join(", ") : "None"}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{row.riskWarnings.length ? row.riskWarnings.map((warning) => <span key={warning} className="rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-xs font-bold text-amber-950">{warning}</span>) : <span className="text-xs font-bold text-slate-500">Clear</span>}</div></td>
                <td className="px-4 py-3"><Button size="sm" variant="outline" onClick={() => onOpen(row)} className="gap-1 border-slate-400 bg-white text-slate-950"><Eye className="h-3.5 w-3.5" aria-hidden />Review</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
