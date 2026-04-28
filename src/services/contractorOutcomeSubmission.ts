import { supabase } from "@/integrations/supabase/client";

export type ContractorOutcomeDispositionState =
  | "new"
  | "attempting_contact"
  | "contacted"
  | "meeting_scheduled"
  | "scheduled"
  | "quote_delivered"
  | "sold_closed"
  | "lost_dead";

export type ContractorOutcomeReasonCode =
  | "price_too_high"
  | "chose_competitor"
  | "no_longer_interested"
  | "unresponsive"
  | "project_canceled"
  | "out_of_service_area"
  | "other";

export type ContractorOutcomeValueBasis =
  | "contract_total"
  | "gross_sale_value"
  | "true_margin"
  | "estimated_contract_value";

export interface ContractorOutcomeSubmissionInput {
  leadAssignmentId: string;
  dispositionState: ContractorOutcomeDispositionState;
  dispositionReasonCode?: ContractorOutcomeReasonCode;
  projectedValueCents?: number;
  finalValueCents?: number;
  valueBasis?: ContractorOutcomeValueBasis;
  signedContractUrl?: string;
  notes?: string;
}

export interface ContractorOutcomeSubmissionResult {
  success: boolean;
  outcomeId: string | null;
  dispositionState: ContractorOutcomeDispositionState | null;
  outcomeIntegrityStatus: string | null;
  outcomeIntegrityReasons: string[];
  externalDispatch: false;
  dispatchCreated: false;
  message: string;
}

type EdgeResponse = {
  success?: boolean;
  outcome_id?: string;
  disposition_state?: ContractorOutcomeDispositionState;
  outcome_integrity_status?: string;
  outcome_integrity_reasons?: string[];
  external_dispatch?: boolean;
  dispatch_created?: boolean;
  message?: string;
  error?: string;
};

function dollarsToCents(value: number | undefined): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  return Math.round(value * 100);
}

export async function submitContractorOutcome(input: ContractorOutcomeSubmissionInput): Promise<ContractorOutcomeSubmissionResult> {
  const payload = {
    lead_assignment_id: input.leadAssignmentId,
    disposition_state: input.dispositionState,
    disposition_reason_code: input.dispositionReasonCode,
    projected_value_cents: input.projectedValueCents,
    final_value_cents: input.finalValueCents,
    value_basis: input.valueBasis,
    signed_contract_url: input.signedContractUrl,
    notes: input.notes,
  };

  const { data, error } = await supabase.functions.invoke<EdgeResponse>("contractor-submit-outcome", {
    body: payload,
  });

  if (error) {
    return {
      success: false,
      outcomeId: null,
      dispositionState: null,
      outcomeIntegrityStatus: null,
      outcomeIntegrityReasons: [],
      externalDispatch: false,
      dispatchCreated: false,
      message: error.message || "Outcome submission failed safely.",
    };
  }

  if (data?.external_dispatch === true || data?.dispatch_created === true) {
    return {
      success: false,
      outcomeId: null,
      dispositionState: null,
      outcomeIntegrityStatus: null,
      outcomeIntegrityReasons: [],
      externalDispatch: false,
      dispatchCreated: false,
      message: "Outcome response failed dispatch guardrails.",
    };
  }

  return {
    success: data?.success === true,
    outcomeId: data?.outcome_id ?? null,
    dispositionState: data?.disposition_state ?? null,
    outcomeIntegrityStatus: data?.outcome_integrity_status ?? null,
    outcomeIntegrityReasons: Array.isArray(data?.outcome_integrity_reasons) ? data.outcome_integrity_reasons : [],
    externalDispatch: false,
    dispatchCreated: false,
    message: data?.message ?? (data?.success ? "Outcome saved." : "Outcome submission failed safely."),
  };
}

export function outcomeDollarsToCents(value: number | undefined): number | undefined {
  return dollarsToCents(value);
}
