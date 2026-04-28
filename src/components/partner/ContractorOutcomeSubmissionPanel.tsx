import { FormEvent, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, FileCheck2, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  outcomeDollarsToCents,
  submitContractorOutcome,
  type ContractorOutcomeDispositionState,
  type ContractorOutcomeReasonCode,
  type ContractorOutcomeValueBasis,
} from "@/services/contractorOutcomeSubmission";
import type { ContractorLeadReleaseState } from "@/services/contractorLeadRelease";

const CONTACT_REQUIRED_STATES: ContractorOutcomeDispositionState[] = ["contacted", "meeting_scheduled", "scheduled", "quote_delivered", "sold_closed", "lost_dead"];
const OUTCOME_OPTIONS: Array<{ value: ContractorOutcomeDispositionState; label: string }> = [
  { value: "attempting_contact", label: "Attempting contact" },
  { value: "contacted", label: "Contacted" },
  { value: "meeting_scheduled", label: "Meeting scheduled" },
  { value: "quote_delivered", label: "Proposal delivered" },
  { value: "sold_closed", label: "Sold / closed" },
  { value: "lost_dead", label: "Lost" },
];
const REASON_OPTIONS: Array<{ value: ContractorOutcomeReasonCode; label: string }> = [
  { value: "price_too_high", label: "Price too high" },
  { value: "chose_competitor", label: "Chose competitor" },
  { value: "no_longer_interested", label: "No longer interested" },
  { value: "unresponsive", label: "Unresponsive" },
  { value: "project_canceled", label: "Project canceled" },
  { value: "out_of_service_area", label: "Out of service area" },
  { value: "other", label: "Other" },
];
const VALUE_BASIS_OPTIONS: Array<{ value: ContractorOutcomeValueBasis; label: string }> = [
  { value: "contract_total", label: "Contract total" },
  { value: "gross_sale_value", label: "Gross sale value" },
  { value: "true_margin", label: "True margin" },
  { value: "estimated_contract_value", label: "Estimated contract value" },
];

function requiresReleasedContact(state: ContractorOutcomeDispositionState): boolean {
  return CONTACT_REQUIRED_STATES.includes(state);
}

export function ContractorOutcomeSubmissionPanel({ assignmentId, contactRelease }: { assignmentId: string; contactRelease: ContractorLeadReleaseState }) {
  const { toast } = useToast();
  const [dispositionState, setDispositionState] = useState<ContractorOutcomeDispositionState>("attempting_contact");
  const [reasonCode, setReasonCode] = useState<ContractorOutcomeReasonCode | undefined>();
  const [valueBasis, setValueBasis] = useState<ContractorOutcomeValueBasis | undefined>();
  const [finalValue, setFinalValue] = useState("");
  const [projectedValue, setProjectedValue] = useState("");
  const [signedContractUrl, setSignedContractUrl] = useState("");
  const [notes, setNotes] = useState("");

  const blockedByRelease = requiresReleasedContact(dispositionState) && contactRelease.status !== "approved";
  const validationMessage = useMemo(() => {
    if (blockedByRelease) return "This outcome requires approved contact release.";
    if (dispositionState === "sold_closed") {
      const cents = outcomeDollarsToCents(Number(finalValue));
      if (!finalValue || cents == null || cents <= 0) return "Sold outcomes require a positive value.";
      if (!valueBasis) return "Sold outcomes require a value basis.";
    }
    if (dispositionState === "lost_dead" && (!reasonCode || notes.trim().length === 0)) return "Lost outcomes require a reason and notes.";
    return null;
  }, [blockedByRelease, dispositionState, finalValue, notes, reasonCode, valueBasis]);

  const mutation = useMutation({
    mutationFn: () => submitContractorOutcome({
      leadAssignmentId: assignmentId,
      dispositionState,
      dispositionReasonCode: dispositionState === "lost_dead" ? reasonCode : undefined,
      projectedValueCents: projectedValue ? outcomeDollarsToCents(Number(projectedValue)) : undefined,
      finalValueCents: dispositionState === "sold_closed" ? outcomeDollarsToCents(Number(finalValue)) : undefined,
      valueBasis: dispositionState === "sold_closed" ? valueBasis : undefined,
      signedContractUrl: signedContractUrl.trim() || undefined,
      notes: notes.trim() || undefined,
    }),
    onSuccess: (result) => {
      toast({
        title: result.success ? "Outcome saved" : "Outcome blocked",
        description: result.message,
        variant: result.success ? "default" : "destructive",
      });
    },
    onError: () => {
      toast({ title: "Outcome blocked", description: "Submission failed safely before any dispatch.", variant: "destructive" });
    },
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (validationMessage) {
      toast({ title: "Outcome blocked", description: validationMessage, variant: "destructive" });
      return;
    }
    mutation.mutate();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-start gap-3 rounded-md border border-slate-300 bg-slate-50 p-3 text-slate-800">
        <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-sm font-semibold leading-6">Outcome updates are saved through the secure contractor submission path. No external dispatch is created.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contractor-outcome-state">Outcome</Label>
        <Select value={dispositionState} onValueChange={(value) => setDispositionState(value as ContractorOutcomeDispositionState)}>
          <SelectTrigger id="contractor-outcome-state"><SelectValue /></SelectTrigger>
          <SelectContent>{OUTCOME_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {blockedByRelease ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-sm font-semibold leading-6">Approved contact release is required before submitting contacted, scheduled, proposal, sold, or lost outcomes.</p>
        </div>
      ) : null}

      {dispositionState === "sold_closed" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="contractor-outcome-final-value">Sold value</Label>
            <Input id="contractor-outcome-final-value" inputMode="decimal" value={finalValue} onChange={(event) => setFinalValue(event.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contractor-outcome-value-basis">Value basis</Label>
            <Select value={valueBasis} onValueChange={(value) => setValueBasis(value as ContractorOutcomeValueBasis)}>
              <SelectTrigger id="contractor-outcome-value-basis"><SelectValue placeholder="Select basis" /></SelectTrigger>
              <SelectContent>{VALUE_BASIS_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      ) : null}

      {dispositionState === "lost_dead" ? (
        <div className="space-y-2">
          <Label htmlFor="contractor-outcome-reason">Loss reason</Label>
          <Select value={reasonCode} onValueChange={(value) => setReasonCode(value as ContractorOutcomeReasonCode)}>
            <SelectTrigger id="contractor-outcome-reason"><SelectValue placeholder="Select reason" /></SelectTrigger>
            <SelectContent>{REASON_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="contractor-outcome-projected-value">Projected value</Label>
          <Input id="contractor-outcome-projected-value" inputMode="decimal" value={projectedValue} onChange={(event) => setProjectedValue(event.target.value)} placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contractor-outcome-contract-url">Contract URL</Label>
          <Input id="contractor-outcome-contract-url" value={signedContractUrl} onChange={(event) => setSignedContractUrl(event.target.value)} placeholder="https://" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="contractor-outcome-notes">Notes</Label>
        <Textarea id="contractor-outcome-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      {validationMessage ? (
        <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-sm font-semibold leading-6">{validationMessage}</p>
        </div>
      ) : null}

      {mutation.data?.success ? (
        <div className="flex items-start gap-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="text-sm font-semibold leading-6">Saved with dispatch disabled.</p>
        </div>
      ) : null}

      <Button type="submit" disabled={mutation.isPending || Boolean(validationMessage)} className="w-full sm:w-auto">
        {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        Save outcome
      </Button>
    </form>
  );
}
