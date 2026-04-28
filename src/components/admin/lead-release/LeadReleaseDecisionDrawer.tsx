import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Hand, RotateCcw, ShieldAlert, ShieldQuestion } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { fetchLeadReleaseDetail, formatAllowedContactField, formatLeadReleaseStatus, submitLeadReleaseDecision, type AllowedContactField, type LeadReleaseDecisionAction, type LeadReleaseQueueItem } from "@/services/leadReleaseQueue";
import { LeadReleaseTimeline } from "@/components/admin/lead-release/LeadReleaseTimeline";

const DEFAULT_FIELDS: AllowedContactField[] = ["first_name", "phone", "email"];
const ALL_FIELDS: AllowedContactField[] = ["first_name", "last_name", "phone", "email", "city", "county"];

const DECISIONS: Array<{ action: LeadReleaseDecisionAction; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { action: "approve", label: "Approve", icon: CheckCircle2 },
  { action: "hold", label: "Hold", icon: Hand },
  { action: "block", label: "Block", icon: ShieldAlert },
  { action: "revoke", label: "Revoke", icon: RotateCcw },
  { action: "manual_review", label: "Manual Review", icon: ShieldQuestion },
];

export function LeadReleaseDecisionDrawer({ row, open, onOpenChange }: { row: LeadReleaseQueueItem | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [selectedFields, setSelectedFields] = useState<AllowedContactField[]>(DEFAULT_FIELDS);
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  const detailQuery = useQuery({
    queryKey: ["lead-release-detail", row?.assignmentId],
    queryFn: () => fetchLeadReleaseDetail(row!.assignmentId),
    enabled: open && Boolean(row?.assignmentId),
  });

  useEffect(() => {
    if (!open || !row) return;
    setSelectedFields(row.allowedContactFields.length ? row.allowedContactFields : DEFAULT_FIELDS);
    setReason("");
    setNotes("");
  }, [open, row]);

  const mutation = useMutation({
    mutationFn: submitLeadReleaseDecision,
    onSuccess: (result) => {
      if (result.ok) {
        toast.success(result.message);
        queryClient.invalidateQueries({ queryKey: ["lead-release-queue"] });
        queryClient.invalidateQueries({ queryKey: ["lead-release-detail", row?.assignmentId] });
      } else {
        toast.error(result.message);
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Lead release decision failed."),
  });

  const detail = detailQuery.data;
  const summary = detail ?? row;
  const reasonPlaceholder = useMemo(() => "Required reason for audit trail", []);

  function toggleField(field: AllowedContactField) {
    setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);
  }

  function submit(action: LeadReleaseDecisionAction) {
    if (!row) return;
    mutation.mutate({ assignmentId: row.assignmentId, decision: action, allowedContactFields: selectedFields, reason, notes });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="wm-slim-scrollbar w-[calc(100vw-1rem)] overflow-y-auto border-slate-300 bg-white p-5 text-slate-950 sm:max-w-3xl">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-xl font-black text-slate-950">Lead Release Decision</SheetTitle>
          <SheetDescription className="font-semibold text-slate-700">Release decisions expose limited contact fields only for the exact assignment and contractor account.</SheetDescription>
        </SheetHeader>

        {!summary ? null : (
          <div className="mt-6 space-y-5">
            <section className="rounded-lg border border-slate-300 bg-slate-50 p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><p className="text-xs font-black uppercase text-slate-500">Assignment</p><p className="font-mono text-sm font-bold">{summary.assignmentIdMasked}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Contractor</p><p className="text-sm font-extrabold">{summary.contractorDisplayName}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Client</p><p className="text-sm font-bold">{summary.clientSlug}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Release</p><p className="text-sm font-bold">{formatLeadReleaseStatus(summary.releaseStatus)}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">Project</p><p className="text-sm font-bold">{summary.projectType ?? "—"}</p></div>
                <div><p className="text-xs font-black uppercase text-slate-500">County</p><p className="text-sm font-bold">{summary.county ?? "—"}</p></div>
              </div>
              {detail?.safeProjectSummary ? <p className="mt-4 rounded-md border border-slate-300 bg-white p-3 text-sm font-semibold text-slate-700">{detail.safeProjectSummary}</p> : null}
              {summary.riskWarnings.length > 0 ? <div className="mt-3 flex flex-wrap gap-1">{summary.riskWarnings.map((warning) => <span key={warning} className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-950">{warning}</span>)}</div> : null}
            </section>

            <section className="rounded-lg border border-slate-300 bg-white p-4">
              <h3 className="text-base font-black text-slate-950">Allowed Contact Fields</h3>
              <p className="mt-1 text-sm font-semibold text-slate-600">Approve only fields needed for the pilot handoff. Quote files and report data are not part of release.</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {ALL_FIELDS.map((field) => (
                  <label key={field} className="flex items-center gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-sm font-bold text-slate-800">
                    <Checkbox checked={selectedFields.includes(field)} onCheckedChange={() => toggleField(field)} />
                    {formatAllowedContactField(field)}
                  </label>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-300 bg-white p-4">
              <h3 className="text-base font-black text-slate-950">Decision Reason</h3>
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={reasonPlaceholder} className="mt-3 border-slate-300 bg-white font-semibold text-slate-950" />
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional internal notes" className="mt-3 min-h-24 border-slate-300 bg-white font-semibold text-slate-950" />
              <div className="mt-4 grid gap-2 sm:grid-cols-5">
                {DECISIONS.map(({ action, label, icon: Icon }) => (
                  <Button key={action} type="button" variant={action === "approve" ? "default" : "outline"} disabled={mutation.isPending || !reason.trim()} onClick={() => submit(action)} className="gap-1">
                    <Icon className="h-4 w-4" aria-hidden />{label}
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-slate-300 bg-white p-4">
              <h3 className="text-base font-black text-slate-950">Release Timeline</h3>
              <div className="mt-3">{detailQuery.isLoading ? <p className="text-sm font-semibold text-slate-700">Loading timeline…</p> : <LeadReleaseTimeline events={detail?.timeline ?? []} />}</div>
            </section>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
