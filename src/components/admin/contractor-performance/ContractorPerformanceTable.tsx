import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatPerformanceCurrency, formatPerformanceRate, formatPerformanceStatus, type ContractorPerformanceSummary } from "@/services/contractorPerformance";

function formatDate(value: string | null): string { return value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(value)) : "—"; }

export function ContractorPerformanceTable({ summaries, onSelect }: { summaries: ContractorPerformanceSummary[]; onSelect: (summary: ContractorPerformanceSummary) => void }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white shadow-sm">
      <Table>
        <TableHeader><TableRow><TableHead>Contractor</TableHead><TableHead>Client</TableHead><TableHead>Assigned</TableHead><TableHead>Released</TableHead><TableHead>Attempting</TableHead><TableHead>Contacted</TableHead><TableHead>Scheduled</TableHead><TableHead>Quote</TableHead><TableHead>Sold</TableHead><TableHead>Lost</TableHead><TableHead>Close</TableHead><TableHead>Appt.</TableHead><TableHead>Pressure</TableHead><TableHead>Sold value</TableHead><TableHead>Last</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
        <TableBody>
          {summaries.map((row) => (
            <TableRow key={row.contractorAccountId}>
              <TableCell><Button variant="link" className="h-auto p-0 text-left font-black text-slate-950" onClick={() => onSelect(row)}>{row.contractorDisplayName}</Button><p className="font-mono text-xs text-slate-500">{row.contractorAccountIdMasked}</p></TableCell>
              <TableCell className="font-bold text-slate-700">{row.clientSlug}</TableCell><TableCell>{row.assignedCount}</TableCell><TableCell>{row.releasedCount}</TableCell><TableCell>{row.attemptingContactCount}</TableCell><TableCell>{row.contactedCount}</TableCell><TableCell>{row.scheduledCount}</TableCell><TableCell>{row.quoteDeliveredCount}</TableCell><TableCell>{row.soldCount}</TableCell><TableCell>{row.lostCount}</TableCell><TableCell>{formatPerformanceRate(row.closeRate)}</TableCell><TableCell>{formatPerformanceRate(row.appointmentRate)}</TableCell><TableCell>{formatPerformanceRate(row.attemptingContactRate)}</TableCell><TableCell>{formatPerformanceCurrency(row.soldValueCents)}</TableCell><TableCell>{formatDate(row.lastActivityAt)}</TableCell><TableCell className="font-extrabold text-slate-950">{formatPerformanceStatus(row.performanceStatus)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
