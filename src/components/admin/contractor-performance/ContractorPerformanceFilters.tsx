import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { type ContractorPerformanceStatus, type ContractorPerformanceWindow, formatPerformanceStatus, formatPerformanceWindow } from "@/services/contractorPerformance";

const WINDOWS: ContractorPerformanceWindow[] = ["7d", "30d", "90d", "all"];
const STATUSES: Array<ContractorPerformanceStatus | "all"> = ["all", "insufficient_data", "healthy", "watch", "coach", "pause"];

export function ContractorPerformanceFilters({
  window,
  clientSlug,
  performanceStatus,
  clientSlugs,
  onWindowChange,
  onClientSlugChange,
  onPerformanceStatusChange,
}: {
  window: ContractorPerformanceWindow;
  clientSlug: string;
  performanceStatus: ContractorPerformanceStatus | "all";
  clientSlugs: string[];
  onWindowChange: (value: ContractorPerformanceWindow) => void;
  onClientSlugChange: (value: string) => void;
  onPerformanceStatusChange: (value: ContractorPerformanceStatus | "all") => void;
}) {
  return (
    <div className="grid gap-3 rounded-lg border border-slate-300 bg-white p-4 shadow-sm md:grid-cols-3">
      <Select value={window} onValueChange={(value) => onWindowChange(value as ContractorPerformanceWindow)}>
        <SelectTrigger className="border-slate-300 font-bold text-slate-950"><SelectValue placeholder="Time window" /></SelectTrigger>
        <SelectContent>{WINDOWS.map((value) => <SelectItem key={value} value={value}>{formatPerformanceWindow(value)}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={clientSlug} onValueChange={onClientSlugChange}>
        <SelectTrigger className="border-slate-300 font-bold text-slate-950"><SelectValue placeholder="Client" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All clients</SelectItem>
          {clientSlugs.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={performanceStatus} onValueChange={(value) => onPerformanceStatusChange(value as ContractorPerformanceStatus | "all")}>
        <SelectTrigger className="border-slate-300 font-bold text-slate-950"><SelectValue placeholder="Status" /></SelectTrigger>
        <SelectContent>{STATUSES.map((value) => <SelectItem key={value} value={value}>{value === "all" ? "All statuses" : formatPerformanceStatus(value)}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
