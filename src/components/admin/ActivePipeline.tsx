import { useState, useMemo } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search } from "lucide-react";
import { LeadDossierSheet } from "./LeadDossierSheet";
import type { CRMLead, PipelineStatus } from "./types";
import { derivePipelineStatus } from "./types";

interface ActivePipelineProps {
  leads: CRMLead[];
  isLoading?: boolean;
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function maskPhone(phone: string | null): string {
  if (!phone) return "—";
  return `•••-•••-${phone.slice(-4)}`;
}

const STATUS_STYLES: Record<PipelineStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  scanning: { label: "Scanning", variant: "secondary" },
  pending_otp: { label: "Pending OTP", variant: "outline" },
  verified: { label: "Verified ✓", variant: "default" },
  webhook_sent: { label: "Webhook Sent", variant: "default" },
  closed_won: { label: "Closed/Won", variant: "default" },
  ghost: { label: "Ghost 👻", variant: "destructive" },
};

const GRADE_COLORS: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  B: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  C: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  D: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  F: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function gradeClass(grade: string | null): string {
  if (!grade) return "";
  const letter = grade.charAt(0).toUpperCase();
  return GRADE_COLORS[letter] ?? "";
}

function displayName(lead: CRMLead): string {
  const parts = [lead.first_name, lead.last_name].filter(Boolean);
  if (parts.length) return parts.join(" ");
  if (lead.email) return lead.email;
  return `Lead ${lead.id.slice(0, 8)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type StatusFilter = "all" | PipelineStatus;
type OwnershipFilter = "all" | "assigned" | "unassigned" | "booked" | "closed" | "recovery_candidate";

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

/* ── Component ───────────────────────────────────────────────────────── */

export function ActivePipeline({ leads, isLoading }: ActivePipelineProps) {
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  /* ── Canonical derived filtered list ── */
  const filteredLeads = useMemo(() => {
    let result = leads;

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((lead) => derivePipelineStatus(lead) === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((lead) => {
        const name = displayName(lead).toLowerCase();
        const email = (lead.email ?? "").toLowerCase();
        const county = (lead.county ?? "").toLowerCase();
        return name.includes(q) || email.includes(q) || county.includes(q);
      });
    }

    return result;
  }, [leads, statusFilter, searchQuery]);

  if (isLoading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading pipeline…
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
        <p className="text-lg font-medium">No leads yet</p>
        <p className="text-sm">Leads will appear here once homeowners start uploading quotes.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Filter controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email, county…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px] h-9 text-sm">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="scanning">Scanning</SelectItem>
            <SelectItem value="pending_otp">Pending OTP</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="webhook_sent">Webhook Sent</SelectItem>
            <SelectItem value="closed_won">Closed/Won</SelectItem>
            <SelectItem value="ghost">Ghost</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filteredLeads.length} of {leads.length} leads
        </span>
      </div>

      <div className="rounded-md border overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Name / Email</TableHead>
              <TableHead className="min-w-[130px]">Phone</TableHead>
              <TableHead className="w-[80px] text-center">Grade</TableHead>
              <TableHead className="w-[80px] text-center">Windows</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Partner</TableHead>
              <TableHead className="w-[90px] text-right">Age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No leads match the current filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => {
                const status = derivePipelineStatus(lead);
                const style = STATUS_STYLES[status];
                return (
                  <TableRow
                    key={lead.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setSelectedLead(lead)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm truncate max-w-[220px]">
                        {displayName(lead)}
                      </div>
                      {lead.email && lead.first_name && (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {lead.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {lead.phone_verified ? (lead.phone_e164 ?? "—") : maskPhone(lead.phone_e164)}
                    </TableCell>
                    <TableCell className="text-center">
                      {lead.grade ? (
                        <Badge className={`text-xs font-bold ${gradeClass(lead.grade)}`}>
                          {lead.grade}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      {lead.window_count ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={style.variant} className="text-xs whitespace-nowrap">
                        {style.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {lead.assigned_partner}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      {timeAgo(lead.created_at)}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Lead Dossier Slide-Out */}
      <LeadDossierSheet
        lead={selectedLead}
        open={!!selectedLead}
        onOpenChange={(open) => !open && setSelectedLead(null)}
      />
    </>
  );
}
