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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            Workflow
          </p>
          <h3 className="font-display text-lg font-extrabold tracking-tight text-foreground mt-0.5">
            Stage
          </h3>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${def.badgeClass}`}
        >
          {def.label}
        </span>
      </div>

      <p className="text-sm text-muted-foreground mb-3">{def.description}</p>

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
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Saving…" />
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
              variant={active ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
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
