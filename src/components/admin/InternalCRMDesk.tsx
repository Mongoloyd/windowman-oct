/**
 * ═══════════════════════════════════════════════════════════════════════════
 * INTERNAL CRM DESK — Power Dialer v2.0 (P3: Autodial + Popover)
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useMemo, useCallback, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Phone, PhoneCall, Users, CalendarCheck, Eye, Flag } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

import type { CRMLead, VoiceFollowupSummary } from "./types";
import { updateLeadDealStatus, dialLead } from "@/services/adminDataService";
import { LeadDossierSheet } from "./LeadDossierSheet";
import { formatPhoneDisplay, stripNonDigits } from "@/utils/formatPhone";

/* ── Constants ────────────────────────────────────────────────────────── */

const DEAL_STATUSES = [
  { value: "new", label: "New" },
  { value: "attempted", label: "Attempted" },
  { value: "in_conversation", label: "In-Conversation" },
  { value: "appointment_booked", label: "Appointment Booked" },
  { value: "dead", label: "Dead" },
] as const;

/* ── Grade badge colors ───────────────────────────────────────────────── */

function gradeColor(grade: string | null): string {
  switch (grade) {
    case "A": return "bg-green-500 text-white";
    case "B": return "bg-teal-500 text-white";
    case "C": return "bg-amber-100 text-amber-950 border border-amber-300";
    case "D": return "bg-orange-500 text-white";
    case "F": return "bg-red-500 text-white";
    default: return "bg-gray-400 text-white";
  }
}

/* ── Pipeline status badge ────────────────────────────────────────────── */

interface StatusBadge {
  label: string;
  className: string;
  rowClass?: string;
}

function derivePipelineBadge(
  lead: CRMLead,
  followup?: VoiceFollowupSummary,
): StatusBadge {
  const pill = "inline-flex items-center rounded-full px-2 py-1 text-xs font-medium whitespace-nowrap";

  if (lead.deal_status === "dead")
    return { label: "Dead", className: `${pill} bg-gray-200 text-slate-700`, rowClass: "opacity-40" };
  if (lead.deal_status === "appointment_booked")
    return { label: "Appt Booked", className: `${pill} bg-green-100 text-green-800 ring-1 ring-green-500` };
  if (lead.latest_opportunity_id != null)
    return { label: "Sent to Client", className: `${pill} bg-purple-100 text-purple-800` };
  if (lead.intro_requested_at != null)
    return { label: "Intro Requested", className: `${pill} bg-blue-100 text-blue-800` };
  if (lead.deal_status === "ghosted")
    return { label: "Ghosted", className: `${pill} bg-slate-200 text-slate-700` };
  if (followup?.status === "queued" || followup?.status === "in_progress")
    return { label: "AI Calling", className: `${pill} bg-blue-100 text-blue-950 animate-pulse` };
  if (followup?.call_outcome === "voicemail")
    return { label: "Left Voicemail", className: `${pill} bg-amber-100 text-amber-800` };
  if (followup?.status === "failed" || followup?.call_outcome === "no_answer")
    return { label: "No Answer", className: `${pill} bg-orange-100 text-orange-800` };

  return { label: "New Lead", className: `${pill} border border-border bg-background text-slate-700` };
}

/* ── Sort options ─────────────────────────────────────────────────────── */

type SortMode = "default" | "grade_worst" | "flags_most";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "default", label: "Newest (Default)" },
  { value: "grade_worst", label: "Grade: Worst First" },
  { value: "flags_most", label: "Flags: Most First" },
];

const GRADE_WEIGHT: Record<string, number> = { F: 0, D: 1, C: 2, B: 3, A: 4 };

/* ── Props ────────────────────────────────────────────────────────────── */

interface InternalCRMDeskProps {
  leads: CRMLead[];
  isLoading: boolean;
  onStatusChange: () => void;
  latestFollowups?: Record<string, VoiceFollowupSummary>;
}

/* ── Component ────────────────────────────────────────────────────────── */

export function InternalCRMDesk({ leads, isLoading, onStatusChange, latestFollowups = {} }: InternalCRMDeskProps) {
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [dialingLeadId, setDialingLeadId] = useState<string | null>(null);
  const [followupOverrides, setFollowupOverrides] = useState<Record<string, Partial<VoiceFollowupSummary>>>({});

  // Filter to phone-verified leads only
  const verified = useMemo(
    () => leads.filter((l) => l.phone_verified && l.latest_analysis_id),
    [leads],
  );

  // Sort
  const sorted = useMemo(() => {
    return [...verified].sort((a, b) => {
      if (sortMode === "grade_worst") {
        const wA = GRADE_WEIGHT[a.grade ?? ""] ?? 99;
        const wB = GRADE_WEIGHT[b.grade ?? ""] ?? 99;
        if (wA !== wB) return wA - wB;
      }
      if (sortMode === "flags_most") {
        const fA = a.flag_count ?? 0;
        const fB = b.flag_count ?? 0;
        if (fA !== fB) return fB - fA;
      }
      const aStatus = statusOverrides[a.id] ?? a.deal_status;
      const bStatus = statusOverrides[b.id] ?? b.deal_status;
      const aIsNew = !aStatus || aStatus === "new";
      const bIsNew = !bStatus || bStatus === "new";
      if (aIsNew && !bIsNew) return -1;
      if (!aIsNew && bIsNew) return 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [verified, sortMode, statusOverrides]);

  // KPIs
  const needsFirstCall = verified.filter((l) => {
    const s = statusOverrides[l.id] ?? l.deal_status;
    return !s || s === "new";
  }).length;
  const appointmentsBooked = verified.filter((l) => {
    const s = statusOverrides[l.id] ?? l.deal_status;
    return s === "appointment_booked";
  }).length;

  const handleDealStatusChange = useCallback(async (leadId: string, newStatus: string) => {
    setUpdatingLeadId(leadId);
    setStatusOverrides(prev => ({ ...prev, [leadId]: newStatus }));
    try {
      await updateLeadDealStatus(leadId, newStatus);
      toast.success(`Status updated to "${DEAL_STATUSES.find((s) => s.value === newStatus)?.label}"`);
      onStatusChange();
    } catch (err) {
      setStatusOverrides(prev => {
        const next = { ...prev };
        delete next[leadId];
        return next;
      });
      const msg = err instanceof Error ? err.message : "Failed to update status";
      toast.error(`Status update failed — reverted. ${msg}`);
    } finally {
      setUpdatingLeadId(null);
    }
  }, [onStatusChange]);

  const openDossier = useCallback((lead: CRMLead) => {
    setSelectedLead(lead);
    setDossierOpen(true);
  }, []);

  const handleAutodial = useCallback(async (lead: CRMLead) => {
    if (!lead.phone_e164 || dialingLeadId) return;
    setDialingLeadId(lead.id);

    // Optimistic: set followup override so pipeline badge flips to "AI Calling"
    setFollowupOverrides(prev => ({
      ...prev,
      [lead.id]: { status: "in_progress", call_intent: "operator_outbound" } as Partial<VoiceFollowupSummary>,
    }));

    try {
      await dialLead(lead.id);
      toast.success(`Call queued for ${lead.first_name || "lead"}`);

      // Optimistically bump deal_status if new/null
      const currentStatus = statusOverrides[lead.id] ?? lead.deal_status;
      if (!currentStatus || currentStatus === "new") {
        setStatusOverrides(prev => ({ ...prev, [lead.id]: "attempted" }));
      }

      onStatusChange();
    } catch (err) {
      // Rollback followup override
      setFollowupOverrides(prev => {
        const next = { ...prev };
        delete next[lead.id];
        return next;
      });
      const msg = err instanceof Error ? err.message : typeof err === "object" && err !== null && "message" in err ? String((err as any).message) : "Failed to dial";
      toast.error(`Autodial failed: ${msg}`);
    } finally {
      setDialingLeadId(null);
    }
  }, [dialingLeadId, onStatusChange, statusOverrides]);

  // Merge followup sources: prop (server truth) + local overrides (optimistic)
  const getFollowup = useCallback((leadId: string): VoiceFollowupSummary | undefined => {
    const override = followupOverrides[leadId];
    const server = latestFollowups[leadId];
    if (override) return { ...server, ...override } as VoiceFollowupSummary;
    return server;
  }, [latestFollowups, followupOverrides]);

  return (
    <div className="space-y-6">
      {/* ── Summary Strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{verified.length}</p>
              <p className="text-xs text-slate-700">Verified Leads</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <PhoneCall className="h-8 w-8 text-amber-500" />
            <div>
              <p className="text-2xl font-bold">{needsFirstCall}</p>
              <p className="text-xs text-slate-700">Needs First Call</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-4">
            <CalendarCheck className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-2xl font-bold">{appointmentsBooked}</p>
              <p className="text-xs text-slate-700">Appointments Booked</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Sort Control ─────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="w-[200px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value} className="text-xs">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Power Dialer Table ─────────────────────────────────────── */}
      {isLoading && sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-700">Loading leads…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-slate-700">
          No phone-verified leads yet.
        </div>
      ) : (
        <Card>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Date</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>County</TableHead>
                  <TableHead className="text-center">Grade</TableHead>
                  <TableHead className="text-center">Flags</TableHead>
                  <TableHead className="text-center">Pipeline</TableHead>
                  <TableHead className="text-center">Call Intent</TableHead>
                  <TableHead className="w-[180px]">Deal Status</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((lead) => {
                  const effectiveStatus = statusOverrides[lead.id] ?? lead.deal_status;
                  const leadWithOverride = { ...lead, deal_status: effectiveStatus };
                  const followup = getFollowup(lead.id);
                  const badge = derivePipelineBadge(leadWithOverride, followup);
                  const isUpdating = updatingLeadId === lead.id;
                  const isDialing = dialingLeadId === lead.id;
                  const dialDisabled = !lead.phone_e164 || effectiveStatus === "dead" || !!dialingLeadId;
                  const displayName = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—";
                  const displayPhone = lead.phone_e164 ? formatPhoneDisplay(stripNonDigits(lead.phone_e164)) : "";

                  return (
                  <TableRow key={lead.id} className={badge.rowClass ?? ""}>
                    <TableCell className="text-xs text-slate-700 whitespace-nowrap">
                      {format(new Date(lead.created_at), "MMM d")}
                    </TableCell>
                    <TableCell className="font-medium whitespace-nowrap">
                      {displayName}
                    </TableCell>
                    <TableCell>
                      {lead.phone_e164 ? (
                        <div className="inline-flex items-center gap-1.5">
                          <a
                            href={`tel:${lead.phone_e164}`}
                            className="inline-flex items-center gap-1.5 text-primary hover:underline font-mono text-sm"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            {displayPhone}
                          </a>
                          {/* ── Autodial Popover ── */}
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={dialDisabled}
                                title="Autodial via AI"
                              >
                                <PhoneCall className={`h-3.5 w-3.5 ${isDialing ? "animate-pulse text-blue-500" : "text-slate-700 hover:text-primary"}`} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-56 p-3" align="end">
                              <div className="space-y-2">
                                <p className="text-sm font-medium">{displayName}</p>
                                <p className="text-xs text-slate-700 font-mono">{displayPhone}</p>
                                <div className="flex gap-2 pt-1">
                                  <Button
                                    size="sm"
                                    className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
                                    disabled={isDialing}
                                    onClick={() => handleAutodial(lead)}
                                  >
                                    {isDialing ? "Dialing…" : "Dial Now"}
                                  </Button>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </div>
                      ) : (
                        <span className="text-slate-700">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{lead.county || "—"}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${gradeColor(lead.grade)}`}
                      >
                        {lead.grade ?? "?"}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {(lead.flag_count ?? 0) > 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700 ${
                            (lead.flag_count ?? 0) >= 3 ? "ring-2 ring-red-500 animate-pulse" : ""
                          }`}
                        >
                          <Flag className="w-3 h-3" />
                          {lead.flag_count}
                        </span>
                      ) : (
                        <span className="text-slate-700 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={badge.className}>{badge.label}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {lead.last_call_intent ? (
                        <Badge variant="secondary" className="text-xs">
                          Requested
                        </Badge>
                      ) : (
                        <span className="text-slate-700 text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Select
                        value={effectiveStatus || "new"}
                        onValueChange={(val) => handleDealStatusChange(lead.id, val)}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className={`h-8 text-xs ${isUpdating ? "opacity-100 cursor-not-allowed" : ""}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DEAL_STATUSES.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openDossier(lead)}
                        title="View Lead Dossier"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

      {/* ── Dossier Sheet ──────────────────────────────────────────── */}
      <LeadDossierSheet
        lead={selectedLead}
        open={dossierOpen}
        onOpenChange={setDossierOpen}
      />
    </div>
  );
}
