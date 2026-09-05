import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Search } from "lucide-react";
import { LeadDossierSheet } from "./LeadDossierSheet";
import { LeadIdentity } from "./LeadIdentity";
import type { CRMLead, PipelineStatus } from "./types";
import { derivePipelineStatus } from "./types";
import { matchesAdminLeadSearch } from "@/lib/adminLeadSearch";
import { useAdminLeadSelection } from "@/hooks/useAdminLeadSelection";

interface ActivePipelineProps {
  leads: CRMLead[];
  isLoading?: boolean;
  hasLoadError?: boolean;
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
  A: "bg-emerald-100 text-emerald-950 border border-emerald-300",
  B: "bg-blue-100 text-blue-950 border border-blue-300",
  C: "bg-amber-100 text-amber-950 border border-amber-300",
  D: "bg-orange-100 text-orange-950 border border-orange-300",
  F: "bg-red-100 text-red-950 border border-red-300",
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

// Phase 8 — safe operator-facing fallback for null/empty geography.
// Never block the UI on missing county data.
const UNKNOWN_COUNTY = "Unknown County";

/* ── Component ───────────────────────────────────────────────────────── */

export function ActivePipeline({ leads, isLoading, hasLoadError = false }: ActivePipelineProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter>("all");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const {
    selectedLead,
    isOpen,
    presentation,
    openLead,
    closeLead,
  } = useAdminLeadSelection(leads, { isReady: !isLoading && !hasLoadError });

  // Phase 8 — distinct county list for dropdown, with safe Unknown fallback.
  const marketOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const l of leads) {
      const county = l.county?.trim();
      const key = county && county.length > 0 ? county : UNKNOWN_COUNTY;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [leads]);

  /* ── Canonical derived filtered list ── */
  const filteredLeads = useMemo(() => {
    let result = leads;
    const now = Date.now();

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((lead) => derivePipelineStatus(lead) === statusFilter);
    }

    // Ownership filter (repo-real lifecycle fields + one operator-derived)
    if (ownershipFilter !== "all") {
      result = result.filter((lead) => {
        const routedAt = lead.routed_to_contractor_at ?? null;
        const bookedAt = lead.appointment_booked_at ?? null;
        const closedAt = lead.closed_at ?? null;
        const unlockedAt = lead.report_unlocked_at ?? null;
        switch (ownershipFilter) {
          case "assigned": return !!routedAt;
          case "unassigned": return !routedAt;
          case "booked": return !!bookedAt;
          case "closed": return !!closedAt;
          case "recovery_candidate":
            return !!unlockedAt && !routedAt &&
              now - new Date(unlockedAt).getTime() > FOURTEEN_DAYS_MS;
          default: return true;
        }
      });
    }

    // Phase 8 — Market filter (county). Safe fallback for null/empty county.
    if (marketFilter !== "all") {
      result = result.filter((lead) => {
        const county = lead.county?.trim();
        const key = county && county.length > 0 ? county : UNKNOWN_COUNTY;
        return key === marketFilter;
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      result = result.filter((lead) => matchesAdminLeadSearch(lead, searchQuery));
    }

    return result;
  }, [leads, statusFilter, ownershipFilter, marketFilter, searchQuery]);

  if (isLoading && leads.length === 0) {
    return (
      <div className="wm-on-canvas-text flex items-center justify-center py-20 font-medium">
        Loading pipeline…
      </div>
    );
  }

  if (!leads.length) {
    return (
      <div className="wm-on-canvas-text flex flex-col items-center justify-center py-20 font-medium gap-2">
        <p className="wm-on-canvas-title text-xl font-extrabold">No leads yet</p>
        <p className="text-sm">Leads will appear here once homeowners start uploading quotes.</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Filter controls ── */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-700" />
          <Input
            placeholder="Search name, phone, email, ZIP, or lead ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 text-sm font-semibold"
            aria-label="Search pipeline leads"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[160px] h-10 text-sm font-semibold">
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
        <Select value={ownershipFilter} onValueChange={(v) => setOwnershipFilter(v as OwnershipFilter)}>
          <SelectTrigger className="w-[210px] h-10 text-sm font-semibold">
            <SelectValue placeholder="All Ownership" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Ownership</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            <SelectItem value="booked">Appointment Booked</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="recovery_candidate">Recovery Candidate (operator view)</SelectItem>
          </SelectContent>
        </Select>
        {/* Phase 8 — Always exposes an explicit "Unknown County" option as a safe
            fallback for null/empty geography, even when no current leads match. */}
        <Select value={marketFilter} onValueChange={setMarketFilter}>
          <SelectTrigger className="w-[180px] h-10 text-sm font-semibold">
            <SelectValue placeholder="All Markets" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Markets</SelectItem>
            {marketOptions.map(([market, count]) => (
              <SelectItem key={market} value={market}>
                {market} ({count})
              </SelectItem>
            ))}
            {!marketOptions.some(([m]) => m === UNKNOWN_COUNTY) && (
              <SelectItem value={UNKNOWN_COUNTY}>{UNKNOWN_COUNTY} (0)</SelectItem>
            )}
          </SelectContent>
        </Select>
        <span className="wm-on-canvas-text text-sm font-semibold">
          {filteredLeads.length} of {leads.length} leads
        </span>
      </div>

      <div className="rounded-xl border border-slate-300 bg-white shadow-sm overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px]">Name / Email</TableHead>
              <TableHead className="min-w-[130px]">Phone</TableHead>
              <TableHead className="w-[80px] text-center">Grade</TableHead>
              <TableHead className="w-[80px] text-center">Windows</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[120px]">Owner</TableHead>
              <TableHead className="w-[90px] text-right">Age</TableHead>
              <TableHead className="w-[120px] text-right">Workspace</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-slate-700">
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
                    onClick={(event) => openLead(lead.id, event.currentTarget)}
                  >
                    <TableCell>
                      <div className="font-medium text-sm truncate max-w-[220px]">
                        {displayName(lead)}
                      </div>
                      {lead.email && lead.first_name && (
                        <div className="text-sm font-semibold text-slate-700 truncate max-w-[220px]">
                          {lead.email}
                        </div>
                      )}
                      <div onClick={(event) => event.stopPropagation()}>
                        <LeadIdentity leadId={lead.id} className="mt-1 text-xs font-semibold text-slate-600" />
                      </div>
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
                        <span className="text-slate-700 text-xs">—</span>
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
                    <TableCell className="text-sm text-slate-700">
                      {lead.assigned_partner}
                    </TableCell>
                    <TableCell className="text-right text-sm font-semibold text-slate-700 whitespace-nowrap">
                      {timeAgo(lead.created_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          to={`/admin/leads/${lead.id}`}
                          onClick={(event) => event.stopPropagation()}
                          aria-label={`Open lead workspace for ${displayName(lead)}`}
                        >
                          Open <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                        </Link>
                      </Button>
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
        open={isOpen}
        presentation={presentation}
        onOpenChange={(open) => {
          if (!open) closeLead();
        }}
      />
    </>
  );
}
