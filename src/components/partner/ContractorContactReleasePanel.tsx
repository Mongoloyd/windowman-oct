import { AlertCircle, CheckCircle2, Clock, Lock, ShieldAlert } from "lucide-react";
import type { ContractorLeadReleaseState } from "@/services/contractorLeadRelease";
import { formatAllowedContactField, formatLeadReleaseStatus } from "@/services/leadReleaseQueue";

function IconForStatus({ status }: { status: ContractorLeadReleaseState["status"] }) {
  if (status === "approved") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />;
  if (status === "revoked" || status === "blocked") return <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-700" aria-hidden />;
  if (status === "held" || status === "manual_review") return <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />;
  return <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden />;
}

function fieldRows(state: ContractorLeadReleaseState): Array<{ label: string; value: string }> {
  const contact = state.contact;
  if (!contact) return [];
  return [
    state.allowedContactFields.includes("first_name") && contact.firstName ? { label: "First name", value: contact.firstName } : null,
    state.allowedContactFields.includes("last_name") && contact.lastName ? { label: "Last name", value: contact.lastName } : null,
    state.allowedContactFields.includes("phone") && contact.phone ? { label: "Phone", value: contact.phone } : null,
    state.allowedContactFields.includes("email") && contact.email ? { label: "Email", value: contact.email } : null,
    state.allowedContactFields.includes("city") && contact.city ? { label: "City", value: contact.city } : null,
    state.allowedContactFields.includes("county") && contact.county ? { label: "County", value: contact.county } : null,
  ].filter((row): row is { label: string; value: string } => Boolean(row));
}

export function ContractorContactReleasePanel({ state, isLoading = false, isError = false }: { state?: ContractorLeadReleaseState; isLoading?: boolean; isError?: boolean }) {
  if (isLoading) {
    return <div className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm font-semibold text-slate-700">Loading contact release state…</div>;
  }

  if (isError || !state) {
    return (
      <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <p className="text-sm font-semibold leading-6">Contact release state could not be loaded. Contact details remain hidden.</p>
      </div>
    );
  }

  const rows = fieldRows(state);

  if (state.status === "approved") {
    return (
      <div className="space-y-3 rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-950">
        <div className="flex items-start gap-3">
          <IconForStatus status={state.status} />
          <div>
            <p className="text-sm font-black uppercase tracking-wide">{formatLeadReleaseStatus(state.status)}</p>
            <p className="mt-1 text-sm font-semibold leading-6">{state.message}</p>
          </div>
        </div>
        {rows.length > 0 ? (
          <dl className="grid gap-2 sm:grid-cols-2">
            {rows.map((row) => (
              <div key={row.label} className="rounded-md border border-emerald-200 bg-white/80 p-2">
                <dt className="text-xs font-black uppercase text-emerald-900/70">{row.label}</dt>
                <dd className="mt-1 text-sm font-extrabold text-emerald-950">{row.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-md border border-emerald-200 bg-white/80 p-2 text-sm font-semibold">No contact fields are currently available for this approved release.</p>
        )}
        {state.allowedContactFields.length > 0 ? <p className="text-xs font-bold uppercase text-emerald-900/80">Allowed fields: {state.allowedContactFields.map(formatAllowedContactField).join(", ")}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
      <IconForStatus status={state.status} />
      <div>
        <p className="text-sm font-black uppercase tracking-wide">{formatLeadReleaseStatus(state.status)}</p>
        <p className="mt-1 text-sm font-semibold leading-6">{state.message}</p>
      </div>
    </div>
  );
}
