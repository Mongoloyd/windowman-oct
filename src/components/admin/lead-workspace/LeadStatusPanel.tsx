/**
 * LeadStatusPanel — Sprint 5
 *
 * Lets an operator move a lead between canonical funnel stages.
 * Writes via admin-data → lead.funnel_stage and emits a
 * `funnel_stage_changed` lead_events row (server-side audit).
 */

import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
  const [pending, setPending] = useState<FunnelStage | null>(null);

  const initial = (currentStage ?? "new") as FunnelStage;
  const def = getStageDef(initial) ?? FUNNEL_STAGES[0];

  const mutation = useMutation({
    mutationFn: (stage: FunnelStage) => updateLeadFunnelStage(leadId, stage),
    onSuccess: (_data, stage) => {
      toast({ title: "Stage updated", description: `Lead moved to ${getStageDef(stage)?.label ?? stage}.` });
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "lead-events", leadId] });
      queryClient.invalidateQueries({ queryKey: ["admin", "leads"] });
      setPending(null);
    },
    onError: (err) => {
      toast({
        title: "Couldn't update stage",
        description: getErrorMessage(err),
        variant: "destructive",
      });
      setPending(null);
    },
  });

  const handleChange = (next: string) => {
    if (next === initial) return;
    setPending(next as FunnelStage);
    mutation.mutate(next as FunnelStage);
  };

  const getStageButtonClass = (stage: FunnelStage, active: boolean) => {
    const base = "h-8 rounded-md border text-xs font-semibold transition-all duration-150";
    const activeDepth = "shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_2px_0_rgba(15,23,42,0.18)]";

    if (stage === "booked") {
      return `${base} ${active ? `border-emerald-700 bg-emerald-600 text-white ${activeDepth}` : "border-emerald-600/25 bg-emerald-600/10 text-emerald-700 hover:bg-emerald-600/15"}`;
    }

    if (stage === "routed" || stage === "contacted") {
      return `${base} ${active ? `border-orange-700 bg-orange-600 text-white ${activeDepth}` : "border-orange-500/25 bg-orange-500/10 text-orange-700 hover:bg-orange-500/15"}`;
    }

    if (stage === "closed" || stage === "stale" || stage === "ghost") {
      return `${base} ${active ? `border-slate-700 bg-slate-600 text-white ${activeDepth}` : "border-slate-300 bg-slate-200 text-slate-600 hover:bg-slate-300"}`;
    }

    return `${base} ${active ? `border-blue-700 bg-blue-600 text-white ${activeDepth}` : "border-blue-500/25 bg-blue-500/10 text-blue-700 hover:bg-blue-500/15"}`;
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-700">
            Workflow
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
            Stage
          </h3>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-sm font-bold uppercase tracking-wider ${def.badgeClass}`}
        >
          {def.label}
        </span>
      </div>

      <p className="text-sm text-slate-700 mb-3">{def.description}</p>

      <div className="flex items-center gap-2">
        <Select value={initial} onValueChange={handleChange} disabled={mutation.isPending}>
          <SelectTrigger className="h-10">
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
          <Loader2 className="h-4 w-4 animate-spin text-slate-700" aria-label="Saving…" />
        )}
      </div>

      {mutation.isError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{getErrorMessage(mutation.error)}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {FUNNEL_STAGES.map((s) => {
          const active = s.value === (pending ?? initial);
          return (
            <Button
              key={s.value}
              type="button"
              variant="ghost"
              size="sm"
              className={getStageButtonClass(s.value, active)}
              onClick={() => handleChange(s.value)}
              disabled={mutation.isPending || active}
            >
              {s.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
