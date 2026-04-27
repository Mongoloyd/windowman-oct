import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Eye, FileText, History, Loader2, RefreshCw, RotateCcw, Route, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  LEAD_ASSIGNMENT_REASON_CODES,
  addOperatorNote,
  fetchLeadAssignmentDetail,
  fetchLeadAssignmentReferenceData,
  fetchLeadAssignments,
  markAssignmentManualReview,
  maskAssignmentId,
  reassignLead,
  recycleLead,
  routeLead,
  summarizeSafeMetadata,
  type LeadAssignmentDetail,
  type LeadAssignmentReasonCode,
  type LeadAssignmentReferenceData,
  type LeadAssignmentRow,
  type LeadAssignmentStatus,
  type LeadRoutingEventRow,
} from "@/services/leadAssignments";

const STATUS_OPTIONS: Array<LeadAssignmentStatus | "all"> = [
  "all",
  "assigned",
  "accepted",
  "contacted",
  "scheduled",
  "recycled",
  "reassigned",
  "manual_review",
  "lost_dead",
  "disputed",
];

type ActionKind = "route" | "reassign" | "recycle" | "manual_review" | "operator_note";

interface ActionState {
  kind: ActionKind;
  assignment: LeadAssignmentRow | null;
}

interface ActionFormState {
  lead_id: string;
  scan_session_id: string;
  analysis_id: string;
  syndicate_id: string;
  client_slug: string;
  contractor_account_id: string;
  reason_code: LeadAssignmentReasonCode | "";
  operator_note: string;
}

const defaultActionForm: ActionFormState = {
  lead_id: "",
  scan_session_id: "",
  analysis_id: "",
  syndicate_id: "",
  client_slug: "",
  contractor_account_id: "",
  reason_code: "",
  operator_note: "",
};

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(date);
}

function boolLabel(value: boolean) {
  return value ? "Yes" : "No";
}

function statusTone(status: string) {
  if (status === "manual_review") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "recycled" || status === "lost_dead") return "border-slate-300 bg-slate-100 text-slate-800";
  if (status === "reassigned") return "border-blue-300 bg-blue-50 text-blue-900";
  return "border-emerald-300 bg-emerald-50 text-emerald-900";
}

function safeNotePreview(note: string | null) {
  if (!note) return "No note";
  return note.length > 140 ? `${note.slice(0, 140)}…` : note;
}

function KpiCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
      <p className="text-xs font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function DetailField({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-slate-600">{label}</p>
      <p className="mt-1 break-words text-sm font-bold text-slate-950">{value ?? "—"}</p>
    </div>
  );
}

function Timeline({ events }: { events: LeadRoutingEventRow[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-700">
        No routing events found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const meta = summarizeSafeMetadata(event.metadata);
        return (
          <div key={event.id} className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-slate-950">{event.event_type}</p>
                <p className="text-xs font-semibold text-slate-600">{fmt(event.created_at)}</p>
              </div>
              <Badge className="border border-slate-300 bg-slate-50 text-slate-900">{event.reason_code}</Badge>
            </div>
            <div className="mt-3 grid gap-2 text-xs font-semibold text-slate-700 sm:grid-cols-2">
              <span>From client: {event.from_client_slug ?? "—"}</span>
              <span>To client: {event.to_client_slug ?? "—"}</span>
              <span>From contractor: {maskAssignmentId(event.from_contractor_account_id)}</span>
              <span>To contractor: {maskAssignmentId(event.to_contractor_account_id)}</span>
              <span>Operator: {maskAssignmentId(event.operator_id)}</span>
              <span>Note: {safeNotePreview(event.note)}</span>
              <span>external_dispatch: {meta.externalDispatch}</span>
              <span>revenue_truth_mutated: {meta.revenueTruthMutated}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AssignmentDetailDrawer({ detail, open, onOpenChange }: { detail: LeadAssignmentDetail | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const assignment = detail?.assignment;
  const meta = summarizeSafeMetadata(assignment?.metadata);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white p-5 text-slate-950 sm:max-w-3xl">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-xl font-black text-slate-950">Assignment Detail</SheetTitle>
          <SheetDescription className="font-semibold text-slate-700">
            Operational ownership only. No external dispatch occurs here, and contractor_outcomes remains revenue truth.
          </SheetDescription>
        </SheetHeader>

        {!assignment ? (
          <div className="mt-6 rounded-lg border border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-700">Select an assignment to inspect.</div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <DetailField label="Assignment ID" value={maskAssignmentId(assignment.id)} />
              <DetailField label="Lead ID" value={maskAssignmentId(assignment.lead_id)} />
              <DetailField label="Scan Session ID" value={maskAssignmentId(assignment.scan_session_id)} />
              <DetailField label="Analysis ID" value={maskAssignmentId(assignment.analysis_id)} />
              <DetailField label="Client Slug" value={assignment.client_slug} />
              <DetailField label="Syndicate" value={assignment.syndicate ? `${assignment.syndicate.name} / ${assignment.syndicate.slug}` : maskAssignmentId(assignment.syndicate_id)} />
              <DetailField label="Contractor Account" value={assignment.contractor_account?.display_name ?? maskAssignmentId(assignment.contractor_account_id)} />
              <DetailField label="Status" value={assignment.status} />
              <DetailField label="Current" value={boolLabel(assignment.is_current)} />
              <DetailField label="Reason Code" value={assignment.reason_code} />
              <DetailField label="Assigned At" value={fmt(assignment.assigned_at)} />
              <DetailField label="Accepted At" value={fmt(assignment.accepted_at)} />
              <DetailField label="Released At" value={fmt(assignment.released_at)} />
              <DetailField label="Recycled At" value={fmt(assignment.recycled_at)} />
              <DetailField label="Metadata Source" value={meta.source} />
              <DetailField label="No External Dispatch" value={meta.externalDispatch === "false" ? "Confirmed false" : "Not asserted"} />
              <DetailField label="Revenue Truth Mutated" value={meta.revenueTruthMutated === "false" ? "Confirmed false" : "Not asserted"} />
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-slate-700" />
                <h3 className="text-base font-black text-slate-950">Routing Event Timeline</h3>
              </div>
              <Timeline events={detail?.events ?? []} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function ActionDialog({ action, references, onClose, onSuccess }: { action: ActionState | null; references: LeadAssignmentReferenceData; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState<ActionFormState>(defaultActionForm);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!action) return;
    setForm({
      ...defaultActionForm,
      lead_id: action.assignment?.lead_id ?? "",
      scan_session_id: action.assignment?.scan_session_id ?? "",
      analysis_id: action.assignment?.analysis_id ?? "",
      syndicate_id: action.assignment?.syndicate_id ?? "",
      client_slug: action.assignment?.client_slug ?? "",
      contractor_account_id: action.assignment?.contractor_account_id ?? "",
      reason_code: action.kind === "operator_note" ? "operator_note" : "",
    });
  }, [action]);

  if (!action) return null;

  const title = {
    route: "Route Lead",
    reassign: "Reassign Lead",
    recycle: "Recycle Assignment",
    manual_review: "Mark Manual Review",
    operator_note: "Add Operator Note",
  }[action.kind];

  const requiresTarget = action.kind === "route" || action.kind === "reassign";
  const requiresIdentity = action.kind === "route";
  const targetContractors = references.contractorAccounts.filter((account) => !form.client_slug || account.client_slug === form.client_slug);

  async function submit() {
    if (!form.reason_code) {
      toast.error("Reason code is required.");
      return;
    }
    if (requiresIdentity && !form.lead_id && !form.scan_session_id && !form.analysis_id) {
      toast.error("Route Lead requires a lead/session/analysis identity.");
      return;
    }
    if (requiresTarget && !form.client_slug.trim()) {
      toast.error("Client slug is required.");
      return;
    }

    setIsSaving(true);
    try {
      const base = {
        assignment_id: action.assignment?.id ?? null,
        lead_id: form.lead_id || null,
        scan_session_id: form.scan_session_id || null,
        analysis_id: form.analysis_id || null,
        syndicate_id: form.syndicate_id || null,
        client_slug: form.client_slug.trim(),
        contractor_account_id: form.contractor_account_id || null,
        reason_code: form.reason_code,
        operator_note: form.operator_note.trim() || null,
      };

      if (action.kind === "route") await routeLead(base);
      if (action.kind === "reassign") await reassignLead(base);
      if (action.kind === "recycle") await recycleLead({ assignment_id: action.assignment?.id ?? "", reason_code: form.reason_code, operator_note: base.operator_note });
      if (action.kind === "manual_review") await markAssignmentManualReview({ assignment_id: action.assignment?.id ?? "", reason_code: form.reason_code, operator_note: base.operator_note });
      if (action.kind === "operator_note") await addOperatorNote({ assignment_id: action.assignment?.id ?? "", reason_code: form.reason_code, operator_note: base.operator_note });

      toast.success("Assignment action recorded.");
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment action failed.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="border-slate-300 bg-white text-slate-950 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-black text-slate-950">{title}</DialogTitle>
          <DialogDescription className="font-semibold text-slate-700">
            No external dispatch. No revenue truth mutation. Assignment is operational ownership only.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-800">
          contractor_outcomes remains the revenue source of truth. This action only writes through the admin routing service.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {requiresIdentity ? (
            <>
              <div className="space-y-1.5"><Label>Lead ID</Label><Input value={form.lead_id} onChange={(e) => setForm((f) => ({ ...f, lead_id: e.target.value }))} placeholder="UUID" /></div>
              <div className="space-y-1.5"><Label>Scan Session ID</Label><Input value={form.scan_session_id} onChange={(e) => setForm((f) => ({ ...f, scan_session_id: e.target.value }))} placeholder="UUID" /></div>
              <div className="space-y-1.5"><Label>Analysis ID</Label><Input value={form.analysis_id} onChange={(e) => setForm((f) => ({ ...f, analysis_id: e.target.value }))} placeholder="UUID" /></div>
            </>
          ) : null}

          {requiresTarget ? (
            <>
              <div className="space-y-1.5">
                <Label>Client Slug</Label>
                <Input value={form.client_slug} onChange={(e) => setForm((f) => ({ ...f, client_slug: e.target.value, contractor_account_id: "" }))} placeholder="client-slug" />
              </div>
              <div className="space-y-1.5">
                <Label>Syndicate</Label>
                <Select value={form.syndicate_id || "none"} onValueChange={(value) => setForm((f) => ({ ...f, syndicate_id: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No syndicate</SelectItem>
                    {references.syndicates.map((syndicate) => <SelectItem key={syndicate.id} value={syndicate.id}>{syndicate.name} / {syndicate.slug}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Contractor Account</Label>
                <Select value={form.contractor_account_id || "none"} onValueChange={(value) => setForm((f) => ({ ...f, contractor_account_id: value === "none" ? "" : value }))}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No contractor account</SelectItem>
                    {targetContractors.map((account) => <SelectItem key={account.id} value={account.id}>{account.display_name} / {account.client_slug}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          ) : null}

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Reason Code</Label>
            <Select value={form.reason_code || undefined} onValueChange={(value) => setForm((f) => ({ ...f, reason_code: value as LeadAssignmentReasonCode }))}>
              <SelectTrigger><SelectValue placeholder="Required" /></SelectTrigger>
              <SelectContent>
                {LEAD_ASSIGNMENT_REASON_CODES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Operator Note</Label>
            <Textarea value={form.operator_note} onChange={(e) => setForm((f) => ({ ...f, operator_note: e.target.value }))} maxLength={1000} placeholder="Optional internal note. Avoid raw homeowner PII." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={submit} disabled={isSaving} className="bg-slate-950 text-white hover:bg-slate-800">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record Action
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function LeadAssignmentBoard() {
  const [assignments, setAssignments] = useState<LeadAssignmentRow[]>([]);
  const [references, setReferences] = useState<LeadAssignmentReferenceData>({ syndicates: [], contractorAccounts: [] });
  const [detail, setDetail] = useState<LeadAssignmentDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [action, setAction] = useState<ActionState | null>(null);
  const [clientSlug, setClientSlug] = useState("");
  const [status, setStatus] = useState<LeadAssignmentStatus | "all">("all");
  const [currentOnly, setCurrentOnly] = useState(true);
  const [manualReviewOnly, setManualReviewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAssignments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [rows, referenceData] = await Promise.all([
        fetchLeadAssignments({ clientSlug, status, currentOnly, manualReviewOnly, search }),
        fetchLeadAssignmentReferenceData(),
      ]);
      setAssignments(rows);
      setReferences(referenceData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Assignment board could not load.");
    } finally {
      setIsLoading(false);
    }
  }, [clientSlug, currentOnly, manualReviewOnly, search, status]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  const kpis = useMemo(() => ({
    current: assignments.filter((a) => a.is_current).length,
    manualReview: assignments.filter((a) => a.status === "manual_review").length,
    recycled: assignments.filter((a) => a.status === "recycled").length,
    reassigned: assignments.filter((a) => a.status === "reassigned").length,
    stale: assignments.filter((a) => a.is_current && ["manual_review", "lost_dead", "disputed"].includes(a.status)).length,
    activeSyndicates: references.syndicates.length || "—",
    activeContractors: references.contractorAccounts.length || "—",
  }), [assignments, references]);

  async function openDetail(assignment: LeadAssignmentRow) {
    setDetailOpen(true);
    setDetail(null);
    try {
      setDetail(await fetchLeadAssignmentDetail(assignment.id));
    } catch (detailError) {
      toast.error(detailError instanceof Error ? detailError.message : "Assignment detail could not load.");
    }
  }

  async function refreshAfterAction() {
    await loadAssignments();
    if (detail?.assignment.id) {
      try {
        setDetail(await fetchLeadAssignmentDetail(detail.assignment.id));
      } catch {
        setDetail(null);
      }
    }
  }

  return (
    <section className="space-y-5 bg-slate-50 text-slate-950">
      <div className="rounded-lg border border-slate-300 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-slate-600">Phase 3D-B</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Lead Assignments</h2>
            <p className="mt-2 max-w-4xl text-sm font-semibold text-slate-700">
              Lead assignments control operational routing only. contractor_outcomes remains the revenue source of truth. No external dispatch occurs from this screen.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => void loadAssignments()} disabled={isLoading}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button className="bg-slate-950 text-white hover:bg-slate-800" onClick={() => setAction({ kind: "route", assignment: null })}>
              <Route className="h-4 w-4" /> Route Lead
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        <KpiCard label="Current" value={kpis.current} />
        <KpiCard label="Manual Review" value={kpis.manualReview} />
        <KpiCard label="Recycled" value={kpis.recycled} />
        <KpiCard label="Reassigned" value={kpis.reassigned} />
        <KpiCard label="Needs Attention" value={kpis.stale} />
        <KpiCard label="Active Syndicates" value={kpis.activeSyndicates} />
        <KpiCard label="Active Contractors" value={kpis.activeContractors} />
      </div>

      <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_140px_170px_1.3fr_auto] lg:items-end">
          <div className="space-y-1.5"><Label>Client Slug</Label><Input value={clientSlug} onChange={(e) => setClientSlug(e.target.value)} placeholder="all clients" /></div>
          <div className="space-y-1.5"><Label>Status</Label><Select value={status} onValueChange={(value) => setStatus(value as LeadAssignmentStatus | "all")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STATUS_OPTIONS.map((option) => <SelectItem key={option} value={option}>{option}</SelectItem>)}</SelectContent></Select></div>
          <Button variant={currentOnly ? "default" : "outline"} className={currentOnly ? "bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"} onClick={() => setCurrentOnly((v) => !v)}>Current Only</Button>
          <Button variant={manualReviewOnly ? "default" : "outline"} className={manualReviewOnly ? "bg-slate-950 text-white" : "border-slate-300 bg-white text-slate-950"} onClick={() => setManualReviewOnly((v) => !v)}>Manual Review</Button>
          <div className="space-y-1.5"><Label>Search UUID</Label><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="assignment, lead, session, analysis" /></div></div>
          <Button variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => { setClientSlug(""); setStatus("all"); setCurrentOnly(true); setManualReviewOnly(false); setSearch(""); }}>Clear</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
        {error ? (
          <div className="flex items-start gap-3 p-6 text-sm font-semibold text-slate-800"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" />{error}</div>
        ) : isLoading ? (
          <div className="flex items-center gap-3 p-6 text-sm font-semibold text-slate-700"><Loader2 className="h-5 w-5 animate-spin" />Loading lead assignments…</div>
        ) : assignments.length === 0 ? (
          <div className="p-8 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-base font-black text-slate-950">No assignments found</p><p className="mt-1 text-sm font-semibold text-slate-600">No assignments match the current filters.</p></div>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Created</TableHead><TableHead>Assignment</TableHead><TableHead>Lead</TableHead><TableHead>Session</TableHead><TableHead>Analysis</TableHead><TableHead>Client</TableHead><TableHead>Syndicate</TableHead><TableHead>Contractor</TableHead><TableHead>Status</TableHead><TableHead>Current</TableHead><TableHead>Reason</TableHead><TableHead>Assigned</TableHead><TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((assignment) => (
                <TableRow key={assignment.id} className="align-top">
                  <TableCell className="whitespace-nowrap font-semibold text-slate-700">{fmt(assignment.created_at)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{maskAssignmentId(assignment.id)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{maskAssignmentId(assignment.lead_id)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{maskAssignmentId(assignment.scan_session_id)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{maskAssignmentId(assignment.analysis_id)}</TableCell>
                  <TableCell className="font-bold text-slate-950">{assignment.client_slug}</TableCell>
                  <TableCell className="text-sm font-semibold text-slate-700">{assignment.syndicate?.slug ?? maskAssignmentId(assignment.syndicate_id)}</TableCell>
                  <TableCell className="text-sm font-semibold text-slate-700">{assignment.contractor_account?.display_name ?? maskAssignmentId(assignment.contractor_account_id)}</TableCell>
                  <TableCell><Badge className={statusTone(assignment.status)}>{assignment.status}</Badge></TableCell>
                  <TableCell className="font-bold text-slate-950">{boolLabel(assignment.is_current)}</TableCell>
                  <TableCell className="text-sm font-semibold text-slate-700">{assignment.reason_code}</TableCell>
                  <TableCell className="whitespace-nowrap font-semibold text-slate-700">{fmt(assignment.assigned_at)}</TableCell>
                  <TableCell>
                    <div className="flex min-w-[320px] flex-wrap gap-2">
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => void openDetail(assignment)}><Eye className="h-3.5 w-3.5" />Detail</Button>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => setAction({ kind: "reassign", assignment })}>Reassign</Button>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => setAction({ kind: "recycle", assignment })}><RotateCcw className="h-3.5 w-3.5" />Recycle</Button>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => setAction({ kind: "manual_review", assignment })}>Review</Button>
                      <Button size="sm" variant="outline" className="border-slate-300 bg-white text-slate-950" onClick={() => setAction({ kind: "operator_note", assignment })}><FileText className="h-3.5 w-3.5" />Note</Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AssignmentDetailDrawer detail={detail} open={detailOpen} onOpenChange={setDetailOpen} />
      <ActionDialog action={action} references={references} onClose={() => setAction(null)} onSuccess={() => void refreshAfterAction()} />
    </section>
  );
}
