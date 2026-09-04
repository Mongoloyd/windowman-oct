/**
 * LeadStatusPanel — Sprint 5
 *
 * Lets an operator move a lead between canonical funnel stages.
 * Writes via admin-data → lead.funnel_stage and emits a
 * `funnel_stage_changed` lead_events row (server-side audit).
 */

import { Loader2, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { updateLeadFunnelStage, getErrorMessage } from "@/services/adminDataService";
import { FUNNEL_STAGES, getStageDef, type FunnelStage } from "../leadWorkflow";

interface LeadStatusPanelProps {
  leadId: string;
  currentStage: string | null;
}

export function LeadStatusPanel({ leadId, currentStage }: LeadStatusPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const initial = (currentStage ?? "new") as FunnelStage;
  const def = getStageDef(initial) ?? FUNNEL_STAGES[0];

  const mutation = useMutation({
    mutationFn: (stage: FunnelStage) => updateLeadFunnelStage(leadId, stage),
    onSuccess: (_data, stage) => {
      toast({ title: "Stage updated", description: `Lead moved to ${getStageDef(stage)?.label ?? stage}.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-events", leadId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
    },
    onError: (err) => {
      toast({
        title: "Couldn't update stage",
        description: getErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const handleChange = (next: string) => {
    if (next === initial || mutation.isPending) return;
    mutation.mutate(next as FunnelStage);
  };

  return (
    <section className="wm-lead-dossier-panel">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="wm-lead-dossier-kicker">
            Workflow
          </p>
          <h2 className="wm-lead-dossier-heading">
            Stage
          </h2>
        </div>
        <span
          className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold ${def.badgeClass}`}
        >
          {def.label}
        </span>
      </div>

      <p className="text-sm text-slate-700 mb-3">{def.description}</p>

      <div className="space-y-2">
        <Label htmlFor="lead-funnel-stage" className="text-sm font-semibold text-slate-800">
          Move lead to stage
        </Label>
        <div className="flex items-center gap-2">
          <Select value={initial} onValueChange={handleChange} disabled={mutation.isPending}>
            <SelectTrigger id="lead-funnel-stage" className="h-11 min-h-11">
              <SelectValue placeholder="Select stage" />
            </SelectTrigger>
            <SelectContent>
              {FUNNEL_STAGES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {mutation.isPending && (
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-slate-700" aria-label="Saving stage" />
          )}
        </div>
      </div>

      {mutation.isError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{getErrorMessage(mutation.error)}</span>
        </div>
      )}
    </section>
  );
}
